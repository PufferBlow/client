import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { channelKeys } from "../../features/channels/hooks";
import type { Channel } from "../../features/channels/types";
import { bearerOfCall, jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ChannelSidebar } from "./ChannelSidebar";
import { ServerRail } from "./ServerRail";

beforeEach(() => signIn("tok"));

const channels: Channel[] = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c2", channel_name: "random", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "c3", channel_name: "secret", channel_type: "text", is_private: true, created_at: "t" },
  { channel_id: "v1", channel_name: "Lounge", channel_type: "voice", is_private: false, created_at: "t" },
];

const profile = (extra: Record<string, unknown> = {}) => ({
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  roles_ids: ["member"],
  resolved_privileges: ["send_messages"],
  ...extra,
});
const admin = profile({ resolved_privileges: ["create_channels", "edit_channels", "delete_channels"] });
const owner = profile({ roles_ids: ["owner"], resolved_privileges: ["create_channels", "edit_channels", "delete_channels"] });

const note = (id: string, channel: string, type: "reply" | "mention" = "reply") => ({
  notification_id: id,
  type,
  actor_user_id: "u2",
  channel_id: channel,
  message_id: `m-${id}`,
  created_at: "2030-01-01T10:00:00Z",
  read_at: null,
});

const backend = (extra: Record<string, unknown> = {}, me = profile(), prefs: unknown[] = []) =>
  routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/read-history": { unread_counts: { c2: 3, c3: 1 } },
    "GET /api/v1/system/server-info": { server_info: { server_id: "localhost:7575", server_name: "Test Server" } },
    "GET /api/v1/notifications/preferences": { preferences: prefs },
    // Red counts are replies and pings; the unread messages above only highlight a channel.
    "GET /api/v1/notifications/": { notifications: [note("n1", "c2"), note("n2", "c2"), note("n3", "c2", "mention"), note("n4", "c3")] },
    "POST /api/v1/notifications/read-all": { status_code: 200 },
    "GET /api/v1/users/list": { users: [] },
    ...extra,
  });

const mutedPref = (id: string) => ({ channel_id: id, muted: true, mention_only: false });

