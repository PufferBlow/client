/**
 * Direct-message chat surface rendered in the main pane when the
 * user opens a DM from the Friends panel.
 *
 * Visual style mirrors the channel chat surface — same scrolling
 * message list rhythm, grouped messages with avatar + username +
 * timestamp header, and a composer wrapped in the same
 * rounded-xl bordered surface with the "Enter to send · Shift+Enter
 * for newline · char counter" footer. Layout decisions intentionally
 * track DashboardPage's channel branch (not extracted into a shared
 * component yet — that's a real refactor; this rewrite just makes
 * the surfaces look like they belong to the same product).
 *
 * Federation: the underlying `/api/v1/dms/messages` and
 * `/api/v1/dms/send` endpoints accept a `peer` value that can be a
 * local user_id, a username, an actor URI, or `user@instance`. We
 * pass the friend's local-DB `user_id` (which the server side will
 * resolve through `ActivityPubManager._resolve_peer` — for shadow
 * users that round-trips out to the remote actor on first send,
 * cached afterwards).
 *
 * Realtime: this iteration polls every 5 seconds via react-query's
 * `refetchInterval`. The global WS doesn't carry DM events today —
 * once it does, swap the poll for an in-memory append fed by the
 * WS handler. The component interface here doesn't change.
 *
 * Scope intentionally still lean: no attachments, no emoji picker,
 * no reactions, no replies. The composer mirrors the channel one
 * minus those affordances — they can layer in alongside their
 * channel-side equivalents once the wire surface supports them.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  loadDirectMessages,
  sendDirectMessage,
  type DirectMessagePayload,
} from "../../services/activitypub";
import {
  createFallbackAvatarUrl,
  getAuthTokenFromCookies,
  getHostPortFromCookies,
  getHostPortFromStorage,
} from "../../services/user";

interface DirectMessageViewProps {
  /** The friend's local-DB user_id (or shadow user_id for federated).
   *  Used as the `peer` value the server resolves. */
  peerUserId: string;
  /** Pre-formatted handle for the header ("alice" or "alice@host"). */
  peerHandle: string;
  /** Back affordance — clears the selection in the parent so the
   *  user lands back on the DM "no conversation open" placeholder. */
  onBack: () => void;
}

const POLL_INTERVAL_MS = 5000;
const MESSAGES_PER_PAGE = 50;
const MAX_MESSAGE_LENGTH = 4000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Group consecutive messages from the same sender within a 5-min
 * window — same heuristic the channel chat uses so the visual
 * cadence (one avatar per "burst") is identical.
 */
function groupMessages(
  messages: DirectMessagePayload[],
): DirectMessagePayload[][] {
  const groups: DirectMessagePayload[][] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([msg]);
      continue;
    }
    const head = last[0];
    const sameSender =
      (msg.sender_user_id || msg.sender_id) ===
      (head.sender_user_id || head.sender_id);
    const headTs = head.sent_at ? new Date(head.sent_at).getTime() : 0;
    const msgTs = msg.sent_at ? new Date(msg.sent_at).getTime() : 0;
    const withinWindow =
      headTs && msgTs && Math.abs(msgTs - headTs) <= GROUP_WINDOW_MS;
    if (sameSender && withinWindow) {
      last.push(msg);
    } else {
      groups.push([msg]);
    }
  }
  return groups;
}

