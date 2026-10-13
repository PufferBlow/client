import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { FriendsView } from "./FriendsView";
import { ServerView } from "./ServerView";

beforeEach(() => {
  signIn("tok");
  localStorage.removeItem("pb_members_open");
});

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "localhost:7575" };

const server = {
  server_info: { server_id: "localhost:7575", server_name: "Test Server", avatar_url: null, banner_url: null, members_count: 3, online_members: 1, max_message_length: 2000 },
};

const channels = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c2", channel_name: "random", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c3", channel_name: "secret", channel_type: "text", is_private: true, created_at: "t" },
  { channel_id: "v1", channel_name: "Lounge", channel_type: "voice", is_private: false, created_at: "t" },
  { channel_id: "x1", channel_name: "hybrid", channel_type: "mixed", is_private: false, created_at: "t" },
];

const msg = (id: string, text: string, overrides: Record<string, unknown> = {}) => ({
  message_id: id,
  channel_id: "c1",
  sender_user_id: "u2",
  sender_username: "grace",
  message: text,
  sent_at: `2030-01-01T10:00:0${id.slice(-1)}Z`,
  ...overrides,
});

const user = (id: string, name: string, status: string) => ({ ...me, user_id: id, username: name, status });

/** Backend routes shared by every ServerView test. */
const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/read-history": { unread_counts: { c2: 3 } },
    "GET /api/v1/system/server-info": server,
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [user("me", "ada", "online"), user("u2", "grace", "idle"), user("u3", "linus", "offline")] },
    "GET /api/v1/channels/c1/load_messages": { messages: [msg("m1", "first"), msg("m2", "second")], next_cursor: null },
    "POST /api/v1/channels/c1/mark_all_read": { status_code: 200 },
    ...extra,
  });

const renderServer = (route = "/dashboard/channels/c1") =>
  renderWithProviders(<ServerView />, { route, path: "/dashboard/channels/:channelId?" });

