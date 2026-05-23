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
}

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
 * Send a friend request to `targetUserId`. Idempotent — if a row
 * already exists in any state, the server returns that row instead
 * of creating a duplicate. Inspect `response.data.friendship.status`
 * to know whether the action actually moved the graph.
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
