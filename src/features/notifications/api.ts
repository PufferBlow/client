import { authed } from "../../services/authed";

const BASE = "/api/v1/notifications";

/** Only deviations from the default (notify normally) are stored server-side. */
export interface ChannelPreference {
  channel_id: string;
  muted: boolean;
  mention_only: boolean;
}

export async function listPreferences(): Promise<ChannelPreference[]> {
  const { preferences } = await authed.query<{ preferences?: ChannelPreference[] }>("GET", `${BASE}/preferences`);
  return preferences ?? [];
}

export async function setChannelMuted(channelId: string, muted: boolean): Promise<void> {
  await authed.query("PUT", `${BASE}/preferences/${encodeURIComponent(channelId)}`, { json: { muted } });
}

/** Mutes (or restores) every channel you can access in one request: the "mute server" switch. */
export async function setAllChannelsMuted(muted: boolean): Promise<void> {
  await authed.query("PUT", `${BASE}/preferences`, { json: { muted } });
}

/** What a notification is about. Only mentions exist today; the field leaves room for more. */
export interface AppNotification {
  id: string;
  type: string;
  actorUserId: string | null;
  channelId: string | null;
  messageId: string | null;
  createdAt: string;
  read: boolean;
}

interface WireNotification {
  notification_id: string;
  type: string;
  actor_user_id: string | null;
  channel_id: string | null;
  message_id: string | null;
  created_at: string | null;
  read_at: string | null;
}

/** The newest notifications, unread first is left to the caller; the server sorts newest first. */
export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { notifications } = await authed.query<{ notifications?: WireNotification[] }>("GET", `${BASE}/`, { query: { limit } });
  return (notifications ?? []).map((n) => ({
    id: n.notification_id,
    type: n.type,
    actorUserId: n.actor_user_id,
    channelId: n.channel_id,
    messageId: n.message_id,
    createdAt: n.created_at ?? "",
    read: n.read_at !== null,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  await authed.query("POST", `${BASE}/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await authed.query("POST", `${BASE}/read-all`);
}
