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

export interface BackgroundTaskStatusesResponse {
  status_code: number;
  tasks: Record<string, BackgroundTask> | BackgroundTask[];
  message?: string;
}

export interface RunBackgroundTaskResponse {
  status_code: number;
  message: string;
}

// Background Tasks Management functions (Server Owner only)
export const getBackgroundTaskStatuses = async (authToken: string): Promise<ApiResponse<BackgroundTaskStatusesResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/status', {
    auth_token: authToken,
  });
};

export const runBackgroundTask = async (taskId: string, authToken: string): Promise<ApiResponse<RunBackgroundTaskResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/run', {
    auth_token: authToken,
    task_id: taskId,
  });
};
