import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Bell, BellOff, Check, CheckCheck, Hash, Inbox as InboxIcon } from "lucide-react";
import { useChannels, useMarkAllChannelsRead, useMarkChannelRead, useUnreadCounts } from "../../features/channels/hooks";
import { useConversations } from "../../features/dms/hooks";
import { useDmUnread } from "../../features/dms/unread";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMuteChannel,
  useMutedChannels,
  useNotifications,
  useUnreadNotificationCount,
  PING_TYPES,
} from "../../features/notifications/hooks";
import type { AppNotification } from "../../features/notifications/api";
import { useUsers } from "../../features/users/hooks";
import { Avatar, CountBadge } from "../dashboard/Avatar";

type Tab = "unreads" | "mentions";

const iconButton =
  "grid h-8 w-8 place-items-center rounded-lg border border-border-secondary bg-surface-secondary text-text-secondary outline-none transition-colors hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40";

const channelPath = (id: string) => `/dashboard/channels/${encodeURIComponent(id)}`;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

/**
 * The title-bar inbox: a button with the unread-mention count that opens a panel of what needs
 * attention. Unreads lists the channels with unread messages (jump in, mute, or mark read);
 * Mentions lists the times someone @-mentioned you.
 */
export function InboxButton() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const mentions = useUnreadNotificationCount();
  const { data: unread } = useUnreadCounts();
  const muted = useMutedChannels();
  const { data: conversations = [] } = useConversations();
  const { total: unreadDms } = useDmUnread(conversations);
  const unreadChannels = Object.entries(unread ?? {}).filter(([id, count]) => count > 0 && !muted.has(id)).length;
  // Red count: replies, pings and DMs. Channels that merely have new messages don't add to it.
  const badge = mentions + unreadDms;
  const hasUnreadChannels = unreadChannels > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex h-full items-center">
      <button
        type="button"
        aria-label={badge > 0 ? `Inbox, ${badge} unread` : "Inbox"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Inbox"
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-full w-11 items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text ${open ? "bg-hover text-text" : ""}`}
      >
        <InboxIcon className="h-4 w-4" aria-hidden="true" />
        {badge > 0 ? (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-error px-1 text-[9.5px] font-bold leading-none text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : (
          hasUnreadChannels && <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-text" />
        )}
      </button>
      {open && <InboxPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

function InboxPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("unreads");
  const markAllChannels = useMarkAllChannelsRead();
  const markAllNotifications = useMarkAllNotificationsRead();
  const unreadMentions = useUnreadNotificationCount();

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "unreads", label: "Unreads" },
    { id: "mentions", label: "Mentions", count: unreadMentions },
  ];

  return (
    <div
      role="dialog"
      aria-label="Inbox"
      className="fixed right-2 top-11 z-[80] flex max-h-[min(640px,calc(100vh-60px))] w-[min(420px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-border-secondary bg-surface text-text shadow-popover"
    >
      <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
        <h2 className="m-0 flex items-center gap-2 text-lg font-bold">
          <InboxIcon size={20} aria-hidden="true" />
          Inbox
        </h2>
        <button
          type="button"
          aria-label="Mark everything as read"
          title="Mark everything as read"
          className={iconButton}
          onClick={() => {
            markAllChannels.mutate();
            markAllNotifications.mutate();
          }}
        >
          <CheckCheck size={16} aria-hidden="true" />
        </button>
      </header>

      <div role="tablist" aria-label="Inbox sections" className="flex border-b border-border-secondary px-2">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`inbox-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="inbox-body"
            onClick={() => setTab(id)}
            className={`-mb-px flex flex-1 items-center justify-center gap-1.5 border-0 border-b-2 bg-transparent px-3 py-3 text-sm font-semibold outline-none focus-visible:bg-hover ${
              tab === id ? "border-primary text-text" : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
            {count !== undefined && <CountBadge count={count} />}
          </button>
        ))}
      </div>

      <div id="inbox-body" role="tabpanel" aria-labelledby={`inbox-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "unreads" ? <UnreadsList onNavigate={onClose} /> : <MentionsList onNavigate={onClose} />}
      </div>
    </div>
  );
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center text-sm text-text-muted">
      <span aria-hidden="true" className="text-text-muted">
        {icon}
      </span>
      <p className="m-0">{children}</p>
    </div>
  );
}

