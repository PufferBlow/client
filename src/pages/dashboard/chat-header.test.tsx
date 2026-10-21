import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bearerOf, calledUrl, jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ServerView } from "./ServerView";

beforeEach(() => {
  signIn("tok");
  localStorage.removeItem("pb_members_open");
  Element.prototype.scrollIntoView = () => undefined;
});

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x" };
const channels = [{ channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" }];
const wire = (id: string, text: string, sentAt = "2030-01-01T12:00:00Z") => ({ message_id: id, channel_id: "c1", sender_user_id: "u2", username: "grace", message: text, sent_at: sentAt });

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [{ ...me, status: "online" }] },
    "GET /api/v1/channels/c1/load_messages": { messages: [wire("m1", "hello there"), wire("m2", "deploy tonight")], next_cursor: null },
    "POST /api/v1/channels/c1/mark_all_read": { status_code: 200 },
    ...extra,
  });

const open = async () => {
  const fetchMock = backend();
  const user = userEvent.setup();
  renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
  await screen.findByRole("heading", { name: "general" });
  return { user, fetchMock };
};

describe("chat header", () => {
  it("puts search and the member toggle at the far right", async () => {
    await open();
    const header = screen.getByRole("heading", { name: "general" }).closest("header")!;
    const group = within(header).getByRole("button", { name: /Show member list/ }).parentElement!;
    expect(group).toHaveClass("ml-auto");
    expect(within(group).getByRole("searchbox", { name: /Search #general/ })).toBeInTheDocument();
    expect(header.lastElementChild).toBe(group);
  });
});

describe("chat header: topic and mute", () => {
  it("shows the channel's topic when it has one, and nothing when it has none", async () => {
    backend({ "POST /api/v1/channels/list/": { channels: [{ ...channels[0], topic: "Patch talk and build sessions" }] } });
    renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
    expect(await screen.findByText("Patch talk and build sessions")).toBeInTheDocument();
  });

  it("has no topic line without a topic", async () => {
    await open();
    const header = screen.getByRole("heading", { name: "general" }).closest("header")!;
    expect(header.querySelector("p")).toBeNull();
  });

  it("mutes and unmutes the channel from the bell", async () => {
    const fetchMock = backend({
      "GET /api/v1/notifications/preferences": { preferences: [] },
      "PUT /api/v1/notifications/preferences/c1": { status_code: 200 },
    });
    const user = userEvent.setup();
    renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
    await screen.findByRole("heading", { name: "general" });

    await user.click(screen.getByRole("button", { name: "Mute channel" }));
    expect(await screen.findByRole("button", { name: "Unmute channel" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Unmute channel" }));
    expect(await screen.findByRole("button", { name: "Mute channel" })).toBeInTheDocument();
    const sent = fetchMock.mock.calls
      .filter(([input, init]) => init?.method === "PUT" && new URL(String(input)).pathname === "/api/v1/notifications/preferences/c1")
      .map(([, init]) => JSON.parse(String(init!.body)));
    expect(sent).toEqual([{ muted: true }, { muted: false }]);
  });
});

describe("member list toggle", () => {
  it("is closed by default on a narrow window and opens and closes from the header", async () => {
    const { user } = await open();
    expect(screen.queryByRole("complementary", { name: "Members" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show member list" }));
    expect(await screen.findByRole("complementary", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide member list" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Hide member list" }));
    expect(screen.queryByRole("complementary", { name: "Members" })).not.toBeInTheDocument();
  });

  it("remembers the choice", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "Show member list" }));
    expect(localStorage.getItem("pb_members_open")).toBe("1");
  });

  it("starts open when it was left open", async () => {
    localStorage.setItem("pb_members_open", "1");
    await open();
    expect(await screen.findByRole("complementary", { name: "Members" })).toBeInTheDocument();
  });
});

describe("channel search", () => {
  const searchRoute = (matches: unknown[], extra: Record<string, unknown> = {}) => ({
    "GET /api/v1/channels/c1/search": { status_code: 200, messages: matches, query: "deploy", scanned: 50, truncated_scan: false, ...extra },
  });

  async function openSearch(extra: Record<string, unknown> = {}) {
    const fetchMock = backend(extra);
    const user = userEvent.setup();
    renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
    await screen.findByRole("heading", { name: "general" });
    const field = screen.getByRole("searchbox", { name: /Search #general/ });
    await user.click(field);
    return { user, fetchMock, field };
  }

  it("is always there as a full field, and Escape empties it without removing it", async () => {
    const { user, field } = await openSearch();
    expect(field).toBeVisible();
    await user.type(field, "dep");
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(field).toHaveValue("");
    expect(screen.getByRole("searchbox", { name: /Search #general/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("puts the matches away when you click elsewhere but keeps what you typed", async () => {
    const { user, field } = await openSearch(searchRoute([wire("m2", "deploy tonight")]));
    await user.type(field, "deploy");
    expect(await screen.findByRole("region", { name: "Search results" })).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: "general" }));
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    expect(field).toHaveValue("deploy");

    await user.click(field);
    expect(await screen.findByRole("region", { name: "Search results" })).toBeInTheDocument();
  });

  it("asks for at least two characters before searching", async () => {
    const { user, field, fetchMock } = await openSearch(searchRoute([]));
    await user.type(field, "d");
    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/search"))).toBe(false);
  });

  it("searches the channel with the query and lists matches with the term highlighted", async () => {
    const { user, field, fetchMock } = await openSearch(searchRoute([wire("m2", "deploy tonight")]));
    await user.type(field, "deploy");

    const results = await screen.findByRole("region", { name: "Search results" });
    await waitFor(() => expect(within(results).getByText("deploy").tagName).toBe("MARK"));
    expect(within(results).getByText("grace")).toBeInTheDocument();
    const index = fetchMock.mock.calls.findIndex(([url]) => String(url).includes("/search"));
    expect(calledUrl(fetchMock, index).searchParams.get("q")).toBe("deploy");
    expect(bearerOf(fetchMock, index)).toBe("Bearer tok");
    expect(calledUrl(fetchMock, index).searchParams.has("auth_token")).toBe(false);
  });

  it("says when nothing matches", async () => {
    const { user, field } = await openSearch(searchRoute([]));
    await user.type(field, "zzz");
    expect(await screen.findByText(/No messages match/)).toBeInTheDocument();
  });

  it("says when only recent history was searched", async () => {
    const { user, field } = await openSearch(searchRoute([wire("m2", "deploy tonight")], { truncated_scan: true, scanned: 1000 }));
    await user.type(field, "deploy");
    expect(await screen.findByText(/most recent 1,000 messages/)).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    const { user, field } = await openSearch({ "GET /api/v1/channels/c1/search": () => jsonResponse({ detail: "`q` exceeds the 256-character maximum." }, 400) });
    await user.type(field, "deploy");
    expect(await screen.findByRole("alert")).toHaveTextContent(/maximum/);
  });

  it("jumps to a loaded message when a result is chosen, and clears the search", async () => {
    const { user, field } = await openSearch(searchRoute([wire("m2", "deploy tonight")]));
    await user.type(field, "deploy");
    const results = await screen.findByRole("region", { name: "Search results" });
    await user.click(await within(results).findByRole("button", { name: /grace/ }));

    expect(field).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    const row = document.querySelector<HTMLElement>('[data-message-id="m2"]')!;
    expect(row).toHaveClass("bg-primary/15");
  });

  it("explains when the match is older than what is loaded", async () => {
    const { user, field } = await openSearch(searchRoute([wire("old", "deploy last year", "2020-01-01T00:00:00Z")]));
    await user.type(field, "deploy");
    const results = await screen.findByRole("region", { name: "Search results" });
    await user.click(await within(results).findByRole("button", { name: /grace/ }));
    expect(await screen.findByText(/further back than what's loaded/)).toBeInTheDocument();
  });
});
