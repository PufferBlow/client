import { logger } from '../utils/logger';
import { GlobalWebSocket } from './websocket';

// WebRTC logging
const webrtcLogger = logger.network;

// WebRTC configuration optimized for voice
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Could add TURN servers from your backend config here
  ]
};

// Audio constraints optimized for voice
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000, // Lower sample rate for voice
    channelCount: 1,   // Mono audio
  },
  video: false
};

export interface VoiceChannelParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
  status: string;
  isMuted: boolean;
  isSpeaking: boolean;
  connectedAt: Date;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

export interface VoiceChannelStatus {
  channelId: string;
  participants: VoiceChannelParticipant[];
  participantCount: number;
  isJoined: boolean;
  error?: string;
}

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map(); // userId -> RTCPeerConnection
  private participants: Map<string, VoiceChannelParticipant> = new Map(); // userId -> participant data
  private currentChannelId: string | null = null;
  private localStream: MediaStream | null = null;
  private isMuted = false;
  private isDeafened = false;
  private websocket: GlobalWebSocket;
  private onStatusChange?: (status: VoiceChannelStatus) => void;
  private onError?: (error: string) => void;
  private audioContext: AudioContext | null = null;
  private localUserId: string;
  private isInitialized = false;

  constructor(websocket: GlobalWebSocket, localUserId: string) {
    this.websocket = websocket;
    this.localUserId = localUserId;

    webrtcLogger.info(`WebRTCManager initialized for user ${localUserId}`);
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // Set up WebRTC signaling handlers on the websocket
    const originalCallback = (this.websocket as any).callbacks.onMessage;
    (this.websocket as any).callbacks.onMessage = (message: any) => {
      // Handle WebRTC signaling messages first
      this.handleWebRTCSignaling(message);

      // Call original callback for any other message types
      originalCallback?.(message);
    };

    webrtcLogger.info(`WebRTC service initialized for user ${this.localUserId}`);
  }

  private async handleWebRTCSignaling(message: any): Promise<void> {
    if (!message.webrtcData) return;

    const { fromUserId, toUserId, channelId, offer, answer, candidate } = message.webrtcData;

    // Ensure the message is for current channel and not from ourselves
    if (channelId !== this.currentChannelId || fromUserId === this.localUserId) {
      return;
    }

    webrtcLogger.debug('Received WebRTC signaling message', { type: message.type, fromUserId, toUserId, channelId });

    switch (message.type) {
      case 'webrtc_offer':
        if (offer && toUserId === this.localUserId) {
          await this.handleOffer(fromUserId, offer);
        }
        break;

      case 'webrtc_answer':
        if (answer && toUserId === this.localUserId) {
          await this.handleAnswer(fromUserId, answer);
        }
        break;

      case 'webrtc_ice':
        if (candidate && toUserId === this.localUserId) {
          await this.handleIceCandidate(fromUserId, candidate);
        }
        break;

      case 'webrtc_join':
        await this.handleParticipantJoin(fromUserId, channelId);
        break;

      case 'webrtc_leave':
        await this.handleParticipantLeave(fromUserId);
        break;

      case 'webrtc_mute':
      case 'webrtc_unmute':
        this.handleParticipantMute(fromUserId, message.type === 'webrtc_mute');
        break;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      webrtcLogger.info('Local audio stream initialized');

      // Create audio context for speech detection
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      this.isInitialized = true;
    } catch (error) {
      webrtcLogger.error('Failed to initialize WebRTC manager', error);
      throw new Error(`WebRTC initialization failed: ${error}`);
    }
  }

  async joinVoiceChannel(channelId: string): Promise<VoiceChannelStatus> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.currentChannelId) {
      await this.leaveVoiceChannel();
    }

    this.currentChannelId = channelId;

    // Notify other participants we're joining
    this.websocket.sendVoiceChannelJoin(channelId);

    // Add ourselves as participant
    const localParticipant: VoiceChannelParticipant = {
      userId: this.localUserId,
      username: 'You', // Will be updated by server data
      status: 'online',
      isMuted: this.isMuted,
      isSpeaking: false,
      connectedAt: new Date(),
      stream: this.localStream || undefined
    };

    this.participants.set(this.localUserId, localParticipant);

    webrtcLogger.info(`Joined voice channel ${channelId}`);

    const status: VoiceChannelStatus = {
      channelId,
      participants: Array.from(this.participants.values()),
      participantCount: this.participants.size,
      isJoined: true
    };

    this.onStatusChange?.(status);
    return status;
  }

  async leaveVoiceChannel(): Promise<void> {
    if (!this.currentChannelId) return;

    // Close all peer connections
    for (const [userId, pc] of this.peerConnections) {
      pc.close();
      this.peerConnections.delete(userId);
      this.participants.delete(userId);
    }

    // Notify others we're leaving
    this.websocket.sendVoiceChannelLeave(this.currentChannelId);

    this.currentChannelId = null;

    webrtcLogger.info('Left voice channel');

    const status: VoiceChannelStatus = {
      channelId: '',
      participants: [],
      participantCount: 0,
      isJoined: false
    };

    this.onStatusChange?.(status);
  }

  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const participant = this.participants.get(userId);
      if (participant && event.streams[0]) {
        participant.stream = event.streams[0];
        // Could emit audio for playback here

        // Update participant status
        this.notifyStatusChange();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentChannelId) {
        this.websocket.sendWebRTCIceCandidate(this.currentChannelId, event.candidate.toJSON(), userId);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const participant = this.participants.get(userId);
      if (participant) {
        webrtcLogger.debug(`Peer connection state for ${userId}: ${pc.connectionState}`);

        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          // Could implement reconnection logic here
          participant.stream = undefined;
        }

        this.notifyStatusChange();
      }
    };

    // Store the peer connection
    this.peerConnections.set(userId, pc);

    return pc;
  }

  private async handleParticipantJoin(userId: string, channelId: string): Promise<void> {
    if (userId === this.localUserId || !this.currentChannelId || channelId !== this.currentChannelId) {
      return;
    }

    // Create participant entry
    const participant: VoiceChannelParticipant = {
      userId,
      username: `User ${userId.slice(-4)}`, // Server should provide username
      status: 'online',
      isMuted: false,
      isSpeaking: false,
      connectedAt: new Date()
    };

    this.participants.set(userId, participant);

    // Create peer connection for this participant
    await this.createPeerConnection(userId);

    // Initiate connection by sending offer (we joined before them, so we start)
    try {
      const pc = this.peerConnections.get(userId);
      if (pc && this.currentChannelId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.websocket.sendWebRTCOffer(this.currentChannelId, offer, userId);
      }
    } catch (error) {
      webrtcLogger.error(`Failed to create offer for ${userId}`, error);
    }

    webrtcLogger.info(`Participant ${userId} joined channel ${channelId}`);

    this.notifyStatusChange();
  }

  private async handleParticipantLeave(userId: string): Promise<void> {
    // Close and remove peer connection
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }

    // Remove participant
    this.participants.delete(userId);

    webrtcLogger.info(`Participant ${userId} left channel`);

    this.notifyStatusChange();
  }

  private async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      let pc = this.peerConnections.get(fromUserId);
      if (!pc) {
        pc = await this.createPeerConnection(fromUserId);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.currentChannelId) {
        this.websocket.sendWebRTCAnswer(this.currentChannelId, answer, fromUserId);
      }

      webrtcLogger.debug(`Handled offer from ${fromUserId}`);
    } catch (error) {
      webrtcLogger.error(`Failed to handle offer from ${fromUserId}`, error);
    }
  }

  private async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        webrtcLogger.debug(`Handled answer from ${fromUserId}`);
      }
    } catch (error) {
      webrtcLogger.error(`Failed to handle answer from ${fromUserId}`, error);
    }
  }

  private async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        webrtcLogger.debug(`Added ICE candidate from ${fromUserId}`);
      }
    } catch (error) {
      webrtcLogger.error(`Failed to handle ICE candidate from ${fromUserId}`, error);
    }
  }

  private handleParticipantMute(userId: string, muted: boolean): void {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.isMuted = muted;
      this.notifyStatusChange();

      webrtcLogger.debug(`Participant ${userId} mute status: ${muted}`);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    // Update local stream tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }

    // Notify WebSocket about mute status change
    if (this.currentChannelId) {
      this.websocket.sendVoiceChannelMute(this.currentChannelId, this.isMuted);

      // Update local participant data
      const localParticipant = this.participants.get(this.localUserId);
      if (localParticipant) {
        localParticipant.isMuted = this.isMuted;
        this.notifyStatusChange();
      }
    }

    webrtcLogger.info(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`);
    return this.isMuted;
  }

  toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;

    // When deafened, we disable all remote audio
    for (const participant of this.participants.values()) {
      if (participant.stream && participant.userId !== this.localUserId) {
        const audioTracks = participant.stream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = !this.isDeafened;
        });
      }
    }

    webrtcLogger.info(`Audio ${this.isDeafened ? 'deafened' : 'undeafened'}`);
    return this.isDeafened;
  }

  getChannelStatus(): VoiceChannelStatus {
    return {
      channelId: this.currentChannelId || '',
      participants: Array.from(this.participants.values()),
      participantCount: this.participants.size,
      isJoined: this.currentChannelId !== null
    };
  }

  isJoined(): boolean {
    return this.currentChannelId !== null;
  }

  getCurrentChannelId(): string | null {
    return this.currentChannelId;
  }

  private notifyStatusChange(): void {
    if (this.onStatusChange) {
      const status = this.getChannelStatus();
      this.onStatusChange(status);
    }
  }

  // Event listeners
  setOnStatusChange(callback: (status: VoiceChannelStatus) => void): void {
    this.onStatusChange = callback;
  }

  setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }

    this.peerConnections.clear();
    this.participants.clear();
    this.currentChannelId = null;
    this.isInitialized = false;

    webrtcLogger.info('WebRTC manager cleaned up');
  }
}

// Factory function to create WebRTC manager
export const createWebRTCManager = (websocket: GlobalWebSocket, localUserId: string): WebRTCManager => {
  return new WebRTCManager(websocket, localUserId);
};

// Utility functions for media device management
export const getAudioDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput');
  } catch (error) {
    webrtcLogger.error('Failed to enumerate audio devices', error);
    return [];
  }
};

export const checkMediaPermissions = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop immediately
    return true;
  } catch (error) {
    webrtcLogger.warn('Microphone permission denied or not available', error);
    return false;
  }
};
