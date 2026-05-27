import { logger } from '../utils/logger';
import type { RTCMediaQuality } from './system';

const voiceLogger = logger.network;

// Persistence key shared with DeviceSelectorModal / useSettingsAudio.
// Read on connect (and on every device-change event) so the user's mic +
// headphones picks actually route audio.
const AUDIO_SETTINGS_STORAGE_KEY = 'pufferblow-audio-settings';
const AUDIO_DEVICES_CHANGED_EVENT = 'pufferblow:audio-devices-changed';
/**
 * Dispatched by the Settings page after the user flips any audio
 * setting that the live voice transport cares about (mic gain, voice
 * activity mode / PTT, audio quality preset). Carries no payload —
 * the transport re-reads localStorage when it fires.
 */
export const AUDIO_SETTINGS_CHANGED_EVENT = 'pufferblow:audio-settings-changed';

export type VoiceActivityMode = 'voice' | 'ptt';
export type AudioQualityPreset = 'good' | 'better' | 'best';

/**
 * Upper-bound audio bitrate per quality preset, in kilobits per second.
 * Live calls cap their RTCRtpSender bitrate at min(server-profile, this).
 *
 * Numbers picked to match the labels shown on the Settings page (~64 /
 * ~128 / ~256 kbps). Opus tops out around 510 kbps and runs comfortably
 * at 32+ kbps for speech, so the range here is well inside the codec's
 * sane envelope.
 */
const QUALITY_BITRATE_KBPS: Record<AudioQualityPreset, number> = {
  good: 64,
  better: 128,
  best: 256,
};

interface PersistedAudioSelections {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  /**
   * The three DSP toggles the Settings page lets the user flip. All three
   * default to `true` when the user has never opened Settings — that
   * matches both the hook default in useSettingsAudio.ts and the long-
   * standing behavior of the voice stack before these toggles existed.
   */
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /**
   * Input gain applied via a Web Audio GainNode in the local audio graph.
   * Stored as a 0–200 integer percentage (matches the slider UI); 100 is
   * unity. We clamp to [0, 200] on read so a future schema change can't
   * blow our ear-drums.
   */
  micVolume: number;
  /**
   * Output gain applied to every remote peer's `<audio>` element via the
   * HTMLMediaElement.volume property. Stored as a 0–100 integer
   * percentage (matches the slider UI); 100 is full. Capped at 100
   * because `.volume` ceiling is 1.0 — we can't amplify the incoming
   * stream past unity without inserting a Web Audio graph, and that
   * would defeat the per-element setSinkId routing.
   */
  speakerVolume: number;
  voiceActivityMode: VoiceActivityMode;
  pttKey: string;
  audioQuality: AudioQualityPreset;
}

const DEFAULT_AUDIO_SELECTIONS: PersistedAudioSelections = {
  inputDeviceId: null,
  outputDeviceId: null,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  micVolume: 100,
  speakerVolume: 100,
  voiceActivityMode: 'voice',
  pttKey: 'Alt',
  audioQuality: 'better',
};

/**
 * Read the persisted audio settings from localStorage. Returns defaults
 * outside the browser, when storage is empty, or when the payload is
 * malformed. Tolerates schema drift (the settings page writes additional
 * fields beyond what we consume here).
 *
 * Settings apply at call-connect time and again on every mid-call device
 * swap — there's no live event for the DSP toggles, but in practice users
 * change them rarely and a leave + rejoin (or a device swap) refreshes
 * the constraints. Worth revisiting if telemetry shows people toggling
 * mid-call and getting confused.
 */
function readAudioSettings(): PersistedAudioSelections {
  if (typeof window === 'undefined') return { ...DEFAULT_AUDIO_SELECTIONS };
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SELECTIONS };
    const parsed = JSON.parse(raw) as {
      selectedInputDevice?: string;
      selectedOutputDevice?: string;
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      autoGainControl?: boolean;
      micVolume?: number;
      speakerVolume?: number;
      voiceActivityMode?: string;
      pttKey?: string;
      audioQuality?: string;
    };
    const micRaw = typeof parsed.micVolume === 'number' ? parsed.micVolume : 100;
    // Clamp into the 0–200% range the slider exposes. Anything higher would
    // amplify line noise into clipping for very little perceived benefit.
    const micVolume = Math.max(0, Math.min(200, micRaw));
    // SpeakerVolume is 0–100 because HTMLMediaElement.volume tops at 1.0;
    // a missing field defaults to 100 (don't silently mute existing
    // users who upgrade from a build that didn't persist this).
    const speakerRaw = typeof parsed.speakerVolume === 'number' ? parsed.speakerVolume : 100;
    const speakerVolume = Math.max(0, Math.min(100, speakerRaw));
    const mode: VoiceActivityMode = parsed.voiceActivityMode === 'ptt' ? 'ptt' : 'voice';
    const quality: AudioQualityPreset =
      parsed.audioQuality === 'good' || parsed.audioQuality === 'best'
        ? parsed.audioQuality
        : 'better';
    return {
      inputDeviceId: parsed.selectedInputDevice?.trim() || null,
      outputDeviceId: parsed.selectedOutputDevice?.trim() || null,
      echoCancellation: parsed.echoCancellation ?? true,
      noiseSuppression: parsed.noiseSuppression ?? true,
      autoGainControl: parsed.autoGainControl ?? true,
      micVolume,
      speakerVolume,
      voiceActivityMode: mode,
      pttKey: parsed.pttKey?.trim() || 'Alt',
      audioQuality: quality,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SELECTIONS };
  }
}

/**
 * HTMLAudioElement.setSinkId is Chromium-only at time of writing and not
 * yet on the static lib.dom.d.ts. The check at the call site protects
 * Firefox / Safari from a TypeError; this helper just types it.
 */
type AudioElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const AUDIO_DEVICE_CHANGE_PAYLOAD_KEY = 'detail';
interface AudioDeviceChangeDetail {
  inputDeviceId?: string;
  outputDeviceId?: string;
}

export type VoiceTransportState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VoiceSessionBootstrap {
  session_id: string;
  channel_id: string;
  join_token: string;
  signaling_url: string;
  ice_servers: IceServerConfig[];
  quality_profile?: 'low' | 'balanced' | 'high';
  media_quality?: RTCMediaQuality;
}

export interface VoiceParticipant {
  user_id: string;
  username?: string;
  is_muted?: boolean;
  is_deafened?: boolean;
  is_speaking?: boolean;
  is_sharing_screen?: boolean;
  connected_at?: string;
}

/**
 * Fired whenever a remote peer's screen-share track arrives or goes away.
 * `stream === null` means "tear down the tile for this user" — the peer
 * stopped sharing, or disconnected, or the SFU told us to drop it.
 * Otherwise `stream` is the MediaStream the UI should bind to a <video>
 * element.
 */
export type RemoteScreenShareCallback = (
  userId: string,
  stream: MediaStream | null,
) => void;

interface VoiceTransportCallbacks {
  onStateChange?: (state: VoiceTransportState) => void;
  onParticipantsChange?: (participants: VoiceParticipant[]) => void;
  onError?: (error: string) => void;
  onRemoteScreenShare?: RemoteScreenShareCallback;
}

interface SignalMessage {
  type: string;
  session_id?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  audio_state?: {
    is_muted: boolean;
    is_deafened: boolean;
    is_speaking: boolean;
  };
  participants?: VoiceParticipant[];
  payload?: Record<string, unknown>;
  error?: string;
}

