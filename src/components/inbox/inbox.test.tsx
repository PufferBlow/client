import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type { AppNotification } from "../../features/notifications/api";
import { InboxButton } from "./Inbox";

const state = {
  unread: { c1: 3, c2: 0, c3: 5 } as Record<string, number>,
  muted: new Set<string>(["c3"]),
  notifications: [] as AppNotification[],
  unreadDms: 0,
};
const markChannelRead = vi.fn();
const markAllChannelsRead = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const muteChannel = vi.fn();

vi.mock("../../features/channels/hooks", () => ({
  useUnreadCounts: () => ({ data: state.unread, isPending: false }),
  useChannels: () => ({
    data: [
      { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "" },
      { channel_id: "c2", channel_name: "random", channel_type: "text", is_private: false, created_at: "" },
      { channel_id: "c3", channel_name: "muted-room", channel_type: "text", is_private: false, created_at: "" },
    ],
  }),
  useMarkChannelRead: () => ({ mutate: markChannelRead }),
  useMarkAllChannelsRead: () => ({ mutate: markAllChannelsRead }),
}));
vi.mock("../../features/dms/hooks", () => ({ useConversations: () => ({ data: [] }) }));
vi.mock("../../features/dms/unread", () => ({ useDmUnread: () => ({ total: state.unreadDms, countFor: () => 0 }) }));
vi.mock("../../features/notifications/hooks", () => ({
  PING_TYPES: new Set(["mention", "reply"]),
  useMutedChannels: () => state.muted,
  useMuteChannel: () => ({ mutate: muteChannel }),
  useNotifications: () => ({ data: state.notifications, isPending: false, error: null }),
  useUnreadNotificationCount: () => state.notifications.filter((n) => !n.read).length,
  useMarkNotificationRead: () => ({ mutate: markNotificationRead }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllNotificationsRead }),
}));
vi.mock("../../features/users/hooks", () => ({
  useUsers: () => ({ data: [{ user_id: "u1", username: "grace", avatar_url: null }] }),
}));

const mention = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: "n1",
  type: "mention",
  actorUserId: "u1",
  channelId: "c1",
  messageId: "m1",
  createdAt: new Date().toISOString(),
  read: false,
  ...overrides,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const renderInbox = () =>
  render(
    <MemoryRouter>
      <InboxButton />
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.unread = { c1: 3, c2: 0, c3: 5 };
  state.muted = new Set(["c3"]);
  state.notifications = [];
  state.unreadDms = 0;
  for (const spy of [markChannelRead, markAllChannelsRead, markNotificationRead, markAllNotificationsRead, muteChannel]) spy.mockReset();
});

describe("inbox button", () => {
  it("counts unread replies, pings and DMs in the red badge, but not channels that only have new messages", () => {
    state.notifications = [mention(), mention({ id: "n2", type: "reply" }), mention({ id: "n3", read: true })];
    state.unreadDms = 3;
    renderInbox();
    // 2 unread pings + 3 unread DMs. The unread channel (general, 3 messages) adds nothing.
    expect(screen.getByRole("button", { name: "Inbox, 5 unread" })).toBeInTheDocument();
  });

  it("has no red badge when channels merely have new messages", () => {
    renderInbox(); // general has 3 unread messages, nothing else
    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
  });

  it("has no badge when everything is read", () => {
    state.unread = {};
    renderInbox();
    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
  });

  it("opens and closes with the button, Escape and an outside click", async () => {
    const user = userEvent.setup();
    renderInbox();
    const button = screen.getByRole("button", { name: /^Inbox/ });

    await user.click(button);
    expect(screen.getByRole("dialog", { name: "Inbox" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);
    await user.click(screen.getByTestId("where"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("unreads tab", () => {
  it("lists unread channels, leaving out muted and read ones", async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));

    const panel = screen.getByRole("dialog", { name: "Inbox" });
    expect(within(panel).getByText("general")).toBeInTheDocument();
    expect(within(panel).getByText("3 new")).toBeInTheDocument(); // plain text, not a red badge
    expect(within(panel).queryByText("random")).not.toBeInTheDocument();
    expect(within(panel).queryByText("muted-room")).not.toBeInTheDocument();
  });

  it("jumps to a channel, marks it read, or mutes it", async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));

    await user.click(screen.getByRole("button", { name: "Mark general as read" }));
    expect(markChannelRead).toHaveBeenCalledWith("c1");
    await user.click(screen.getByRole("button", { name: "Mute general" }));
    expect(muteChannel).toHaveBeenCalledWith({ channelId: "c1", muted: true });

    await user.click(screen.getByText("general"));
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard/channels/c1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says when you are all caught up", async () => {
    state.unread = {};
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("marks everything read from the header", async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    await user.click(screen.getByRole("button", { name: "Mark everything as read" }));
    expect(markAllChannelsRead).toHaveBeenCalled();
    expect(markAllNotificationsRead).toHaveBeenCalled();
  });
});

describe("mentions tab", () => {
  it("shows who mentioned you and where, and opens it", async () => {
    state.notifications = [mention()];
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    await user.click(screen.getByRole("tab", { name: /Mentions/ }));

    const row = screen.getByRole("button", { name: /grace mentioned you in #general/ });
    await user.click(row);

    expect(markNotificationRead).toHaveBeenCalledWith("n1");
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard/channels/c1");
  });

  it("lists replies to you next to mentions", async () => {
    state.notifications = [mention({ id: "n9", type: "reply" })];
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    await user.click(screen.getByRole("tab", { name: /Mentions/ }));
    expect(screen.getByRole("button", { name: /grace replied to you in #general/ })).toBeInTheDocument();
  });

  it("does not mark an already-read mention again, and offers no check for it", async () => {
    state.notifications = [mention({ read: true })];
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    await user.click(screen.getByRole("tab", { name: /Mentions/ }));

    expect(screen.queryByRole("button", { name: /Mark the mention/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /grace mentioned you/ }));
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("says so when nobody has mentioned you", async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(screen.getByRole("button", { name: /^Inbox/ }));
    await user.click(screen.getByRole("tab", { name: /Mentions/ }));
    expect(screen.getByText(/No replies or mentions yet/)).toBeInTheDocument();
  });
});
