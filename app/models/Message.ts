/**
 * Message model - represents a message sent in a channel or conversation
 */

/** Represents an attachment to a message */
export interface MessageAttachment {
  /** Full URL to the attachment */
  url: string;
  /** Original filename of the attachment */
  filename: string;
  /** MIME type of the attachment */
  type: string;
  /** File size in bytes (may be null) */
  size: number | null;
}

export interface Message {
  /** Unique identifier for the message */
  message_id: string;

  /** Raw message content from API response */
  message: string;

  /** Hashed version of the message content for security/storage */
  hashed_message: string;

  /** ID of the user who sent the message */
  sender_user_id: string;

  /** Username of the message sender */
  username?: string;

  /** Avatar URL of the message sender */
  sender_avatar_url?: string | null;

  /** Banner URL of the message sender */
  sender_banner_url?: string | null;

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
}
