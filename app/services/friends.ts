/**
 * Friends service — thin TypeScript wrapper over the server's
 * `/api/v1/friends/*` endpoints.
 *
 * Foundation pass: just the network surface + types. No React hooks,
 * no caching, no realtime invalidations yet — the Friends panel UI
 * lands in a follow-up commit and that's where we'll wire the
 * data into the dashboard's existing query layer.
 *
 * Server contract reference (kept in sync with
 * `pufferblow/api/routes/friends.py`):
 *
 *   POST   /api/v1/friends/requests                    → send request
 *   GET    /api/v1/friends/requests                    → { incoming, outgoing }
 *   POST   /api/v1/friends/requests/{id}/accept        → accept
 *   DELETE /api/v1/friends/requests/{id}               → cancel / reject
 *   GET    /api/v1/friends                              → list friends
 *   DELETE /api/v1/friends/{other_user_id}             → unfriend
 */
import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export type FriendshipStatus = 'pending' | 'accepted';

/**
 * Server-side `Friendships.to_dict()` shape, plus the `other_user_id`
 * convenience the manager attaches on listing endpoints so the UI
 * doesn't have to compare against the current user's id row-by-row.
 *
 * `other_user_id` is absent on the response of `sendFriendRequest`
 * and `acceptFriendRequest` (those return the raw row before
 * perspective is applied), so it's optional on the type.
 */
export interface Friendship {
  friendship_id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string | null;
  updated_at: string | null;
  /** Set by the listing endpoints (list_friends, list_pending). */
  other_user_id?: string;
  /** The other side's username, joined server-side from the users
   *  table. Set by the listing endpoints. Absent on the immediate
   *  `sendFriendRequest` / `acceptFriendRequest` responses (those
   *  return the raw friendship row without identity hydration). */
  other_username?: string;
  /** The other side's `origin_server` value. Empty string means
   *  "this instance" — the client should render `username` alone
   *  in that case; otherwise `username@origin_server`. */
  other_origin_server?: string;
}

/**
 * Pure formatter for the "Friends panel row" identifier display.
 * Empty origin → just the username (local user); non-empty origin
 * → `username@host`. Falls back to the user_id when neither is
 * available (defensive — shouldn't happen given the new server-
 * side hydration).
 */
export const formatFriendHandle = (
  friendship: Pick<Friendship, 'other_user_id' | 'other_username' | 'other_origin_server'>,
): string => {
  const username = friendship.other_username?.trim();
  if (!username) return friendship.other_user_id || '';
  const origin = friendship.other_origin_server?.trim();
  return origin ? `${username}@${origin}` : username;
};

export interface SendFriendRequestResponse {
  status_code: number;
  friendship: Friendship;
}

export interface ListFriendRequestsResponse {
  status_code: number;
  incoming: Friendship[];
  outgoing: Friendship[];
}

export interface AcceptFriendRequestResponse {
  status_code: number;
  friendship: Friendship;
}

export interface CancelOrRejectResponse {
  status_code: number;
  deleted: boolean;
}

export interface ListFriendsResponse {
  status_code: number;
  friends: Friendship[];
}

export interface UnfriendResponse {
  status_code: number;
  removed: boolean;
}

/**
 * Send a friend request to a user by their LOCAL `user_id`.
 *
 * Used by call sites that already hold the local UUID — the
 * UserCard's "Add Friend" button, the MessageContextMenu's
 * "Send Friend Request" row. Idempotent: if a row exists in any
 * state the server returns it unchanged; inspect
 * `friendship.status` to know whether the action moved the graph.
 */
export const sendFriendRequest = async (
  hostPort: string,
  authToken: string,
  targetUserId: string,
): Promise<ApiResponse<SendFriendRequestResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post<SendFriendRequestResponse>(
    `/api/v1/friends/requests?auth_token=${encodeURIComponent(authToken)}`,
    { target_user_id: targetUserId },
  );
};

/**
 * Send a friend request by handle (username + instance).
 *
 * Two shapes the modal uses:
 *   * `{ username: "alice" }` (or `originServer` blank/undefined) →
 *     "This instance" — server does a local username lookup.
 *   * `{ username: "alice", originServer: "mastodon.example" }` →
 *     server WebFingers the remote actor, creates a shadow `users`
 *     row on first add, and returns the friendship targeting that
 *     shadow's user_id. Subsequent listings hydrate the same
 *     username + origin back so the row renders as
 *     `alice@mastodon.example` everywhere.
 *
 * Returns the same response shape as `sendFriendRequest`. On
 * 404 the server's `error` includes a "couldn't find X@Y" hint
 * that the modal surfaces to the user.
 */
export const sendFriendRequestByHandle = async (
  hostPort: string,
  authToken: string,
  args: { username: string; originServer?: string },
): Promise<ApiResponse<SendFriendRequestResponse>> => {
  const apiClient = createApiClient(hostPort);
  const body: Record<string, string> = {
    target_username: args.username.trim(),
  };
  const origin = (args.originServer ?? '').trim();
  if (origin) {
    body.target_origin_server = origin;
  }
  return apiClient.post<SendFriendRequestResponse>(
    `/api/v1/friends/requests?auth_token=${encodeURIComponent(authToken)}`,
    body,
  );
};

