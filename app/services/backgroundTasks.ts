import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface BackgroundTask {
  task_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result?: any;
}

// Background Tasks Management functions (Server Owner only)
export const getBackgroundTaskStatuses = async (authToken: string): Promise<ApiResponse<{ status_code: number; tasks: BackgroundTask[] }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/background-tasks/status`, {
    auth_token: authToken,
  });
};

export const runBackgroundTask = async (taskId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string; task: BackgroundTask }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/background-tasks/run/${taskId}`, {
    auth_token: authToken,
  });
};
