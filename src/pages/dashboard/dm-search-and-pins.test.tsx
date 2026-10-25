import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { DirectMessageView } from "./DirectMessageView";

beforeEach(() => {
  signIn("tok");
  Element.prototype.scrollIntoView = () => undefined;
});

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x" };
const conversation = { conversation_id: "conv1", peer_user_id: "u2", peer_username: "grace", peer_origin_server: "x", last_message_at: "2030-01-01T12:00:00Z", last_message_preview: "see you there", last_message_sender_is_me: false };
const wire = (id: string, text: string) => ({ message_id: id, conversation_id: "conv1", sender_user_id: "u2", username: "grace", message: text, sent_at: "2030-01-01T12:00:00Z" });
const pinned = (id: string, text: string) => ({ ...wire(id, text), pinned_by: "u2", pinned_at: "2030-01-02T09:00:00Z" });

const backend = (pins: unknown[] = [], extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [me] },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
    "GET /api/v1/dms/conversations": { conversations: [conversation] },
    "GET /api/v1/dms/messages": { conversation_id: "conv1", messages: [wire("m1", "the picnic is at noon"), wire("m2", "bring lemonade")] },
    "GET /api/v1/dms/conversations/conv1/pins": { pins, limit: 50 },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    ...extra,
  });

const open = async () => {
  const user = userEvent.setup();
  renderWithProviders(<DirectMessageView />, { route: "/dashboard/dms/conv1?peer=grace", path: "/dashboard/dms/:conversationId" });
  await screen.findByText("bring lemonade");
  return user;
};

const requests = (fetchMock: ReturnType<typeof routeFetch>) => fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`);

describe("search in a direct message", () => {
  it("has a search field for the conversation in the header", async () => {
    backend();
    await open();
    const header = screen.getByRole("heading", { level: 1, name: "grace" }).closest("header")!;
    expect(within(header).getByRole("searchbox", { name: "Search @grace" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /^Pinned messages/ })).toBeInTheDocument();
  });

  it("searches the conversation, not a channel, and lists the matches", async () => {
    const fetchMock = backend([], { "GET /api/v1/dms/conversations/conv1/search": { messages: [wire("m2", "bring lemonade")], scanned: 2, truncated_scan: false } });
    const user = await open();

    await user.type(screen.getByRole("searchbox", { name: "Search @grace" }), "lemon");

    const results = within(await screen.findByRole("region", { name: "Search results" }));
    expect(await results.findByText("lemon")).toBeInTheDocument(); // the matched part is highlighted
    expect(results.getAllByRole("button")).toHaveLength(1);
    const call = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname === "/api/v1/dms/conversations/conv1/search")!;
    expect(new URL(String(call[0])).searchParams.get("q")).toBe("lemon");
  });
});

describe("pinned messages in a direct message", () => {
  it("lists what is pinned, and says either of you can pin when nothing is", async () => {
    backend([pinned("m1", "the picnic is at noon")]);
    const user = await open();

    await user.click(screen.getByRole("button", { name: /^Pinned messages/ }));
    const list = within(await screen.findByRole("dialog", { name: "Pinned messages" }));
    expect(await list.findByText("the picnic is at noon")).toBeInTheDocument();
  });

  it("says so when nothing is pinned", async () => {
    backend([]);
    const user = await open();
    await user.click(screen.getByRole("button", { name: /^Pinned messages/ }));
    expect(await screen.findByText("Nothing is pinned yet")).toBeInTheDocument();
    expect(screen.getByText("Either of you can pin a message from its menu.")).toBeInTheDocument();
  });

  it("offers Pin in a message's menu to anyone in the conversation, and sends it to the conversation's route", async () => {
    const fetchMock = backend([], { "PUT /api/v1/dms/conversations/conv1/messages/m1/pin": { pinned: true, already: false } });
    const user = await open();

    fireEvent.contextMenu(screen.getByText("the picnic is at noon"));
    await user.click(await screen.findByRole("menuitem", { name: "Pin message" }));

    await waitFor(() => expect(requests(fetchMock)).toContain("PUT /api/v1/dms/conversations/conv1/messages/m1/pin"));
    expect(await screen.findByText("Message pinned.")).toBeInTheDocument();
  });

  it("offers Unpin for a pinned message, and either person can use it from the list", async () => {
    const fetchMock = backend([pinned("m2", "bring lemonade")], { "DELETE /api/v1/dms/conversations/conv1/messages/m2/pin": { pinned: false, removed: true } });
    const user = await open();
    await waitFor(() => expect(requests(fetchMock)).toContain("GET /api/v1/dms/conversations/conv1/pins"));

    await user.click(screen.getByRole("button", { name: /^Pinned messages/ }));
    const list = within(await screen.findByRole("dialog", { name: "Pinned messages" }));
    await user.click(await list.findByRole("button", { name: "Unpin the message from grace" }));

    await waitFor(() => expect(requests(fetchMock)).toContain("DELETE /api/v1/dms/conversations/conv1/messages/m2/pin"));
  });

  it("shows the server's reason when a pin is refused", async () => {
    backend([], { "PUT /api/v1/dms/conversations/conv1/messages/m1/pin": jsonResponse({ detail: "A conversation can have at most 50 pins. Unpin one first." }, 409) });
    const user = await open();
    fireEvent.contextMenu(screen.getByText("the picnic is at noon"));
    await user.click(await screen.findByRole("menuitem", { name: "Pin message" }));
    expect(await screen.findByText(/at most 50 pins/)).toBeInTheDocument();
  });
});

describe("call lines in a direct message", () => {
  const callEntry = (outcome: string, extra: Record<string, unknown> = {}) => ({
    url: "call:c1",
    type: "call",
    call: { call_id: "c1", caller_id: "u2", callee_id: "me", caller_name: "grace", callee_name: "ada", outcome, duration_seconds: 0, ...extra },
  });

  it("draws a missed call and a finished one as what happened, with how long it lasted", async () => {
    routeFetch({
      "POST /api/v1/users/profile": { user_data: me },
      "GET /api/v1/users/list": { users: [me] },
      "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
      "GET /api/v1/dms/conversations": { conversations: [conversation] },
      "GET /api/v1/dms/messages": {
        conversation_id: "conv1",
        messages: [
          wire("m1", "call me later"),
          { ...wire("m2", ""), attachments: [callEntry("missed")] },
          { ...wire("m3", ""), message_id: "m3", attachments: [callEntry("completed", { call_id: "c2", duration_seconds: 4350 })] },
        ],
      },
      "GET /api/v1/dms/conversations/conv1/pins": { pins: [], limit: 50 },
      "GET /api/v1/channels/read-history": { unread_counts: {} },
    });
    renderWithProviders(<DirectMessageView />, { route: "/dashboard/dms/conv1?peer=grace", path: "/dashboard/dms/:conversationId" });

    expect(await screen.findByText("Missed call from grace")).toBeInTheDocument();
    expect(screen.getByText("grace called you")).toBeInTheDocument();
    expect(screen.getByText("Lasted 1 hr 12 min")).toBeInTheDocument();
    // They are notices, not messages: no toolbar of reactions, no name header.
    expect(document.querySelectorAll("[data-call-log]")).toHaveLength(2);
    expect(screen.getByText("call me later")).toBeInTheDocument();
  });
});
