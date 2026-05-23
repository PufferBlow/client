/**
 * Direct-message chat surface rendered in the main pane when the
 * user opens a DM from the Friends panel.
 *
 * Federated: the underlying `/api/v1/dms/messages` and
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
 * WS handler. The interface here doesn't change.
 *
 * Scope is intentionally lean: header (friend handle + back),
 * scrolling message list, single-line composer. No reactions, no
 * attachments, no read receipts. Those can layer in alongside the
 * channel chat's equivalents once the DM surface graduates from
 * "v1 wires" to "v1 polish."
 */
import { useEffect, useRef, useState } from "react";
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
    // Stop the poll when the tab is in the background — the
    // standard react-query behaviour suffices here, no custom
    // gate needed.
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
      // tight. No optimistic insert because we don't have a
      // server-assigned message_id on the wire yet.
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages. Same heuristic the
  // channel chat uses: pin to the bottom if the user was already
  // near the bottom; otherwise leave their scroll position alone
  // so they can read older messages without being yanked down.
  const messages = messagesQuery.data?.messages ?? [];
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — friend handle + back button. Mirrors the channel
          chat's header height so swapping between channel and DM
          views doesn't shift the composer position. */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to Friends"
          aria-label="Back to friends list"
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            @{peerHandle}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Direct message
          </div>
        </div>
      </div>

      {/* Message list. Empty state when there are no messages yet so
          the user knows they're in the right view but the
          conversation just hasn't started. */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messagesQuery.isLoading && messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              No messages yet
            </h2>
            <p className="mt-2 max-w-[32ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
              This is the beginning of your conversation with
              {" "}<span className="text-[var(--color-text)]">@{peerHandle}</span>.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => (
              <DirectMessageRow key={message.message_id} message={message} />
            ))}
          </ul>
        )}
      </div>

      {/* Composer — single line, Enter sends, Shift+Enter newline
          (matches the channel composer's contract so muscle memory
          transfers). Send button is gated on non-empty trimmed
          input + no in-flight send. */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={`Message @${peerHandle}`}
            className="min-h-[2.25rem] flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
            className="shrink-0 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {sendMutation.isPending ? "Sending…" : "Send"}
          </button>
        </div>
        {sendMutation.isError && (
          <div className="mt-1 text-[10px] text-[var(--color-error)]">
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : "Send failed."}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One message bubble. Lean — no avatars, no role tints, no reaction
 * shelf. Sender username on top, message body below, timestamp
 * tucked at the right edge of the header row.
 */
function DirectMessageRow({ message }: { message: DirectMessagePayload }) {
  const sender = message.username || message.sender_user_id || message.sender_id || "Unknown";
  const ts = message.sent_at
    ? new Date(message.sent_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <li className="rounded-md px-2 py-1.5 hover:bg-[var(--color-hover)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs font-semibold text-[var(--color-text)]">
          {sender}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">{ts}</span>
      </div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">
        {message.message}
      </div>
    </li>
  );
}
