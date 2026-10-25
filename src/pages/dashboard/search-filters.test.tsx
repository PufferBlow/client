import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { DirectMessageView } from "./DirectMessageView";
import { ServerView } from "./ServerView";

beforeEach(() => {
  signIn("tok");
  localStorage.removeItem("pb_members_open");
  Element.prototype.scrollIntoView = () => undefined;
});

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x" };
const grace = { ...me, user_id: "u2", username: "grace" };
const channels = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c2", channel_name: "random", channel_type: "text", is_private: false, created_at: "t" },
];
const wire = (id: string, text: string, channel = "c1") => ({ message_id: id, channel_id: channel, sender_user_id: "u2", username: "grace", message: text, sent_at: "2030-01-01T12:00:00Z" });

const searchOf = (fetchMock: ReturnType<typeof routeFetch>, path: string) =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input))).filter((url) => url.pathname === path);

const channelBackend = () =>
  routeFetch({
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/categories": { categories: [] },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [me, grace] },
    "GET /api/v1/channels/c1/load_messages": { messages: [wire("m1", "hello there")], next_cursor: null },
    "POST /api/v1/channels/c1/mark_all_read": { status_code: 200 },
    "GET /api/v1/channels/c1/search": { messages: [wire("m1", "hello there")], scanned: 1, truncated_scan: false },
    "GET /api/v1/channels/c2/search": { messages: [wire("m9", "elsewhere", "c2")], scanned: 1, truncated_scan: false },
  });

const openChannel = async () => {
  const fetchMock = channelBackend();
  const user = userEvent.setup();
  renderWithProviders(<ServerView />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId?" });
  await screen.findByRole("heading", { name: "general" });
  await screen.findByText("hello there");
  return { user, fetchMock, field: screen.getByRole("searchbox", { name: "Search #general" }) as HTMLInputElement };
};

describe("search filters in a channel", () => {
  it("lists the filters when the field is focused, the way Discord does", async () => {
    const { user, field } = await openChannel();
    await user.click(field);

    const menu = within(await screen.findByRole("region", { name: "Search filters" }));
    expect(menu.getByText("From a specific user")).toBeInTheDocument();
    expect(menu.getByText("Sent in a specific channel")).toBeInTheDocument();
    expect(menu.getByText("Includes a specific type of data")).toBeInTheDocument();
    expect(menu.getByText("Mentions a specific user")).toBeInTheDocument();
    expect(menu.getByText("dates, author type, and more")).toBeInTheDocument();
  });

  it("starts a filter from the menu, suggests people for it, and searches by that person with no text", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.click(field);
    await user.click(within(await screen.findByRole("region", { name: "Search filters" })).getByRole("button", { name: /From a specific user/ }));
    expect(field).toHaveValue("from:");

    const suggestions = within(await screen.findByRole("region", { name: "Suggestions for from:" }));
    expect(suggestions.getByText("ada")).toBeInTheDocument();
    await user.click(suggestions.getByRole("button", { name: /grace/ }));
    expect(field).toHaveValue("from:grace ");

    await waitFor(() => expect(searchOf(fetchMock, "/api/v1/channels/c1/search").length).toBeGreaterThan(0));
    const asked = searchOf(fetchMock, "/api/v1/channels/c1/search").at(-1)!;
    expect(asked.searchParams.get("from_user_id")).toBe("u2");
    expect(asked.searchParams.has("q")).toBe(false);
    expect(await screen.findByRole("region", { name: "Search results" })).toBeInTheDocument();
  });

  it("narrows suggestions as the value is typed, and Enter takes the first", async () => {
    const { user, field } = await openChannel();
    await user.type(field, "mentions:gr");
    const suggestions = within(await screen.findByRole("region", { name: "Suggestions for mentions:" }));
    expect(suggestions.getByRole("button", { name: /grace/ })).toBeInTheDocument();
    expect(suggestions.queryByRole("button", { name: /ada/ })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(field).toHaveValue("mentions:grace ");
  });

  it("sends has: and the text together", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.type(field, "hello has:image");
    await waitFor(() => {
      const asked = searchOf(fetchMock, "/api/v1/channels/c1/search").at(-1);
      expect(asked?.searchParams.get("has")).toBe("image");
      expect(asked?.searchParams.get("q")).toBe("hello");
    });
  });

  it("offers the kinds of data for has:", async () => {
    const { user, field } = await openChannel();
    await user.type(field, "has:");
    const suggestions = within(await screen.findByRole("region", { name: "Suggestions for has:" }));
    for (const kind of ["link", "file", "image", "video", "sound", "sticker"]) expect(suggestions.getByText(kind)).toBeInTheDocument();
  });

  it("searches another channel with in:", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.type(field, "in:random elsewhere");
    await waitFor(() => expect(searchOf(fetchMock, "/api/v1/channels/c2/search").length).toBeGreaterThan(0));
    expect(searchOf(fetchMock, "/api/v1/channels/c2/search").at(-1)!.searchParams.get("q")).toBe("elsewhere");
    expect(searchOf(fetchMock, "/api/v1/channels/c1/search")).toHaveLength(0);
  });

  it("says plainly when a filter names someone or somewhere that is not there, and does not search", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.type(field, "from:nobody");
    expect(await screen.findByText("No one called nobody here.")).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "in:nowhere ");
    expect(await screen.findByText("No channel called nowhere.")).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "has:gif ");
    expect(await screen.findByText(/has:gif/)).toBeInTheDocument();
    expect(searchOf(fetchMock, "/api/v1/channels/c1/search")).toHaveLength(0);
  });

  it("sets dates and the author type from More filters, as filters in the field", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.click(field);
    const menu = within(await screen.findByRole("region", { name: "Search filters" }));
    await user.click(menu.getByRole("button", { name: /More filters/ }));
    await user.click(menu.getByRole("button", { name: "Bots" }));
    expect(field).toHaveValue("author:bot");
    await waitFor(() => expect(searchOf(fetchMock, "/api/v1/channels/c1/search").at(-1)?.searchParams.get("author_type")).toBe("bot"));
    await user.click(menu.getByRole("button", { name: "Anyone" }));
    expect(field).toHaveValue("");
  });

  it("converts during: into the day around it", async () => {
    const { user, fetchMock, field } = await openChannel();
    await user.type(field, "during:2026-03-10");
    await waitFor(() => {
      const asked = searchOf(fetchMock, "/api/v1/channels/c1/search").at(-1);
      expect([asked?.searchParams.get("after"), asked?.searchParams.get("before")]).toEqual(["2026-03-09", "2026-03-11"]);
    });
  });
});

