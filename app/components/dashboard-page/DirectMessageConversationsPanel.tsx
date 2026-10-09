/**
 * Sidebar slot for the DM mode.
 *
 * Lists the viewer's DM conversations, most-recent-first. Each row
 * shows the peer's avatar (with presence dot), display name,
 * one-line preview of the latest message, and a relative timestamp.
 * Clicking a row sets the selected conversation in the parent,
 * which renders `DirectMessageView` in the main pane.
 *
 * Empty state: when the user has no conversations yet, we show a
 * gentle nudge pointing at the Friends panel (which now lives in
 * the main pane when no conversation is open — same place a user
 * goes to start their first DM by clicking a friend).
 *
 * Replaces the previous sidebar shape where the Friends/Pending/
 * Blocked tabs filled the sidebar; that UI now lives in
 * `FriendsManagementPanel` on the main pane.
 */
import { useMemo } from "react";

import {
  createFallbackAvatarUrl,
  createFullUrl,
  getAuthTokenFromCookies,
  getHostPortFromCookies,
  getHostPortFromStorage,
} from "../../services/user";
import { useDirectMessageConversations } from "../../services/useDirectMessageConversations";
import type { DirectMessageConversation } from "../../services/activitypub";
import type { SelectedFriendForDM } from "./DirectMessagesPanel";

interface DirectMessageConversationsPanelProps {
  /** Selected conversation — drives the active-row highlight. Null
   *  when the main pane is showing the Friends panel instead. */
  selectedFriendForDM: SelectedFriendForDM | null;
  /** Open this conversation in the main pane. Same callback shape
   *  the Friends panel uses for "click friend → open DM," so the
   *  two surfaces share one source of truth in the parent. */
  onOpenDirectMessage: (friend: SelectedFriendForDM) => void;
  /** Clear the current conversation and surface the Friends panel.
   *  The header's "Friends" button uses this. */
  onShowFriends: () => void;
}

export function DirectMessageConversationsPanel({
  selectedFriendForDM,
  onOpenDirectMessage,
  onShowFriends,
}: DirectMessageConversationsPanelProps) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;

  const { data: conversations = [], isLoading } = useDirectMessageConversations(
    hostPort,
    authToken,
  );

  // Memoize the active id so the row-highlight check is O(1) per
  // row render rather than re-deriving on every render.
  const activeId = selectedFriendForDM?.userId ?? null;
  const sortedConversations = useMemo(() => conversations, [conversations]);

  return (
    <div className="flex h-full flex-col">
      {/* Header — same vertical rhythm as the channel sidebar
          header so swapping between the channel view and DM view
          doesn't shift the top of the column. The "Friends" button
          on the right is the affordance for surfacing the Friends
          tabs in the main pane — replaces the now-removed "this
          panel WAS the friends list" mental model. */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-3 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--color-text)]">
            Direct messages
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
            {sortedConversations.length === 0
              ? "Your conversations will appear here."
              : `${sortedConversations.length} conversation${sortedConversations.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onShowFriends}
          title="Open the friends tab in the main pane"
          aria-pressed={activeId === null}
          className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            activeId === null
              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          }`}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.4}
              d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Friends
        </button>
      </div>

      {/* Conversation list — scrollable. Empty / loading / loaded
          branches kept lean: each row is one click target with
          avatar, peer label, preview, and timestamp. */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && sortedConversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : sortedConversations.length === 0 ? (
          <EmptyState onShowFriends={onShowFriends} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {sortedConversations.map((conv) => {
              const isActive = activeId === conv.peer_user_id;
              return (
                <ConversationRow
                  key={conv.conversation_id}
                  conversation={conv}
                  active={isActive}
                  onClick={() =>
                    onOpenDirectMessage({
                      userId: conv.peer_user_id,
                      handle: conv.peer_username,
                      avatarUrl: conv.peer_avatar_url ?? null,
                    })
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Internal building blocks
// ─────────────────────────────────────────────────────────────────────

interface ConversationRowProps {
  conversation: DirectMessageConversation;
  active: boolean;
  onClick: () => void;
}

function ConversationRow({ conversation, active, onClick }: ConversationRowProps) {
  const avatarSrc =
    createFullUrl(conversation.peer_avatar_url ?? undefined) ||
    createFallbackAvatarUrl(conversation.peer_username || conversation.peer_user_id);

  // Presence dot tone — same palette the friend rows use so the
  // two surfaces agree on what each color means.
  const presenceClass = ((): string => {
    const status = conversation.peer_status || "offline";
    if (status === "online") return "bg-[var(--color-success)]";
    if (status === "idle" || status === "afk") return "bg-[var(--color-warning)]";
    if (status === "dnd") return "bg-[var(--color-error)]";
    return "bg-[var(--color-text-muted)]";
  })();

  // Preview prefix: "You: " for outgoing latest messages so the
  // user can tell at a glance whether they're waiting on a reply
  // or owe one. Same prefix Discord / iMessage use.
  const preview = conversation.last_message_preview || (
    conversation.last_message_at ? "" : "No messages yet"
  );
  const previewWithPrefix = conversation.last_message_sender_is_me && preview
    ? `You: ${preview}`
    : preview;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
          active
            ? "bg-[var(--color-active)]"
            : "hover:bg-[var(--color-hover)]"
        }`}
      >
        <div className="relative shrink-0">
          <img
            src={avatarSrc}
            alt=""
            className="h-9 w-9 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] object-cover"
          />
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-background)] ${presenceClass}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text)]">
              {conversation.peer_username || conversation.peer_user_id}
            </span>
            {conversation.last_message_at ? (
              <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-muted)]">
                {formatRelativeShort(conversation.last_message_at)}
              </span>
            ) : null}
          </div>
          {previewWithPrefix ? (
            <div className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
              {previewWithPrefix}
            </div>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function EmptyState({ onShowFriends }: { onShowFriends: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">
        No conversations yet
      </h2>
      <p className="mt-2 max-w-[32ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
        Start a DM by opening the Friends panel and clicking a friend.
      </p>
      <button
        type="button"
        onClick={onShowFriends}
        className="mt-4 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
      >
        Open Friends
      </button>
    </div>
  );
}

/**
 * Compact relative timestamp for the conversation row.
 *
 *   - <1m ago    → "now"
 *   - <60m ago   → "12m"
 *   - <24h ago   → "3h"
 *   - <7d ago    → "2d"
 *   - older      → "May 24"
 *
 * Chosen for one-glance scanability: the operator wants to know
 * "is this stale or fresh," not the exact second.
 */
function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
