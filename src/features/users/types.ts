export type PresenceStatus = "online" | "idle" | "afk" | "dnd" | "offline";

/** The `user_profile` payload fields the client uses (the backend returns more). */
export interface UserProfile {
  user_id: string;
  username: string;
  about: string | null;
  status: PresenceStatus;
  accent_color: string | null;
  avatar_url: string | null;
  avatar_kind?: "identicon" | "image" | null;
  origin_server: string;
  last_seen?: string | null;
  /** Role ids held by the user (`"owner"`, `"admin"`, ...). */
  roles_ids?: string[] | null;
  resolved_roles?: UserRole[];
  resolved_privileges?: string[];
}

export interface UserRole {
  role_id: string;
  role_name: string;
  is_system?: boolean;
}
