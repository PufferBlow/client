import { describe, expect, it } from "vitest";
import { calledUrl, jsonResponse, mockFetch, signIn } from "../../test/helpers";
import { deleteMessage, editMessage, loadMessages, PAGE_SIZE, sendMessage, setReaction } from "./api";
import { flattenMessages, patchMessage, removeMessage, setReactions, upsertMessage, type MessageCache } from "./cache";
import { isWireMessage, normalizeMessage, normalizeReactions, type WireMessage } from "./normalize";
import type { Message } from "./types";

const wire = (id: string, overrides: Partial<WireMessage> = {}): WireMessage => ({
  message_id: id,
  channel_id: "c1",
  sender_user_id: "u1",
  username: "ada",
  message: `text ${id}`,
  sent_at: `2030-01-01T00:00:0${id.length}Z`,
  ...overrides,
});

const message = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
  channelId: "c1",
  authorId: "u1",
  authorName: "ada",
  authorAvatarUrl: null,
  text: `text ${id}`,
  sentAt: `2030-01-01T00:00:00Z|${id}`,
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

describe("normalizeMessage", () => {
  it("reads the live broadcast shape", () => {
    expect(normalizeMessage(wire("m1", { sender_avatar_url: "/storage/abc" }))).toMatchObject({
      id: "m1",
      channelId: "c1",
      authorId: "u1",
      authorName: "ada",
      authorAvatarUrl: "/storage/abc",
      text: "text m1",
    });
  });

  it("reads the hydrated history shape (sender_username, empty sender_id)", () => {
    const m = normalizeMessage({ message_id: "m2", sender_id: "", sender_user_id: "u9", sender_username: "grace", message: "hi", sent_at: "t" }, "fallback-channel");
    expect(m).toMatchObject({ authorId: "u9", authorName: "grace", channelId: "fallback-channel" });
  });

  it("prefers sender_user_id over a blank sender_id, and falls back to sender_id", () => {
    expect(normalizeMessage({ message_id: "m", sender_id: "", sender_user_id: "u1", sent_at: "t" }).authorId).toBe("u1");
    expect(normalizeMessage({ message_id: "m", sender_id: "legacy", sent_at: "t" }).authorId).toBe("legacy");
  });

  it("fills defaults for missing optional fields", () => {
    expect(normalizeMessage({ message_id: "m", sent_at: "t" })).toMatchObject({
      authorName: "Unknown user",
      text: "",
      attachments: [],
      reactions: [],
      editCount: 0,
      editedAt: null,
    });
  });

  it("carries edit state and reactions", () => {
    const m = normalizeMessage(wire("m", { edit_count: 2, last_edited_at: "later", reactions: [{ emoji: "👍", count: 2, user_ids: ["a", "b"] }] }));
    expect(m).toMatchObject({ editCount: 2, editedAt: "later", reactions: [{ emoji: "👍", count: 2, userIds: ["a", "b"] }] });
  });
});

describe("forwarded messages", () => {
  it("are flagged, and the original's id is not kept", () => {
    const forwarded = normalizeMessage(wire("m1", { forwarded_from_message_id: "orig-9" }));
    expect(forwarded.forwarded).toBe(true);
    expect(JSON.stringify(forwarded)).not.toContain("orig-9");
  });

  it("are not flagged when nothing was forwarded", () => {
    expect(normalizeMessage(wire("m1"))).not.toHaveProperty("forwarded");
    expect(normalizeMessage(wire("m1", { forwarded_from_message_id: null }))).not.toHaveProperty("forwarded");
  });
});

describe("normalizeReactions", () => {
  it("derives the count from user ids when absent", () => {
    expect(normalizeReactions([{ emoji: "🎉", user_ids: ["a", "b", "c"] }])).toEqual([{ emoji: "🎉", count: 3, userIds: ["a", "b", "c"] }]);
  });

  it("handles null", () => {
    expect(normalizeReactions(null)).toEqual([]);
  });
});

