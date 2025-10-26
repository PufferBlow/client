/**
 * Channel model - represents a communication channel in a server
 */
export interface Channel {
  /** Unique identifier for the channel */
  channel_id: string;

  /** Name of the channel */
  channel_name: string;

  /** Type of channel: 'text', 'voice', or 'mixed' */
  channel_type?: string;

  /** List of message IDs in this channel */
  messages_ids?: string[];

  /** Whether this channel is private (invite-only) */
  is_private?: boolean;

  /** List of user IDs allowed to access this private channel */
  allowed_users?: string[] | null;

  /** LiveKit room name for voice channels */
  livekit_room_name?: string | null;

  /** Active voice participants */
  participant_ids?: string[];

  /** Timestamp when the channel was created */
  created_at: string;
}
