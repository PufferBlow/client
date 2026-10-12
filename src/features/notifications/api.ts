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