describe("ServerView", () => {
  it("lists text channels (including private and mixed) and voice channels separately", async () => {
    backend();
    renderServer();

    const nav = await screen.findByRole("navigation", { name: "Channels" });
    for (const name of ["general", "random", "secret", "hybrid"]) {
      expect(await within(nav).findByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(within(nav).getByText("Lounge")).toBeInTheDocument();
    // A voice channel is a join button, not a link to a chat view.
    expect(within(nav).queryByRole("link", { name: /Lounge/ })).not.toBeInTheDocument();
  });

  it("shows unread counts from the server", async () => {
    backend();
    renderServer();

    const random = await screen.findByRole("link", { name: /random/ });
    await waitFor(() => expect(random).toHaveTextContent("3"));
    expect(screen.getByRole("link", { name: /general/ })).not.toHaveTextContent(/\d/);
  });

  it("shows the server name and address in the sidebar", async () => {
    backend();
    renderServer();
    expect(await screen.findByRole("heading", { name: "Test Server" })).toBeInTheDocument();
    expect(screen.getAllByText("localhost:7575").length).toBeGreaterThan(0);
  });

  it("loads and renders the channel's messages", async () => {
    backend();
    renderServer();

    expect(await screen.findByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getAllByText("grace").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "general" })).toBeInTheDocument();
  });

  it("marks the channel read once its messages have loaded", async () => {
    const fetchMock = backend();
    renderServer();

    await screen.findByText("first");
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/channels/c1/mark_all_read"));
  });

  it("opens the first text channel when none is selected", async () => {
    const fetchMock = backend();
    renderServer("/dashboard/channels");

    expect(await screen.findByText("first")).toBeInTheDocument();
    expect(requestLog(fetchMock)).toContain("GET /api/v1/channels/c1/load_messages");
  });

  it("falls back to the first channel for a stale link", async () => {
    backend();
    renderServer("/dashboard/channels/does-not-exist");
    expect(await screen.findByText("first")).toBeInTheDocument();
  });

  it("does not open voice channels as chat", async () => {
    backend();
    renderServer("/dashboard/channels/v1");
    expect(await screen.findByText("first")).toBeInTheDocument(); // redirected to c1
  });

  it("sends a message and shows it once", async () => {
    const fetchMock = backend({
      "POST /api/v1/channels/c1/send_message": (_url: URL, init: RequestInit) => {
        const form = init.body as FormData;
        return jsonResponse({
          status_code: 201,
          message_data: { message_id: "m-new", channel_id: "c1", sender_user_id: "me", username: "ada", message: form.get("message"), sent_at: "2030-01-01T10:05:00Z" },
        });
      },
    });
    const { user: u } = renderServer();
    await screen.findByText("second");

    await u.type(screen.getByLabelText("Message #general"), "hello world{Enter}");

    expect(await screen.findByText("hello world")).toBeInTheDocument();
    expect(screen.getAllByText("hello world")).toHaveLength(1);
    expect(requestLog(fetchMock).filter((r) => r.includes("send_message"))).toHaveLength(1);
    expect(screen.getByLabelText("Message #general")).toHaveValue("");
  });

  it("shows why a message could not be sent", async () => {
    backend({
      "POST /api/v1/channels/c1/send_message": jsonResponse({ error_code: "auth.privilege_denied", message: "You cannot send messages here." }, 403),
    });
    const { user: u } = renderServer();
    await screen.findByText("second");

    await u.type(screen.getByLabelText("Message #general"), "nope{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot send messages here.");
  });

  it("lets you delete your own message", async () => {
    const fetchMock = backend({
      "GET /api/v1/channels/c1/load_messages": { messages: [msg("m1", "mine", { sender_user_id: "me", sender_username: "ada" })], next_cursor: null },
      "DELETE /api/v1/channels/c1/delete_message": { status_code: 204 },
    });
    const { user: u } = renderServer();
    await screen.findByText("mine");

    // Delete is only in the message menu (not the hover toolbar), and it asks first.
    await u.click(await screen.findByRole("button", { name: "More actions" }));
    await u.click(await screen.findByRole("menuitem", { name: "Delete message" }));
    expect(requestLog(fetchMock)).not.toContain("DELETE /api/v1/channels/c1/delete_message");
    await u.click(within(await screen.findByText("Delete message?").then((h) => h.parentElement!.parentElement!)).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("mine")).not.toBeInTheDocument());
    expect(requestLog(fetchMock)).toContain("DELETE /api/v1/channels/c1/delete_message");
  });

  it("says so when a channel is empty", async () => {
    backend({ "GET /api/v1/channels/c1/load_messages": { messages: [], next_cursor: null } });
    renderServer();
    expect(await screen.findByText(/no messages in #general yet/i)).toBeInTheDocument();
  });

  it("offers older messages when a full page comes back, and loads them with a cursor", async () => {
    const page = Array.from({ length: 30 }, (_, i) => msg(`m${100 + i}`, `msg ${i}`, { sent_at: `2030-01-01T10:00:${String(i).padStart(2, "0")}Z` }));
    const fetchMock = backend({
      "GET /api/v1/channels/c1/load_messages": (url: URL) =>
        url.searchParams.has("before_cursor")
          ? jsonResponse({ messages: [msg("m50", "an older one", { sent_at: "2029-12-31T00:00:00Z" })], next_cursor: null })
          : jsonResponse({ messages: page, next_cursor: null }),
    });
    const { user: u } = renderServer();

    await u.click(await screen.findByRole("button", { name: /load older messages/i }));

    expect(await screen.findByText("an older one")).toBeInTheDocument();
    const older = fetchMock.mock.calls.map(([input]) => new URL(String(input))).find((url) => url.searchParams.has("before_cursor"))!;
    expect(older.searchParams.get("before_cursor")).toBe("2030-01-01T10:00:00Z|m100");
    await waitFor(() => expect(screen.queryByRole("button", { name: /load older messages/i })).not.toBeInTheDocument());
  });

  it("doesn't offer older messages for a short first page", async () => {
    backend();
    renderServer();
    await screen.findByText("first");
    expect(screen.queryByRole("button", { name: /load older messages/i })).not.toBeInTheDocument();
  });

  it("groups members by presence and sorts them by name", async () => {
    localStorage.setItem("pb_members_open", "1"); // the panel is closed by default on a window this narrow
    backend();
    renderServer();

    const members = await screen.findByRole("complementary", { name: "Members" });
    expect(await within(members).findByRole("heading", { name: /Online — 2/ })).toBeInTheDocument();
    expect(within(members).getByRole("heading", { name: /Offline — 1/ })).toBeInTheDocument();
    const names = within(members).getAllByText(/^(ada|grace|linus)$/).map((el) => el.textContent);
    expect(names).toEqual(["ada", "grace", "linus"]);
  });

  it("shows an error with retry when channels fail to load", async () => {
    let fail = true;
    routeFetch({
      "POST /api/v1/channels/list/": () => (fail ? jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500) : jsonResponse({ channels })),
      "GET /api/v1/channels/read-history": { unread_counts: {} },
      "GET /api/v1/system/server-info": server,
      "POST /api/v1/users/profile": { user_data: me },
      "GET /api/v1/users/list": { users: [] },
      "GET /api/v1/channels/c1/load_messages": { messages: [msg("m1", "first")], next_cursor: null },
      "POST /api/v1/channels/c1/mark_all_read": {},
    });
    const { user: u } = renderServer();

    expect(await screen.findByText("Couldn't load channels")).toBeInTheDocument();
    fail = false;
    await u.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("first")).toBeInTheDocument();
  });

  it("explains when there are no text channels", async () => {
    backend({ "POST /api/v1/channels/list/": { channels: [channels[3]] } });
    renderServer();
    expect(await screen.findByText("No text channels yet")).toBeInTheDocument();
  });
});

