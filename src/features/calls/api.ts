import { authed } from "../../services/authed";
import type { PublicJwk } from "./crypto/identity";
import type { VoiceSessionGrant } from "../voice/types";
import type { IceServer } from "./types";

const CALLS = "/api/v1/dm-calls";
const callPath = (callId: string) => `${CALLS}/${encodeURIComponent(callId)}`;

export interface StartedCall {
  callId: string;
  iceServers: IceServer[];
}

/** Ring someone. They are rung over their realtime connection; if they have none, nothing happens until the ring times out. */
export async function inviteToCall(calleeId: string): Promise<StartedCall> {
  const res = await authed.body<{ call_id: string; ice_servers?: IceServer[] }>("POST", `${CALLS}/${encodeURIComponent(calleeId)}/invite`, { callee_id: calleeId });
  return { callId: res.call_id, iceServers: res.ice_servers ?? [] };
}

export async function acceptCall(callId: string): Promise<IceServer[]> {
  const res = await authed.body<{ ice_servers?: IceServer[] }>("POST", `${callPath(callId)}/accept`);
  return res.ice_servers ?? [];
}

export const rejectCall = (callId: string) => authed.body("POST", `${callPath(callId)}/reject`);
export const endCall = (callId: string) => authed.body("POST", `${callPath(callId)}/end`);

/** Pass one offer, answer or ICE candidate to the other person. The instance relays it and reads none of it. */
export const sendCallSignal = (callId: string, signalType: "offer" | "answer" | "candidate" | "relay", payload: Record<string, unknown>) =>
  authed.body("POST", `${callPath(callId)}/signal`, { signal_type: signalType, payload });

/** Join the media-server session for this call (used when the two devices cannot connect directly). */
export async function joinCallRelay(callId: string): Promise<VoiceSessionGrant> {
  const res = await authed.body<{ session_id: string; join_token: string; signaling_url: string; ice_servers?: IceServer[] }>("POST", `${callPath(callId)}/fallback`, { quality_profile: "balanced" });
  return {
    sessionId: res.session_id,
    channelId: callId,
    joinToken: res.join_token,
    signalingUrl: res.signaling_url,
    iceServers: res.ice_servers ?? [],
    participantCount: 0,
    qualityProfile: "balanced",
  };
}

/** Make this device's public signing key known to the instance (so other devices of the same person can list it). */
export async function registerIdentityKey(publicKey: PublicJwk, label: string): Promise<void> {
  await authed.body("PUT", "/api/v1/identity-keys", { public_key: publicKey, label });
}

export interface IdentityKeyEntry {
  key_id: string;
  label: string | null;
  created_at: string;
}

/** The signing keys registered for a person (each device that has made a call registers one). */
export async function listIdentityKeys(userId: string): Promise<IdentityKeyEntry[]> {
  const { keys } = await authed.query<{ keys: IdentityKeyEntry[] }>("GET", `/api/v1/identity-keys/${encodeURIComponent(userId)}`);
  return keys ?? [];
}

/** Remove one of your own keys, for a device you no longer have. */
export const removeIdentityKey = (keyId: string) => authed.query<unknown>("DELETE", `/api/v1/identity-keys/${encodeURIComponent(keyId)}`);
