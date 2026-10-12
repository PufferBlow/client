export type ChannelType = "text" | "voice" | "mixed";

export interface Channel {
  channel_id: string;
  channel_name: string;
  channel_type: ChannelType;
  is_private: boolean;
  created_at: string;
}

/** `channel_id -> unread message count`. */
export type UnreadCounts = Record<string, number>;

export const hasText = (channel: Channel): boolean => channel.channel_type !== "voice";