describe("search filters in a direct message", () => {
  const conversation = { conversation_id: "conv1", peer_user_id: "u2", peer_username: "grace", peer_origin_server: "x", last_message_at: "2030-01-01T12:00:00Z", last_message_preview: "hi", last_message_sender_is_me: false };
  const dmWire = (id: string, text: string) => ({ message_id: id, conversation_id: "conv1", sender_user_id: "u2", username: "grace", message: text, sent_at: "2030-01-01T12:00:00Z" });

  const openDm = async () => {
    const fetchMock = routeFetch({
      "POST /api/v1/users/profile": { user_data: me },
      "GET /api/v1/users/list": { users: [me, grace] },
      "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", max_message_length: 2000 } },
      "GET /api/v1/dms/conversations": { conversations: [conversation] },
      "GET /api/v1/dms/messages": { conversation_id: "conv1", messages: [dmWire("m1", "see the menu")] },
      "GET /api/v1/dms/conversations/conv1/pins": { pins: [], limit: 50 },
      "GET /api/v1/dms/conversations/conv1/search": { messages: [dmWire("m1", "see the menu")], scanned: 1, truncated_scan: false },
      "GET /api/v1/channels/read-history": { unread_counts: {} },
    });
    const user = userEvent.setup();
    renderWithProviders(<DirectMessageView />, { route: "/dashboard/dms/conv1?peer=grace", path: "/dashboard/dms/:conversationId" });
    await screen.findByText("see the menu");
    return { user, fetchMock, field: screen.getByRole("searchbox", { name: "Search @grace" }) as HTMLInputElement };
  };

  it("has no in: filter, and names the two of you for from:", async () => {
    const { user, field } = await openDm();
    await user.click(field);
    const menu = within(await screen.findByRole("region", { name: "Search filters" }));
    expect(menu.getByText("From a specific user")).toBeInTheDocument();
    expect(menu.queryByText("Sent in a specific channel")).not.toBeInTheDocument();

    await user.click(menu.getByRole("button", { name: /From a specific user/ }));
    const suggestions = within(await screen.findByRole("region", { name: "Suggestions for from:" }));
    expect(suggestions.getAllByRole("button").map((b) => b.textContent)).toEqual(["ada", "grace"]);
  });

  it("searches the conversation with the filters", async () => {
    const { user, fetchMock, field } = await openDm();
    await user.type(field, "has:link from:grace");
    await waitFor(() => {
      const asked = searchOf(fetchMock, "/api/v1/dms/conversations/conv1/search").at(-1);
      expect([asked?.searchParams.get("has"), asked?.searchParams.get("from_user_id")]).toEqual(["link", "u2"]);
    });
  });

  it("says in: does not work here", async () => {
    const { user, field } = await openDm();
    await user.type(field, "in:general ");
    expect(await screen.findByText("in: does not work in a direct message.")).toBeInTheDocument();
  });
});
