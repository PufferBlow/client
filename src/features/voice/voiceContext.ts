import { createContext, useContext } from "react";
import type { VoiceParticipant, VoiceStatus } from "./types";

export interface VoiceState {
  status: VoiceStatus;
  /** The channel of the call being joined, connected, or that just failed. Null when idle. */
  channelId: string | null;
  participants: VoiceParticipant[];
  error: string | null;
  isMuted: boolean;
  isDeafened: boolean;
}

export interface VoiceControls extends VoiceState {
  /** The channel someone asked to join while already in another call, waiting for them to confirm leaving the first. */
  pendingJoin: string | null;
  /** Join a channel the way a person asks to: straight away if free, otherwise by asking first (see `pendingJoin`). */
  requestJoin: (channelId: string) => void;
  /** Leave the current call and join the one that was asked for. */
  confirmJoin: () => Promise<void>;
  /** Stay in the current call. */
  cancelJoin: () => void;
  join: (channelId: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export const IDLE_VOICE: VoiceState = { status: "idle", channelId: null, participants: [], error: null, isMuted: false, isDeafened: false };

export const VoiceContext = createContext<VoiceControls | null>(null);

const OUTSIDE_DASHBOARD: VoiceControls = {
  ...IDLE_VOICE,
  pendingJoin: null,
  requestJoin: () => undefined,
  confirmJoin: async () => undefined,
  cancelJoin: () => undefined,
  join: async () => undefined,
  leave: async () => undefined,
  toggleMute: () => undefined,
  toggleDeafen: () => undefined,
};

/** Voice controls and state. Outside the dashboard there is no call, so this returns an idle stand-in. */
export const useVoice = (): VoiceControls => useContext(VoiceContext) ?? OUTSIDE_DASHBOARD;
