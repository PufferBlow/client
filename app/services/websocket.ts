import { logger } from '../utils/logger';
import { resolveInstance } from './instance';
import { networkStatus } from './networkStatus';
import { getHostPortFromStorage } from './user';
import type { Message, MessageAttachment } from '../models';

// Use network logger for WebSocket since it's networking related
const websocketLogger = logger.network;

const buildWebSocketBaseUrl = (hostPort: string): string =>
  resolveInstance(hostPort).wsBaseUrl;

const buildHttpBaseUrl = (hostPort: string): string =>
  resolveInstance(hostPort).apiBaseUrl;

export type PresenceStatus = 'online' | 'idle' | 'afk' | 'dnd' | 'offline';

export interface WebSocketAttachmentPayload {
  url: string;
  filename?: string;
  type?: string;
  size?: number | null;
}

interface WebSocketBaseMessage {
  channel_id?: string;
  message_id?: string;
}

export interface WebSocketChatMessage extends WebSocketBaseMessage {
  // The current server may omit `type` for chat payloads sent over websocket.
  type?: 'message';
  sender_user_id?: string;
  username?: string;
  sender_avatar_url?: string | null;
  sender_status?: string;
  sender_roles?: string[];
  message?: string;
  hashed_message?: string;
  sent_at?: string;
  attachments?: Array<string | WebSocketAttachmentPayload>;
}

export interface WebSocketPresenceMessage extends WebSocketBaseMessage {
  type: 'user_status_changed';
  user_id?: string;
  timestamp?: string;
  status?: PresenceStatus;
  source?: string;
}

export interface WebSocketChannelMembershipMessage extends WebSocketBaseMessage {
  type: 'user_joined' | 'user_left';
  user_id?: string;
  username?: string;
  timestamp?: string;
}

export interface WebSocketReadConfirmationMessage extends WebSocketBaseMessage {
  type: 'read_confirmation';
}

export interface WebSocketErrorMessage extends WebSocketBaseMessage {
  type: 'error';
  error?: string;
}

// ---------------------------------------------------------------------------
// Ping real-time events
// ---------------------------------------------------------------------------

export interface WebSocketPingReceivedMessage extends WebSocketBaseMessage {
  type: 'ping_received';
  ping_id: string;
  receiver_ping_id?: string;
  sender_id?: string;
  sender_actor_uri?: string;
  sender_username?: string;
  ping_type: 'local' | 'federated' | 'instance';
  message?: string | null;
  sent_at: string;
  expires_at: string;
  original_activity_uri?: string;
}

export interface WebSocketPingAckedMessage extends WebSocketBaseMessage {
  type: 'ping_acked';
  ping_id: string;
  sender_ping_id?: string;
  acker_user_id?: string;
  acker_actor_uri?: string;
  latency_ms: number;
  acked_at: string;
  federated?: boolean;
}

/**
 * Aggregated-reactions broadcast for a single message. Same payload goes to
 * every channel viewer; the client computes its own `viewer_reacted` flag
 * locally by checking whether the viewer's user_id is in the per-emoji
 * `user_ids` list (the server intentionally doesn't bake that in here so
 * the broadcast can be a single message for everyone).
 */
export interface WebSocketReactionUpdateMessage extends WebSocketBaseMessage {
  type: 'message_reaction_added' | 'message_reaction_removed';
  user_id?: string;
  emoji?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    user_ids?: string[];
  }>;
}

/**
 * Server-pushed notification row destined for the viewer. Emitted by the
 * pufferblow API after it records a mention (or any future notification
 * class) so the client can light up an OS-level toast immediately.
 *
 * The nested `notification` shape mirrors `Notifications.to_dict()` on the
 * server (see api/database/tables/notifications.py).
 */
export interface WebSocketNotificationCreatedMessage extends WebSocketBaseMessage {
  type: 'notification_created';
  notification: {
    notification_id: string;
    user_id: string;
    type: string;
    actor_user_id?: string | null;
    channel_id?: string | null;
    message_id?: string | null;
    created_at?: string | null;
    read_at?: string | null;
  };
}

export type WebSocketMessage =
  | WebSocketChatMessage
  | WebSocketPresenceMessage
  | WebSocketChannelMembershipMessage
  | WebSocketReadConfirmationMessage
  | WebSocketErrorMessage
  | WebSocketPingReceivedMessage
  | WebSocketPingAckedMessage
  | WebSocketReactionUpdateMessage
  | WebSocketNotificationCreatedMessage;

