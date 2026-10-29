import { type ProfileSettings, type RoleBadgeData, type SectionName } from "@pufferblow/spines";

export type PresenceStatus = "online" | "idle" | "afk" | "dnd" | "offline";

/** The `user_profile` payload fields the client uses (the backend returns more). */
export interface UserProfile {
  user_id: string;
  username: string;
  about: string | null;
  status: PresenceStatus;
  accent_color: string | null;
  avatar_url: string | null;
  /** The picture the server hosts for this user: their upload, or the default puffer art. */
  banner_url?: string | null;
  /** `identicon` is the default art; `image` an upload. */
  avatar_kind?: "identicon" | "image" | null;
  /** `default` is the default art; `solid` shows the accent colour only; `image` an upload. */
  banner_kind?: "default" | "solid" | "image" | null;
  /** At most 40 characters. */
  pronouns?: string | null;
  /** The line shown under the name on the card; at most 60 characters. */
  custom_status?: string | null;
  /** How the person chose to look; always complete from an up-to-date instance. */
  profile_settings?: (Partial<Omit<ProfileSettings, "sections">> & { sections?: Partial<Record<SectionName, boolean>> }) | null;
  origin_server: string;
  last_seen?: string | null;
  created_at?: string | null;
  /** Role ids held by the user (`"owner"`, `"moderator"`, ...). */
  roles_ids?: string[] | null;
  resolved_roles?: UserRole[];
  resolved_privileges?: string[];
}

export interface UserRole {
  role_id: string;
  role_name: string;
  is_system?: boolean;
  /** The mark shown after the name of someone who holds the role. Instances before role badges send none. */
  badge?: RoleBadgeData | null;
}