function UnreadsList({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { data: unread, isPending } = useUnreadCounts();
  const { data: channels } = useChannels();
  const muted = useMutedChannels();
  const markRead = useMarkChannelRead();
  const mute = useMuteChannel();

  if (isPending) return <p className="m-0 px-3 py-8 text-center text-sm text-text-muted">Loading…</p>;

  const rows = (channels ?? [])
    .map((channel) => ({ channel, count: unread?.[channel.channel_id] ?? 0 }))
    .filter(({ channel, count }) => count > 0 && !muted.has(channel.channel_id));

  if (rows.length === 0) return <Empty icon={<CheckCheck size={28} />}>You're all caught up. Nothing unread.</Empty>;

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map(({ channel, count }) => (
        <li key={channel.channel_id} className="flex items-center gap-2 rounded-xl border border-border-secondary bg-surface-secondary p-2 pl-3">
          <button
            type="button"
            onClick={() => {
              navigate(channelPath(channel.channel_id));
              onNavigate();
            }}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border-0 bg-transparent py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Hash size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="min-w-0 truncate text-[15px] font-bold">{channel.channel_name}</span>
            <span className="shrink-0 text-[12px] text-text-muted">{count} new</span>
          </button>
          <button
            type="button"
            aria-label={`Mute ${channel.channel_name}`}
            title="Mute channel"
            className={iconButton}
            onClick={() => mute.mutate({ channelId: channel.channel_id, muted: true })}
          >
            <Bell size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Mark ${channel.channel_name} as read`}
            title="Mark as read"
            className={iconButton}
            onClick={() => markRead.mutate(channel.channel_id)}
          >
            <Check size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MentionsList({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { data, isPending, error } = useNotifications();
  const { data: users } = useUsers();
  const { data: channels } = useChannels();
  const markRead = useMarkNotificationRead();

  if (isPending) return <p className="m-0 px-3 py-8 text-center text-sm text-text-muted">Loading…</p>;
  if (error) return <Empty icon={<BellOff size={28} />}>Couldn't load your mentions.</Empty>;

  const mentions = (data ?? []).filter((n) => PING_TYPES.has(n.type));
  if (mentions.length === 0) return <Empty icon={<BellOff size={28} />}>No replies or mentions yet.</Empty>;

  const open = (notification: AppNotification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.channelId) navigate(channelPath(notification.channelId));
    onNavigate();
  };

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {mentions.map((notification) => {
        const actor = users?.find((u) => u.user_id === notification.actorUserId);
        const name = actor?.username ?? "Someone";
        const channel = channels?.find((c) => c.channel_id === notification.channelId);
        return (
          <li key={notification.id} className="flex items-center gap-2 rounded-xl border border-border-secondary bg-surface-secondary p-2 pl-3">
            <button
              type="button"
              onClick={() => open(notification)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border-0 bg-transparent py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Avatar name={name} src={actor?.avatar_url} seed={notification.actorUserId ?? name} size={36} bristle={!notification.read} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] ${notification.read ? "text-text-secondary" : "font-semibold text-text"}`}>
                  <strong className="font-bold">{name}</strong> {notification.type === "reply" ? "replied to you" : "mentioned you"}{channel ? <> in <span className="text-text">#{channel.channel_name}</span></> : null}
                </span>
                <span className="block text-[12px] text-text-muted">{formatWhen(notification.createdAt)}</span>
              </span>
              {!notification.read && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
            {!notification.read && (
              <button
                type="button"
                aria-label={`Mark ${notification.type === "reply" ? "the reply" : "the mention"} from ${name} as read`}
                title="Mark as read"
                className={iconButton}
                onClick={() => markRead.mutate(notification.id)}
              >
                <Check size={15} aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
