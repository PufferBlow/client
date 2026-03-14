/**
 * User model - represents a user in the system (matches API SQLAlchemy model)
 */
export interface User {
  /** Unique identifier for the user (UUID) */
  user_id: string;

  /** Username chosen by the user */
  username: string;

  /** User's password (should be hashed in production) */
  password: string;

  /** User's about/bio information */
  about?: string | null;

  /** User's avatar URL */
  avatar_url?: string | null;

  /** User's banner URL */
  banner_url?: string | null;

  /** User's inbox ID (UUID) */
  inbox_id?: string | null;

  /** Server where this user account was created */
  origin_server: string;

  /** Current online status of the user */
  status: string;

  /** List of role IDs the user has */
  roles_ids: string[];

  /** Timestamp of when the user was last seen online */
  last_seen?: string | null;

  /** List of server IDs the user has joined */
  joined_servers_ids: string[];

  /** Authentication token */
  auth_token: string;

  /** Raw authentication token (runtime only) */
  raw_auth_token?: string;

  /** Expiration time for the auth token */
  auth_token_expire_time?: string | null;

  /** Timestamp when the user account was created */
  created_at: string;

  /** Timestamp when the user was last updated */
  updated_at: string;

  /** Legacy fields for backward compatibility */
  /** Alias for user_id */
  id?: string;
  /** Alias for about */
  bio?: string;
  /** Alias for avatar_url */
  avatar?: string;
  /** Alias for joined_servers_ids (legacy format) */
  conversations?: string[];
  contacts?: string[];
  /** Legacy admin flags (computed from roles_ids) */
  is_admin?: boolean;
  is_owner?: boolean;
  /** Resolved instance role metadata */
  resolved_roles?: Array<{
    role_id: string;
    role_name: string;
    privileges_ids: string[];
    is_system: boolean;
  }>;
  /** Effective privileges resolved from instance roles */
  resolved_privileges?: string[];
  /** Current moderation state resolved by the instance */
  moderation_state?: {
    is_banned: boolean;
    ban_reason?: string | null;
    banned_at?: string | null;
    timeout_until?: string | null;
    timeout_reason?: string | null;
    is_timed_out: boolean;
  };
  /** Alias for roles_ids */
  roles?: string[];
  /** Alias for created_at */
  joinedAt?: string;
}
