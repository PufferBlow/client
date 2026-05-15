import { logger } from '../utils/logger';
import type { RTCMediaQuality } from './system';

const voiceLogger = logger.network;

// Persistence key shared with DeviceSelectorModal / useSettingsAudio.
// Read on connect (and on every device-change event) so the user's mic +
// headphones picks actually route audio.
const AUDIO_SETTINGS_STORAGE_KEY = 'pufferblow-audio-settings';
const AUDIO_DEVICES_CHANGED_EVENT = 'pufferblow:audio-devices-changed';

interface PersistedAudioSelections {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
}

/**
 * Read the persisted audio-device selections from localStorage. Returns
 * (null, null) outside the browser, when storage is empty, or when the
 * payload is malformed. Tolerates schema drift (the settings page writes
 * additional fields beyond these two device IDs).
 */
function readAudioDeviceSelections(): PersistedAudioSelections {
  if (typeof window === 'undefined') return { inputDeviceId: null, outputDeviceId: null };
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { inputDeviceId: null, outputDeviceId: null };
    const parsed = JSON.parse(raw) as {
      selectedInputDevice?: string;
      selectedOutputDevice?: string;
    };
    return {
      inputDeviceId: parsed.selectedInputDevice?.trim() || null,
      outputDeviceId: parsed.selectedOutputDevice?.trim() || null,
    };
  } catch {
    return { inputDeviceId: null, outputDeviceId: null };
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
  connected_at?: string;
}

interface VoiceTransportCallbacks {
  onStateChange?: (state: VoiceTransportState) => void;
  onParticipantsChange?: (participants: VoiceParticipant[]) => void;
  onError?: (error: string) => void;
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

  constructor(callbacks: VoiceTransportCallbacks = {}) {
    this.callbacks = callbacks;
  }

  getState(): VoiceTransportState {
    return this.state;
  }

  getParticipants(): VoiceParticipant[] {
    return Array.from(this.participants.values());
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
    const { inputDeviceId, outputDeviceId } = readAudioDeviceSelections();
    this.currentInputDeviceId = inputDeviceId;
    this.currentOutputDeviceId = outputDeviceId;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: audioSettings?.sample_rate_hz,
      channelCount: audioSettings?.stereo_enabled
        ? Math.max(audioSettings.channels, 2)
        : audioSettings?.channels,
    };
    // Honor the mic picked in DeviceSelectorModal / settings. Without this
    // the browser silently uses the system default and the device picker
    // becomes a lie.
    if (inputDeviceId) {
      audioConstraints.deviceId = { exact: inputDeviceId };
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
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
    const persisted = readAudioDeviceSelections();
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
        const constraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: audioSettings?.sample_rate_hz,
          channelCount: audioSettings?.stereo_enabled
            ? Math.max(audioSettings.channels, 2)
            : audioSettings?.channels,
          deviceId: { exact: nextInput },
        };
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: constraints,
          video: false,
        });
        const nextTrack = nextStream.getAudioTracks()[0];
        if (!nextTrack) return;
        // Inherit the current mute state so swapping mid-call doesn't
        // accidentally unmute the user.
        nextTrack.enabled = !this.isMuted;
        const previousStream = this.localStream;
        this.localStream = nextStream;
        await Promise.all(
          this.pc
            .getSenders()
            .filter((sender) => sender.track?.kind === 'audio')
            .map((sender) => sender.replaceTrack(nextTrack)),
        );
        if (previousStream) {
          for (const track of previousStream.getTracks()) {
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

  private async applyAudioSenderQuality(pc: RTCPeerConnection): Promise<void> {
    const activeProfile = this.getActiveAudioProfile();
    if (!activeProfile) {
      return;
    }

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
            maxBitrate: activeProfile.bitrate_kbps * 1000,
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

      // Associate with a userId from the pending queue (FIFO)
      if (this.pendingTrackQueue.length > 0) {
        const userId = this.pendingTrackQueue.shift()!;
        this.userAudioMap.set(userId, audio);
        // Apply stored volume preference
        const vol = this.userVolumePrefs.get(userId);
        if (vol !== undefined) {
          audio.volume = vol;
        }
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
        for (const participant of participants) {
          this.participants.set(participant.user_id, participant);
          // Queue existing participants for track assignment
          this.pendingTrackQueue.push(participant.user_id);
        }
        this.emitParticipants();
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
          this.pendingTrackQueue = this.pendingTrackQueue.filter(id => id !== userId);
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
        this.emitError(msg.error || 'Voice signaling error');
        this.setState('failed');
        break;
      }
      default:
        break;
    }
  }

  async connect(bootstrap: VoiceSessionBootstrap): Promise<void> {
    this.setState('connecting');
    // Persist the bootstrap so an unexpected WS close or ICE failure can
    // be recovered by replaying the same join_token + signaling_url.
    // Replaced verbatim on every connect() call — picking up a new
    // session via REST should never re-enter the reconnect path.
    this.lastBootstrap = bootstrap;
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;

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

      this.sendSignal({ type: 'join', session_id: bootstrap.session_id });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', offer });

      this.setState('connected');
      this.sendAudioState();
    } catch (error) {
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
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
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
      audio.volume = clamped;
    }
  }

  /** Get current volume for a user (defaults to 1 if not set). */
  getUserVolume(userId: string): number {
    return this.userVolumePrefs.get(userId) ?? 1;
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
