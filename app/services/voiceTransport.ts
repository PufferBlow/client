import { logger } from '../utils/logger';
import type { RTCMediaQuality } from './system';

const voiceLogger = logger.network;

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
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: audioSettings?.sample_rate_hz,
        channelCount: audioSettings?.stereo_enabled
          ? Math.max(audioSettings.channels, 2)
          : audioSettings?.channels,
      },
      video: false,
    });
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
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        this.remoteAudioEls.set(trackId, audio);
      }

      audio.srcObject = stream;
      audio.muted = this.isDeafened;
      void audio.play().catch(() => undefined);
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.setState('connected');
          break;
        case 'disconnected':
          this.setState('reconnecting');
          break;
        case 'failed':
          this.setState('failed');
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
        if (this.state !== 'idle') {
          this.setState('failed');
        }
      };
      ws.onmessage = (event) => {
        this.handleSignalMessage(event.data);
      };
    });
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
        for (const participant of participants) {
          this.participants.set(participant.user_id, participant);
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
          this.emitParticipants();
        }
        break;
      }
      case 'participant_left': {
        const userId = String(msg.payload?.user_id ?? '');
        if (userId) {
          this.participants.delete(userId);
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

    try {
      this.mediaQuality = bootstrap.media_quality ?? null;
      this.activeQualityProfile = bootstrap.quality_profile
        ?? bootstrap.media_quality?.default_profile
        ?? 'balanced';
      await this.setupLocalAudio();
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

  async disconnect(): Promise<void> {
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
    this.mediaQuality = null;
    this.activeQualityProfile = 'balanced';

    this.participants.clear();
    this.emitParticipants();
    this.setState('idle');
  }
}

export const createVoiceTransport = (
  callbacks: VoiceTransportCallbacks = {}
): VoiceTransport => new VoiceTransport(callbacks);