describe("isWireMessage", () => {
  it("accepts untyped message pushes", () => {
    expect(isWireMessage({ message_id: "m", sent_at: "t" })).toBe(true);
  });

  it("rejects typed events, and anything malformed", () => {
    expect(isWireMessage({ type: "message_edited", message_id: "m", sent_at: "t" })).toBe(false);
    expect(isWireMessage({ message_id: "m" })).toBe(false);
    expect(isWireMessage(null)).toBe(false);
    expect(isWireMessage("str")).toBe(false);
  });
});

describe("message cache", () => {
  const cache = (): MessageCache => ({
    pageParams: [null, "cursor"],
    pages: [
      { messages: [message("m3"), message("m4")], nextCursor: "cursor" }, // newest page
      { messages: [message("m1"), message("m2")], nextCursor: null },
    ],
  });

  it("flattens oldest to newest", () => {
    expect(flattenMessages(cache()).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(flattenMessages(undefined)).toEqual([]);
  });

  it("appends a new message to the newest page", () => {
    const next = upsertMessage(cache(), message("m5"))!;
    expect(next.pages[0]!.messages.map((m) => m.id)).toEqual(["m3", "m4", "m5"]);
    expect(next.pages[1]!.messages).toHaveLength(2);
  });

  it("is idempotent: a repeated push updates in place", () => {
    const once = upsertMessage(cache(), message("m4", { text: "changed" }))!;
    expect(flattenMessages(once).filter((m) => m.id === "m4")).toHaveLength(1);
    expect(flattenMessages(once).find((m) => m.id === "m4")!.text).toBe("changed");
  });

  it("keeps cached reactions when the repeated push carries none", () => {
    const reacted = patchMessage(cache(), "m4", { reactions: [{ emoji: "👍", count: 1, userIds: ["a"] }] });
    const merged = upsertMessage(reacted, message("m4"))!;
    expect(flattenMessages(merged).find((m) => m.id === "m4")!.reactions).toHaveLength(1);
  });

  it("leaves an uncached channel alone", () => {
    expect(upsertMessage(undefined, message("m1"))).toBeUndefined();
  });

  it("patches, replaces reactions on, and removes by id", () => {
    expect(flattenMessages(patchMessage(cache(), "m2", { text: "edited" })).find((m) => m.id === "m2")!.text).toBe("edited");
    expect(flattenMessages(setReactions(cache(), "m1", [{ emoji: "❤️", count: 1, userIds: ["x"] }])).find((m) => m.id === "m1")!.reactions).toHaveLength(1);
    expect(flattenMessages(removeMessage(cache(), "m3")).map((m) => m.id)).toEqual(["m1", "m2", "m4"]);
  });

  it("does not mutate the input cache", () => {
    const original = cache();
    upsertMessage(original, message("m9"));
    removeMessage(original, "m1");
    expect(flattenMessages(original)).toHaveLength(4);
  });
});

describe("loadMessages", () => {
  it("requests page 1 first and returns oldest-first with a derived cursor when the page is full", async () => {
    signIn("tok");
    const full = Array.from({ length: PAGE_SIZE }, (_, i) => wire(`m${i}`, { sent_at: `2030-01-01T00:00:${String(i).padStart(2, "0")}Z` }));
    const fetchMock = mockFetch(jsonResponse({ messages: full, next_cursor: null }));

    const page = await loadMessages("c1", null);

    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/channels/c1/load_messages");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("messages_per_page")).toBe(String(PAGE_SIZE));
    expect(url.searchParams.get("auth_token")).toBe("tok");
    expect(page.messages[0]!.id).toBe("m0");
    expect(page.nextCursor).toBe("2030-01-01T00:00:00Z|m0");
  });

  it("ends history when the first page is not full", async () => {
    signIn();
    mockFetch(jsonResponse({ messages: [wire("m1"), wire("m2")], next_cursor: null }));
    expect((await loadMessages("c1", null)).nextCursor).toBeNull();
  });

  it("handles an empty channel", async () => {
    signIn();
    mockFetch(jsonResponse({ messages: [], next_cursor: null }));
    await expect(loadMessages("c1", null)).resolves.toEqual({ messages: [], nextCursor: null });
  });

  it("pages older messages with before_cursor and reverses the newest-first response", async () => {
    signIn();
    const fetchMock = mockFetch(jsonResponse({ messages: [wire("m3"), wire("m2"), wire("m1")], next_cursor: "next|m1" }));

    const page = await loadMessages("c1", "cur|m4");

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get("before_cursor")).toBe("cur|m4");
    expect(url.searchParams.has("page")).toBe(false);
    expect(page.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(page.nextCursor).toBe("next|m1");
  });

  it("encodes the channel id into the path", async () => {
    signIn();
    const fetchMock = mockFetch(jsonResponse({ messages: [], next_cursor: null }));
    await loadMessages("a/b c", null);
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/channels/a%2Fb%20c/load_messages");
  });
});

describe("sendMessage", () => {
  it("posts multipart with auth_token in the form (not the query)", async () => {
    signIn("tok");
    const fetchMock = mockFetch(jsonResponse({ message_data: wire("new", { message: "hello" }) }));
    const file = new File(["x"], "pic.png", { type: "image/png" });

    const sent = await sendMessage("c1", { text: "hello", files: [file] });

    const [, init] = fetchMock.mock.calls[0]!;
    const form = init!.body as FormData;
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/channels/c1/send_message");
    expect(calledUrl(fetchMock).searchParams.has("auth_token")).toBe(false);
    expect(form.get("auth_token")).toBe("tok");
    expect(form.get("message")).toBe("hello");
    expect((form.getAll("attachments")[0] as File).name).toBe("pic.png");
    expect(sent).toMatchObject({ id: "new", text: "hello", channelId: "c1" });
  });

  it("works without attachments", async () => {
    signIn();
    const fetchMock = mockFetch(jsonResponse({ message_data: wire("m") }));
    await sendMessage("c1", { text: "x" });
    expect((fetchMock.mock.calls[0]![1]!.body as FormData).getAll("attachments")).toHaveLength(0);
  });
});

describe("edit, delete and react", () => {
  it("edits with a PATCH carrying the token in the JSON body", async () => {
    signIn("tok");
    const fetchMock = mockFetch(jsonResponse({ message: "new text", edit_count: 1, last_edited_at: "now" }));

    await expect(editMessage("c1", "m1", "new text")).resolves.toEqual({ message: "new text", editCount: 1, editedAt: "now" });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init!.method).toBe("PATCH");
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/channels/c1/messages/m1");
    expect(JSON.parse(String(init!.body))).toEqual({ message: "new text", auth_token: "tok" });
  });

  it("deletes with the message id and token in the query", async () => {
    signIn("tok");
    const fetchMock = mockFetch(jsonResponse({ status_code: 204 }));
    await deleteMessage("c1", "m1");

    const url = calledUrl(fetchMock);
    expect(fetchMock.mock.calls[0]![1]!.method).toBe("DELETE");
    expect(url.pathname).toBe("/api/v1/channels/c1/delete_message");
    expect(url.searchParams.get("message_id")).toBe("m1");
    expect(url.searchParams.get("auth_token")).toBe("tok");
  });

  it("adds a reaction with POST and removes it with DELETE, returning the full list", async () => {
    signIn();
    const fetchMock = mockFetch(
      jsonResponse({ reactions: [{ emoji: "👍", count: 1, user_ids: ["u1"] }] }),
      jsonResponse({ reactions: [] }),
    );

    await expect(setReaction("c1", "m1", "👍", true)).resolves.toEqual([{ emoji: "👍", count: 1, userIds: ["u1"] }]);
    await expect(setReaction("c1", "m1", "👍", false)).resolves.toEqual([]);

    expect(fetchMock.mock.calls.map(([, init]) => init!.method)).toEqual(["POST", "DELETE"]);
    expect(calledUrl(fetchMock).searchParams.get("emoji")).toBe("👍");
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/channels/c1/messages/m1/reactions");
  });

  it("fails fast when signed out", async () => {
    mockFetch();
    await expect(deleteMessage("c1", "m1")).rejects.toMatchObject({ code: "auth.token_required" });
  });
});
