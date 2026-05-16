/**
 * voiceCallSession — module-level registry for the (at most one) active
 * voice call. Decouples the voice transport's lifetime from any single
 * React component's lifetime.
 *
 * The problem this solves: previously the VoiceTransport instance was
 * owned by VoiceChannel's `useEffect`. When the user navigated away
 * from /dashboard (e.g. to /settings or /control-panel), the dashboard
 * route unmounted, taking every VoiceChannel sidebar row with it -- and
 * the useEffect cleanup called `transport.disconnect()`. The call was
 * killed every time the user opened settings.
 *
 * The fix here: a singleton holder. When a user joins a voice channel,
 * the transport is registered in this module and persists until either
 *
 *   a) the user explicitly clicks "Leave", or
 *   b) the page actually unloads (window close / app quit).
 *
 * VoiceChannel components are now subscribers. On mount they check the
 * registry; if there's an active call for the channel they represent,
 * they re-attach their callbacks to the existing transport (via
 * VoiceTransport.setCallbacks) and seed their React state from the
 * transport's snapshot getters. On unmount they only detach themselves
 * -- they do NOT disconnect the transport.
 *
 * Only one call can be active at a time (you can only be in one voice
 * channel), which is why this is a singleton rather than a Map.
 */

import type { VoiceTransport } from './voiceTransport';

interface ActiveVoiceCall {
  transport: VoiceTransport;
  channelId: string;
  channelName: string;
}

let active: ActiveVoiceCall | null = null;

export const voiceCallSession = {
  /** The currently-active call, or null if no call is in progress. */
  get(): ActiveVoiceCall | null {
    return active;
  },

  /**
   * Register a transport as the active call. Called by VoiceChannel
   * after a successful join. Replaces any previous registration (the
   * caller is expected to have disconnected the prior transport first;
   * channel switches are the only legitimate replace path).
   */
  set(call: ActiveVoiceCall): void {
    active = call;
  },

  /**
   * Clear the registration. Called when the user explicitly leaves or
   * when the page is unloading. Does NOT call disconnect -- the caller
   * is responsible for tearing the transport down before / after this.
   */
  clear(): void {
    active = null;
  },

  /** True iff there's an active call for the given channelId. */
  isActive(channelId: string): boolean {
    return active?.channelId === channelId;
  },
};

/**
 * Install a one-time `beforeunload` handler that disconnects the active
 * transport before the page closes. Without this, refreshing the tab
 * during a call would leave the WebRTC peer connection / signaling
 * socket dangling for the SFU to time out.
 *
 * Idempotent: safe to call from multiple component mounts. The flag
 * lives in module scope so we only register once across all mounts.
 */
let unloadHandlerInstalled = false;
export function installVoiceUnloadHandler(): void {
  if (unloadHandlerInstalled) return;
  if (typeof window === 'undefined') return;
  unloadHandlerInstalled = true;
  window.addEventListener('beforeunload', () => {
    const call = active;
    if (call) {
      // Fire-and-forget; we're on our way out.
      void call.transport.disconnect();
      active = null;
    }
  });
}
