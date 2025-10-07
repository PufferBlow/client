/**
 * User model - represents a user in the system
 */
export interface User {
  /** Unique identifier for the user */
  id: string;

  /** Unique identifier for the user (alias for id) */
  user_id: string;

  /** Username chosen by the user */
  username: string;

  /** User's password (should be hashed in production) */
  password?: string;

  /** Current online status of the user */
  status: string;

  /** Timestamp of when the user was last seen online */
  last_seen: string;

  /** List of conversation IDs the user is part of */
  conversations?: string[];

  /** List of contact user IDs */
  contacts?: string[];

  /** List of server IDs the user has joined */
  joined_servers_ids?: string[];

  /** Timestamp when the user account was created */
  created_at: string;

  /** Raw authentication token */
  raw_auth_token?: string;

  /** Encrypted authentication token for secure storage */
  encrypted_auth_token?: string;

  /** Expiration time for the auth token */
  auth_token_expire_time?: string;

  /** Timestamp when the user was last updated */
  updated_at?: string;

  /** Whether the user has admin privileges */
  is_admin?: boolean;

  /** Whether the user is the owner of a server */
  is_owner?: boolean;

  /** List of roles the user has */
  roles?: string[];

  /** User's avatar URL */
  avatar?: string;

  /** Timestamp when the user joined (for display purposes) */
  joinedAt?: string;

  /** User's bio */
  bio?: string;
}
