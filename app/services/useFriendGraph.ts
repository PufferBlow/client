/**
 * React-query hooks + a perspective resolver for the friend graph.
 *
 * One place owns the wire-data shape and the "what should the UI
 * say for THIS user" derivation. Three consumers today:
 *
 *   * `UserCard` (Add Friend button) — uses `useFriendGraph` to
 *     pick a label + onSelect handler per displayed user.
 *   * `MessageContextMenu` (Send Friend Request item) — same.
 *   * `DirectMessagesPanel` (Friends panel) — renders each query
 *     bucket directly.
 *
 * The viewer's own user_id is required for the "is this me?"
 * short-circuit; the perspective resolver also needs to map
 * the friend graph's directional edges (requester / addressee)
 * into the viewer-centric labels (incoming / outgoing).
 *
 * Cache keys are stable strings the mutations below invalidate so
 * the UI updates without a window reload after send / accept /
 * cancel / block.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  acceptFriendRequest,
  blockFriendRequests,
  cancelOrRejectFriendRequest,
  listFriendRequestBlocks,
  listFriendRequests,
  listFriends,
  sendFriendRequest,
  unblockFriendRequests,
  unfriendUser,
  type Friendship,
  type FriendRequestBlock,
} from './friends';

const FRIENDS_QK = ['friends', 'list'] as const;
const FRIEND_REQUESTS_QK = ['friends', 'requests'] as const;
const FRIEND_BLOCKS_QK = ['friends', 'blocks'] as const;

/** Tiny accumulator for the perspective resolver. */
export interface FriendGraphSnapshot {
  friends: Friendship[];
  incoming: Friendship[];
  outgoing: Friendship[];
  blocks: FriendRequestBlock[];
}

/**
 * Result of asking "what's my relationship with this user?"
 *
 *   * 'none'         — no edge in the graph. UI shows "Add Friend."
 *   * 'pending-out'  — viewer sent a request, awaiting their reply.
 *   * 'pending-in'   — they sent the viewer a request.
 *   * 'friends'      — accepted relationship.
 *   * 'blocked'      — viewer has blocked this user from sending requests.
 *   * 'self'         — this IS the viewer; no action shown.
 *
 * `friendship` is set for any non-'none' / non-'blocked' state so
 * the UI can use the friendship_id for accept / cancel calls.
 */
export type FriendEdgeState =
  | 'none'
  | 'pending-out'
  | 'pending-in'
  | 'friends'
  | 'blocked'
  | 'self';

export interface FriendEdge {
  state: FriendEdgeState;
  friendship?: Friendship;
}

/**
 * Pure perspective resolver: given a graph snapshot and a target
 * user, what's the edge between viewer and target?
 *
 * O(n) over the snapshot. The graph is small (a normal account has
 * tens of friends and a handful of pending), so it's cheaper than
 * indexing on every render.
 */
export function resolveFriendEdge(
  snapshot: FriendGraphSnapshot | undefined,
  viewerUserId: string | null | undefined,
  targetUserId: string | null | undefined,
): FriendEdge {
  if (!targetUserId) return { state: 'none' };
  if (viewerUserId && viewerUserId === targetUserId) return { state: 'self' };
  if (!snapshot) return { state: 'none' };

  // Block edges short-circuit before friend edges — a blocked user
  // can't be friends (the block flow deletes pending rows but
  // leaves accepted rows; if you blocked a current friend they
  // still register as a friend until the explicit unfriend).
  const block = snapshot.blocks.find((b) => b.blocked_id === targetUserId);
  if (block) return { state: 'blocked' };

  const accepted = snapshot.friends.find(
    (row) => row.other_user_id === targetUserId,
  );
  if (accepted) return { state: 'friends', friendship: accepted };

  const outgoing = snapshot.outgoing.find(
    (row) => row.addressee_id === targetUserId,
  );
  if (outgoing) return { state: 'pending-out', friendship: outgoing };

  const incoming = snapshot.incoming.find(
    (row) => row.requester_id === targetUserId,
  );
  if (incoming) return { state: 'pending-in', friendship: incoming };

  return { state: 'none' };
}

/**
 * Fetch the three friend-graph reads in parallel and roll them into
 * a single snapshot. React-query caches each list independently
 * under the keys above so a mutation can invalidate just one
 * bucket if it only touches one bucket.
 */
export function useFriendGraph(hostPort: string | undefined, authToken: string | undefined) {
  const enabled = !!hostPort && !!authToken;

  const friends = useQuery({
    queryKey: FRIENDS_QK,
    queryFn: async () => {
      const response = await listFriends(hostPort!, authToken!);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to load friends.');
      }
      return response.data.friends;
    },
    enabled,
  });

  const requests = useQuery({
    queryKey: FRIEND_REQUESTS_QK,
    queryFn: async () => {
      const response = await listFriendRequests(hostPort!, authToken!);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to load friend requests.');
      }
      return {
        incoming: response.data.incoming,
        outgoing: response.data.outgoing,
      };
    },
    enabled,
  });

  const blocks = useQuery({
    queryKey: FRIEND_BLOCKS_QK,
    queryFn: async () => {
      const response = await listFriendRequestBlocks(hostPort!, authToken!);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to load blocked users.');
      }
      return response.data.blocks;
    },
    enabled,
  });

  const snapshot: FriendGraphSnapshot | undefined =
    friends.data && requests.data && blocks.data
      ? {
          friends: friends.data,
          incoming: requests.data.incoming,
          outgoing: requests.data.outgoing,
          blocks: blocks.data,
        }
      : undefined;

  return {
    snapshot,
    friends,
    requests,
    blocks,
    isLoading: friends.isLoading || requests.isLoading || blocks.isLoading,
  };
}

/**
 * Mutation hooks. Each one invalidates the cache keys it touches
 * so the Friends panel + the user-card / context-menu affordances
 * update in lock-step.
 */
export function useFriendGraphMutations(
  hostPort: string | undefined,
  authToken: string | undefined,
) {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: FRIENDS_QK });
    void queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QK });
    void queryClient.invalidateQueries({ queryKey: FRIEND_BLOCKS_QK });
  };

  const sendRequest = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await sendFriendRequest(hostPort, authToken, targetUserId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to send friend request.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  const accept = useMutation({
    mutationFn: async (friendshipId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await acceptFriendRequest(hostPort, authToken, friendshipId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to accept request.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  const cancelOrReject = useMutation({
    mutationFn: async (friendshipId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await cancelOrRejectFriendRequest(
        hostPort,
        authToken,
        friendshipId,
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to update request.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  const unfriend = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await unfriendUser(hostPort, authToken, otherUserId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to unfriend.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  const block = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await blockFriendRequests(hostPort, authToken, targetUserId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to block user.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  const unblock = useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!hostPort || !authToken) throw new Error('Not signed in.');
      const response = await unblockFriendRequests(hostPort, authToken, blockedUserId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to unblock user.');
      }
      return response.data;
    },
    onSuccess: invalidateAll,
  });

  return { sendRequest, accept, cancelOrReject, unfriend, block, unblock };
}