export const isChatWebSocketMessage = (
  message: WebSocketMessage
): message is WebSocketChatMessage =>
  (message.type === 'message' || message.type === undefined) &&
  Boolean(message.message_id);

const guessAttachmentMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return `video/${ext === 'mov' ? 'quicktime' : ext}`;
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) {
    return ext === 'mp3'
      ? 'audio/mpeg'
      : ext === 'm4a'
        ? 'audio/mp4'
        : `audio/${ext}`;
  }
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
    return ext === 'pdf'
      ? 'application/pdf'
      : ext === 'doc'
        ? 'application/msword'
        : ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : ext === 'txt'
            ? 'text/plain'
            : 'application/octet-stream';
  }

  return 'application/octet-stream';
};

export const normalizeWebSocketAttachments = (
  attachments?: Array<string | WebSocketAttachmentPayload>
): MessageAttachment[] => {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }

  const normalized: MessageAttachment[] = [];

  for (const attachment of attachments) {
    if (typeof attachment === 'object' && attachment?.url) {
      normalized.push({
        url: attachment.url,
        filename: attachment.filename || attachment.url.split('/').pop() || 'attachment',
        type: attachment.type || 'application/octet-stream',
        size: attachment.size || null,
      });
      continue;
    }

    if (typeof attachment === 'string') {
      const filename = attachment.split('/').pop() || 'attachment';
      normalized.push({
        url: attachment,
        filename,
        type: guessAttachmentMimeType(filename),
        size: null,
      });
    }
  }

  return normalized;
};

