/**
 * Ping service — wraps all /api/v1/ping/* REST endpoints.
 */
import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import { getAuthTokenForRequests } from './authSession';
import type {
  AckPingResponse,
  InstancePingRequest,
  Ping,
  PingHistoryResponse,
  PingPendingResponse,
  PingStatsResponse,
  SendPingRequest,
  SendPingResponse,
} from '../models/Ping';

const pingClient = (instance?: string) => createApiClient(instance);

// ---------------------------------------------------------------------------
// Send ping (auto-routes local / federated)
// ---------------------------------------------------------------------------

export const sendPing = async (
  request: SendPingRequest,
  instance?: string,
): Promise<ApiResponse<SendPingResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.post<SendPingResponse>('/api/v1/ping/send', {
    auth_token: authToken,
    target: request.target,
    ...(request.message ? { message: request.message } : {}),
  });
};

// ---------------------------------------------------------------------------
// Probe a remote instance
// ---------------------------------------------------------------------------

export const pingInstance = async (
  request: InstancePingRequest,
  instance?: string,
): Promise<ApiResponse<SendPingResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.post<SendPingResponse>('/api/v1/ping/instance', {
    auth_token: authToken,
    target_instance_url: request.target_instance_url,
  });
};

// ---------------------------------------------------------------------------
// Acknowledge a received ping
// ---------------------------------------------------------------------------

export const ackPing = async (
  pingId: string,
  instance?: string,
): Promise<ApiResponse<AckPingResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.post<AckPingResponse>(`/api/v1/ping/ack/${encodeURIComponent(pingId)}`, {
    auth_token: authToken,
  });
};

// ---------------------------------------------------------------------------
// Paginated ping history
// ---------------------------------------------------------------------------

export const getPingHistory = async (
  direction: 'sent' | 'received' | 'both' = 'both',
  page = 1,
  perPage = 20,
  instance?: string,
): Promise<ApiResponse<PingHistoryResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.get<PingHistoryResponse>('/api/v1/ping/history', {
    auth_token: authToken,
    direction,
    page: String(page),
    per_page: String(perPage),
  });
};

// ---------------------------------------------------------------------------
// Pending (unacknowledged) inbound pings
// ---------------------------------------------------------------------------

export const getPendingPings = async (
  instance?: string,
): Promise<ApiResponse<PingPendingResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.get<PingPendingResponse>('/api/v1/ping/pending', {
    auth_token: authToken,
  });
};

// ---------------------------------------------------------------------------
// Aggregated statistics
// ---------------------------------------------------------------------------

export const getPingStats = async (
  instance?: string,
): Promise<ApiResponse<PingStatsResponse>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.get<PingStatsResponse>('/api/v1/ping/stats', {
    auth_token: authToken,
  });
};

// ---------------------------------------------------------------------------
// Dismiss / delete a ping record
// ---------------------------------------------------------------------------

export const dismissPing = async (
  pingId: string,
  instance?: string,
): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return { success: false, error: 'Not authenticated.' };

  const client = pingClient(instance);
  return client.delete(`/api/v1/ping/${encodeURIComponent(pingId)}`, {
    auth_token: authToken,
  });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the ping has passed its expiry time. */
export const isPingExpired = (ping: Ping): boolean => {
  if (!ping.expires_at) return false;
  return new Date(ping.expires_at).getTime() < Date.now();
};

/** Human-readable label for a ping status. */
export const pingStatusLabel = (status: string): string => {
  switch (status) {
    case 'sent': return 'Sent';
    case 'delivered': return 'Delivered';
    case 'acked': return 'Acknowledged';
    case 'timeout': return 'Timed Out';
    case 'failed': return 'Failed';
    default: return status;
  }
};
