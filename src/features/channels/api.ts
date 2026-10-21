import { authed } from "../../services/authed";
import type { Channel, ChannelType, UnreadCounts } from "./types";

const CHANNELS = "/api/v1/channels";

export async function listChannels(): Promise<Channel[]> {
  // The trailing slash is required by the route.
  const { channels } = await authed.body<{ channels: Channel[] }>("POST", `${CHANNELS}/list/`);
  return channels ?? [];
}

export async function getUnreadCounts(): Promise<UnreadCounts> {
  const { unread_counts } = await authed.query<{ unread_counts?: UnreadCounts }>("GET", `${CHANNELS}/read-history`);
  return unread_counts ?? {};
}

export async function markChannelRead(channelId: string): Promise<void> {
  await authed.query("POST", `${CHANNELS}/${encodeURIComponent(channelId)}/mark_all_read`);
}

export interface NewChannel {
  channel_name: string;
  channel_type: ChannelType;
  is_private: boolean;
  /** Set after creation (the create route has no field for them), so a new channel can start with them. */
  topic?: string;
  category_id?: string | null;
}

/**
 * The type can't change after creation, so an edit carries name, privacy, topic, category and
 * position. `topic: ""` clears the topic; `category_id: null` takes the channel out of its category.
 */
export type ChannelChanges = Partial<Pick<NewChannel, "channel_name" | "is_private" | "topic">> & { category_id?: string | null; position?: number };

export async function createChannel(channel: NewChannel): Promise<Channel> {
  const { topic, category_id, ...creation } = channel;
  const { channel_data } = await authed.body<{ channel_data: Channel }>("POST", `${CHANNELS}/create/`, { ...creation });
  // A topic and a category are an update away, since the create route does not take them.
  if (topic?.trim() || category_id) {
    const changes: ChannelChanges = {};
    if (topic?.trim()) changes.topic = topic.trim();
    if (category_id) changes.category_id = category_id;
    return updateChannel(channel_data.channel_id, changes);
  }
  return channel_data;
}

export async function updateChannel(channelId: string, changes: ChannelChanges): Promise<Channel> {
  const { channel_data } = await authed.body<{ channel_data: Channel }>(
    "PUT",
    `${CHANNELS}/${encodeURIComponent(channelId)}/update`,
    { ...changes },
  );
  return channel_data;
}

export async function deleteChannel(channelId: string): Promise<void> {
  await authed.query("DELETE", `${CHANNELS}/${encodeURIComponent(channelId)}/delete`);
}

/** Marks every channel you can see as read in one request. */
export async function markAllChannelsRead(): Promise<void> {
  await authed.query("POST", `${CHANNELS}/mark_all_read`);
}