async function openSidebar(extra?: Record<string, unknown>, me = profile(), prefs: unknown[] = []) {
  const fetchMock = backend(extra, me, prefs);
  const view = renderWithProviders(<ChannelSidebar />, { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId" });
  await screen.findByRole("link", { name: /general/ });
  await waitFor(() => expect(requestLog(fetchMock)).toContain("GET /api/v1/notifications/preferences"));
  await waitFor(() => expect(screen.getByRole("link", { name: /random/ })).toHaveTextContent("3"));
  await act(async () => {});
  return { fetchMock, ...view };
}

const link = (name: RegExp) => screen.getByRole("link", { name });
const rightClick = (name: RegExp, point = { clientX: 30, clientY: 40 }) => fireEvent.contextMenu(link(name), point);
const menu = () => screen.queryByRole("menu");
const entry = (name: string | RegExp) => within(screen.getByRole("menu")).getByRole("menuitem", { name });
const hasEntry = (name: string | RegExp) => within(screen.getByRole("menu")).queryByRole("menuitem", { name }) !== null;
const labels = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map((e) => e.textContent);
const bodyOf = (fetchMock: ReturnType<typeof routeFetch>, route: string) => {
  const call = fetchMock.mock.calls.find(([input, init]) => `${init?.method} ${new URL(String(input)).pathname}` === route)!;
  return JSON.parse(String(call[1]!.body));
};

describe("channel context menu", () => {
  it("opens on right-click, names its target and blocks the browser menu", async () => {
    await openSidebar();
    const allowed = fireEvent.contextMenu(link(/random/), { clientX: 30, clientY: 40 });
    expect(allowed).toBe(false);
    expect(screen.getByRole("menu", { name: "Actions for random" })).toBeInTheDocument();
  });

  it("offers read, mute and copy actions to an ordinary member, and nothing administrative", async () => {
    await openSidebar();
    rightClick(/random/);

    expect(labels()).toEqual(["Mark as read", "Mute channel", "Copy channel link", "Copy channel ID"]);
    // Dividers separate groups but never lead or trail.
    const children = Array.from(screen.getByRole("menu").children);
    expect(children[0]).toHaveAttribute("role", "menuitem");
    expect(children.at(-1)).toHaveAttribute("role", "menuitem");
  });

  it("adds create, duplicate, edit and delete (last, after a divider) for someone with the privileges", async () => {
    await openSidebar({}, admin);
    rightClick(/random/);

    for (const name of ["Create channel", "Duplicate channel", "Edit channel", "Delete channel"]) expect(hasEntry(name)).toBe(true);
    const children = Array.from(screen.getByRole("menu").children);
    expect(children.at(-1)).toHaveTextContent("Delete channel");
    expect(children.at(-2)).toHaveAttribute("role", "separator");
  });

  it("shows only the actions a privilege grants", async () => {
    await openSidebar({}, profile({ resolved_privileges: ["edit_channels"] }));
    rightClick(/random/);
    expect(hasEntry("Edit channel")).toBe(true);
    expect(hasEntry("Create channel")).toBe(false);
    expect(hasEntry("Delete channel")).toBe(false);
  });

  it("gives voice channels their own, shorter menu", async () => {
    await openSidebar({}, admin);
    fireEvent.contextMenu(screen.getByText("Lounge"), { clientX: 10, clientY: 10 });

    expect(screen.getByRole("menu", { name: "Actions for Lounge" })).toBeInTheDocument();
    expect(hasEntry("Copy channel ID")).toBe(true);
    expect(hasEntry("Edit channel")).toBe(true);
    expect(hasEntry("Mark as read")).toBe(false);
    expect(hasEntry("Mute channel")).toBe(false);
  });

  it("never lists actions the app can't perform", async () => {
    await openSidebar({}, owner);
    rightClick(/random/);
    for (const name of [/invite/i, /notification settings/i, /category/i, /join|leave/i, /move|reorder/i]) expect(hasEntry(name)).toBe(false);
  });

  it("targets the right-clicked channel and copies its id", async () => {
    const { user } = await openSidebar();
    rightClick(/general/);
    await user.click(entry("Copy channel ID"));
    expect(await navigator.clipboard.readText()).toBe("c1");

    rightClick(/secret/);
    await user.click(entry("Copy channel ID"));
    expect(await navigator.clipboard.readText()).toBe("c3");
    expect(await screen.findByText("Channel ID copied.")).toBeInTheDocument();
  });

  it("copies a link to the channel", async () => {
    const { user } = await openSidebar();
    rightClick(/random/);
    await user.click(entry("Copy channel link"));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/dashboard/channels/c2`);
  });

  it("keeps a single menu aimed at the last channel after rapid right-clicks", async () => {
    const { user } = await openSidebar();
    rightClick(/general/);
    rightClick(/random/);
    rightClick(/secret/);
    rightClick(/random/);

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    await user.click(entry("Copy channel ID"));
    expect(await navigator.clipboard.readText()).toBe("c2");
  });

  it("closes on Escape and on an outside click", async () => {
    const { user } = await openSidebar();
    rightClick(/random/);
    await user.keyboard("{Escape}");
    expect(menu()).not.toBeInTheDocument();

    rightClick(/random/);
    fireEvent.pointerDown(screen.getByRole("navigation", { name: "Channels" }));
    expect(menu()).not.toBeInTheDocument();
  });

  it("closes when the sidebar scrolls", async () => {
    await openSidebar();
    rightClick(/random/);
    fireEvent.scroll(screen.getByRole("navigation", { name: "Channels" }));
    expect(menu()).not.toBeInTheDocument();
  });

  it("closes if its channel disappears", async () => {
    const { queryClient } = await openSidebar();
    rightClick(/secret/);
    act(() => {
      queryClient.setQueryData<Channel[]>(channelKeys.list, (list) => list?.filter((c) => c.channel_id !== "c3"));
    });
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
  });

  describe("without a mouse", () => {
    it("opens from the More actions button, for touch", async () => {
      const { user } = await openSidebar();
      await user.click(screen.getByRole("button", { name: "Channel actions for random" }));
      expect(screen.getByRole("menu", { name: "Actions for random" })).toBeInTheDocument();
      expect(entry("Mark as read")).toHaveFocus();
    });

    it("opens from the context-menu key on a focused channel", async () => {
      const { user } = await openSidebar();
      link(/secret/).focus();
      await user.keyboard("{ContextMenu}");
      expect(screen.getByRole("menu", { name: "Actions for secret" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(link(/secret/)).toHaveFocus();
    });

    it("opens with Shift+F10", async () => {
      const { user } = await openSidebar();
      link(/general/).focus();
      await user.keyboard("{Shift>}{F10}{/Shift}");
      expect(menu()).toBeInTheDocument();
    });
  });

  describe("mark as read", () => {
    it("is disabled when there is nothing unread", async () => {
      await openSidebar();
      rightClick(/general/);
      expect(entry("Mark as read")).toHaveAttribute("aria-disabled", "true");
    });

    it("clears that channel's unread badge", async () => {
      const { user, fetchMock } = await openSidebar({ "POST /api/v1/channels/c2/mark_all_read": { status_code: 200 } });
      rightClick(/random/);
      await user.click(entry("Mark as read"));

      await waitFor(() => expect(link(/random/)).not.toHaveTextContent("3"));
      expect(requestLog(fetchMock)).toContain("POST /api/v1/channels/c2/mark_all_read");
      expect(link(/secret/)).toHaveTextContent("1"); // others untouched
    });

    it("restores the badge and says why if the server refuses", async () => {
      const { user } = await openSidebar({
        "POST /api/v1/channels/c2/mark_all_read": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500),
      });
      rightClick(/random/);
      await user.click(entry("Mark as read"));

      expect(await screen.findByRole("status")).toHaveTextContent(/./);
    });
  });

  describe("muting", () => {
    it("mutes through the notification preferences and shows it at once", async () => {
      const { user, fetchMock } = await openSidebar({ "PUT /api/v1/notifications/preferences/c2": { status_code: 200 } });
      rightClick(/random/);
      await user.click(entry("Mute channel"));

      await waitFor(() => expect(requestLog(fetchMock)).toContain("PUT /api/v1/notifications/preferences/c2"));
      expect(bodyOf(fetchMock, "PUT /api/v1/notifications/preferences/c2")).toEqual({ muted: true });
      const row = link(/random/);
      expect(within(row).getByLabelText("Muted")).toBeInTheDocument();
      expect(row).not.toHaveTextContent("3"); // muted channels don't badge

      rightClick(/random/);
      expect(hasEntry("Unmute channel")).toBe(true);
    });

    it("unmutes a channel that was already muted", async () => {
      const { user, fetchMock } = await openSidebar({ "PUT /api/v1/notifications/preferences/c3": { status_code: 200 } }, profile(), [mutedPref("c3")]);
      expect(within(link(/secret/)).getByLabelText("Muted")).toBeInTheDocument();

      rightClick(/secret/);
      await user.click(entry("Unmute channel"));

      await waitFor(() => expect(requestLog(fetchMock)).toContain("PUT /api/v1/notifications/preferences/c3"));
      expect(bodyOf(fetchMock, "PUT /api/v1/notifications/preferences/c3")).toEqual({ muted: false });
      expect(within(link(/secret/)).queryByLabelText("Muted")).not.toBeInTheDocument();
    });

    it("rolls the mute back and says so when it fails", async () => {
      const { user } = await openSidebar({
        "PUT /api/v1/notifications/preferences/c2": jsonResponse({ error_code: "server.internal_error", message: "boom" }, 500),
      });
      rightClick(/random/);
      await user.click(entry("Mute channel"));

      expect(await screen.findByRole("status")).toHaveTextContent(/./);
      await waitFor(() => expect(within(link(/random/)).queryByLabelText("Muted")).not.toBeInTheDocument());
      expect(link(/random/)).toHaveTextContent("3");
    });
  });

  describe("managing channels", () => {
    it("edits the right channel", async () => {
      const { user, fetchMock } = await openSidebar({ "PUT /api/v1/channels/c2/update": { channel_data: channels[1] } }, admin);
      rightClick(/random/);
      await user.click(entry("Edit channel"));

      const name = await screen.findByRole("textbox", { name: "Channel name" });
      expect(name).toHaveValue("random");
      await user.clear(name);
      await user.type(name, "chatter");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(requestLog(fetchMock)).toContain("PUT /api/v1/channels/c2/update"));
      expect(bodyOf(fetchMock, "PUT /api/v1/channels/c2/update")).toEqual({ channel_name: "chatter", is_private: false, auth_token: "tok" });
    });

    it("opens an empty create form from 'Create channel'", async () => {
      const { user } = await openSidebar({}, admin);
      rightClick(/random/);
      await user.click(entry("Create channel"));
      expect(await screen.findByRole("textbox", { name: "Channel name" })).toHaveValue("");
    });

    it("duplicates a channel's settings into a pre-filled create form", async () => {
      const { user, fetchMock } = await openSidebar(
        { "POST /api/v1/channels/create/": { channel_data: { ...channels[2], channel_id: "c9", channel_name: "secret-copy" } } },
        admin,
      );
      rightClick(/secret/);
      await user.click(entry("Duplicate channel"));

      expect(await screen.findByRole("textbox", { name: "Channel name" })).toHaveValue("secret-copy");
      expect(screen.getByLabelText(/private channel/i)).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Create channel" }));

      await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/channels/create/"));
      expect(bodyOf(fetchMock, "POST /api/v1/channels/create/")).toEqual({
        channel_name: "secret-copy",
        channel_type: "text",
        is_private: true,
        auth_token: "tok",
      });
    });

    it("asks before deleting, and cancelling deletes nothing", async () => {
      const { user, fetchMock } = await openSidebar({}, admin);
      rightClick(/random/);
      await user.click(entry("Delete channel"));

      expect(await screen.findByText("Delete random?")).toBeInTheDocument();
      expect(requestLog(fetchMock).some((r) => r.startsWith("DELETE"))).toBe(false);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByText("Delete random?")).not.toBeInTheDocument();
      expect(link(/random/)).toBeInTheDocument();
      expect(requestLog(fetchMock).some((r) => r.startsWith("DELETE"))).toBe(false);
    });

    it("deletes exactly that channel once confirmed and removes it from the sidebar", async () => {
      // Like the real server, the list no longer contains the channel once it is deleted.
      let deleted = false;
      const { user, fetchMock } = await openSidebar(
        {
          "DELETE /api/v1/channels/c2/delete": () => {
            deleted = true;
            return jsonResponse({ status_code: 200 });
          },
          "POST /api/v1/channels/list/": () => jsonResponse({ channels: deleted ? channels.filter((c) => c.channel_id !== "c2") : channels }),
        },
        admin,
      );
      rightClick(/random/);
      await user.click(entry("Delete channel"));
      await user.click(await screen.findByRole("button", { name: "Delete channel" }));

      await waitFor(() => expect(screen.queryByRole("link", { name: /random/ })).not.toBeInTheDocument());
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")!;
      expect(bearerOfCall(call)).toBe("Bearer tok");
      expect(new URL(String(call[0])).searchParams.has("auth_token")).toBe(false);
      expect(link(/general/)).toBeInTheDocument();
      expect(await screen.findByText("Deleted #random.")).toBeInTheDocument();
    });

    it("leaves the channel you are viewing when you delete it", async () => {
      const { user } = await openSidebar({ "DELETE /api/v1/channels/c1/delete": { status_code: 200 } }, admin);
      rightClick(/general/);
      await user.click(entry("Delete channel"));
      await user.click(await screen.findByRole("button", { name: "Delete channel" }));

      expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/dashboard/channels");
    });

    it("keeps the channel and shows the reason when deleting is refused", async () => {
      const { user } = await openSidebar(
        { "DELETE /api/v1/channels/c2/delete": jsonResponse({ error_code: "auth.forbidden", message: "You can't delete channels." }, 403) },
        admin,
      );
      rightClick(/random/);
      await user.click(entry("Delete channel"));
      await user.click(await screen.findByRole("button", { name: "Delete channel" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(link(/random/)).toBeInTheDocument();
    });
  });
});

describe("server context menu", () => {
  it("opens from the header menu button", async () => {
    const { user } = await openSidebar();
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    expect(screen.getByRole("menu", { name: "Server actions" })).toBeInTheDocument();
    expect(labels()).toEqual(["Mark all as read", "Mute server", "Copy server address"]);
  });

  it("adds create channel and the control panel for the people who can use them", async () => {
    const { user } = await openSidebar({}, owner);
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    expect(hasEntry("Create channel")).toBe(true);
    expect(hasEntry("Server control panel")).toBe(true);
  });

  it("opens the control panel", async () => {
    const { user } = await openSidebar({}, owner);
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    await user.click(entry("Server control panel"));
    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/control-panel");
  });

  it("marks every channel read in one request", async () => {
    const { user, fetchMock } = await openSidebar({ "POST /api/v1/channels/mark_all_read": { status_code: 200 } });
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    await user.click(entry("Mark all as read"));

    await waitFor(() => expect(link(/random/)).not.toHaveTextContent("3"));
    expect(link(/secret/)).not.toHaveTextContent("1");
    expect(requestLog(fetchMock)).toContain("POST /api/v1/channels/mark_all_read");
  });

  it("mutes every channel and then offers to unmute", async () => {
    const { user, fetchMock } = await openSidebar({ "PUT /api/v1/notifications/preferences": { status_code: 200 } });
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    await user.click(entry("Mute server"));

    await waitFor(() => expect(requestLog(fetchMock)).toContain("PUT /api/v1/notifications/preferences"));
    expect(bodyOf(fetchMock, "PUT /api/v1/notifications/preferences")).toEqual({ muted: true });
    expect(within(link(/random/)).getByLabelText("Muted")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Server menu" }));
    expect(hasEntry("Unmute server")).toBe(true);
  });

  it("copies the server address", async () => {
    const { user } = await openSidebar();
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    await user.click(entry("Copy server address"));
    expect(await navigator.clipboard.readText()).toBe("localhost:7575");
  });

  it("never lists server actions the app can't perform", async () => {
    const { user } = await openSidebar({}, owner);
    await user.click(screen.getByRole("button", { name: "Server menu" }));
    for (const name of [/invite/i, /leave/i, /delete server/i, /category/i, /edit server/i, /notification settings/i]) expect(hasEntry(name)).toBe(false);
  });
});

describe("server rail context menu", () => {
  it("opens when right-clicking the server tile", async () => {
    backend({}, owner);
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
    const tile = await screen.findByRole("link", { name: /Test Server/ });

    const allowed = fireEvent.contextMenu(tile, { clientX: 40, clientY: 90 });
    expect(allowed).toBe(false);
    expect(screen.getByRole("menu", { name: "Server actions" })).toBeInTheDocument();
  });

  it("draws the Home tile as the puffer: white on dark, and black on white when you hover or are on it", async () => {
    backend();
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
    const home = await screen.findByRole("link", { name: "Friends" });
    expect(home.className).toContain("text-[#f2f2f2]");
    expect(home.className).toContain("hover:bg-primary");
    expect(home.className).toContain("hover:text-black");
    expect(home.querySelector("rect[mask]")).toHaveAttribute("fill", "currentColor"); // follows the tile's text colour
  });

  it("gives the Home tile the inverted state while you are on it", async () => {
    backend();
    renderWithProviders(<ServerRail />, { route: "/dashboard/friends", path: "*" });
    const home = await screen.findByRole("link", { name: "Friends" });
    expect(home.className).toContain("bg-primary");
    expect(home.className).toContain("text-black");
  });

  it("does not hijack the Friends tile", async () => {
    backend();
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
    const friends = await screen.findByRole("link", { name: "Friends" });
    expect(fireEvent.contextMenu(friends)).toBe(true);
    expect(menu()).not.toBeInTheDocument();
  });
});
