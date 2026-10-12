import { authed } from "../../services/authed";
import { asPresence } from "../members/presence";
import type { BlockedUser, Friend, FriendRequests } from "./types";

const FRIENDS = "/api/v1/friends";

interface WireFriend {
  friendship_id: string;
  other_user_id: string;
  other_username: string;
  other_origin_server?: string;
  other_avatar_url?: string | null;
  other_status?: string;
}

interface WireBlock {
  blocked_id: string;
  blocked_username: string;
  blocked_origin_server?: string;
  blocked_avatar_url?: string | null;
}

const toFriend = (w: WireFriend): Friend => ({
  friendshipId: w.friendship_id,
  userId: w.other_user_id,
  username: w.other_username,
  host: w.other_origin_server ?? "",
  avatarUrl: w.other_avatar_url ?? null,
  status: asPresence(w.other_status),
});

export async function listFriends(): Promise<Friend[]> {
  const { friends } = await authed.query<{ friends: WireFriend[] }>("GET", FRIENDS);
  return (friends ?? []).map(toFriend);
}

export async function listFriendRequests(): Promise<FriendRequests> {
  const res = await authed.query<{ incoming: WireFriend[]; outgoing: WireFriend[] }>("GET", `${FRIENDS}/requests`);
  return { incoming: (res.incoming ?? []).map(toFriend), outgoing: (res.outgoing ?? []).map(toFriend) };
}

/** `name` or `name@instance`. Without an instance the request targets this instance. */
export async function sendFriendRequest(handle: string): Promise<void> {
  const [username, host] = handle.trim().replace(/^@/, "").split("@");
  await authed.query("POST", `${FRIENDS}/requests`, {
    json: { target_username: username, ...(host ? { target_origin_server: host } : {}) },
  });
}

export const acceptFriendRequest = (friendshipId: string) =>
  authed.query("POST", `${FRIENDS}/requests/${encodeURIComponent(friendshipId)}/accept`).then(() => undefined);

/** Declines an incoming request or cancels an outgoing one (the backend uses one route for both). */
export const removeFriendRequest = (friendshipId: string) =>
  authed.query("DELETE", `${FRIENDS}/requests/${encodeURIComponent(friendshipId)}`).then(() => undefined);

export const removeFriend = (userId: string) =>
  authed.query("DELETE", `${FRIENDS}/${encodeURIComponent(userId)}`).then(() => undefined);

export async function listBlocks(): Promise<BlockedUser[]> {
  const { blocks } = await authed.query<{ blocks: WireBlock[] }>("GET", `${FRIENDS}/blocks`);
  return (blocks ?? []).map((b) => ({
    userId: b.blocked_id,
    username: b.blocked_username,
    host: b.blocked_origin_server ?? "",
    avatarUrl: b.blocked_avatar_url ?? null,
  }));
}

export const unblockUser = (userId: string) =>
  authed.query("DELETE", `${FRIENDS}/blocks/${encodeURIComponent(userId)}`).then(() => undefined);
