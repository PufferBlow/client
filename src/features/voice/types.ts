export type VoiceStatus = "idle" | "connecting" | "connected" | "failed";

export type QualityProfile = "low" | "balanced" | "high";

export interface VoiceParticipant {
  userId: string;
  username: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** What `POST /api/v2/voice/channels/{id}/sessions` returns, trimmed to what the client uses. */
export interface VoiceSessionGrant {
  sessionId: string;
  channelId: string;
  /** One-time token for the media server; spent by the first connection that presents it. */
  joinToken: string;
  /** WebSocket URL of the media server (without the token). */
  signalingUrl: string;
  iceServers: IceServer[];
  participantCount: number;
  qualityProfile: QualityProfile;
}

export const newParticipant = (userId: string, username = ""): VoiceParticipant => ({
  userId,
  username,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
});
