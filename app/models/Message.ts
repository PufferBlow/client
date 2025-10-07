/**
 * Message model - represents a message sent in a channel or conversation
 */
export interface Message {
  /** Unique identifier for the message */
  message_id: string;

  /** Raw message content from API response */
  message: string;

  /** Hashed version of the message content for security/storage */
  hashed_message: string;

  /** ID of the user who sent the message */
  sender_user_id: string;

  /** ID of the channel this message belongs to (optional) */
  channel_id?: string | null;

  /** ID of the conversation this message belongs to (optional) */
  conversation_id?: string | null;

  /** Timestamp when the message was sent */
  sent_at: string;
}
