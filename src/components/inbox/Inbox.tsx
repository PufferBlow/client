import { LoadingState } from "../ui/LoadingState";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Bell, BellOff, Check, CheckCheck, ChevronDown, ChevronRight, Hash, Inbox as InboxIcon, Paperclip } from "lucide-react";
import { useCategories } from "../../features/channels/categories";
import { useChannels, useMarkAllChannelsRead, useMarkChannelRead, useUnreadCounts } from "../../features/channels/hooks";
import type { Channel } from "../../features/channels/types";
import { useConversations } from "../../features/dms/hooks";
import { markDmRead, useDmUnread } from "../../features/dms/unread";
import { useRecentMessages } from "../../features/messages/hooks";
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
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import { toPlainText } from "../../lib/markdown";
import { Avatar, CountBadge } from "../dashboard/Avatar";
import { EmojiText } from "../ui/Emoji";

type Tab = "unreads" | "mentions";

/** How many of a channel's unread messages its card shows; the rest are counted. */
const MAX_PREVIEWS = 5;

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

/** The line under a channel's name: which server it is on, and the category it sits in. */
function useWhere() {
  const { data: server } = useServerInfo();
  const { data: categories = [] } = useCategories();
  return (channel: Channel | undefined) => {
    const category = categories.find((c) => c.category_id === channel?.category_id)?.name;
    return [server?.server_name, category].filter(Boolean).join(" › ");
  };
}

