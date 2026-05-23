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
 *     and Block, and clicking the row opens a DM chat view in the
 *     main pane (handled by `onOpenDirectMessage` from the parent).
 *   * Pending — incoming + outgoing requests, separated by header.
 *     Incoming rows offer Accept / Reject / Block; outgoing offer
 *     Cancel.
 *   * Blocked — users the viewer has stopped from sending requests.
 *     Each row offers Unblock.
 *
 * Top-right of the panel header carries an "Add Friend" button that
 * opens a modal taking `username + instance origin` (with a "This
 * instance" radio for local lookups). The modal flows through
 * `useFriendGraphMutations.sendRequestByHandle` so federated targets
 * are resolved via WebFinger server-side and a shadow row is created
 * for the remote actor on first add.
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
import {
  formatFriendHandle,
  type Friendship,
} from "../../services/friends";
import { Modal } from "../ui/Modal";
import type { ShowToast } from "../Toast";

type TabId = "friends" | "pending" | "blocked";

export interface SelectedFriendForDM {
  /** Friend's local-DB `user_id` (or shadow user_id for federated). */
  userId: string;
  /** Their display handle — pre-formatted via `formatFriendHandle`,
   *  so callers can use it as a header subtitle without re-deriving. */
  handle: string;
}

interface DirectMessagesPanelProps {
  /** Shared toast for surfacing server errors (e.g. 403 from a
   *  blocked recipient on send_request). */
  showToast: ShowToast;
  /** The friend currently being chatted with — used to render the
   *  active selection state in the Friends tab. Null when no
   *  conversation is open. */
  selectedFriendForDM: SelectedFriendForDM | null;
  /** Fired when the user clicks a friend row in the Friends tab.
   *  The parent owns the chat view and responds by rendering it
   *  in the main pane. */
  onOpenDirectMessage: (friend: SelectedFriendForDM) => void;
}

export function DirectMessagesPanel({
  showToast,
  selectedFriendForDM,
  onOpenDirectMessage,
}: DirectMessagesPanelProps) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;

  const { data: currentUser } = useCurrentUserProfile();
  const { snapshot, isLoading } = useFriendGraph(hostPort, authToken);
  const {
    accept,
    cancelOrReject,
    unfriend,
    block,
    unblock,
  } = useFriendGraphMutations(hostPort, authToken);

  const [tab, setTab] = useState<TabId>("friends");
  const [addFriendOpen, setAddFriendOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header — title + the top-right Add Friend trigger. Same
          vertical rhythm as ChannelSidebarHeader so the panel
          handoff doesn't jump when toggling. */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-3 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--color-text)]">
            Friends
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
            Friend requests, friends, and blocked users
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddFriendOpen(true)}
          title="Send a friend request by username and instance"
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
          </svg>
          Add Friend
        </button>
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

      {/* Body — scrollable. */}
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
              body="Click Add Friend to send a request — by username on this instance, or by username + instance origin to a federated user."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {snapshot.friends.map((row) => {
                const handle = formatFriendHandle(row);
                const isActive =
                  !!selectedFriendForDM &&
                  selectedFriendForDM.userId === row.other_user_id;
                return (
                  <FriendshipRow
                    key={row.friendship_id}
                    row={row}
                    variant="friend"
                    currentUserId={currentUser?.user_id}
                    selected={isActive}
                    onOpen={() =>
                      row.other_user_id &&
                      onOpenDirectMessage({
                        userId: row.other_user_id,
                        handle,
                      })
                    }
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
                );
              })}
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
              {snapshot.blocks.map((row) => {
                const username = row.blocked_username?.trim() || row.blocked_id;
                const origin = row.blocked_origin_server?.trim();
                const display = origin ? `${username}@${origin}` : username;
                return (
                  <li
                    key={row.blocked_id}
                    className="flex items-center gap-3 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                      {display}
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
                );
              })}
            </ul>
          )
        )}
      </div>

      <AddFriendModal
        isOpen={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
        showToast={showToast}
      />
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
      <p className="mt-2 max-w-[32ch] text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}

/**
 * One row per friendship / pending request. `variant` controls
 * which action buttons appear. `onOpen` is only wired for accepted
 * friend rows — clicking them tells the parent to open the DM
 * chat view in the main pane.
 *
 * The identifier rendered is the formatted handle
 * (`username` for local, `username@host` for federated) via
 * `formatFriendHandle`. Falls back to the raw `user_id` only if the
 * server failed to hydrate identity — defensive against an older
 * server build.
 */
function FriendshipRow({
  row,
  variant,
  currentUserId,
  selected = false,
  onOpen,
  onAccept,
  onReject,
  onCancel,
  onUnfriend,
  onBlock,
}: {
  row: Friendship;
  variant: "friend" | "incoming" | "outgoing";
  currentUserId: string | undefined;
  selected?: boolean;
  onOpen?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onUnfriend?: () => void;
  onBlock?: () => void;
}) {
  const handle = formatFriendHandle({
    other_user_id:
      row.other_user_id ??
      (currentUserId && row.requester_id === currentUserId
        ? row.addressee_id
        : row.requester_id),
    other_username: row.other_username,
    other_origin_server: row.other_origin_server,
  });

  // Only friend rows are clickable; pending rows are passive (the
  // actions are the only thing the user can do with them).
  const clickable = variant === "friend" && !!onOpen;

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors ${
        clickable ? "cursor-pointer" : ""
      } ${
        selected
          ? "bg-[var(--color-active)]"
          : clickable
            ? "hover:bg-[var(--color-hover)]"
            : ""
      }`}
      onClick={() => {
        if (clickable && onOpen) onOpen();
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--color-text)]">{handle}</div>
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
      <div
        className="flex shrink-0 items-center gap-1"
        // Action buttons sit on top of the row's click handler.
        // Stop propagation so e.g. "Unfriend" doesn't also fire
        // "open chat" on its way up.
        onClick={(e) => e.stopPropagation()}
      >
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

/**
 * Add Friend modal — username + instance picker.
 *
 * Two instance choices via a radio pair:
 *   * "This instance" (default) — sends the request as a
 *     local username lookup; server resolves via `users.username`.
 *   * "Other instance" — reveals a host input that the server
 *     WebFingers to find the remote actor. Creates a shadow
 *     `users` row on first add so future listings render the
 *     federated handle natively.
 *
 * Submit gates on a non-empty username. Errors come back from the
 * server via the showToast channel — most commonly a 404 with a
 * "couldn't find X@Y" hint when the handle doesn't resolve.
 */
function AddFriendModal({
  isOpen,
  onClose,
  showToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  showToast: ShowToast;
}) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;
  const { sendRequestByHandle } = useFriendGraphMutations(hostPort, authToken);

  const [username, setUsername] = useState("");
  const [instanceMode, setInstanceMode] = useState<"this" | "other">("this");
  const [originHost, setOriginHost] = useState("");

  const reset = () => {
    setUsername("");
    setInstanceMode("this");
    setOriginHost("");
  };
  const handleClose = () => {
    if (!sendRequestByHandle.isPending) {
      reset();
      onClose();
    }
  };

  const canSubmit =
    username.trim().length > 0 &&
    (instanceMode === "this" || originHost.trim().length > 0) &&
    !sendRequestByHandle.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    sendRequestByHandle.mutate(
      {
        username: username.trim(),
        originServer:
          instanceMode === "this" ? undefined : originHost.trim(),
      },
      {
        onSuccess: () => {
          showToast({
            message: "Friend request sent.",
            tone: "success",
            category: "system",
          });
          reset();
          onClose();
        },
        onError: (err) => {
          showToast({
            message:
              err instanceof Error
                ? err.message
                : "Failed to send friend request.",
            tone: "error",
            category: "system",
          });
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add friend"
      description="Send a friend request by username. Pick the instance the user belongs to."
      widthClassName="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="add-friend-username"
            className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            Username
          </label>
          <input
            id="add-friend-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="alice"
            autoFocus
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            Instance
          </legend>
          {/* Two compact radio rows. Picking "Other instance" reveals
              the host input below so the modal stays focused at
              first glance and only grows when the user actually
              needs the federated field. */}
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm">
              <input
                type="radio"
                name="add-friend-instance"
                value="this"
                checked={instanceMode === "this"}
                onChange={() => setInstanceMode("this")}
              />
              <span className="text-[var(--color-text)]">This instance</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                Local lookup
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm">
              <input
                type="radio"
                name="add-friend-instance"
                value="other"
                checked={instanceMode === "other"}
                onChange={() => setInstanceMode("other")}
              />
              <span className="text-[var(--color-text)]">Other instance</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                Federated via WebFinger
              </span>
            </label>
          </div>

          {instanceMode === "other" && (
            <div className="mt-3">
              <label
                htmlFor="add-friend-origin"
                className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
              >
                Instance host
              </label>
              <input
                id="add-friend-origin"
                type="text"
                value={originHost}
                onChange={(e) => setOriginHost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="mastodon.example"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                The remote instance's hostname (no <code>http(s)://</code>).
              </p>
            </div>
          )}
        </fieldset>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={sendRequestByHandle.isPending}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {sendRequestByHandle.isPending ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
