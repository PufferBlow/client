import { afterEach, describe, expect, it } from "vitest";
import type { Conversation } from "./api";
import { conversationFor, mergeOutgoing, readOutgoing, rememberOutgoing } from "./outgoing";

const server = (id: string, at: string): Conversation => ({
  id,
  peerUserId: `u-${id}`,
  peerUsername: id,
  peerHost: "home.example",
  peerAvatarUrl: null,
  peerStatus: "online",
  lastMessageAt: at,
  lastMessagePreview: "hi",
  lastMessageSenderIsMe: false,
});

afterEach(() => localStorage.clear());

describe("conversationFor", () => {
  it("reads a bare name as someone on this instance and name@host as someone elsewhere", () => {
    expect(conversationFor({ id: "c1", peer: "ann", myHost: "home.example", preview: "x" })).toMatchObject({ peerUsername: "ann", peerHost: "home.example" });
    expect(conversationFor({ id: "c2", peer: "bob@far.example", myHost: "home.example", preview: "x" })).toMatchObject({ peerUsername: "bob", peerHost: "far.example" });
  });
});

describe("conversations you started", () => {
  it("show up in the list even though the server does not list them yet", () => {
    rememberOutgoing("me", conversationFor({ id: "mine", peer: "ann", myHost: "home.example", preview: "hello" }));
    const merged = mergeOutgoing([server("old", "2020-01-01T00:00:00Z")], "me");

    expect(merged.map((c) => c.id)).toEqual(["mine", "old"]); // newest first
    expect(merged[0]).toMatchObject({ peerUsername: "ann", lastMessagePreview: "hello", lastMessageSenderIsMe: true });
  });

  it("are replaced by the server's own entry once it lists them", () => {
    rememberOutgoing("me", conversationFor({ id: "mine", peer: "ann", myHost: "home.example", preview: "hello" }));
    const merged = mergeOutgoing([server("mine", "2030-01-01T00:00:00Z")], "me");

    expect(merged).toHaveLength(1);
    expect(merged[0]?.peerUserId).toBe("u-mine");
    expect(readOutgoing("me")).toEqual([]); // and forgotten locally
  });

  it("belong to one account and never leak to another", () => {
    rememberOutgoing("me", conversationFor({ id: "mine", peer: "ann", myHost: "home.example", preview: "hello" }));
    expect(mergeOutgoing([], "someone-else")).toEqual([]);
    expect(mergeOutgoing([], undefined)).toEqual([]);
  });

  it("keep a single entry per conversation", () => {
    for (const preview of ["one", "two"]) rememberOutgoing("me", conversationFor({ id: "mine", peer: "ann", myHost: "h", preview }));
    expect(readOutgoing("me")).toHaveLength(1);
    expect(readOutgoing("me")[0]?.lastMessagePreview).toBe("two");
  });

  it("survive a corrupt store", () => {
    localStorage.setItem("pb_dm_outgoing:me", "{not json");
    expect(readOutgoing("me")).toEqual([]);
  });
});
