import { authed } from "../../services/authed";
import type { PublicJwk } from "./crypto/identity";
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
export const sendCallSignal = (callId: string, signalType: "offer" | "answer" | "candidate", payload: Record<string, unknown>) =>
  authed.body("POST", `${callPath(callId)}/signal`, { signal_type: signalType, payload });

/** Make this device's public signing key known to the instance (so other devices of the same person can list it). */
export async function registerIdentityKey(publicKey: PublicJwk, label: string): Promise<void> {
  await authed.body("PUT", "/api/v1/identity-keys", { public_key: publicKey, label });
}
