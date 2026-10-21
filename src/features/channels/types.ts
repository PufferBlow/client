export type ChannelType = "text" | "voice" | "mixed";

/** The longest topic the instance accepts. */
export const TOPIC_MAX = 256;

export interface Channel {
  channel_id: string;
  channel_name: string;
  channel_type: ChannelType;
  is_private: boolean;
  created_at: string;
  /** One line about what the channel is for. Instances that do not have topics yet send none. */
  topic?: string | null;
  /** The category it sits in (see `categories.ts`), and its order within that category. */
  category_id?: string | null;
  position?: number;
}

/** `channel_id -> unread message count`. */
export type UnreadCounts = Record<string, number>;

export const hasText = (channel: Channel): boolean => channel.channel_type !== "voice";
