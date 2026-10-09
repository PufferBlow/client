/**
 * Message model - represents a message sent in a channel or conversation
 */

/** Represents an attachment to a message */
export interface MessageAttachment {
  /** Full URL to the attachment */
  url: string;
  /**
   * Low-quality image placeholder URL — `/storage/{hash}?variant=lqip`.
   * Only populated for image attachments where the server
   * successfully generated a placeholder. `null` / undefined means
   * the consumer should render a skeleton until the full image
   * loads. Other attachment kinds (video, audio, document) always
   * leave this null.
   */
  lqip_url?: string | null;
  /** Original filename of the attachment */
  filename: string;
  /** MIME type of the attachment */
  type: string;
  /** File size in bytes (may be null) */
  size: number | null;
}

/** Aggregated reactions to a message, grouped by emoji. */
export interface MessageReaction {
  /** The emoji (1-32 chars; may be multi-codepoint, e.g. skin tone or flag) */
  emoji: string;
  /** Number of distinct users who applied this emoji */
  count: number;
  /** Whether the viewer is one of the users who applied this emoji */
  viewer_reacted: boolean;
  /** Full list of users who applied this emoji (newest API: present, older: empty) */
  user_ids?: string[];
}

export interface Message {
  /** Unique identifier for the message */
  message_id: string;

  /** Raw message content from API response */
  message: string;

  /** Hashed version of the message content for security/storage */
  hashed_message: string;

  /** Number of times this message has been edited. ``0`` means
   *  never edited; the client renders an "edited" / "edited N
   *  times" badge when this is > 0. */
  edit_count?: number;

  /** ISO 8601 timestamp of the most recent edit, or null if the
   *  message has never been edited. */
  last_edited_at?: string | null;

  /** ID of the user who sent the message */
  sender_user_id: string;

  /** Username of the message sender */
  username?: string;

  /** Avatar URL of the message sender */
  sender_avatar_url?: string | null;

  /** Banner URL of the message sender */
  sender_banner_url?: string | null;

  /** LQIP variant of `sender_avatar_url`. Same semantics as MessageAttachment.lqip_url. */
  sender_avatar_lqip_url?: string | null;

  /** LQIP variant of `sender_banner_url`. */
  sender_banner_lqip_url?: string | null;

  /** Current status of the message sender */
  sender_status?: string;

  /** Roles/permissions of the message sender */
  sender_roles?: string[];

  /** About/bio information of the message sender */
  sender_about?: string | null;

  /** Last seen timestamp of the message sender */
  sender_last_seen?: string | null;

  /** Account creation timestamp of the message sender */
  sender_created_at?: string | null;

  /** ID of the channel this message belongs to (optional) */
  channel_id?: string | null;

  /** ID of the conversation this message belongs to (optional) */
  conversation_id?: string | null;

  /** Timestamp when the message was sent */
  sent_at: string;

  /** List of detailed attachment objects (optional) */
  attachments?: MessageAttachment[];

  /** Aggregated reactions to this message (one entry per distinct emoji) */
  reactions?: MessageReaction[];
}
