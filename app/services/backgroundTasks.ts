import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface TaskInfo {
  task_id?: string;
  name: string;
  description: string;
  schedule_label: string;
  enabled: boolean;
  running: boolean;
  runs: number;
  errors: number;
  last_run: string | null;
  last_error: string | null;
  total_runtime: number;
  next_run: string | null;
}

export interface BackgroundTaskStatusesResponse {
  status_code: number;
  tasks: Record<string, TaskInfo>;
}

export interface RunBackgroundTaskResponse {
  status_code: number;
  message: string;
}

export interface ToggleTaskResponse {
  status_code: number;
  message: string;
  task_id: string;
  enabled: boolean;
}

export interface BackupConfig {
  enabled: boolean;
  mode: 'file' | 'mirror';
  path: string;
  mirror_dsn: string | null;
  schedule_hours: number;
  max_files: number;
}

export interface BackupConfigResponse {
  status_code: number;
  config: BackupConfig;
}

export interface UpdateBackupConfigRequest {
  auth_token: string;
  enabled: boolean;
  mode: 'file' | 'mirror';
  path?: string;
  mirror_dsn?: string;
  schedule_hours: number;
  max_files: number;
}

export const getBackgroundTaskStatuses = async (authToken: string): Promise<ApiResponse<BackgroundTaskStatusesResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/status', { auth_token: authToken });
};

export const runBackgroundTask = async (taskId: string, authToken: string): Promise<ApiResponse<RunBackgroundTaskResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/run', { auth_token: authToken, task_id: taskId });
};

export const toggleBackgroundTask = async (taskId: string, enabled: boolean, authToken: string): Promise<ApiResponse<ToggleTaskResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/toggle', { auth_token: authToken, task_id: taskId, enabled });
};

export const getBackupConfig = async (authToken: string): Promise<ApiResponse<BackupConfigResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/backup-config/get', { auth_token: authToken });
};

export const updateBackupConfig = async (request: UpdateBackupConfigRequest): Promise<ApiResponse<{ status_code: number; message: string; config: Record<string, unknown> }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/background-tasks/backup-config', request);
};