/**
 * Fetch every pending friend request involving the viewer. The
 * response is split by direction so the UI can label each section
 * ("Sent" vs "Received") without re-deriving from requester /
 * addressee on every render.
 */
export const listFriendRequests = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<ListFriendRequestsResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListFriendRequestsResponse>(
    '/api/v1/friends/requests',
    { auth_token: authToken },
  );
};

/**
 * Accept a pending friend request. Server enforces that only the
 * addressee can accept; the viewer's own auth-token is the actor.
 */
export const acceptFriendRequest = async (
  hostPort: string,
  authToken: string,
  friendshipId: string,
): Promise<ApiResponse<AcceptFriendRequestResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post<AcceptFriendRequestResponse>(
    `/api/v1/friends/requests/${friendshipId}/accept?auth_token=${encodeURIComponent(authToken)}`,
  );
};

/**
 * Cancel (if the viewer is the sender) or reject (if the viewer is
 * the recipient) a pending request. The resulting DB state is the
 * same in both cases: the row is deleted.
 */
export const cancelOrRejectFriendRequest = async (
  hostPort: string,
  authToken: string,
  friendshipId: string,
): Promise<ApiResponse<CancelOrRejectResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<CancelOrRejectResponse>(
    `/api/v1/friends/requests/${friendshipId}`,
    { auth_token: authToken },
  );
};

/**
 * Return the viewer's accepted friends. Each entry carries
 * `other_user_id` (the side of the pair that isn't the viewer)
 * so the client can resolve avatars / usernames in one pass
 * through the existing users cache.
 */
export const listFriends = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<ListFriendsResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListFriendsResponse>('/api/v1/friends', {
    auth_token: authToken,
  });
};

/**
 * Remove a friendship by the other side's user_id. Idempotent —
 * `removed: false` means there was no accepted relationship to
 * remove. Lets the UI treat "unfriend a stranger" the same as
 * "unfriend a friend."
 */
export const unfriendUser = async (
  hostPort: string,
  authToken: string,
  otherUserId: string,
): Promise<ApiResponse<UnfriendResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<UnfriendResponse>(
    `/api/v1/friends/${otherUserId}`,
    { auth_token: authToken },
  );
};

// ─────────────────────────────────────────────────────────────────────
// Friend-request blocks
// ─────────────────────────────────────────────────────────────────────

/**
 * One row from `GET /api/v1/friends/blocks`. Matches the server-side
 * `FriendRequestBlocks.to_dict()` shape.
 */
export interface FriendRequestBlock {
  blocker_id: string;
  blocked_id: string;
  created_at: string | null;
  /** Hydrated from `users.username` by `list_blocks` server-side
   *  so the Blocked tab can render `<username>@<origin>` instead
   *  of a raw user_id. Absent on the immediate `block` response. */
  blocked_username?: string;
  blocked_origin_server?: string;
}

export interface BlockFriendRequestsResponse {
  status_code: number;
  block: FriendRequestBlock;
}

export interface UnblockFriendRequestsResponse {
  status_code: number;
  removed: boolean;
}

export interface ListFriendRequestBlocksResponse {
  status_code: number;
  blocks: FriendRequestBlock[];
}

/**
 * Block incoming friend requests from `targetUserId`. Side effect:
 * any pending request from that user toward the viewer is deleted
 * server-side in the same transaction. An ACCEPTED friendship is
 * NOT affected — to also end the friendship the client should call
 * `unfriendUser` separately.
 *
 * The server's `sendFriendRequest` rejection for blocked senders
 * comes back as a generic "this user is not accepting friend
 * requests" 403 — the wire surface deliberately doesn't reveal
 * block status to the would-be sender.
 */
export const blockFriendRequests = async (
  hostPort: string,
  authToken: string,
  targetUserId: string,
): Promise<ApiResponse<BlockFriendRequestsResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post<BlockFriendRequestsResponse>(
    `/api/v1/friends/blocks?auth_token=${encodeURIComponent(authToken)}`,
    { target_user_id: targetUserId },
  );
};

/**
 * Lift a friend-request block. Idempotent — `removed: false`
 * means there was no block to remove.
 */
export const unblockFriendRequests = async (
  hostPort: string,
  authToken: string,
  blockedUserId: string,
): Promise<ApiResponse<UnblockFriendRequestsResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<UnblockFriendRequestsResponse>(
    `/api/v1/friends/blocks/${blockedUserId}`,
    { auth_token: authToken },
  );
};

/**
 * Return every user the viewer has blocked from sending requests.
 * The Friends panel renders the result in its "Blocked" tab.
 */
export const listFriendRequestBlocks = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<ListFriendRequestBlocksResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListFriendRequestBlocksResponse>(
    '/api/v1/friends/blocks',
    { auth_token: authToken },
  );
};
