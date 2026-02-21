import { logger } from '../utils/logger';
import { getHostPortFromStorage } from './user';

// Use network logger for WebSocket since it's networking related
const websocketLogger = logger.network;

const buildWebSocketBaseUrl = (hostPort: string): string => {
  const trimmed = hostPort.trim().replace(/\/$/, '');
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/^http/i, 'ws');
  }

  const protocol =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss'
      : 'ws';
  return `${protocol}://${trimmed}`;
};

const buildHttpBaseUrl = (hostPort: string): string => {
  const trimmed = hostPort.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed.replace(/^ws/i, 'http');
  }

  const protocol =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'https'
      : 'http';
  return `${protocol}://${trimmed}`;
};

export interface WebRTCData {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  fromUserId: string;
  toUserId?: string; // for direct signaling (optional, undefined = broadcast)
  channelId: string;
}

export interface WebSocketMessage {
  type: 'message' | 'user_joined' | 'user_left' | 'user_status_changed' | 'error' | 'read_confirmation' | 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice' | 'webrtc_join' | 'webrtc_leave' | 'webrtc_mute' | 'webrtc_unmute';
  channel_id?: string;  // Now always included in global websocket
  message_id?: string;
  sender_user_id?: string;
  username?: string;
  sender_avatar_url?: string | null;
  sender_status?: string;
  sender_roles?: string[];
  message?: string;
  hashed_message?: string;
  sent_at?: string;
  attachments?: string[];
  webrtcData?: WebRTCData; // WebRTC signaling data
  user_id?: string;
  avatar?: string;
  content?: string;
  timestamp?: string;
  status?: 'online' | 'idle' | 'afk' | 'dnd' | 'offline';
  error?: string;
}

export interface WebSocketCallbacks {
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: Event) => void;
}