export function DirectMessageView({
  peerUserId,
  peerHandle,
  onBack,
}: DirectMessageViewProps) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;
  const queryClient = useQueryClient();

  const messagesQueryKey = ["dms", "messages", peerUserId] as const;

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: async () => {
      if (!hostPort || !authToken) {
        throw new Error("Not signed in.");
      }
      const response = await loadDirectMessages(
        authToken,
        peerUserId,
        1,
        MESSAGES_PER_PAGE,
        hostPort,
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load messages.");
      }
      return response.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!hostPort && !!authToken && !!peerUserId,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!hostPort || !authToken) throw new Error("Not signed in.");
      const response = await sendDirectMessage(
        {
          auth_token: authToken,
          peer: peerUserId,
          message: text,
        },
        hostPort,
      );
      if (!response.success) {
        throw new Error(response.error || "Failed to send message.");
      }
      return response.data;
    },
    onSuccess: () => {
      // Refetch immediately — the polling cycle would catch the
      // new message in <=5s, but we want the round-trip to feel
      // tight. No optimistic insert because the server's response
      // doesn't carry the final message_id on the wire today.
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = messagesQuery.data?.messages ?? [];
  const groups = useMemo(() => groupMessages(messages), [messages]);

  // Auto-scroll to bottom on new messages — same near-bottom
  // heuristic the channel chat uses so the user doesn't get
  // yanked down while reading older messages.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Auto-resize the composer textarea on input (cap at ~6 lines so
  // it never eats the message list). Mirrors the channel composer's
  // `resizeMessageComposer` behaviour at a smaller scale.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${next}px`;
  }, [draft]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
    setDraft("");
  };

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Header — same height/rhythm as ChatHeader so swapping
          between channel and DM views doesn't shift the composer
          position. Back button on the left + handle + subtitle. */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to Friends"
          aria-label="Back to friends list"
          className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img
          src={createFallbackAvatarUrl(peerHandle)}
          alt=""
          className="h-7 w-7 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)]"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            @{peerHandle}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Direct message
          </div>
        </div>
      </div>

      {/* Message list — same container shape as the channel scroller
          (`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4
          break-words`) so a DM and a channel feel like the same
          page with a different conversation in it. */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words"
      >
        {messagesQuery.isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="text-[var(--color-text-muted)] text-sm">Loading…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-[var(--color-text-secondary)]">
              <div className="text-[var(--color-text-muted)] text-sm">No messages yet</div>
              <div className="text-[var(--color-text-muted)] text-xs mt-1">
                This is the beginning of your conversation with @{peerHandle}
              </div>
            </div>
          </div>
        ) : (
          groups.map((group) => {
            const head = group[0];
            const sender =
              head.username || head.sender_user_id || head.sender_id || "Unknown";
            const headTs = head.sent_at
              ? new Date(head.sent_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "";
            return (
              <div
                key={head.message_id}
                // Mirror the channel row container: `group relative
                // flex items-start space-x-3 px-2 py-1 rounded`.
                // No hover bg — the channel rows dropped it for the
                // same reason, see DashboardPage row comment.
                className="group relative flex items-start space-x-3 px-2 py-1 rounded"
              >
                {/* Avatar — 40×40 round, same dimensions as channel
                    avatars. DiceBear fallback keyed on the sender's
                    display name so distinct senders get distinct
                    glyphs deterministically. */}
                <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)]">
                  <img
                    src={createFallbackAvatarUrl(sender)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-[var(--color-text)] font-medium select-text">
                      {sender}
                    </span>
                    <span className="text-[var(--color-text-secondary)] text-xs select-text">
                      {headTs}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.map((msg) => (
                      <div
                        key={msg.message_id}
                        className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words"
                      >
                        {msg.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer — same wrapper shell as the channel composer
          (`rounded-xl border bg-[var(--color-surface-secondary)]
          px-6 py-4`) with the same footer convention (Enter to
          send · Shift+Enter for newline · char counter). No
          attachment / emoji picker for DMs yet; the slot is
          reserved by the same flex layout so a future addition
          drops in without a visual jump. */}
      <div className="px-4 pb-4 pt-2">
        <div
          className={`relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-6 py-4 ${
            sendMutation.isPending ? "opacity-90" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message @${peerHandle}`}
                disabled={sendMutation.isPending}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none resize-none h-6 break-words overflow-wrap-anywhere disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="pb-icon-btn bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--color-primary)]"
              title={canSend ? "Send message" : "Type a message"}
              aria-label="Send message"
            >
              {sendMutation.isPending ? (
                <span
                  role="status"
                  aria-label="Sending"
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : (
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              <span>Enter to send</span>
              <span>Shift+Enter for newline</span>
              {sendMutation.isError && (
                <span className="text-[var(--color-error)]">
                  {sendMutation.error instanceof Error
                    ? sendMutation.error.message
                    : "Send failed"}
                </span>
              )}
            </div>
            <span>
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
