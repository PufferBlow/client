import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ServerView } from "./ServerView";

beforeEach(() => {
  signIn("tok");
  localStorage.removeItem("pb_members_open");
  Element.prototype.scrollIntoView = () => undefined;
});

const mod = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x", roles_ids: ["moderator"], resolved_privileges: ["moderate_content"] };
const member = { ...mod, roles_ids: ["member"], resolved_privileges: [] };
const channels = [{ channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" }];
const wire = (id: string, text: string) => ({ message_id: id, channel_id: "c1", sender_user_id: "u2", username: "grace", message: text, sent_at: "2030-01-01T12:00:00Z" });
const pinned = (id: string, text: string) => ({ ...wire(id, text), pinned_by: "me", pinned_at: "2030-01-02T09:00:00Z" });

const backend = (me: unknown, pins: unknown[] = [], extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/categories": { categories: [] },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [me] },
    "GET /api/v1/channels/c1/load_messages": { messages: [wire("m1", "hello there"), wire("m2", "the rules")], next_cursor: null },
    "POST /api/v1/channels/c1/mark_all_read": { status_code: 200 },
    "GET /api/v1/channels/c1/pins": { pins, limit: 50 },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    ...extra,
  });

const open = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
  await screen.findByRole("heading", { name: "general" });
  return user;
};

const requests = (fetchMock: ReturnType<typeof routeFetch>) => fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`);

describe("pinned messages", () => {
  it("lists what is pinned when the pin button is opened", async () => {
    backend(member, [pinned("m2", "the rules")]);
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Pinned messages" }));

    const list = within(await screen.findByRole("dialog", { name: "Pinned messages" }));
    expect(await list.findByText("the rules")).toBeInTheDocument();
    expect(list.getByText("grace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pinned messages, 1" })).toBeInTheDocument();
  });

  it("does not ask for pins until someone looks, unless they can pin", async () => {
    const fetchMock = backend(member, []);
    await open();
    expect(requests(fetchMock)).not.toContain("GET /api/v1/channels/c1/pins");
  });

  it("says plainly that nothing is pinned", async () => {
    backend(member, []);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Pinned messages" }));
    expect(await screen.findByText("Nothing is pinned yet")).toBeInTheDocument();
  });

  it("says so when the instance does not know about pins", async () => {
    backend(member, [], { "GET /api/v1/channels/c1/pins": jsonResponse({ detail: "Not Found" }, 404) });
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Pinned messages" }));
    expect(await screen.findByText(/does not support pins yet/)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    backend(member, []);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Pinned messages" }));
    await screen.findByRole("dialog", { name: "Pinned messages" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Pinned messages" })).not.toBeInTheDocument();
  });

  it("offers Pin in a message's menu to a moderator, and sends it", async () => {
    const fetchMock = backend(mod, [], { "PUT /api/v1/channels/c1/messages/m1/pin": { pinned: true, already: false } });
    const user = await open();
    await screen.findByText("hello there");

    fireEvent.contextMenu(screen.getByText("hello there"));
    await user.click(await screen.findByRole("menuitem", { name: "Pin message" }));

    await waitFor(() => expect(requests(fetchMock)).toContain("PUT /api/v1/channels/c1/messages/m1/pin"));
    expect(await screen.findByText("Message pinned.")).toBeInTheDocument();
  });

  it("offers Unpin for a message that is pinned", async () => {
    const fetchMock = backend(mod, [pinned("m2", "the rules")], { "DELETE /api/v1/channels/c1/messages/m2/pin": { pinned: false, removed: true } });
    const user = await open();
    await screen.findByText("the rules");
    await waitFor(() => expect(requests(fetchMock)).toContain("GET /api/v1/channels/c1/pins"));

    fireEvent.contextMenu(screen.getByText("the rules"));
    await user.click(await screen.findByRole("menuitem", { name: "Unpin message" }));

    await waitFor(() => expect(requests(fetchMock)).toContain("DELETE /api/v1/channels/c1/messages/m2/pin"));
  });

  it("does not offer pinning to someone who may not", async () => {
    backend(member, []);
    await open();
    await screen.findByText("hello there");
    fireEvent.contextMenu(screen.getByText("hello there"));
    await screen.findByRole("menu", { name: "Message actions" });
    expect(screen.queryByRole("menuitem", { name: /Pin message/ })).not.toBeInTheDocument();
  });

  it("lets a moderator unpin from the list", async () => {
    const fetchMock = backend(mod, [pinned("m2", "the rules")], { "DELETE /api/v1/channels/c1/messages/m2/pin": { pinned: false, removed: true } });
    const user = await open();
    await user.click(screen.getByRole("button", { name: /Pinned messages/ }));
    await user.click(await screen.findByRole("button", { name: "Unpin the message from grace" }));
    await waitFor(() => expect(requests(fetchMock)).toContain("DELETE /api/v1/channels/c1/messages/m2/pin"));
  });

  it("shows no unpin button to anyone who may not unpin", async () => {
    backend(member, [pinned("m2", "the rules")]);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Pinned messages" }));
    const list = within(await screen.findByRole("dialog", { name: "Pinned messages" }));
    await list.findByText("the rules");
    expect(screen.queryByRole("button", { name: /Unpin the message/ })).not.toBeInTheDocument();
  });
});
