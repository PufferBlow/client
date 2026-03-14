import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface SubmitMessageReportRequest {
  auth_token: string;
  message_ids: string[];
  category: string;
  description?: string;
}

export interface SubmitUserReportRequest {
  auth_token: string;
  target_user_id: string;
  category: string;
  description?: string;
}

export interface ModerateUserRequest {
  auth_token: string;
  reason?: string;
}

export interface TimeoutUserRequest extends ModerateUserRequest {
  duration_minutes: number;
}

export const submitMessageReport = async (
  request: SubmitMessageReportRequest,
): Promise<ApiResponse<{ status_code: number; message: string; reported_count: number }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/moderation/reports/messages', request);
};

export const submitUserReport = async (
  request: SubmitUserReportRequest,
): Promise<ApiResponse<{ status_code: number; message: string; target_user_id: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/moderation/reports/users', request);
};

export const banUser = async (
  targetUserId: string,
  request: ModerateUserRequest,
): Promise<ApiResponse<{ status_code: number; message: string; target_user_id: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/moderation/users/${targetUserId}/ban`, request);
};

export const unbanUser = async (
  targetUserId: string,
  authToken: string,
): Promise<ApiResponse<{ status_code: number; message: string; target_user_id: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/moderation/users/${targetUserId}/ban`, {
    auth_token: authToken,
  });
};

export const timeoutUser = async (
  targetUserId: string,
  request: TimeoutUserRequest,
): Promise<ApiResponse<{ status_code: number; message: string; target_user_id: string; expires_at: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/moderation/users/${targetUserId}/timeout`, request);
};

export const clearUserTimeout = async (
  targetUserId: string,
  authToken: string,
): Promise<ApiResponse<{ status_code: number; message: string; target_user_id: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/moderation/users/${targetUserId}/timeout`, {
    auth_token: authToken,
  });
};
