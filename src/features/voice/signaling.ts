import type { VoiceParticipant } from "./types";

/**
 * Messages on the media server's signalling socket (`GET /rtc/v1/ws?join_token=...`).
 * Client to server: offer, answer, candidate, audio_state, join, ping, leave.
 * Server to client: the frames below. Anything else is ignored.
 */
export type SignalFrame =
  | { type: "joined"; participants: VoiceParticipant[] }
  | { type: "participant_joined"; userId: string; username: string }
  | { type: "participant_left"; userId: string }
  | { type: "speaker_levels"; userId: string; isSpeaking: boolean; isMuted: boolean; isDeafened: boolean }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "leave_ack" }
  | { type: "pong" }
  | { type: "error"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

function participantFrom(raw: unknown): VoiceParticipant | null {
  if (!isRecord(raw) || typeof raw.user_id !== "string") return null;
  return {
    userId: raw.user_id,
    username: str(raw.username),
    isMuted: raw.is_muted === true,
    isDeafened: raw.is_deafened === true,
    isSpeaking: raw.is_speaking === true,
  };
}

export function parseSignal(data: unknown): SignalFrame | null {
  if (typeof data !== "string") return null;
  let frame: unknown;
  try {
    frame = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(frame)) return null;
  const payload = isRecord(frame.payload) ? frame.payload : {};

  switch (frame.type) {
    case "joined":
      return {
        type: "joined",
        participants: Array.isArray(frame.participants) ? frame.participants.flatMap((p) => participantFrom(p) ?? []) : [],
      };
    case "participant_joined":
      return typeof payload.user_id === "string" ? { type: "participant_joined", userId: payload.user_id, username: str(payload.username) } : null;
    case "participant_left":
      return typeof payload.user_id === "string" ? { type: "participant_left", userId: payload.user_id } : null;
    case "speaker_levels":
      return typeof payload.user_id === "string"
        ? {
            type: "speaker_levels",
            userId: payload.user_id,
            isSpeaking: payload.is_speaking === true,
            isMuted: payload.is_muted === true,
            isDeafened: payload.is_deafened === true,
          }
        : null;
    case "offer":
      return isRecord(frame.offer) ? { type: "offer", sdp: frame.offer as unknown as RTCSessionDescriptionInit } : null;
    case "answer":
      return isRecord(frame.answer) ? { type: "answer", sdp: frame.answer as unknown as RTCSessionDescriptionInit } : null;
    case "candidate":
      return isRecord(frame.candidate) ? { type: "candidate", candidate: frame.candidate as unknown as RTCIceCandidateInit } : null;
    case "leave_ack":
      return { type: "leave_ack" };
    case "pong":
      return { type: "pong" };
    case "error":
      return { type: "error", message: str(frame.error) || "The voice server reported an error." };
    default:
      return null;
  }
}

export const signal = {
  offer: (sdp: RTCSessionDescriptionInit) => JSON.stringify({ type: "offer", offer: sdp }),
  answer: (sdp: RTCSessionDescriptionInit) => JSON.stringify({ type: "answer", answer: sdp }),
  candidate: (candidate: RTCIceCandidateInit) => JSON.stringify({ type: "candidate", candidate }),
  audioState: (state: { isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean }) =>
    JSON.stringify({
      type: "audio_state",
      audio_state: {
        ...(state.isMuted !== undefined && { is_muted: state.isMuted }),
        ...(state.isDeafened !== undefined && { is_deafened: state.isDeafened }),
        ...(state.isSpeaking !== undefined && { is_speaking: state.isSpeaking }),
      },
    }),
  ping: () => JSON.stringify({ type: "ping" }),
  leave: () => JSON.stringify({ type: "leave" }),
};
