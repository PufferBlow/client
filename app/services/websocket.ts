import { logger } from '../utils/logger';

// Use network logger for WebSocket since it's networking related
const websocketLogger = logger.network;

export interface WebSocketMessage {
  type: 'message' | 'user_joined' | 'user_left' | 'user_status_changed' | 'error';
  channel_id: string;
  message_id?: string;
  user_id?: string;
  username?: string;
  content?: string;
  timestamp?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  error?: string;
}

export interface WebSocketCallbacks {
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: Event) => void;
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
    const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const protocol = isDevelopment ? 'ws' : 'ws';
    const baseUrl = isDevelopment ? '' : `${protocol}://${this.hostPort}`;
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

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false;
  }

  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING || false;
  }
}

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
  if (typeof window !== 'undefined') {
    // First check sessionStorage
    const sessionHostPort = sessionStorage.getItem('serverHostPort');
    if (sessionHostPort) return sessionHostPort;

    // Then localStorage
    const localHostPort = localStorage.getItem('serverHostPort');
    if (localHostPort) return localHostPort;

    // Fallback
    return 'localhost:7575';
  }
  return 'localhost:7575';
};