// Reconnect tuning. The first retry happens almost immediately so transient
// blips (laptop sleep, WiFi handoff) recover invisibly; subsequent retries
// back off so we don't hammer the SFU during an outage. After
// MAX_RECONNECT_ATTEMPTS we give up and surface a `failed` state so the UI
// can offer a manual rejoin.
const RECONNECT_BACKOFF_MS = [500, 1500, 4000, 10_000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_BACKOFF_MS.length;

export class VoiceTransport {
  private callbacks: VoiceTransportCallbacks;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private participants = new Map<string, VoiceParticipant>();
  private state: VoiceTransportState = 'idle';
  private remoteAudioEls = new Map<string, HTMLAudioElement>();
  private isMuted = false;
  private isDeafened = false;
  private activeQualityProfile: 'low' | 'balanced' | 'high' = 'balanced';
  private mediaQuality: RTCMediaQuality | null = null;

  // Screen share state.
  // - localScreenStream: the MediaStream returned by getDisplayMedia. Held
  //   so stopScreenShare can stop every track (mic-bound audio track too,
  //   if the user opted in to share with sound).
  // - screenVideoSender: the RTCRtpSender created when we addTrack'd the
  //   video. Kept on the side so stopScreenShare can removeTrack without
  //   having to scan getSenders() to find the right one.
  // - pendingVideoUserIds: FIFO of user IDs we've been told are about to
  //   publish a video track via the SFU's screen_share_started broadcast.
  //   The next video track that arrives in ontrack gets bound to the head
  //   of this queue. Mirror of the audio queue pattern that's already
  //   shipping — see pendingTrackQueue above.
  // - remoteScreenStreams: user_id -> the live MediaStream for their screen
  //   share, so we can stop/replace it on screen_share_stopped without
  //   relying on the UI to hold the reference.
  private localScreenStream: MediaStream | null = null;
  private screenVideoSender: RTCRtpSender | null = null;
  private screenAudioSender: RTCRtpSender | null = null;
  private pendingVideoUserIds: string[] = [];
  private remoteScreenStreams = new Map<string, MediaStream>();

  // Reconnect state. We hold onto the bootstrap from the initial connect so
  // a transient WebSocket / ICE drop can re-open the signaling channel
  // without going back to the REST `join` endpoint (which would mint a new
  // session_id and force every other peer to see us leave + rejoin).
  private lastBootstrap: VoiceSessionBootstrap | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // True once disconnect() has been called explicitly — prevents a stray
  // ws.onclose firing after we've torn down from kicking off a reconnect.
  private intentionalDisconnect = false;

  // Per-user volume: userId → preferred volume 0..1
  private userVolumePrefs = new Map<string, number>();
  // FIFO queue: userIds waiting for a track to be assigned
  private pendingTrackQueue: string[] = [];
  // userId → HTMLAudioElement mapping (populated as tracks arrive)
  private userAudioMap = new Map<string, HTMLAudioElement>();
  // Active audio device selections (mirrored from localStorage on connect
  // and updated by the device-change listener). Held here so we don't
  // have to re-read storage on every remote-track event.
  private currentInputDeviceId: string | null = null;
  private currentOutputDeviceId: string | null = null;
  // Unsubscribe handle for the window-level device-change listener.
  // Cleared on disconnect so re-connecting the transport doesn't stack
  // subscriptions.
  private deviceChangeUnsub: (() => void) | null = null;

  // ── Web Audio local input graph ─────────────────────────────────────────
  // The microphone stream returned by getUserMedia is routed through an
  // AudioContext so we can:
  //   1. apply the user's mic-volume slider as a real GainNode
  //   2. expose the processed stream to RTCPeerConnection
  //
  // The "raw" stream from getUserMedia is held separately so disconnect can
  // stop its tracks (the processed stream from the destination node doesn't
  // own the mic — it just observes the graph output).
  private localAudioContext: AudioContext | null = null;
  private localGainNode: GainNode | null = null;
  private localMicStream: MediaStream | null = null;
  // The Settings page dispatches AUDIO_SETTINGS_CHANGED_EVENT after any
  // mid-call settings flip; this unsub cleans the listener on disconnect.
  private audioSettingsChangeUnsub: (() => void) | null = null;

  // ── Push-to-talk state ──────────────────────────────────────────────────
  // When voiceActivityMode === 'ptt', the audio track stays disabled by
  // default and only fires while the PTT key is held. We hold the listeners
  // here so disconnect / mode-change can remove them without stacking.
  private currentVoiceActivityMode: VoiceActivityMode = 'voice';
  private currentPttKey: string = 'Alt';
  private pttKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private pttKeyupHandler: ((event: KeyboardEvent) => void) | null = null;
  // True while the user holds the PTT key. Distinct from `isMuted` — the
  // user can be in PTT mode AND muted, in which case the key does nothing.
  private isPttActive = false;

  // Latest user-selected audio quality preset; consulted by
  // applyAudioSenderQuality to cap the sender bitrate below the
  // server-negotiated profile.
  private currentAudioQuality: AudioQualityPreset = 'better';

  // Global output gain applied to every remote peer's audio element
  // as `audio.volume = currentSpeakerVolume * perUserPref`. Stored
  // as 0..1 here (the slider's 0..100 percentage is normalised on
  // read). Defaults to 1 so users upgrading from a build that
  // didn't have this setting don't suddenly land at silence.
  private currentSpeakerVolume = 1;

  // Current DSP toggles. Tracked here so the settings-change
  // listener can detect when a flip happened and re-acquire the
  // local mic with the new constraints — getUserMedia constraints
  // can't be updated in-place on an already-running track, so the
  // only way to apply a fresh `echoCancellation`/`noiseSuppression`/
  // `autoGainControl` value mid-call is to call getUserMedia again
  // and `replaceTrack` on every sender. The fields default to the
  // same values the persisted-settings reader does so the first
  // refresh after a Settings hop doesn't spuriously trigger a
  // reacquire on identical values.
  private currentEchoCancellation = true;
  private currentNoiseSuppression = true;
  private currentAutoGainControl = true;

  constructor(callbacks: VoiceTransportCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Replace the callback bundle. Used by the voice-call session registry
   * so a transport can outlive any single React mount: when the
   * VoiceChannel component remounts after a navigation away/back, it
   * swaps fresh callbacks onto the existing transport rather than
   * tearing it down and creating a new one (which would drop the call).
   *
   * Callers should pull current state via the getter methods immediately
   * after swapping callbacks -- the transport doesn't re-emit on
   * setCallbacks since nothing has changed from its perspective.
   */
  setCallbacks(callbacks: VoiceTransportCallbacks): void {
    this.callbacks = callbacks;
  }

  getState(): VoiceTransportState {
    return this.state;
  }

  getParticipants(): VoiceParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Snapshot getters for state that's normally observed via callbacks.
   * Used by the registry-aware mount path in VoiceChannel to seed React
   * state from a still-alive transport after a route-change remount.
   */
  getIsMuted(): boolean {
    return this.isMuted;
  }
  getIsDeafened(): boolean {
    return this.isDeafened;
  }
  getRemoteScreenStreams(): Map<string, MediaStream> {
    return new Map(this.remoteScreenStreams);
  }
  getActiveSessionId(): string | null {
    return this.lastBootstrap?.session_id ?? null;
  }

  private setState(state: VoiceTransportState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private emitParticipants(): void {
    this.callbacks.onParticipantsChange?.(this.getParticipants());
  }

  private emitError(error: string): void {
    voiceLogger.error(error);
    this.callbacks.onError?.(error);
  }

  private buildSignalingUrl(signalingUrl: string, joinToken: string): string {
    const trimmed = signalingUrl.trim();
    const withProtocol = (() => {
      if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed.replace(/^http/i, 'ws');
      }
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${protocol}://${trimmed}`;
    })();

    const url = new URL(withProtocol);
    url.searchParams.set('join_token', joinToken);
    return url.toString();
  }

  private getActiveAudioProfile() {
    const mediaQuality = this.mediaQuality;
    const profileName = this.activeQualityProfile;
    return mediaQuality?.audio.profiles?.[profileName];
  }

  private async setupLocalAudio(): Promise<void> {
    if (this.localStream) return;

    const audioSettings = this.mediaQuality?.audio;
    const persisted = readAudioSettings();
    this.currentInputDeviceId = persisted.inputDeviceId;
    this.currentOutputDeviceId = persisted.outputDeviceId;
    this.currentVoiceActivityMode = persisted.voiceActivityMode;
    this.currentPttKey = persisted.pttKey;
    this.currentAudioQuality = persisted.audioQuality;
    this.currentSpeakerVolume = Math.max(0, Math.min(1, persisted.speakerVolume / 100));
    this.currentEchoCancellation = persisted.echoCancellation;
    this.currentNoiseSuppression = persisted.noiseSuppression;
    this.currentAutoGainControl = persisted.autoGainControl;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: persisted.echoCancellation,
      noiseSuppression: persisted.noiseSuppression,
      autoGainControl: persisted.autoGainControl,
      sampleRate: audioSettings?.sample_rate_hz,
      channelCount: audioSettings?.stereo_enabled
        ? Math.max(audioSettings.channels, 2)
        : audioSettings?.channels,
    };
    // Honor the mic picked in DeviceSelectorModal / settings. Without this
    // the browser silently uses the system default and the device picker
    // becomes a lie.
    if (persisted.inputDeviceId) {
      audioConstraints.deviceId = { exact: persisted.inputDeviceId };
    }

    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
    this.localStream = this.buildLocalAudioGraph(rawStream, persisted.micVolume);
    this.applyVoiceActivityMode(persisted.voiceActivityMode, persisted.pttKey);
    this.wireAudioSettingsListener();
  }

  /**
   * Build the local input audio graph:
   *
   *   mic (rawStream) → MediaStreamAudioSourceNode
   *                       │
   *                       ▼
   *                   GainNode  (.gain = micVolume / 100)
   *                       │
   *                       ▼
   *           MediaStreamAudioDestinationNode → destination.stream
   *
   * The destination stream is what we hand to RTCPeerConnection, so the
   * user's mic-volume slider drives the audio peers actually receive — not
   * just a local meter. The raw stream is held on `localMicStream` so
   * disconnect can stop its tracks.
   *
   * Falls back to returning `rawStream` unchanged if AudioContext isn't
   * available (server-side render, locked-down WebView). The peers in that
   * case get the un-processed mic, which is identical to the old behavior
   * before this change.
   */
  private buildLocalAudioGraph(rawStream: MediaStream, micVolumePercent: number): MediaStream {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      this.localMicStream = rawStream;
      return rawStream;
    }
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(rawStream);
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, micVolumePercent / 100);
      const destination = ctx.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(destination);

      this.localAudioContext = ctx;
      this.localGainNode = gain;
      this.localMicStream = rawStream;
      return destination.stream;
    } catch (error) {
      voiceLogger.warn('voiceTransport: failed to build local audio graph; falling back to raw mic', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.localMicStream = rawStream;
      return rawStream;
    }
  }

  /**
   * Install or remove the global keydown/keyup listeners that gate the
   * outgoing audio track when the user is in push-to-talk mode. Idempotent
   * — repeated calls with the same mode are safe.
   *
   * The audio track's `.enabled` flag is what controls whether mic audio
   * reaches the RTCPeerConnection. In 'voice' mode it's just `!isMuted`.
   * In 'ptt' mode it's `!isMuted && isPttActive`, so muting still wins
   * over the key.
   */
  private applyVoiceActivityMode(mode: VoiceActivityMode, pttKey: string): void {
    this.currentVoiceActivityMode = mode;
    this.currentPttKey = pttKey;
    this.removePttListeners();

    if (mode === 'voice') {
      this.isPttActive = false;
      this.refreshLocalTrackEnabled();
      return;
    }

    // PTT mode: track is off until the key is held. We listen on window so
    // the call can stay open while the user is focused on a message
    // composer or other input; bare `keydown` listeners don't propagate
    // through inputs, but the listener fires regardless.
    if (typeof window === 'undefined') return;

    const normalized = pttKey.toLowerCase();
    const matches = (event: KeyboardEvent): boolean => {
      // Modifier keys come through as `event.key === 'Alt'` etc.; letter
      // keys come through as lowercased characters. Accept both forms.
      const k = event.key.toLowerCase();
      if (k === normalized) return true;
      // Space is persisted as a single space character; event.key for
      // space is ' ', which equals normalized after lowercase. Belt-and-
      // suspenders accept 'space' too in case the UI ever writes that.
      if (normalized === ' ' && (k === ' ' || k === 'space')) return true;
      return false;
    };

    this.pttKeydownHandler = (event) => {
      if (!matches(event)) return;
      if (this.isPttActive) return;
      this.isPttActive = true;
      this.refreshLocalTrackEnabled();
    };
    this.pttKeyupHandler = (event) => {
      if (!matches(event)) return;
      if (!this.isPttActive) return;
      this.isPttActive = false;
      this.refreshLocalTrackEnabled();
    };

    window.addEventListener('keydown', this.pttKeydownHandler);
    window.addEventListener('keyup', this.pttKeyupHandler);

    this.refreshLocalTrackEnabled();
  }

  private removePttListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.pttKeydownHandler) {
      window.removeEventListener('keydown', this.pttKeydownHandler);
      this.pttKeydownHandler = null;
    }
    if (this.pttKeyupHandler) {
      window.removeEventListener('keyup', this.pttKeyupHandler);
      this.pttKeyupHandler = null;
    }
  }

  /**
   * Recompute the audio track's `enabled` flag from the current mute + PTT
   * state. Single source of truth so setMuted / setVoiceActivityMode / the
   * PTT key handlers don't fight over the flag.
   */
  private refreshLocalTrackEnabled(): void {
    if (!this.localStream) return;
    const shouldTransmit =
      !this.isMuted &&
      (this.currentVoiceActivityMode === 'voice' || this.isPttActive);
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = shouldTransmit;
    }
  }

  /**
   * Subscribe to the window-level AUDIO_SETTINGS_CHANGED_EVENT so the
   * Settings page can push live changes (mic gain, PTT mode, audio
   * quality) into the call without the user having to leave + rejoin.
   *
   * Idempotent — repeated calls just re-use the existing subscription.
   * Cleared on disconnect.
   */
  private wireAudioSettingsListener(): void {
    if (typeof window === 'undefined') return;
    if (this.audioSettingsChangeUnsub) return;
    const handler = () => {
      this.refreshFromPersistedAudioSettings();
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handler);
    this.audioSettingsChangeUnsub = () => {
      window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handler);
    };
  }

  /**
   * Re-read the persisted audio settings and apply any deltas to the live
   * call. Called on AUDIO_SETTINGS_CHANGED_EVENT. We deliberately avoid
   * touching getUserMedia constraints here — device + DSP changes still
   * route through handleDeviceChange + a fresh track swap, because the
   * browser doesn't expose live constraint updates for those.
   */
  private refreshFromPersistedAudioSettings(): void {
    const persisted = readAudioSettings();

    if (this.localGainNode && this.localAudioContext) {
      const target = Math.max(0, persisted.micVolume / 100);
      // Short ramp to avoid the click that a hard gain jump produces on
      // continuous audio. 30ms is fast enough to feel instant but slow
      // enough to be smooth.
      try {
        this.localGainNode.gain.setTargetAtTime(target, this.localAudioContext.currentTime, 0.01);
      } catch {
        this.localGainNode.gain.value = target;
      }
    }

    if (
      persisted.voiceActivityMode !== this.currentVoiceActivityMode ||
      persisted.pttKey !== this.currentPttKey
    ) {
      this.applyVoiceActivityMode(persisted.voiceActivityMode, persisted.pttKey);
    }

    if (persisted.audioQuality !== this.currentAudioQuality) {
      this.currentAudioQuality = persisted.audioQuality;
      if (this.pc) {
        void this.applyAudioSenderQuality(this.pc);
      }
    }

    // Speaker volume — apply to every remote audio element so a
    // live drag in Settings adjusts an in-progress call without
    // requiring a leave + rejoin. The applySpeakerVolumeToAllRemotes
    // helper preserves per-user preferences by recomputing
    // `effectiveVolumeFor` for each.
    const nextSpeakerVolume = Math.max(0, Math.min(1, persisted.speakerVolume / 100));
    if (Math.abs(nextSpeakerVolume - this.currentSpeakerVolume) > 0.001) {
      this.currentSpeakerVolume = nextSpeakerVolume;
      this.applySpeakerVolumeToAllRemotes();
    }

    // DSP toggles — these can't be updated in place on a running
    // mediaTrack (getUserMedia constraints are sticky once a track
    // exists), so the only way to apply a flipped value mid-call
    // is to re-acquire the mic and replaceTrack on every sender.
    // Detected by comparing each toggle against the cached current
    // value; if any drifted, kick the re-acquire path with the
    // current device. Quietly skipped when there's no peer
    // connection (settings flip happened outside a call — values
    // will be picked up on next connect).
    const dspChanged =
      persisted.echoCancellation !== this.currentEchoCancellation ||
      persisted.noiseSuppression !== this.currentNoiseSuppression ||
      persisted.autoGainControl !== this.currentAutoGainControl;
    if (dspChanged && this.pc) {
      this.currentEchoCancellation = persisted.echoCancellation;
      this.currentNoiseSuppression = persisted.noiseSuppression;
      this.currentAutoGainControl = persisted.autoGainControl;
      void this.reacquireLocalMicWithCurrentSettings();
    } else if (dspChanged) {
      // Update the cache so a subsequent connect picks them up.
      this.currentEchoCancellation = persisted.echoCancellation;
      this.currentNoiseSuppression = persisted.noiseSuppression;
      this.currentAutoGainControl = persisted.autoGainControl;
    }
  }

  /**
   * Re-acquire the local mic with the current persisted settings
   * (device + DSP toggles + sample rate) and ``replaceTrack`` on
   * every active sender. Used by:
   *
   *   * The settings-change listener when the user flips a DSP
   *     toggle mid-call — getUserMedia constraints can't be
   *     updated in place, so we replay the stream with fresh
   *     constraints.
   *   * (handleDeviceChange retains its own inline implementation
   *     for now because it owns the input/output split semantics;
   *     a future cleanup could route both through here.)
   *
   * Failures bubble through onError but don't tear down the call.
   * The peer keeps its connection — only the local mic source
   * changes from its perspective, which is invisible because the
   * sender's MediaStreamTrack reference stays stable from RTC's
   * point of view.
   */
  private async reacquireLocalMicWithCurrentSettings(): Promise<void> {
    if (!this.pc) return;
    try {
      const audioSettings = this.mediaQuality?.audio;
      const constraints: MediaTrackConstraints = {
        echoCancellation: this.currentEchoCancellation,
        noiseSuppression: this.currentNoiseSuppression,
        autoGainControl: this.currentAutoGainControl,
        sampleRate: audioSettings?.sample_rate_hz,
        channelCount: audioSettings?.stereo_enabled
          ? Math.max(audioSettings.channels, 2)
          : audioSettings?.channels,
      };
      if (this.currentInputDeviceId) {
        constraints.deviceId = { exact: this.currentInputDeviceId };
      }
      const nextRawStream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false,
      });
      const persisted = readAudioSettings();
      // Tear down the old audio graph (the old AudioContext was
      // holding the previous mic's source node).
      this.teardownLocalAudioGraph();
      const previousProcessedStream = this.localStream;
      this.localStream = this.buildLocalAudioGraph(nextRawStream, persisted.micVolume);
      const nextTrack = this.localStream.getAudioTracks()[0];
      if (!nextTrack) return;
      await Promise.all(
        this.pc
          .getSenders()
          .filter((sender) => sender.track?.kind === 'audio')
          .map((sender) => sender.replaceTrack(nextTrack)),
      );
      this.refreshLocalTrackEnabled();
      if (previousProcessedStream && previousProcessedStream !== nextRawStream) {
        for (const track of previousProcessedStream.getTracks()) {
          track.stop();
        }
      }
    } catch (error) {
      this.emitError(
        `Failed to re-apply audio settings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Apply the persisted output deviceId to a freshly-created remote audio
   * element. Silently skipped when the browser doesn't expose setSinkId
   * (Firefox, Safari pre-17) — those ship with system-default-only behavior.
   */
  private async applyOutputSinkId(audio: HTMLAudioElement): Promise<void> {
    const sinkId = this.currentOutputDeviceId;
    if (!sinkId) return;
    const sinkable = audio as AudioElementWithSinkId;
    if (typeof sinkable.setSinkId !== 'function') return;
    try {
      await sinkable.setSinkId(sinkId);
    } catch (error) {
      voiceLogger.warn('voiceTransport: setSinkId failed', {
        sinkId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Wire up the `pufferblow:audio-devices-changed` event so a user who
   * changes their mic/headphones mid-call sees audio re-route without
   * having to leave + rejoin. No-op outside the browser.
   *
   * Stores the disposer on `this` so disconnect() can remove the listener
   * when the call ends — otherwise navigating between channels would
   * stack up multiple subscriptions on the same VoiceTransport.
   */
  private wireDeviceChangeListener(): void {
    if (typeof window === 'undefined') return;
    if (this.deviceChangeUnsub) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AudioDeviceChangeDetail>)[
        AUDIO_DEVICE_CHANGE_PAYLOAD_KEY
      ];
      void this.handleDeviceChange(detail);
    };
    window.addEventListener(AUDIO_DEVICES_CHANGED_EVENT, handler);
    this.deviceChangeUnsub = () => {
      window.removeEventListener(AUDIO_DEVICES_CHANGED_EVENT, handler);
    };
  }

  /**
   * Live device-swap path. For input changes we re-acquire the mic with
   * the new deviceId and `replaceTrack` on every active sender so the
   * peer keeps its connection — no need for an SDP renegotiation. For
   * output changes we walk every cached audio element and re-apply
   * `setSinkId`. Failures bubble through onError but don't tear down the
   * call.
   */
  private async handleDeviceChange(
    detail: AudioDeviceChangeDetail | undefined,
  ): Promise<void> {
    const persisted = readAudioSettings();
    const nextInput = detail?.inputDeviceId ?? persisted.inputDeviceId;
    const nextOutput = detail?.outputDeviceId ?? persisted.outputDeviceId;

    if (nextOutput && nextOutput !== this.currentOutputDeviceId) {
      this.currentOutputDeviceId = nextOutput;
      await Promise.all(
        Array.from(this.remoteAudioEls.values()).map((audio) =>
          this.applyOutputSinkId(audio),
        ),
      );
    }

    if (nextInput && nextInput !== this.currentInputDeviceId && this.pc) {
      this.currentInputDeviceId = nextInput;
      try {
        const audioSettings = this.mediaQuality?.audio;
        // Re-read settings so a mid-call toggle flip on the Settings page
        // takes effect on the next device swap, not just on rejoin.
        const settings = readAudioSettings();
        const constraints: MediaTrackConstraints = {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          sampleRate: audioSettings?.sample_rate_hz,
          channelCount: audioSettings?.stereo_enabled
            ? Math.max(audioSettings.channels, 2)
            : audioSettings?.channels,
          deviceId: { exact: nextInput },
        };
        const nextRawStream = await navigator.mediaDevices.getUserMedia({
          audio: constraints,
          video: false,
        });
        // Tear down the old audio graph (the old AudioContext was holding
        // the previous mic's source node; rebuilding is cheaper and safer
        // than trying to swap the source in place).
        this.teardownLocalAudioGraph();
        const previousProcessedStream = this.localStream;
        this.localStream = this.buildLocalAudioGraph(nextRawStream, settings.micVolume);
        const nextTrack = this.localStream.getAudioTracks()[0];
        if (!nextTrack) return;
        await Promise.all(
          this.pc
            .getSenders()
            .filter((sender) => sender.track?.kind === 'audio')
            .map((sender) => sender.replaceTrack(nextTrack)),
        );
        // Re-apply mute + PTT state to the new track and stop the old
        // processed stream's tracks (the destination node held them, the
        // raw stream's tracks were already stopped inside teardown).
        this.refreshLocalTrackEnabled();
        if (previousProcessedStream && previousProcessedStream !== nextRawStream) {
          for (const track of previousProcessedStream.getTracks()) {
            track.stop();
          }
        }
      } catch (error) {
        this.emitError(
          `Failed to switch microphone: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Stop the raw mic stream and close the AudioContext built by
   * buildLocalAudioGraph. Leaves `localStream` (the processed stream)
   * alone — the caller is responsible for swapping or stopping that
   * separately, depending on whether this is a device swap or a full
   * disconnect.
   */
  private teardownLocalAudioGraph(): void {
    if (this.localMicStream) {
      for (const track of this.localMicStream.getTracks()) {
        track.stop();
      }
      this.localMicStream = null;
    }
    if (this.localAudioContext) {
      try {
        void this.localAudioContext.close();
      } catch {
        // closing a closed context throws; ignore.
      }
      this.localAudioContext = null;
    }
    this.localGainNode = null;
  }

  private async applyAudioSenderQuality(pc: RTCPeerConnection): Promise<void> {
    const activeProfile = this.getActiveAudioProfile();
    const serverBitrateKbps = activeProfile?.bitrate_kbps;
    const userBitrateKbps = QUALITY_BITRATE_KBPS[this.currentAudioQuality];

    // Cap at the lower of (server profile, user preset) so the server can
    // still enforce an upper bound (e.g. a free tier) while a user who
    // wants to save bandwidth can dial themselves below it. If the server
    // never provided a profile we just use the user's preset.
    const targetBitrateKbps =
      typeof serverBitrateKbps === 'number'
        ? Math.min(serverBitrateKbps, userBitrateKbps)
        : userBitrateKbps;

    const audioSenders = pc
      .getSenders()
      .filter((sender) => sender.track?.kind === 'audio');

    await Promise.all(
      audioSenders.map(async (sender) => {
        try {
          const parameters = sender.getParameters();
          const encodings = parameters.encodings && parameters.encodings.length > 0
            ? parameters.encodings
            : [{}];

          encodings[0] = {
            ...encodings[0],
            maxBitrate: targetBitrateKbps * 1000,
          };

          await sender.setParameters({
            ...parameters,
            encodings,
          });
        } catch (error) {
          voiceLogger.warn('Audio sender quality parameters were not applied', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );
  }

  /**
   * Bind an incoming video track to a user. The SFU sends a
   * `screen_share_started` broadcast (which lands in handleSignalMessage
   * and pushes to pendingVideoUserIds) right before forwarding the track,
   * so we pop the next pending userId and emit onRemoteScreenShare.
   *
   * If the queue is empty when the track arrives — e.g. announce arrived
   * after the track due to network reordering, or the publisher started
   * sharing before we joined and we missed the broadcast — we silently
   * drop the track. The user remains in the participant list with their
   * is_sharing_screen flag, so the worst case is "this peer shows as
   * sharing but the tile is empty," not a stuck call.
   *
   * track.onended fires when the publisher stops or disconnects, which
   * the SFU handles via a `screen_share_stopped` broadcast — but we
   * also belt-and-suspenders clean up here in case the broadcast is lost.
   */
  private handleRemoteVideoTrack(track: MediaStreamTrack, stream: MediaStream): void {
    const userId = this.pendingVideoUserIds.shift();
    if (!userId) {
      voiceLogger.warn('voiceTransport: video track arrived with no pending user binding', {
        track_id: track.id,
      });
      return;
    }
    this.remoteScreenStreams.set(userId, stream);
    this.callbacks.onRemoteScreenShare?.(userId, stream);

    track.onended = () => {
      if (this.remoteScreenStreams.get(userId) === stream) {
        this.remoteScreenStreams.delete(userId);
        this.callbacks.onRemoteScreenShare?.(userId, null);
      }
    };
  }

  /**
   * Start publishing a screen share. Captures via getDisplayMedia with
   * `audio: true` so the user can opt in to share system sound, but
   * gracefully accepts an audio-less stream (most browsers prompt for
   * each). The video track is addTrack'd on the existing peer connection
   * which triggers onnegotiationneeded → renegotiation, and a
   * `screen_share_started` signal is sent so other clients know who to
   * bind the incoming track to.
   *
   * Throws if the user denies the prompt or the browser doesn't support
   * getDisplayMedia. Callers should surface the error via toast — the
   * call itself stays alive.
   */
  async startScreenShare(): Promise<void> {
    if (!this.pc) {
      throw new Error('Cannot start screen share — not connected to voice');
    }
    if (this.localScreenStream) {
      // Already sharing — be idempotent rather than throwing.
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      // Shouldn't happen — getDisplayMedia always returns a video track —
      // but handle defensively.
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Screen capture returned no video track');
    }

    // Browser-level "Stop sharing" button (Chrome's overlay) ends the
    // track directly. Wire that to our normal stop path so the SFU and
    // other peers find out.
    videoTrack.onended = () => {
      void this.stopScreenShare();
    };

    this.localScreenStream = stream;
    this.screenVideoSender = this.pc.addTrack(videoTrack, stream);

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      this.screenAudioSender = this.pc.addTrack(audioTrack, stream);
    }

    // Renegotiate. addTrack synchronously dirties the senders so the
    // resulting offer includes the new m-line. The SFU's offer handler
    // is renegotiation-friendly — it always SetRemoteDescription +
    // generates a fresh answer.
    await this.renegotiate();

    // Announce after renegotiation so the SFU has already accepted the
    // new track when other peers receive the broadcast. Ordering matters:
    // if we announce first, the peer pops a pending userId, the track
    // arrives, gets bound — good. If we announce after, same outcome.
    // The race is harmless either way because pendingVideoUserIds is
    // populated on the announce, not on the track arrival.
    this.sendSignal({ type: 'screen_share_started' });
  }

  /**
   * Stop publishing a screen share. Removes the video sender (and audio
   * sender if present), stops the local tracks, renegotiates so the SFU
   * tears down its end, and broadcasts the stop so other clients drop
   * their tile.
   *
   * Safe to call when not sharing — no-ops in that case.
   */
  async stopScreenShare(): Promise<void> {
    if (!this.localScreenStream || !this.pc) return;

    if (this.screenVideoSender) {
      try {
        this.pc.removeTrack(this.screenVideoSender);
      } catch (error) {
        voiceLogger.warn('voiceTransport: removeTrack(video) failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.screenVideoSender = null;
    }
    if (this.screenAudioSender) {
      try {
        this.pc.removeTrack(this.screenAudioSender);
      } catch (error) {
        voiceLogger.warn('voiceTransport: removeTrack(audio) failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.screenAudioSender = null;
    }

    for (const track of this.localScreenStream.getTracks()) {
      track.stop();
    }
    this.localScreenStream = null;

    try {
      await this.renegotiate();
    } catch (error) {
      // Best-effort — even if the renegotiation fails, the local capture
      // is stopped and the broadcast still lets other peers tear down.
      voiceLogger.warn('voiceTransport: renegotiation after stop failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    this.sendSignal({ type: 'screen_share_stopped' });
  }

  /**
   * True iff this transport is currently publishing a screen share track.
   * Used by the UI to flip the share button into a stop-share state.
   */
  isScreenSharing(): boolean {
    return this.localScreenStream !== null;
  }

  /**
   * Returns the local screen-capture stream so the UI can render a
   * self-preview tile. Null when not sharing.
   */
  getLocalScreenStream(): MediaStream | null {
    return this.localScreenStream;
  }

  /**
   * Create and send a fresh offer. Used by startScreenShare /
   * stopScreenShare after addTrack / removeTrack. We don't use
   * onnegotiationneeded because the initial connect() already does
   * createOffer manually — wiring both would double-fire on the first
   * connection. Doing it explicitly here keeps the flow predictable.
   */
  private async renegotiate(): Promise<void> {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: 'offer', offer });
  }

  private ensurePeerConnection(iceServers: IceServerConfig[]): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({
      iceServers: iceServers.map((server) => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential,
      })),
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.sendSignal({
        type: 'candidate',
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // Video tracks are screen shares — branch into the screen-share
      // path which surfaces a MediaStream to the UI via callback rather
      // than creating a hidden <audio> element.
      if (event.track.kind === 'video') {
        this.handleRemoteVideoTrack(event.track, stream);
        return;
      }

      const trackId = event.track.id;
      let audio = this.remoteAudioEls.get(trackId);
      const createdNow = !audio;
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        this.remoteAudioEls.set(trackId, audio);
      }

      audio.srcObject = stream;
      audio.muted = this.isDeafened;

      // Route output to the headphones the user picked in
      // DeviceSelectorModal. Only call setSinkId on first creation —
      // subsequent track replacements keep the same element so the sink
      // stays bound.
      if (createdNow) {
        void this.applyOutputSinkId(audio);
      }

      // Associate with a userId from the pending queue (FIFO). Apply
      // the effective volume = global speaker volume * per-user
      // preference. The two compose because the slider in Settings
      // is a master gain ("how loud is everyone overall?"), while
      // per-user prefs are deltas ("make X quieter"). Defaults to
      // the global volume alone when the user has no per-user
      // override yet.
      if (this.pendingTrackQueue.length > 0) {
        const userId = this.pendingTrackQueue.shift()!;
        this.userAudioMap.set(userId, audio);
        audio.volume = this.effectiveVolumeFor(userId);
      } else {
        // No userId association yet — at least apply the global
        // speaker volume so the first frame doesn't blast at full.
        audio.volume = this.currentSpeakerVolume;
      }

      void audio.play().catch(() => undefined);
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          // Successful connect (initial or after retry) — clear the retry
          // counter so the next transient drop gets the full backoff budget.
          this.reconnectAttempts = 0;
          this.setState('connected');
          break;
        case 'disconnected':
          // Disconnected is transient — Chrome fires this when ICE checks
          // are failing but the PC may still recover on its own. Mark
          // reconnecting for UI feedback but don't immediately tear down.
          // If we don't reach connected within a few seconds, `failed`
          // fires and the explicit reconnect kicks in.
          this.setState('reconnecting');
          break;
        case 'failed':
          // Hard ICE failure. Try an ICE restart via fresh offer; if the
          // signaling channel is also down, scheduleReconnect will reopen
          // the WS first.
          this.scheduleReconnect('pc-failed');
          break;
        case 'closed':
          this.setState('idle');
          break;
        default:
          break;
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    this.pc = pc;
    return pc;
  }

  private async openSignaling(signalingUrl: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(signalingUrl);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Failed to open voice signaling websocket'));
      ws.onclose = () => {
        // Don't react to a close we triggered ourselves (disconnect() path),
        // and don't reconnect from the idle state — that means we never
        // really got connected and the initial connect() will throw on its
        // own.
        if (this.intentionalDisconnect || this.state === 'idle') {
          return;
        }
        this.scheduleReconnect('ws-closed');
      };
      ws.onmessage = (event) => {
        this.handleSignalMessage(event.data);
      };
    });
  }

  /**
   * Schedule an exponential-backoff reconnect. Idempotent — repeated calls
   * during the same outage (e.g. both the WS and the PC firing close events)
   * collapse into a single retry on the timer that's already armed.
   *
   * Why we re-use the original bootstrap: minting a new session via REST
   * would change the session_id and make every other peer see a leave+rejoin
   * pair. Replaying the same join_token keeps continuity. The SFU's `join`
   * handler is documented as idempotent, and `offer` always renegotiates,
   * so re-sending both on the new WS picks us back up where we left off.
   */
  private scheduleReconnect(reason: string): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectTimer) return;
    if (!this.lastBootstrap) {
      // Nothing to reconnect to — connect() was never called or already
      // tore down. Surface a hard failure so the UI can route to manual
      // rejoin instead of leaving the user in a stuck reconnecting state.
      this.setState('failed');
      return;
    }
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emitError(
        `Voice reconnect gave up after ${MAX_RECONNECT_ATTEMPTS} attempts (${reason})`,
      );
      this.setState('failed');
      return;
    }

    const delay = RECONNECT_BACKOFF_MS[this.reconnectAttempts] ?? 10_000;
    this.reconnectAttempts += 1;
    this.setState('reconnecting');
    voiceLogger.info('voiceTransport: scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delay_ms: delay,
      reason,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.attemptReconnect(reason);
    }, delay);
  }

  /**
   * Single reconnect attempt. Closes the old signaling socket, opens a
   * fresh one against the same SFU URL + join token, sends `join` to
   * refresh participant state, and issues an ICE-restart offer so the
   * existing peer connection re-establishes its media path. If anything
   * throws we schedule another retry (subject to MAX_RECONNECT_ATTEMPTS).
   */
  private async attemptReconnect(reason: string): Promise<void> {
    if (this.intentionalDisconnect || !this.lastBootstrap || !this.pc) {
      return;
    }

    try {
      if (this.ws) {
        try {
          this.ws.onclose = null; // suppress recursive reconnect from the old socket
          this.ws.close();
        } catch {
          // no-op
        }
        this.ws = null;
      }

      const signalingUrl = this.buildSignalingUrl(
        this.lastBootstrap.signaling_url,
        this.lastBootstrap.join_token,
      );
      await this.openSignaling(signalingUrl);
      this.sendSignal({ type: 'join', session_id: this.lastBootstrap.session_id });

      // ICE restart forces fresh candidates without dropping senders /
      // receivers, so audio resumes as soon as the new path is established.
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', offer });

      // State will flip to `connected` via onconnectionstatechange once
      // ICE finishes. Leaving it as `reconnecting` is correct in the gap.
      voiceLogger.info('voiceTransport: reconnect handshake sent', { reason });
    } catch (error) {
      voiceLogger.warn('voiceTransport: reconnect attempt failed', {
        attempt: this.reconnectAttempts,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      this.scheduleReconnect(`retry-after-error:${reason}`);
    }
  }

  private sendSignal(message: SignalMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private async handleSignalMessage(raw: unknown): Promise<void> {
    let msg: SignalMessage;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : (raw as SignalMessage);
    } catch {
      this.emitError('Invalid signaling payload');
      return;
    }

    switch (msg.type) {
      case 'joined': {
        const participants = msg.participants ?? [];
        this.participants.clear();
        this.pendingTrackQueue = [];
        // Reset the video queue too. Any participant who is already
        // sharing at the time we join gets pre-queued so their forwarded
        // video track binds correctly when it lands.
        this.pendingVideoUserIds = [];
        for (const participant of participants) {
          this.participants.set(participant.user_id, participant);
          this.pendingTrackQueue.push(participant.user_id);
          if (participant.is_sharing_screen) {
            this.pendingVideoUserIds.push(participant.user_id);
          }
        }
        this.emitParticipants();
        break;
      }
      case 'screen_share_started': {
        const userId = String(msg.payload?.user_id ?? '');
        if (!userId) break;
        // Update the participant flag so consumers (UI participant list)
        // can show a "sharing screen" indicator before the video track
        // itself arrives.
        const current = this.participants.get(userId);
        if (current) {
          this.participants.set(userId, { ...current, is_sharing_screen: true });
          this.emitParticipants();
        }
        // Queue the userId for the next inbound video track. Dedupe to
        // tolerate the SFU re-broadcasting on a client reconnect — pushing
        // twice would leave a phantom userId waiting forever.
        if (!this.pendingVideoUserIds.includes(userId)) {
          this.pendingVideoUserIds.push(userId);
        }
        break;
      }
      case 'screen_share_stopped': {
        const userId = String(msg.payload?.user_id ?? '');
        if (!userId) break;
        const current = this.participants.get(userId);
        if (current) {
          this.participants.set(userId, { ...current, is_sharing_screen: false });
          this.emitParticipants();
        }
        // If we never bound the track (announce out of order, or we
        // didn't have onRemoteScreenShare registered), still drain the
        // pending queue so a later legitimate share doesn't get bound to
        // the wrong user.
        this.pendingVideoUserIds = this.pendingVideoUserIds.filter((id) => id !== userId);
        const stream = this.remoteScreenStreams.get(userId);
        if (stream) {
          this.remoteScreenStreams.delete(userId);
          this.callbacks.onRemoteScreenShare?.(userId, null);
        }
        break;
      }
      case 'participant_joined': {
        const userId = String(msg.payload?.user_id ?? '');
        if (userId) {
          const current = this.participants.get(userId);
          this.participants.set(userId, {
            user_id: userId,
            username: String(msg.payload?.username ?? current?.username ?? ''),
            is_muted: Boolean(msg.payload?.is_muted ?? current?.is_muted ?? false),
            is_deafened: Boolean(msg.payload?.is_deafened ?? current?.is_deafened ?? false),
            is_speaking: Boolean(msg.payload?.is_speaking ?? current?.is_speaking ?? false),
            connected_at: String(msg.payload?.connected_at ?? current?.connected_at ?? ''),
          });
          // Queue for track assignment
          if (!this.userAudioMap.has(userId)) {
            this.pendingTrackQueue.push(userId);
          }
          this.emitParticipants();
        }
        break;
      }
      case 'participant_left': {
        const userId = String(msg.payload?.user_id ?? '');
        if (userId) {
          this.participants.delete(userId);
          this.userAudioMap.delete(userId);
          this.pendingTrackQueue = this.pendingTrackQueue.filter((id) => id !== userId);
          this.pendingVideoUserIds = this.pendingVideoUserIds.filter((id) => id !== userId);
          // Drop any remote screen stream that hasn't been torn down yet.
          // The SFU broadcasts screen_share_stopped before participant_left
          // when a sharing peer disconnects, so this is a safety net for
          // out-of-order delivery.
          if (this.remoteScreenStreams.has(userId)) {
            this.remoteScreenStreams.delete(userId);
            this.callbacks.onRemoteScreenShare?.(userId, null);
          }
          this.emitParticipants();
        }
        break;
      }
      case 'offer': {
        if (!msg.offer || !this.pc) break;
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', answer });
        break;
      }
      case 'answer': {
        if (!msg.answer || !this.pc) break;
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        break;
      }
      case 'candidate': {
        if (!msg.candidate || !this.pc) break;
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        break;
      }
      case 'speaker_levels': {
        const userId = String(msg.payload?.user_id ?? '');
        if (!userId || !this.participants.has(userId)) break;
        const current = this.participants.get(userId)!;
        this.participants.set(userId, {
          ...current,
          is_speaking: Boolean(msg.payload?.is_speaking),
          is_muted: Boolean(msg.payload?.is_muted),
          is_deafened: Boolean(msg.payload?.is_deafened ?? current.is_deafened),
        });
        this.emitParticipants();
        break;
      }
      case 'error': {
        // Server-sent error means the SFU is rejecting us at the protocol
        // level (invalid token, room full, instance mismatch, etc).
        // Treat as final — clearing lastBootstrap and flipping the
        // intentionalDisconnect flag means the WS close that follows
        // won't kick off a reconnect loop with the same bad token.
        this.emitError(msg.error || 'Voice signaling error');
        this.lastBootstrap = null;
        this.intentionalDisconnect = true;
        this.setState('failed');
        break;
      }
      default:
        break;
    }
  }

  async connect(bootstrap: VoiceSessionBootstrap): Promise<void> {
    this.setState('connecting');
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;
    // lastBootstrap is set AFTER the WS handshake completes successfully
    // (see below). Setting it up front meant a failed initial connect
    // would leave the bootstrap cached, and a late-arriving ws.onclose
    // event would trigger scheduleReconnect against the same bad token —
    // a 4-attempt loop on a permanently rejected session.
    this.lastBootstrap = null;

    try {
      this.mediaQuality = bootstrap.media_quality ?? null;
      this.activeQualityProfile = bootstrap.quality_profile
        ?? bootstrap.media_quality?.default_profile
        ?? 'balanced';
      await this.setupLocalAudio();
      this.wireDeviceChangeListener();
      const pc = this.ensurePeerConnection(bootstrap.ice_servers || []);
      await this.applyAudioSenderQuality(pc);
      const signalingUrl = this.buildSignalingUrl(bootstrap.signaling_url, bootstrap.join_token);
      await this.openSignaling(signalingUrl);

      // openSignaling resolved → the WS is open and the SFU accepted us
      // at the protocol level. Now it's safe to cache the bootstrap for
      // the reconnect path. A subsequent ws.onclose / pc 'failed' will
      // legitimately need this to recover.
      this.lastBootstrap = bootstrap;

      this.sendSignal({ type: 'join', session_id: bootstrap.session_id });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', offer });

      // Don't optimistically setState('connected') here — ICE hasn't
      // completed and pc.onconnectionstatechange will flip us to
      // 'connected' once the media path is actually established. The
      // old optimistic flip caused a connecting → connected → reconnecting
      // bounce when the initial ICE attempt failed against a slow TURN.
      this.sendAudioState();
    } catch (error) {
      // Initial connect failure is final — clear the bootstrap so any
      // delayed ws.onclose firing during teardown can't re-enter the
      // reconnect path. The caller (VoiceChannel) surfaces the error
      // and the user clicks Join again to retry.
      this.lastBootstrap = null;
      this.intentionalDisconnect = true;
      this.setState('failed');
      this.emitError(error instanceof Error ? error.message : 'Failed to connect voice transport');
      throw error;
    }
  }

  private sendAudioState(): void {
    this.sendSignal({
      type: 'audio_state',
      audio_state: {
        is_muted: this.isMuted,
        is_deafened: this.isDeafened,
        is_speaking: false,
      },
    });
  }

  setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    // Funnel the actual `enabled` flag through one place so mute + PTT can
    // coexist (e.g. mute wins over a held PTT key).
    this.refreshLocalTrackEnabled();
    this.sendAudioState();
    return this.isMuted;
  }

  setDeafened(deafened: boolean): boolean {
    this.isDeafened = deafened;
    for (const audio of this.remoteAudioEls.values()) {
      audio.muted = deafened;
    }
    this.sendAudioState();
    return this.isDeafened;
  }

  /** Set playback volume for a specific remote participant (0 = silent, 1 = full). */
  setUserVolume(userId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.userVolumePrefs.set(userId, clamped);
    const audio = this.userAudioMap.get(userId);
    if (audio) {
      // Compose with the global speaker volume so the per-user
      // preference acts as a delta on top of the master gain.
      audio.volume = this.effectiveVolumeFor(userId);
    }
  }

  /** Get current per-user volume preference (defaults to 1 if not set).
   *  This is the RAW preference value, NOT the effective applied
   *  volume — call sites that want the actual playback gain should
   *  multiply by the current speaker volume themselves, or read
   *  ``audio.volume`` from the element.
   */
  getUserVolume(userId: string): number {
    return this.userVolumePrefs.get(userId) ?? 1;
  }

  /**
   * Effective playback volume for a remote participant: the master
   * speaker volume (Settings → Voice → Output volume) multiplied
   * by any per-user preference. Both factors are clamped to [0, 1],
   * so the result is naturally clamped too. Used wherever we need
   * to write to ``audio.volume`` so the two factors stay in sync.
   */
  private effectiveVolumeFor(userId: string | null | undefined): number {
    const perUser = userId ? this.userVolumePrefs.get(userId) ?? 1 : 1;
    return Math.max(0, Math.min(1, this.currentSpeakerVolume * perUser));
  }

  /**
   * Apply the current speaker volume + per-user prefs to every live
   * remote audio element. Called when ``currentSpeakerVolume``
   * changes (the user dragged the slider mid-call). Iterates the
   * userAudioMap rather than remoteAudioEls so each peer's per-user
   * preference is preserved.
   */
  private applySpeakerVolumeToAllRemotes(): void {
    for (const [userId, audio] of this.userAudioMap.entries()) {
      audio.volume = this.effectiveVolumeFor(userId);
    }
    // Audio elements that haven't been associated with a user yet
    // (first frame arriving before the pendingTrackQueue resolves)
    // still need the master volume applied.
    for (const audio of this.remoteAudioEls.values()) {
      // Walk userAudioMap to detect whether this element is already
      // associated — set membership is faster than a reverse lookup
      // built every time.
      let isAssociated = false;
      for (const known of this.userAudioMap.values()) {
        if (known === audio) {
          isAssociated = true;
          break;
        }
      }
      if (!isAssociated) {
        audio.volume = this.currentSpeakerVolume;
      }
    }
  }

  async disconnect(): Promise<void> {
    // Flag set first so any in-flight ws.onclose / pc.onconnectionstatechange
    // events that fire during teardown skip the reconnect path.
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.lastBootstrap = null;
    this.reconnectAttempts = 0;

    if (this.ws) {
      try {
        this.ws.close(1000, 'voice-disconnect');
      } catch {
        // no-op
      }
      this.ws = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    // Stop the raw mic stream + close the AudioContext built by
    // buildLocalAudioGraph. Without this the AudioContext can keep the
    // mic LED on after the user has hung up.
    this.teardownLocalAudioGraph();
    this.removePttListeners();
    this.isPttActive = false;
    this.currentVoiceActivityMode = 'voice';
    this.currentPttKey = 'Alt';
    this.currentAudioQuality = 'better';
    if (this.audioSettingsChangeUnsub) {
      this.audioSettingsChangeUnsub();
      this.audioSettingsChangeUnsub = null;
    }

    for (const audio of this.remoteAudioEls.values()) {
      audio.srcObject = null;
    }
    this.remoteAudioEls.clear();
    this.userAudioMap.clear();
    this.pendingTrackQueue = [];
    this.userVolumePrefs.clear();
    this.mediaQuality = null;
    this.activeQualityProfile = 'balanced';
    this.currentInputDeviceId = null;
    this.currentOutputDeviceId = null;

    // Screen share teardown. Notify the UI for every still-open remote
    // tile (cleanup happens before UI sees the state change) and stop
    // any local capture tracks we were publishing.
    if (this.localScreenStream) {
      for (const track of this.localScreenStream.getTracks()) {
        track.stop();
      }
      this.localScreenStream = null;
    }
    this.screenVideoSender = null;
    this.screenAudioSender = null;
    for (const userId of this.remoteScreenStreams.keys()) {
      this.callbacks.onRemoteScreenShare?.(userId, null);
    }
    this.remoteScreenStreams.clear();
    this.pendingVideoUserIds = [];
    if (this.deviceChangeUnsub) {
      this.deviceChangeUnsub();
      this.deviceChangeUnsub = null;
    }

    this.participants.clear();
    this.emitParticipants();
    this.setState('idle');
  }
}

export const createVoiceTransport = (
  callbacks: VoiceTransportCallbacks = {}
): VoiceTransport => new VoiceTransport(callbacks);