const friend = (id: string, name: string, status: string, host = "") => ({
  friendship_id: `f-${id}`,
  other_user_id: id,
  other_username: name,
  other_origin_server: host,
  other_avatar_url: null,
  other_status: status,
});

const friendsBackend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/friends": { friends: [friend("u1", "grace", "online"), friend("u2", "linus", "offline", "kiln.social"), friend("u3", "ken", "dnd")] },
    "GET /api/v1/friends/requests": { incoming: [friend("u4", "ada2", "online")], outgoing: [friend("u5", "bob", "offline")] },
    "GET /api/v1/friends/blocks": { blocks: [{ blocked_id: "u9", blocked_username: "troll", blocked_origin_server: "bad.example", blocked_avatar_url: null }] },
    ...extra,
  });

describe("FriendsView", () => {
  const renderFriends = () => renderWithProviders(<FriendsView />, { route: "/dashboard/friends" });
  const main = () => screen.getByRole("region", { name: "Friends" });

  it("shows only online friends on the Online tab, and everyone on All", async () => {
    friendsBackend();
    const { user: u } = renderFriends();

    await within(main()).findByText("2 friends");
    expect(within(main()).getByText("grace")).toBeInTheDocument();
    expect(within(main()).getByText("ken")).toBeInTheDocument();
    expect(within(main()).queryByText("linus")).not.toBeInTheDocument();

    await u.click(screen.getByRole("tab", { name: /^All/ }));
    expect(await within(main()).findByText("linus")).toBeInTheDocument();
    expect(within(main()).getByText("@linus@kiln.social")).toBeInTheDocument();
    expect(within(main()).getByText("3 friends")).toBeInTheDocument();
  });

  it("badges the Pending tab with the incoming request count", async () => {
    friendsBackend();
    renderFriends();
    const tab = await screen.findByRole("tab", { name: /Pending/ });
    await waitFor(() => expect(tab).toHaveTextContent("1"));
  });

  it("accepts an incoming request and refreshes the lists", async () => {
    const fetchMock = friendsBackend({ "POST /api/v1/friends/requests/f-u4/accept": { status_code: 200 } });
    const { user: u } = renderFriends();

    await u.click(await screen.findByRole("tab", { name: /Pending/ }));
    await u.click(await screen.findByRole("button", { name: "Accept ada2" }));

    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/friends/requests/f-u4/accept"));
    // The accept invalidated the friends queries, so they were fetched again.
    await waitFor(() => expect(requestLog(fetchMock).filter((r) => r === "GET /api/v1/friends")).toHaveLength(2));
  });

  it("declines an incoming request and cancels an outgoing one with the same endpoint", async () => {
    const fetchMock = friendsBackend({
      "DELETE /api/v1/friends/requests/f-u4": { deleted: true },
      "DELETE /api/v1/friends/requests/f-u5": { deleted: true },
    });
    const { user: u } = renderFriends();

    await u.click(await screen.findByRole("tab", { name: /Pending/ }));
    await u.click(await screen.findByRole("button", { name: "Decline ada2" }));
    await u.click(await screen.findByRole("button", { name: "Cancel request to bob" }));

    await waitFor(() => {
      const log = requestLog(fetchMock);
      expect(log).toContain("DELETE /api/v1/friends/requests/f-u4");
      expect(log).toContain("DELETE /api/v1/friends/requests/f-u5");
    });
  });

  it("removes a friend by user id", async () => {
    const fetchMock = friendsBackend({ "DELETE /api/v1/friends/u1": { removed: true } });
    const { user: u } = renderFriends();

    await u.click(await screen.findByRole("button", { name: "Remove grace from friends" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/friends/u1"));
  });

  it("sends a friend request with a bare username", async () => {
    const fetchMock = friendsBackend({ "POST /api/v1/friends/requests": { status_code: 201 } });
    const { user: u } = renderFriends();

    await u.type(await screen.findByLabelText("Friend handle"), "newbie");
    await u.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Request sent to newbie.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input, init]) => String(input).includes("/friends/requests") && init?.method === "POST")!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ target_username: "newbie" });
    expect(new URL(String(call[0])).searchParams.get("auth_token")).toBe("tok");
    expect(screen.getByLabelText("Friend handle")).toHaveValue("");
  });

  it("sends a request to a user on another instance", async () => {
    const fetchMock = friendsBackend({ "POST /api/v1/friends/requests": { status_code: 201 } });
    const { user: u } = renderFriends();

    await u.type(await screen.findByLabelText("Friend handle"), "@zed@kiln.social");
    await u.click(screen.getByRole("button", { name: "Send request" }));

    await screen.findByText(/Request sent/);
    const call = fetchMock.mock.calls.find(([input, init]) => String(input).includes("/friends/requests") && init?.method === "POST")!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ target_username: "zed", target_origin_server: "kiln.social" });
  });

  it("shows why a request failed", async () => {
    friendsBackend({ "POST /api/v1/friends/requests": jsonResponse({ error_code: "friends.not_found", message: "No such user.", user_message: "No such user." }, 404) });
    const { user: u } = renderFriends();

    await u.type(await screen.findByLabelText("Friend handle"), "ghost");
    await u.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No such user.");
    expect(screen.queryByText(/request sent/i)).not.toBeInTheDocument();
  });

  it("lists blocked users and unblocks them", async () => {
    const fetchMock = friendsBackend({ "DELETE /api/v1/friends/blocks/u9": { removed: true } });
    const { user: u } = renderFriends();

    await u.click(await screen.findByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("@troll@bad.example")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(requestLog(fetchMock)).toContain("DELETE /api/v1/friends/blocks/u9"));
  });

  it("shows friendly empty states", async () => {
    friendsBackend({
      "GET /api/v1/friends": { friends: [] },
      "GET /api/v1/friends/requests": { incoming: [], outgoing: [] },
      "GET /api/v1/friends/blocks": { blocks: [] },
    });
    const { user: u } = renderFriends();

    expect(await screen.findByText("Nobody is online right now.")).toBeInTheDocument();
    await u.click(screen.getByRole("tab", { name: /Pending/ }));
    expect(await screen.findByText("No pending requests.")).toBeInTheDocument();
    await u.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText(/haven.t blocked anyone/i)).toBeInTheDocument();
  });

  it("shows an error with retry when friends fail to load", async () => {
    friendsBackend({ "GET /api/v1/friends": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500) });
    renderFriends();
    expect(await screen.findByText("Couldn't load friends")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
