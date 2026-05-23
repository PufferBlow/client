/**
 * Channel-sidebar slot that fills the column when the user has the
 * rail's "Direct messages" affordance selected.
 *
 * Today this is the FRIENDS panel — actual DM conversations don't
 * have a wire surface yet, but the friend graph does, and the
 * client-side affordance (Add Friend / accept / cancel / unfriend /
 * block / unblock) all live in one place here. When the
 * `/api/v1/dms/*` endpoint family lands, the active "Friends" tab
 * becomes one of several (Friends / DMs / …) inside the same shell.
 *
 * Three tabs:
 *   * Friends — accepted relationships. Each row offers Unfriend
 *     and Block.
 *   * Pending — incoming + outgoing requests, separated by header.
 *     Incoming rows offer Accept / Reject / Block; outgoing offer
 *     Cancel.
 *   * Blocked — users the viewer has stopped from sending requests.
 *     Each row offers Unblock.
 *
 * Plus a persistent "Add friend by user ID" composer at the top so
 * a user can send a request without needing the target's
 * UserCard in front of them.
 *
 * All reads + mutations flow through `useFriendGraph` /
 * `useFriendGraphMutations` so this panel + the UserCard popout +
 * the message context menu stay in sync. Optimistic UI is
 * deliberately NOT used here — the operations are infrequent and
 * the round-trip cost (~50ms typical) is fine for the truthful
 * "did the server confirm it" feedback loop.
 */
import { useMemo, useState } from "react";
import {
  getAuthTokenFromCookies,
  getHostPortFromCookies,
  getHostPortFromStorage,
  useCurrentUserProfile,
} from "../../services/user";
import {
  useFriendGraph,
  useFriendGraphMutations,
} from "../../services/useFriendGraph";
import type { Friendship } from "../../services/friends";
import type { ShowToast } from "../Toast";

type TabId = "friends" | "pending" | "blocked";

interface DirectMessagesPanelProps {
  /** Shared toast for surfacing server errors (e.g. 403 from a
   *  blocked recipient on send_request). */
  showToast: ShowToast;
}