export const normalizeChatWebSocketMessage = (
  message: WebSocketChatMessage
): Message => ({
  message_id: message.message_id || `ws-${Date.now()}-${Math.random()}`,
  sender_user_id: message.sender_user_id || '',
  message: message.message || '',
  hashed_message: message.hashed_message || '',
  username: message.username,
  sender_avatar_url: message.sender_avatar_url,
  sender_status: message.sender_status,
  sender_roles: message.sender_roles,
  sent_at: message.sent_at || new Date().toISOString(),
  channel_id: message.channel_id || '',
  attachments: normalizeWebSocketAttachments(message.attachments),
});

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface WebSocketCallbacks {
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: Event) => void;
  onStateChange?: (state: ConnectionState) => void;
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
  private connectionState: ConnectionState = 'idle';
  private statusOnConnect: PresenceStatus | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Unsubscribe handle for the network-status listener. Held so
   *  we can drop it cleanly in ``disconnect`` and avoid leaking
   *  listeners across hot reloads in development. */
  private networkStatusUnsubscribe: (() => void) | null = null;
  /** Pending reconnect timer id. Tracked so we can cancel it when
   *  the device goes offline — no point burning the exponential-
   *  backoff budget while there's no chance of succeeding. */
  private pendingReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while the device is offline. ``scheduleReconnect`` bails
   *  when this is true so the manager doesn't thrash; the
   *  network-status listener triggers a fresh ``connect()`` the
   *  moment the device comes back online. */
  private suspendedForOffline = false;

  constructor(authToken: string, hostPort: string, callbacks: WebSocketCallbacks = {}) {
    this.authToken = authToken;
    this.hostPort = hostPort;
    this.callbacks = callbacks;
    // Subscribe to device-level connectivity changes so the manager
    // can pause reconnect attempts when there's no point trying.
    // The listener is wired up in the constructor (not in
    // ``connect``) because the `online` event may fire BEFORE the
    // caller calls connect — we want to be ready immediately so
    // the first reconnect lands without delay.
    this.networkStatusUnsubscribe = networkStatus.subscribe((online) => {
      this.handleNetworkStatusChange(online);
    });
  }

  /**
   * Network-status transitions.
   *
   * Offline → cancel any pending reconnect timer and close the
   *   socket if it's still trying. Set ``suspendedForOffline`` so
   *   ``scheduleReconnect`` (which can also be triggered by
   *   ``onclose`` here) doesn't immediately re-schedule.
   *
   * Online → wake up. Reset the reconnect counter (we don't want
   *   to count the offline window as a failed attempt) and call
   *   ``connect`` directly. If the WS was already connected this
   *   is a no-op (``connect`` short-circuits).
   */
  private handleNetworkStatusChange(online: boolean): void {
    if (!online) {
      if (this.suspendedForOffline) return;
      this.suspendedForOffline = true;
      websocketLogger.info(
        'Device offline detected — suspending WebSocket reconnect attempts',
      );
      if (this.pendingReconnectTimer !== null) {
        clearTimeout(this.pendingReconnectTimer);
        this.pendingReconnectTimer = null;
      }
      // Close any in-flight CONNECTING socket — there's no point
      // letting it run out the TCP timeout. An already-connected
      // socket gets closed too because it's effectively dead once
      // the device lost connectivity; the browser would just take
      // longer to tell us.
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        try {
          this.ws.close(1001, 'Device offline');
        } catch {
          // Defensive — close() shouldn't throw on a CONNECTING
          // socket but browsers have shipped bugs there.
        }
      }
      this.setConnectionState('disconnected');
      return;
    }
    if (!this.suspendedForOffline) return;
    this.suspendedForOffline = false;
    websocketLogger.info(
      'Device back online — attempting WebSocket reconnect immediately',
    );
    // Reset the reconnect-attempt budget so the offline window
    // didn't eat retries that should count against actual server
    // failures.
    this.reconnectAttempts = 0;
    if (!this.isDestroyed) {
      this.connect();
    }
  }

  setStatusOnConnect(status: PresenceStatus | null): void {
    this.statusOnConnect = status;
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.callbacks.onStateChange?.(state);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      } catch {
        // ignore send errors; onclose will handle reconnect
      }
      this.heartbeatTimeout = setTimeout(() => {
        websocketLogger.warn('Heartbeat timeout — closing stale WebSocket connection');
        this.ws?.close();
      }, 10_000);
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
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

    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.getWebSocketUrl());
      this.setupEventHandlers();
      this.registerBeforeUnloadHandler();
    } catch (error) {
      websocketLogger.error('Failed to create global WebSocket connection', error);
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(error as Event);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event) => {
      websocketLogger.info('Global WebSocket connected', event);
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startHeartbeat();
      if (this.statusOnConnect) {
        this.sendPresenceUpdate(this.statusOnConnect);
      }
      this.callbacks.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        if (raw?.type === 'pong') {
          // Clear heartbeat timeout — connection is alive
          if (this.heartbeatTimeout !== null) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
          }
          return;
        }
        const message: WebSocketMessage = raw;
        websocketLogger.debug('Global WebSocket message received', message);
        this.callbacks.onMessage?.(message);
      } catch (error) {
        websocketLogger.error('Failed to parse global WebSocket message', error);
      }
    };

    this.ws.onclose = (event) => {
      websocketLogger.info('Global WebSocket disconnected', event);
      this.stopHeartbeat();
      if (!this.isDestroyed && event.code !== 1000) { // 1000 = normal closure
        this.scheduleReconnect();
      } else {
        this.setConnectionState('disconnected');
      }
      this.callbacks.onDisconnected?.(event.reason || 'Connection closed');
    };

    this.ws.onerror = (event) => {
      websocketLogger.error('Global WebSocket error', event);
      this.callbacks.onError?.(event);
    };
  }

  private scheduleReconnect(): void {
    // Suspended because the device is offline — don't burn retries
    // while there's no chance of success. The network-status
    // listener restarts the cycle when the device reconnects.
    if (this.suspendedForOffline) {
      websocketLogger.info(
        'Reconnect requested while device offline — deferring until online',
      );
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      websocketLogger.error('Max reconnect attempts reached for global WebSocket');
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('reconnecting');
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    websocketLogger.info(`Scheduling global WebSocket reconnect in ${delay}ms`);

    this.pendingReconnectTimer = setTimeout(() => {
      this.pendingReconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.unregisterBeforeUnloadHandler();
    if (this.pendingReconnectTimer !== null) {
      clearTimeout(this.pendingReconnectTimer);
      this.pendingReconnectTimer = null;
    }
    if (this.networkStatusUnsubscribe) {
      this.networkStatusUnsubscribe();
      this.networkStatusUnsubscribe = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Global WebSocket component unmounted');
      this.ws = null;
    }
    this.setConnectionState('disconnected');
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

  sendPresenceUpdate(status: PresenceStatus): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'presence_update',
            status,
          }),
        );
        return true;
      } catch (error) {
        websocketLogger.error('Failed to send presence update via global WebSocket', error);
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
  }
  return '';
};
