import { authed } from "../../services/authed";
import type { IceServer, QualityProfile, VoiceParticipant, VoiceSessionGrant } from "./types";

const channelPath = (channelId: string) => `/api/v2/voice/channels/${encodeURIComponent(channelId)}`;
const sessionPath = (sessionId: string) => `/api/v2/voice/sessions/${encodeURIComponent(sessionId)}`;

interface JoinResponse {
  session_id: string;
  channel_id: string;
  join_token: string;
  signaling_url: string;
  ice_servers?: IceServer[];
  participant_count?: number;
  quality_profile?: QualityProfile;
}

/** Create the channel's voice session or join it. The grant is good for one connection to the media server. */
export async function joinVoiceSession(channelId: string, qualityProfile: QualityProfile = "balanced"): Promise<VoiceSessionGrant> {
  const res = await authed.body<JoinResponse>("POST", `${channelPath(channelId)}/sessions`, { quality_profile: qualityProfile });
  return {
    sessionId: res.session_id,
    channelId: res.channel_id,
    joinToken: res.join_token,
    signalingUrl: res.signaling_url,
    iceServers: res.ice_servers ?? [],
    participantCount: res.participant_count ?? 0,
    qualityProfile: res.quality_profile ?? qualityProfile,
  };
}

export async function leaveVoiceSession(sessionId: string): Promise<void> {
  await authed.body("POST", `${sessionPath(sessionId)}/leave`);
}

interface WireParticipant {
  user_id: string;
  username?: string;
  is_connected?: boolean;
  is_muted?: boolean;
  is_deafened?: boolean;
  is_speaking?: boolean;
}

interface ParticipantsResponse {
  participants: WireParticipant[];
  session_id: string | null;
  started_at?: string | null;
}

/** A channel's call as it is now: who is in it, and when it began (the first person to join an empty channel). */
export interface VoiceRoom {
  participants: VoiceParticipant[];
  /** Null when nobody is in the channel. Resets by itself, since a call ends when the last person leaves. */
  startedAt: number | null;
}

/** Who is in a channel's call right now, and since when. Read-only: it does not join. */
export async function getVoiceRoom(channelId: string): Promise<VoiceRoom> {
  const res = await authed.query<ParticipantsResponse>("GET", `${channelPath(channelId)}/participants`);
  // A time with no zone on it is UTC (an older server sends it that way); reading it as local time would be hours off.
  const started = res.started_at ? Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(res.started_at) ? res.started_at : `${res.started_at}Z`) : NaN;
  return {
    participants: (res.participants ?? [])
      .filter((p) => p.is_connected !== false)
      .map((p) => ({
        userId: p.user_id,
        username: p.username ?? "",
        isMuted: p.is_muted === true,
        isDeafened: p.is_deafened === true,
        isSpeaking: p.is_speaking === true,
      })),
    startedAt: Number.isNaN(started) ? null : started,
  };
}

/** Who is in a channel's call right now. Read-only: it does not join. */
export async function listVoiceParticipants(channelId: string): Promise<VoiceParticipant[]> {
  return (await getVoiceRoom(channelId)).participants;
}

/** Record a self-scoped state change so the roster the API serves agrees with what the media server reports. */
export async function applyVoiceAction(sessionId: string, action: "mute_self" | "deafen_self", value: boolean): Promise<void> {
  await authed.body("POST", `${sessionPath(sessionId)}/actions`, { action, payload: { value } });
}
