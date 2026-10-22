import type { Trust } from "./crypto/trust";

export type CallPhase =
  /** We rang them and are waiting. */
  | "calling"
  /** They are ringing us. */
  | "incoming"
  /** Accepted; the audio connection is being set up. */
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

/** What protects the call, said as plainly as the facts allow. */
export type Encryption =
  /** Not known yet: the other side's signed offer or answer has not been checked. */
  | { status: "pending" }
  /** Audio is encrypted between the two devices and the other side's key is `trust`. */
  | { status: "protected"; trust: Trust; keyId: string; safetyNumber: string }
  /** The other person's key is not the one pinned; the call waits for the user to decide. */
  | { status: "key_changed"; keyId: string }
  /** The signed proof did not check out, or was missing. The call is not allowed to continue. */
  | { status: "failed"; reason: string };

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  peerId: string | null;
  peerName: string;
  direction: "outgoing" | "incoming" | null;
  muted: boolean;
  error: string | null;
  encryption: Encryption;
  /** `Date.now()` when the audio connected, for the call timer. */
  connectedAt: number | null;
  /** Straight between the two devices, or through the media server (still end-to-end encrypted). */
  route: "direct" | "relay";
}

export const IDLE_CALL: CallState = {
  phase: "ended",
  callId: null,
  peerId: null,
  peerName: "",
  direction: null,
  muted: false,
  error: null,
  encryption: { status: "pending" },
  connectedAt: null,
  route: "direct",
};

/** The call signals that arrive over the realtime connection (`user.dm_call_*`). */
export type CallSignal =
  | { kind: "invite"; callId: string; callerId: string }
  | { kind: "accepted"; callId: string }
  | { kind: "rejected"; callId: string }
  | { kind: "ended"; callId: string }
  | { kind: "offer" | "answer" | "candidate" | "relay"; callId: string; fromUserId: string; payload: Record<string, unknown> };

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