export function DirectMessagesPanel({ showToast }: DirectMessagesPanelProps) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;

  const { data: currentUser } = useCurrentUserProfile();
  const { snapshot, isLoading } = useFriendGraph(hostPort, authToken);
  const {
    sendRequest,
    accept,
    cancelOrReject,
    unfriend,
    block,
    unblock,
  } = useFriendGraphMutations(hostPort, authToken);

  const [tab, setTab] = useState<TabId>("friends");
  const [addInput, setAddInput] = useState("");

  // Hoisted "throw a server error onto a toast" helper — every
  // mutation handler below shares the same shape.
  const surfaceMutationError = (err: unknown) => {
    showToast({
      message:
        err instanceof Error ? err.message : "Friend action failed.",
      tone: "error",
      category: "system",
    });
  };

  const pendingCount = useMemo(
    () =>
      (snapshot?.incoming.length ?? 0) +
      (snapshot?.outgoing.length ?? 0),
    [snapshot?.incoming.length, snapshot?.outgoing.length],
  );
  const friendsCount = snapshot?.friends.length ?? 0;
  const blockedCount = snapshot?.blocks.length ?? 0;

  const handleSendRequest = () => {
    const target = addInput.trim();
    if (!target) return;
    sendRequest.mutate(target, {
      onSuccess: () => {
        setAddInput("");
        showToast({
          message: "Friend request sent.",
          tone: "success",
          category: "system",
        });
      },
      onError: surfaceMutationError,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — same vertical rhythm as ChannelSidebarHeader so
          the panel handoff doesn't jump when toggling between
          server view and DM view. */}
      <div className="border-b border-[var(--color-border)] px-3 py-3">
        <h1 className="text-base font-bold text-[var(--color-text)]">
          Friends
        </h1>
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
          Manage friend requests, friends, and blocked users
        </p>
      </div>

      {/* Add Friend composer — kept above the tab strip because it
          works regardless of which tab is active. Send-button is
          gated on non-empty input. */}
      <div className="border-b border-[var(--color-border)] px-3 py-3">
        <label
          htmlFor="dm-panel-add-friend"
          className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Add friend by user ID
        </label>
        <div className="flex gap-2">
          <input
            id="dm-panel-add-friend"
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendRequest();
            }}
            placeholder="user_id…"
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2.5 py-1.5 text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
          <button
            type="button"
            onClick={handleSendRequest}
            disabled={!addInput.trim() || sendRequest.isPending}
            className="shrink-0 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {sendRequest.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>

      {/* Tab strip. Counts only render when the bucket has rows so
          empty tabs don't carry a stale " (0)" suffix. */}
      <div className="flex border-b border-[var(--color-border)] text-xs">
        <TabButton
          label="Friends"
          count={friendsCount}
          active={tab === "friends"}
          onClick={() => setTab("friends")}
        />
        <TabButton
          label="Pending"
          count={pendingCount}
          active={tab === "pending"}
          onClick={() => setTab("pending")}
        />
        <TabButton
          label="Blocked"
          count={blockedCount}
          active={tab === "blocked"}
          onClick={() => setTab("blocked")}
        />
      </div>

      {/* Body — scrollable. Three branches one per tab; each
          branch renders an EmptyState when its bucket is empty. */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !snapshot && (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">
            Loading…
          </div>
        )}

        {tab === "friends" && snapshot && (
          snapshot.friends.length === 0 ? (
            <EmptyState
              title="No friends yet"
              body="Send someone a friend request to get started."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {snapshot.friends.map((row) => (
                <FriendshipRow
                  key={row.friendship_id}
                  row={row}
                  variant="friend"
                  currentUserId={currentUser?.user_id}
                  onUnfriend={() =>
                    unfriend.mutate(row.other_user_id ?? "", {
                      onError: surfaceMutationError,
                    })
                  }
                  onBlock={() =>
                    block.mutate(row.other_user_id ?? "", {
                      onError: surfaceMutationError,
                    })
                  }
                />
              ))}
            </ul>
          )
        )}

        {tab === "pending" && snapshot && (
          snapshot.incoming.length === 0 &&
          snapshot.outgoing.length === 0 ? (
            <EmptyState
              title="No pending requests"
              body="Friend requests you send or receive will show up here."
            />
          ) : (
            <>
              {snapshot.incoming.length > 0 && (
                <>
                  <SectionLabel>Incoming</SectionLabel>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {snapshot.incoming.map((row) => (
                      <FriendshipRow
                        key={row.friendship_id}
                        row={row}
                        variant="incoming"
                        currentUserId={currentUser?.user_id}
                        onAccept={() =>
                          accept.mutate(row.friendship_id, {
                            onError: surfaceMutationError,
                          })
                        }
                        onReject={() =>
                          cancelOrReject.mutate(row.friendship_id, {
                            onError: surfaceMutationError,
                          })
                        }
                        onBlock={() =>
                          block.mutate(row.requester_id, {
                            onError: surfaceMutationError,
                          })
                        }
                      />
                    ))}
                  </ul>
                </>
              )}
              {snapshot.outgoing.length > 0 && (
                <>
                  <SectionLabel>Sent</SectionLabel>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {snapshot.outgoing.map((row) => (
                      <FriendshipRow
                        key={row.friendship_id}
                        row={row}
                        variant="outgoing"
                        currentUserId={currentUser?.user_id}
                        onCancel={() =>
                          cancelOrReject.mutate(row.friendship_id, {
                            onError: surfaceMutationError,
                          })
                        }
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )
        )}

        {tab === "blocked" && snapshot && (
          snapshot.blocks.length === 0 ? (
            <EmptyState
              title="No one blocked"
              body="Blocking a user stops them from sending you friend requests. Existing friendships aren't affected."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {snapshot.blocks.map((row) => (
                <li
                  key={row.blocked_id}
                  className="flex items-center gap-3 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                    {row.blocked_id}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      unblock.mutate(row.blocked_id, {
                        onError: surfaceMutationError,
                      })
                    }
                    className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Internal building blocks
// ─────────────────────────────────────────────────────────────────────

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)]"
          : "border-b-2 border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)]">
          {count}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      <p className="mt-2 max-w-[28ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}

/**
 * One row per friendship / pending request. The `variant` controls
 * which action buttons appear on the right.
 *
 * The other-side identifier we render today is the raw user_id;
 * once a `GET /users/{user_id}` lookup is wired into the panel
 * (or once the listing endpoints return the joined username +
 * avatar) this can switch to the proper display name. Server-side
 * the hydration would just be an additional join in
 * `FriendsManager.list_friends` / `list_pending`.
 */
function FriendshipRow({
  row,
  variant,
  currentUserId,
  onAccept,
  onReject,
  onCancel,
  onUnfriend,
  onBlock,
}: {
  row: Friendship;
  variant: "friend" | "incoming" | "outgoing";
  currentUserId: string | undefined;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onUnfriend?: () => void;
  onBlock?: () => void;
}) {
  const otherUserId =
    row.other_user_id ??
    (currentUserId && row.requester_id === currentUserId
      ? row.addressee_id
      : row.requester_id);

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--color-text)]">{otherUserId}</div>
        {variant === "outgoing" && (
          <div className="text-[10px] text-[var(--color-text-muted)]">
            Awaiting reply
          </div>
        )}
        {variant === "incoming" && (
          <div className="text-[10px] text-[var(--color-text-muted)]">
            Wants to be friends
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {variant === "incoming" && onAccept && (
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-2 py-1 text-[10px] font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Accept
          </button>
        )}
        {variant === "incoming" && onReject && (
          <button
            type="button"
            onClick={onReject}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            Reject
          </button>
        )}
        {variant === "outgoing" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
        {variant === "friend" && onUnfriend && (
          <button
            type="button"
            onClick={onUnfriend}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            Unfriend
          </button>
        )}
        {(variant === "friend" || variant === "incoming") && onBlock && (
          <button
            type="button"
            onClick={onBlock}
            className="rounded-md border border-[var(--color-error)]/40 px-2 py-1 text-[10px] font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10"
            title="Stop incoming friend requests from this user"
          >
            Block
          </button>
        )}
      </div>
    </li>
  );
}
