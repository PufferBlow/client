import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface BlockedIP {
  ip: string;
  blocked_at: string;
  reason: string;
  blocked_by: string;
}

export interface BlockIPRequest {
  auth_token: string;
  ip: string;
  reason: string;
}

// IP Security Management functions (Server Owner only)
export const listBlockedIPs = async (authToken: string): Promise<ApiResponse<{ status_code: number; blocked_ips: BlockedIP[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/blocked-ips/list`, {
    auth_token: authToken
  });
};

export const blockIP = async (request: BlockIPRequest): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/blocked-ips/block`, request);
};

export const unblockIP = async (ip: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/blocked-ips/unblock`, {
    auth_token: authToken,
    ip,
  });
};
