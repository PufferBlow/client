/**
 * usePing — central hook for the ping system.
 *
 * Responsibilities:
 *  - Hydrate pending pings from the server on mount
 *  - React to ping_received / ping_acked WebSocket events from the GlobalWebSocket
 *  - Expose actions: send, ack, dismiss, history, stats
 *  - Track unread ping count for notification badge
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PingNotification, WsPingAckedEvent, WsPingReceivedEvent } from '../models/Ping';
import {
  ackPing,
  dismissPing,
  getPendingPings,
  getPingHistory,
  getPingStats,
  isPingExpired,
  sendPing,
} from '../services/ping';
import type { SendPingRequest } from '../models/Ping';
import type {
  PingHistoryResponse,
  PingStatsResponse,
} from '../models/Ping';
import type { WebSocketMessage } from '../services/websocket';
import { logger } from '../utils/logger';

const pingLogger = logger.network;

export interface UsePingReturn {
  /** Notifications for pings the current user has received and not yet acked. */
  notifications: PingNotification[];
  /** Number of unread/unacked incoming pings. */
  unreadCount: number;
  /** Whether the pending ping list is being fetched. */
  isLoadingPending: boolean;
  /** Send a ping to a target (local, remote handle, or actor URI). */
  send: (request: SendPingRequest) => Promise<{ ok: boolean; error?: string }>;
  /** Acknowledge a received ping by its receiver-side ping_id. */
  ack: (pingId: string) => Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  /** Dismiss (delete) a ping record. */
  dismiss: (pingId: string) => Promise<boolean>;
  /** Refresh the pending notifications from the server. */
  refreshPending: () => Promise<void>;
  /** Fetch paginated history (memoised per call — caller owns the result). */
  fetchHistory: (
    direction?: 'sent' | 'received' | 'both',
    page?: number,
    perPage?: number,
  ) => Promise<PingHistoryResponse | null>;
  /** Fetch aggregated stats. */
  fetchStats: () => Promise<PingStatsResponse | null>;
  /** Called by the parent WebSocket handler to route incoming messages here. */
  handleWebSocketMessage: (message: WebSocketMessage) => void;
}

export const usePing = (): UsePingReturn => {
  const [notifications, setNotifications] = useState<PingNotification[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  // Track which ping_ids we already have so incoming WS events stay de-duped
  const knownPingIds = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Hydrate pending pings on mount
  // ---------------------------------------------------------------------------
  const refreshPending = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const response = await getPendingPings();
      if (response.success && response.data) {
        const { pings } = response.data;
        const notifs: PingNotification[] = pings
          .filter((p) => !isPingExpired(p))
          .map((p) => {
            const label =
              p.metadata?.sender_username as string ||
              p.target_actor_uri?.split('/').pop() ||
              p.sender_id ||
              'Unknown';
            return {
              pingId: p.ping_id,
              receiverPingId: p.ping_id,
              senderLabel: String(label),
              pingType: p.ping_type,
              message: p.message,
              sentAt: p.sent_at,
              expiresAt: p.expires_at,
              isExpired: false,
            };
          });
        setNotifications(notifs);
        notifs.forEach((n) => knownPingIds.current.add(n.pingId));
      }
    } catch (err) {
      pingLogger.error('Failed to load pending pings', { error: err });
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Expire check — remove pings that passed their deadline
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) =>
        prev.filter((n) => new Date(n.expiresAt).getTime() > now),
      );
    }, 15_000);
    return () => clearInterval(timer);
  }, [notifications.length]);

  // ---------------------------------------------------------------------------
  // WebSocket event handler (injected from the dashboard GlobalWebSocket)
  // ---------------------------------------------------------------------------
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'ping_received') {
      const evt = message as WsPingReceivedEvent;
      if (knownPingIds.current.has(evt.ping_id)) return;

      const expiresAt = evt.expires_at || new Date(Date.now() + 5 * 60_000).toISOString();
      if (new Date(expiresAt).getTime() < Date.now()) return;

      const label =
        evt.sender_username ||
        evt.sender_actor_uri?.split('/').pop() ||
        evt.sender_id ||
        'Unknown';

      const notif: PingNotification = {
        pingId: evt.ping_id,
        receiverPingId: evt.receiver_ping_id || evt.ping_id,
        senderLabel: label,
        pingType: evt.ping_type,
        message: evt.message ?? null,
        sentAt: evt.sent_at,
        expiresAt,
        isExpired: false,
      };

      knownPingIds.current.add(evt.ping_id);
      setNotifications((prev) => [notif, ...prev]);
      pingLogger.info('ping_received WS event processed', { pingId: evt.ping_id });
    }

    if (message.type === 'ping_acked') {
      const evt = message as WsPingAckedEvent;
      // When we receive an ack for a ping *we sent*, nothing to do in the
      // notification list (the ack confirmation is shown via toast by the
      // consuming component). Just log it.
      pingLogger.info('ping_acked WS event received', {
        pingId: evt.ping_id,
        latencyMs: evt.latency_ms,
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const send = useCallback(async (request: SendPingRequest) => {
    const response = await sendPing(request);
    if (!response.success) {
      return { ok: false, error: response.error || 'Failed to send ping.' };
    }
    return { ok: true };
  }, []);

  const ack = useCallback(async (pingId: string) => {
    const response = await ackPing(pingId);
    if (!response.success) {
      return { ok: false, error: response.error || 'Failed to acknowledge ping.' };
    }
    // Remove from notification list
    setNotifications((prev) => prev.filter((n) => n.receiverPingId !== pingId));
    knownPingIds.current.delete(pingId);
    const latencyMs = response.data?.ack?.latency_ms;
    return { ok: true, latencyMs };
  }, []);

  const dismiss = useCallback(async (pingId: string) => {
    const response = await dismissPing(pingId);
    if (response.success) {
      setNotifications((prev) => prev.filter((n) => n.receiverPingId !== pingId));
      knownPingIds.current.delete(pingId);
    }
    return response.success;
  }, []);

  const fetchHistory = useCallback(
    async (
      direction: 'sent' | 'received' | 'both' = 'both',
      page = 1,
      perPage = 20,
    ) => {
      const response = await getPingHistory(direction, page, perPage);
      return response.success && response.data ? response.data : null;
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    const response = await getPingStats();
    return response.success && response.data ? response.data : null;
  }, []);

  return {
    notifications,
    unreadCount: notifications.length,
    isLoadingPending,
    send,
    ack,
    dismiss,
    refreshPending,
    fetchHistory,
    fetchStats,
    handleWebSocketMessage,
  };
};

export default usePing;