export class GlobalWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private callbacks: WebSocketCallbacks;
  private authToken: string;
  private hostPort: string;
  private isDestroyed = false;
  private beforeUnloadHandler: (() => void) | null = null;

  constructor(authToken: string, hostPort: string, callbacks: WebSocketCallbacks = {}) {
    this.authToken = authToken;
    this.hostPort = hostPort;
    this.callbacks = callbacks;
  }

  private getWebSocketUrl(): string {
    const baseUrl = buildWebSocketBaseUrl(this.hostPort);
    return `${baseUrl}/ws?auth_token=${encodeURIComponent(this.authToken)}`;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      websocketLogger.info('Global WebSocket already connected or connecting');
      return;
    }

    try {
      this.ws = new WebSocket(this.getWebSocketUrl());
      this.setupEventHandlers();
      this.registerBeforeUnloadHandler();
    } catch (error) {
      websocketLogger.error('Failed to create global WebSocket connection', error);
      this.callbacks.onError?.(error as Event);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event) => {
      websocketLogger.info('Global WebSocket connected', event);
      this.reconnectAttempts = 0;
      this.callbacks.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        websocketLogger.debug('Global WebSocket message received', message);
        this.callbacks.onMessage?.(message);
      } catch (error) {
        websocketLogger.error('Failed to parse global WebSocket message', error);
      }
    };

    this.ws.onclose = (event) => {
      websocketLogger.info('Global WebSocket disconnected', event);
      if (!this.isDestroyed && event.code !== 1000) { // 1000 = normal closure
        this.scheduleReconnect();
      }
      this.callbacks.onDisconnected?.(event.reason || 'Connection closed');
    };

    this.ws.onerror = (event) => {
      websocketLogger.error('Global WebSocket error', event);
      this.callbacks.onError?.(event);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      websocketLogger.error('Max reconnect attempts reached for global WebSocket');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    websocketLogger.info(`Scheduling global WebSocket reconnect in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.unregisterBeforeUnloadHandler();
    if (this.ws) {
      this.ws.close(1000, 'Global WebSocket component unmounted');
      this.ws = null;
    }
  }

  private registerBeforeUnloadHandler(): void {
    if (typeof window === 'undefined' || this.beforeUnloadHandler) {
      return;
    }

    this.beforeUnloadHandler = () => {
      try {
        const payload = JSON.stringify({
          auth_token: this.authToken,
          status: 'offline',
        });
        const body = new Blob([payload], { type: 'application/json' });
        const endpoint = `${buildHttpBaseUrl(this.hostPort)}/api/v1/users/profile`;
        navigator.sendBeacon(endpoint, body);
      } catch (error) {
        websocketLogger.warn('Failed to send offline presence beacon', error);
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private unregisterBeforeUnloadHandler(): void {
    if (typeof window === 'undefined' || !this.beforeUnloadHandler) {
      return;
    }
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.beforeUnloadHandler = null;
  }

  sendMessage(content: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send just the message content for the send_message endpoint
      this.ws.send(content);
      return true;
    }
    return false;
  }

  sendReadConfirmation(messageId: string, channelId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const confirmationMessage = JSON.stringify({
          type: 'read_confirmation',
          message_id: messageId,
          channel_id: channelId
        });
        this.ws.send(confirmationMessage);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send read confirmation via global WebSocket', error);
        return false;
      }
    }
    return false;
  }

  // WebRTC signaling methods
  sendWebRTCOffer(channelId: string, offer: RTCSessionDescriptionInit, toUserId?: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'webrtc_offer',
          channel_id: channelId,
          webrtcData: {
            offer,
            fromUserId: '', // Will be set by server from auth
            toUserId,
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send WebRTC offer', error);
        return false;
      }
    }
    return false;
  }

  sendWebRTCAnswer(channelId: string, answer: RTCSessionDescriptionInit, toUserId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'webrtc_answer',
          channel_id: channelId,
          webrtcData: {
            answer,
            fromUserId: '', // Will be set by server from auth
            toUserId,
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send WebRTC answer', error);
        return false;
      }
    }
    return false;
  }

  sendWebRTCIceCandidate(channelId: string, candidate: RTCIceCandidateInit, toUserId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'webrtc_ice',
          channel_id: channelId,
          webrtcData: {
            candidate,
            fromUserId: '', // Will be set by server from auth
            toUserId,
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send WebRTC ICE candidate', error);
        return false;
      }
    }
    return false;
  }

  sendVoiceChannelJoin(channelId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'webrtc_join',
          channel_id: channelId,
          webrtcData: {
            fromUserId: '', // Will be set by server from auth
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send voice channel join', error);
        return false;
      }
    }
    return false;
  }

  sendVoiceChannelLeave(channelId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'webrtc_leave',
          channel_id: channelId,
          webrtcData: {
            fromUserId: '', // Will be set by server from auth
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send voice channel leave', error);
        return false;
      }
    }
    return false;
  }

  sendVoiceChannelMute(channelId: string, muted: boolean): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: muted ? 'webrtc_mute' : 'webrtc_unmute',
          channel_id: channelId,
          webrtcData: {
            fromUserId: '', // Will be set by server from auth
            channelId
          }
        });
        this.ws.send(message);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send voice channel mute status', error);
        return false;
      }
    }
    return false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false;
  }

  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING || false;
  }
}

export class ChannelWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private callbacks: WebSocketCallbacks;
  private channelId: string;
  private authToken: string;
  private hostPort: string;
  private isDestroyed = false;

  constructor(channelId: string, authToken: string, hostPort: string, callbacks: WebSocketCallbacks = {}) {
    this.channelId = channelId;
    this.authToken = authToken;
    this.hostPort = hostPort;
    this.callbacks = callbacks;
  }

  private getWebSocketUrl(): string {
    const baseUrl = buildWebSocketBaseUrl(this.hostPort);
    return `${baseUrl}/ws/channels/${this.channelId}?auth_token=${encodeURIComponent(this.authToken)}`;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      websocketLogger.info('WebSocket already connected or connecting');
      return;
    }

    try {
      this.ws = new WebSocket(this.getWebSocketUrl());
      this.setupEventHandlers();
    } catch (error) {
      websocketLogger.error('Failed to create WebSocket connection', error);
      this.callbacks.onError?.(error as Event);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event) => {
      websocketLogger.info('WebSocket connected', event);
      this.reconnectAttempts = 0;
      this.callbacks.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        websocketLogger.debug('WebSocket message received', message);
        this.callbacks.onMessage?.(message);
      } catch (error) {
        websocketLogger.error('Failed to parse WebSocket message', error);
      }
    };

    this.ws.onclose = (event) => {
      websocketLogger.info('WebSocket disconnected', event);
      if (!this.isDestroyed && event.code !== 1000) { // 1000 = normal closure
        this.scheduleReconnect();
      }
      this.callbacks.onDisconnected?.(event.reason || 'Connection closed');
    };

    this.ws.onerror = (event) => {
      websocketLogger.error('WebSocket error', event);
      this.callbacks.onError?.(event);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      websocketLogger.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    websocketLogger.info(`Scheduling reconnect in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.isDestroyed = true;
    if (this.ws) {
      this.ws.close(1000, 'Component unmounted');
      this.ws = null;
    }
  }

  sendMessage(content: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send just the message content for the send_message endpoint
      this.ws.send(content);
      return true;
    }
    return false;
  }

  sendReadConfirmation(messageId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const confirmationMessage = JSON.stringify({
          type: 'read_confirmation',
          message_id: messageId
        });
        this.ws.send(confirmationMessage);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send read confirmation', error);
        return false;
      }
    }
    return false;
  }

  sendReadConfirmationWithChannel(messageId: string, channelId: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const confirmationMessage = JSON.stringify({
          type: 'read_confirmation',
          message_id: messageId,
          channel_id: channelId
        });
        this.ws.send(confirmationMessage);
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send read confirmation with channel', error);
        return false;
      }
    }
    return false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false;
  }

  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING || false;
  }
}

// Convenience function to create a global WebSocket connection
export const createGlobalWebSocket = (
  authToken: string,
  hostPort: string,
  callbacks: WebSocketCallbacks = {}
): GlobalWebSocket => {
  return new GlobalWebSocket(authToken, hostPort, callbacks);
};

// Convenience function to create a WebSocket connection for a channel
export const createChannelWebSocket = (
  channelId: string,
  authToken: string,
  hostPort: string,
  callbacks: WebSocketCallbacks = {}
): ChannelWebSocket => {
  return new ChannelWebSocket(channelId, authToken, hostPort, callbacks);
};

// Helper function to get hostPort from storage (similar to user service)
export const getHostPortForWebSocket = (): string => {
  const serviceHostPort = getHostPortFromStorage();
  if (serviceHostPort) {
    return serviceHostPort;
  }

  if (typeof window !== 'undefined') {
    // First check sessionStorage (legacy key names)
    const sessionHostPort = sessionStorage.getItem('serverHostPort');
    if (sessionHostPort) return sessionHostPort;
    const sessionLegacyHostPort = sessionStorage.getItem('host_port');
    if (sessionLegacyHostPort) return decodeURIComponent(sessionLegacyHostPort);

    // Then localStorage (legacy key names)
    const localHostPort = localStorage.getItem('serverHostPort');
    if (localHostPort) return localHostPort;
    const localLegacyHostPort = localStorage.getItem('host_port');
    if (localLegacyHostPort) return decodeURIComponent(localLegacyHostPort);

    // Fallback
    return 'localhost:7575';
  }
  return 'localhost:7575';
};
