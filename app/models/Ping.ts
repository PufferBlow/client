/**
 * Ping data models for local, federated, and instance pings.
 */

/** All possible ping lifecycle states. */
export type PingStatus = 'sent' | 'delivered' | 'acked' | 'timeout' | 'failed';

/** Transport mode for the ping. */
export type PingType = 'local' | 'federated' | 'instance';

/** A single ping record as returned by the server. */
export interface Ping {
  ping_id: string;
  ping_type: PingType;
  sender_id: string;
  target_user_id: string | null;
  target_actor_uri: string | null;
  target_instance_url: string | null;
  status: PingStatus;
  latency_ms: number | null;
  instance_http_status: number | null;
  instance_latency_ms: number | null;
  activity_uri: string | null;
  is_sender: boolean;
  message: string | null;
  sent_at: string;
  acked_at: string | null;
  expires_at: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface SendPingRequest {
  /** Local user_id, local username, remote handle (user@domain), or actor URI. */
  target: string;
  /** Optional short text body (≤200 chars). */
  message?: string;
}

export interface InstancePingRequest {
  /** Base URL of the remote instance, e.g. https://other.example.com */
  target_instance_url: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface SendPingResponse {
  status_code: number;
  message: string;
  ping: {
    ping_id: string;
    ping_type: PingType;
    target_user_id?: string;
    target_actor_uri?: string;
    target_instance_url?: string;
    status: PingStatus;
    message: string | null;
    sent_at: string;
    expires_at: string;
    activity_uri?: string;
    delivery_target?: string;
    latency_ms?: number;
    error?: string | null;
    http_status?: number;
    health_url?: string;
  };
}

export interface AckPingResponse {
  status_code: number;
  message: string;
  ack: {
    ping_id: string;
    sender_ping_id: string | null;
    status: 'acked';
    latency_ms: number;
    acked_at: string;
  };
}

export interface PingHistoryResponse {
  status_code: number;
  direction: 'sent' | 'received' | 'both';
  page: number;
  per_page: number;
  pings: Ping[];
}

export interface PingPendingResponse {
  status_code: number;
  pending_count: number;
  pings: Ping[];
}

export interface PingStatsResponse {
  status_code: number;
  user_id: string;
  sent_total: number;
  received_total: number;
  acked_count: number;
  timeout_count: number;
  avg_latency_ms: number | null;
}

// ---------------------------------------------------------------------------
// WebSocket event payloads (mirrors server ws broadcasts)
// ---------------------------------------------------------------------------

export interface WsPingReceivedEvent {
  type: 'ping_received';
  ping_id: string;
  receiver_ping_id?: string;
  sender_id?: string;
  sender_actor_uri?: string;
  sender_username?: string;
  ping_type: PingType;
  message?: string | null;
  sent_at: string;
  expires_at: string;
  original_activity_uri?: string;
}

export interface WsPingAckedEvent {
  type: 'ping_acked';
  ping_id: string;
  sender_ping_id?: string;
  acker_user_id?: string;
  acker_actor_uri?: string;
  latency_ms: number;
  acked_at: string;
  federated?: boolean;
}

// ---------------------------------------------------------------------------
// Local UI state (used by usePing hook)
// ---------------------------------------------------------------------------

/** A notification entry shown in the ping inbox panel. */
export interface PingNotification {
  pingId: string;
  receiverPingId: string;
  senderLabel: string;
  pingType: PingType;
  message: string | null;
  sentAt: string;
  expiresAt: string;
  isExpired: boolean;
}
