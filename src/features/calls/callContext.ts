import { createContext, useContext } from "react";
import { IDLE_CALL, type CallState } from "./types";

export interface CallControls extends CallState {
  /** Ring someone. Does nothing while already on a call. */
  startCall: (peer: { userId: string; name: string }) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  /** End the call (or cancel it, while it is still ringing). */
  hangUp: () => Promise<void>;
  toggleMute: () => void;
  /** Answer the question "their key changed; carry on?". */
  resolveKeyChange: (accept: boolean) => void;
  /** The user compared safety numbers and they matched. */
  markVerified: () => void;
  /** Clear a finished or failed call from the screen. */
  dismiss: () => void;
}

export const CallContext = createContext<CallControls | null>(null);

const OUTSIDE_DASHBOARD: CallControls = {
  ...IDLE_CALL,
  startCall: async () => undefined,
  accept: async () => undefined,
  decline: async () => undefined,
  hangUp: async () => undefined,
  toggleMute: () => undefined,
  resolveKeyChange: () => undefined,
  markVerified: () => undefined,
  dismiss: () => undefined,
};

/** The current call and its controls. Outside the dashboard there is no call, so this is an idle stand-in. */
export const useCall = (): CallControls => useContext(CallContext) ?? OUTSIDE_DASHBOARD;

/** Whether a call is ringing or running (so a second cannot be started). */
export const isCallActive = (state: Pick<CallState, "phase">): boolean => state.phase === "calling" || state.phase === "incoming" || state.phase === "connecting" || state.phase === "connected";
