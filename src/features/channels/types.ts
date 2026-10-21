export type ChannelType = "text" | "voice" | "mixed";

export interface Channel {
  channel_id: string;
  channel_name: string;
  channel_type: ChannelType;
  is_private: boolean;
  created_at: string;
  /** One line about what the channel is for. Instances that do not have topics yet send none. */
  topic?: string | null;
}

/** `channel_id -> unread message count`. */
export type UnreadCounts = Record<string, number>;

export const hasText = (channel: Channel): boolean => channel.channel_type !== "voice";