/** One message as the inbox shows it: who sent it, when, and the start of what it says. */
function MessagePreview({
  name,
  avatarUrl,
  seed,
  when,
  text,
  hasAttachments = false,
  deleted = false,
  unread = false,
}: {
  name: string;
  avatarUrl?: string | null;
  seed: string;
  when: string;
  text: string;
  hasAttachments?: boolean;
  deleted?: boolean;
  unread?: boolean;
}) {
  const plain = toPlainText(text).replace(/\s+/g, " ").trim();
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar name={name} src={avatarUrl} seed={seed} size={36} bristle={unread} />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex items-baseline gap-2">
          <strong className={`truncate text-[14px] ${unread ? "text-text" : "text-text-secondary"}`}>{name}</strong>
          {when && <span className="shrink-0 text-[11.5px] text-text-muted">{when}</span>}
        </div>
        {deleted ? (
          <p className="m-0 text-[13.5px] italic text-text-muted">The message was deleted.</p>
        ) : (
          <>
            {plain && (
              <p className="m-0 line-clamp-3 break-words text-[13.5px] text-text-body">
                <EmojiText text={plain} size="1.1em" />
              </p>
            )}
            {hasAttachments && (
              <p className="m-0 mt-0.5 flex items-center gap-1 text-[12.5px] text-text-muted">
                <Paperclip size={12} aria-hidden="true" />
                {plain ? "Attachment" : "Sent an attachment"}
              </p>
            )}
            {!plain && !hasAttachments && <p className="m-0 text-[13.5px] text-text-muted">…</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** The newest unread messages of a channel, read when its card is opened. */
function UnreadMessages({ channelId, count, onOpen }: { channelId: string; count: number; onOpen: () => void }) {
  const { data: messages, isPending, error } = useRecentMessages(channelId, true);
  if (isPending) return <LoadingState message="Loading…" className="px-4 py-3" />;
  if (error) return <p className="m-0 px-4 py-3 text-[13px] text-text-muted">Couldn&apos;t load the messages.</p>;
  const shown = (messages ?? []).slice(-Math.min(count, MAX_PREVIEWS));
  return (
    <ul aria-label="Unread messages" className="m-0 flex list-none flex-col p-0">
      {shown.map((m) => (
        <li key={m.id}>
          <button type="button" onClick={onOpen} className="block w-full rounded-lg border-0 bg-transparent px-4 py-2 text-left outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus">
            <MessagePreview name={m.authorName} avatarUrl={m.authorAvatarUrl} seed={m.authorId} when={formatWhen(m.sentAt)} text={m.text} hasAttachments={m.attachments.length > 0} unread />
          </button>
        </li>
      ))}
      {count > shown.length && <li className="px-4 pb-2 pt-1 text-[12px] text-text-muted">and {count - shown.length} more</li>}
    </ul>
  );
}

function UnreadsList({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { data: unread, isPending } = useUnreadCounts();
  const { data: channels } = useChannels();
  const { data: conversations = [] } = useConversations();
  const { countFor } = useDmUnread(conversations);
  const { data: me } = useMyProfile();
  const muted = useMutedChannels();
  const markRead = useMarkChannelRead();
  const mute = useMuteChannel();
  const where = useWhere();
  // The first card starts open, so the inbox shows something to read without a click; after that, what was chosen.
  const [chosen, setChosen] = useState<Record<string, boolean>>({});

  if (isPending) return <LoadingState message="Loading…" className="px-3 py-3" />;

  const rows = (channels ?? [])
    .map((channel) => ({ channel, count: unread?.[channel.channel_id] ?? 0 }))
    .filter(({ channel, count }) => count > 0 && !muted.has(channel.channel_id));
  const dms = conversations.map((conversation) => ({ conversation, count: countFor(conversation) })).filter(({ count }) => count > 0);

  if (rows.length === 0 && dms.length === 0) return <Empty icon={<CheckCheck size={28} />}>You're all caught up. Nothing unread.</Empty>;

  const isOpen = (id: string, index: number) => chosen[id] ?? index === 0;

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map(({ channel, count }, index) => {
        const open = isOpen(channel.channel_id, index);
        const subtitle = where(channel);
        const goTo = () => {
          navigate(channelPath(channel.channel_id));
          onNavigate();
        };
        return (
          <li key={channel.channel_id} className="overflow-hidden rounded-xl border border-border-secondary bg-surface-secondary">
            <div className="flex items-center gap-2 p-2 pl-2.5">
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? "Hide" : "Show"} the unread messages in ${channel.channel_name}`}
                onClick={() => setChosen((now) => ({ ...now, [channel.channel_id]: !open }))}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-0 bg-transparent text-text-muted outline-none hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              >
                {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              </button>
              <button type="button" onClick={goTo} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border-0 bg-transparent py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus">
                <Hash size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
                <span className="min-w-0 leading-tight">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold">{channel.channel_name}</span>
                    <span className="shrink-0 text-[12px] text-text-muted">{count} new</span>
                  </span>
                  {subtitle && <span className="block truncate text-[12px] text-text-muted">{subtitle}</span>}
                </span>
              </button>
              <button type="button" aria-label={`Mute ${channel.channel_name}`} title="Mute channel" className={iconButton} onClick={() => mute.mutate({ channelId: channel.channel_id, muted: true })}>
                <Bell size={15} aria-hidden="true" />
              </button>
              <button type="button" aria-label={`Mark ${channel.channel_name} as read`} title="Mark as read" className={iconButton} onClick={() => markRead.mutate(channel.channel_id)}>
                <Check size={15} aria-hidden="true" />
              </button>
            </div>
            {open && (
              <div className="border-t border-border-secondary py-1">
                <UnreadMessages channelId={channel.channel_id} count={count} onOpen={goTo} />
              </div>
            )}
          </li>
        );
      })}
      {dms.map(({ conversation, count }) => (
        <li key={conversation.id} className="flex items-center gap-2 rounded-xl border border-border-secondary bg-surface-secondary p-2 pl-3">
          <button
            type="button"
            onClick={() => {
              navigate(`/dashboard/dms/${encodeURIComponent(conversation.id)}?peer=${encodeURIComponent(conversation.peerUsername)}`);
              onNavigate();
            }}
            className="min-w-0 flex-1 rounded-lg border-0 bg-transparent py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"
          >
            <MessagePreview
              name={conversation.peerUsername}
              avatarUrl={conversation.peerAvatarUrl}
              seed={conversation.peerUserId}
              when={conversation.lastMessageAt ? formatWhen(conversation.lastMessageAt) : ""}
              text={conversation.lastMessagePreview}
              unread
            />
            <span className="ml-[48px] mt-0.5 block text-[12px] text-text-muted">Direct message · {count} new</span>
          </button>
          <button
            type="button"
            aria-label={`Mark the conversation with ${conversation.peerUsername} as read`}
            title="Mark as read"
            className={iconButton}
            onClick={() => me && markDmRead(me.user_id, conversation.id)}
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
  const where = useWhere();

  if (isPending) return <LoadingState message="Loading…" className="px-3 py-3" />;
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
        const what = notification.type === "reply" ? "replied to you" : "mentioned you";
        const subtitle = where(channel);
        return (
          <li key={notification.id} className="flex items-start gap-2 rounded-xl border border-border-secondary bg-surface-secondary p-2 pl-3">
            <button type="button" onClick={() => open(notification)} className="min-w-0 flex-1 rounded-lg border-0 bg-transparent py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus">
              <span className={`mb-1.5 flex items-center gap-1.5 text-[12.5px] ${notification.read ? "text-text-muted" : "text-text-secondary"}`}>
                <Hash size={13} aria-hidden="true" className="shrink-0" />
                <span className="truncate">
                  <strong className="font-semibold text-text">{channel ? channel.channel_name : "a channel"}</strong>
                  {subtitle ? ` · ${subtitle}` : ""}
                </span>
                {!notification.read && <span aria-label="Unread" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </span>
              <MessagePreview
                name={name}
                avatarUrl={actor?.avatar_url}
                seed={notification.actorUserId ?? name}
                when={formatWhen(notification.createdAt)}
                text={notification.preview?.text ?? ""}
                hasAttachments={notification.preview?.hasAttachments}
                deleted={notification.preview?.deleted}
                unread={!notification.read}
              />
              <span className="sr-only">
                {name} {what}
                {channel ? ` in #${channel.channel_name}` : ""}
              </span>
              <span aria-hidden="true" className="ml-[48px] mt-1 block text-[12px] text-text-muted">
                {notification.type === "reply" ? "Replied to you" : "Mentioned you"}
              </span>
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
