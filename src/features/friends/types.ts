import type { PresenceStatus } from "../users/types";

/** A person in a friendship relation (friend, or either side of a request). */
export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  /** Home instance; empty for users on this instance. */
  host: string;
  avatarUrl: string | null;
  status: PresenceStatus;
}

export interface FriendRequests {
  incoming: Friend[];
  outgoing: Friend[];
}

export interface BlockedUser {
  userId: string;
  username: string;
  host: string;
  avatarUrl: string | null;
}
