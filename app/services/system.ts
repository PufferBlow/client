import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface ServerStats {
  uptime: string;
  total_users: number;
  active_users: number;
  total_channels: number;
  total_messages: number;
  storage_used: string;
  version: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}

export interface RawStats {
  // User registration stats
  total_users?: number;
  new_this_week?: number;
  new_this_month?: number;
  online_now?: number;
  recently_active?: number;
  growth_rate_week?: number;
  growth_rate_month?: number;
  peak_registrations?: number;
  avg_daily_registrations?: number;

  // Message activity stats
  total_messages?: number;
  messages_today?: number;
  messages_this_week?: number;
  messages_this_month?: number;
  messages_this_quarter?: number;
  messages_this_year?: number;
  peak_activity?: number;
  avg_daily_messages?: number;
  messages_per_user?: number;

  // Online users stats
  currently_online?: number;
  peak_online_today?: number;
  avg_online_today?: number;
  peak_online_week?: number;
  avg_online_week?: number;
  online_percentage?: number;

  // Channel creation stats
  total_channels?: number;
  public_channels?: number;
  private_channels?: number;
  peak_creations?: number;
  avg_daily_creations?: number;

  // User status stats
  online_users?: number;
  offline_users?: number;
  away_users?: number;
}

export interface Period {
  period: '1h' | '24h' | '7d' | '30d' | '90d' | '1y';
}

// System Statistics functions
export const getServerStats = async (): Promise<ApiResponse<{ status_code: number; stats: ServerStats }>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/system/server-stats');
};

export const getLatestRelease = async (): Promise<ApiResponse<GithubRelease>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/system/latest-release');
};

// Charts functions (Authenticated) - Using POST with request body
export const getUserRegistrationsChart = async (period: Period, authToken: string): Promise<ApiResponse<{ status_code: number; chart_data: ChartData; raw_stats: RawStats }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/charts/user-registrations', {
    auth_token: authToken,
    period: period.period,
  });
};

export const getMessageActivityChart = async (period: Period, authToken: string): Promise<ApiResponse<{ status_code: number; chart_data: ChartData; raw_stats: RawStats }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/charts/message-activity', {
    auth_token: authToken,
    period: period.period,
  });
};

export const getOnlineUsersChart = async (period: Period, authToken: string): Promise<ApiResponse<{ status_code: number; chart_data: ChartData; raw_stats: RawStats }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/charts/online-users', {
    auth_token: authToken,
    period: period.period,
  });
};

export const getChannelCreationChart = async (period: Period, authToken: string): Promise<ApiResponse<{ status_code: number; chart_data: ChartData; raw_stats: RawStats }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/charts/channel-creation', {
    auth_token: authToken,
    period: period.period,
  });
};

export const getUserStatusChart = async (authToken: string): Promise<ApiResponse<{ status_code: number; chart_data: ChartData; raw_stats: RawStats }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/charts/user-status', {
    auth_token: authToken,
  });
};

// Server Info functions
export interface ServerInfo {
  server_id: string;
  server_name: string;
  server_description: string;
  version: string;
  max_users: number | null;
  is_private: boolean;
  creation_date: string | null;
  avatar_url?: string;
  banner_url?: string;
  welcome_message?: string;
  members_count?: number;
  online_members?: number;
  max_message_length?: number;
  max_image_size?: number;
  max_video_size?: number;
  max_sticker_size?: number;
  max_gif_size?: number;
  max_audio_size?: number;
  max_file_size?: number;
  max_total_attachment_size?: number;
  allowed_image_types?: string[];
  allowed_video_types?: string[];
  allowed_file_types?: string[];
  allowed_sticker_types?: string[];
  allowed_gif_types?: string[];
  allowed_audio_types?: string[];
  rtc_media_quality?: RTCMediaQuality;
}

export interface RTCProfileBitrate {
  bitrate_kbps: number;
}

export interface RTCVideoProfile {
  bitrate_kbps: number;
  width: number;
  height: number;
  fps: number;
}

export interface RTCMediaQuality {
  default_profile: 'low' | 'balanced' | 'high';
  audio: {
    sample_rate_hz: number;
    channels: number;
    stereo_enabled: boolean;
    dtx_enabled: boolean;
    fec_enabled: boolean;
    profiles: Record<'low' | 'balanced' | 'high', RTCProfileBitrate>;
  };
  video: {
    profiles: Record<'low' | 'balanced' | 'high', RTCVideoProfile>;
  };
}

export interface UpdateServerInfoRequest {
  auth_token: string;
  server_name?: string;
  server_description?: string;
  is_private?: boolean;
  max_users?: number;
  max_message_length?: number;
  max_image_size?: number;
  max_video_size?: number;
  max_sticker_size?: number;
  max_gif_size?: number;
  allowed_image_types?: string[];
  allowed_video_types?: string[];
  allowed_file_types?: string[];
  allowed_sticker_types?: string[];
  allowed_gif_types?: string[];
}

export const getServerInfo = async (): Promise<ApiResponse<{ status_code: number; server_info: ServerInfo }>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/system/server-info');
};

export const updateServerInfo = async (request: UpdateServerInfoRequest): Promise<ApiResponse<{ status_code: number; message: string; updated_fields: string[] }>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/system/server-info', request);
};

// Runtime configuration interfaces
export interface RuntimeConfig {
  [key: string]: unknown;
}

export interface RuntimeConfigResponse {
  status_code: number;
  runtime_config: RuntimeConfig;
  include_secrets: boolean;
}

export interface RuntimeConfigUpdateRequest {
  auth_token: string;
  settings: Record<string, unknown>;
}

export interface InstancePrivilege {
  privilege_id: string;
  privilege_name: string;
  category: string;
}

export interface InstanceRole {
  role_id: string;
  role_name: string;
  privileges_ids: string[];
  is_system: boolean;
  user_count: number;
}

export interface CreateInstanceRoleRequest {
  auth_token: string;
  role_name: string;
  privileges_ids: string[];
}

export interface UpdateInstanceRoleRequest extends CreateInstanceRoleRequest {}

export interface UpdateUserRolesRequest {
  auth_token: string;
  roles_ids: string[];
}

// Runtime configuration functions
export const getServerConfig = async (authToken: string, includeSecurity: boolean = false): Promise<ApiResponse<RuntimeConfigResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/runtime-config', {
    auth_token: authToken,
    include_secrets: includeSecurity,
  });
};

export const updateServerConfig = async (authToken: string, settings: Record<string, unknown>): Promise<ApiResponse<{ status_code: number; message: string; restart_required: boolean; affected_keys: string[] }>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/system/runtime-config', {
    auth_token: authToken,
    settings,
  });
};

export const listInstanceRoles = async (authToken: string): Promise<ApiResponse<{ status_code: number; roles: InstanceRole[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/roles/list', {
    auth_token: authToken,
  });
};

export const listInstancePrivileges = async (authToken: string): Promise<ApiResponse<{ status_code: number; privileges: InstancePrivilege[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/privileges/list', {
    auth_token: authToken,
  });
};

export const createInstanceRole = async (request: CreateInstanceRoleRequest): Promise<ApiResponse<{ status_code: number; message: string; role: InstanceRole }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/roles', request);
};

export const updateInstanceRole = async (roleId: string, request: UpdateInstanceRoleRequest): Promise<ApiResponse<{ status_code: number; message: string; role: InstanceRole }>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/system/roles/${encodeURIComponent(roleId)}`, request);
};

export const deleteInstanceRole = async (roleId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/system/roles/${encodeURIComponent(roleId)}`, {
    auth_token: authToken,
  });
};

export const updateInstanceUserRoles = async (userId: string, request: UpdateUserRolesRequest): Promise<ApiResponse<{ status_code: number; message: string; user: { user_id: string; username: string; roles_ids: string[] } }>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/system/users/${encodeURIComponent(userId)}/roles`, request);
};

// File Upload functions for server avatar and banner
export const uploadServerAvatar = async (authToken: string, file: File): Promise<ApiResponse<{ status_code: number; avatar_url: string; message: string }>> => {
  const formData = new FormData();
  formData.append('auth_token', authToken);
  formData.append('avatar', file);

  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/upload-avatar', formData);
};

export const uploadServerBanner = async (authToken: string, file: File): Promise<ApiResponse<{ status_code: number; banner_url: string; message: string }>> => {
  const formData = new FormData();
  formData.append('auth_token', authToken);
  formData.append('banner', file);

  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/upload-banner', formData);
};

export interface Activity {
  id: string;
  type: 'user_joined' | 'channel_created' | 'moderation' | 'setting_changed' | 'upload';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  metadata?: {
    channel_name?: string;
    moderation_type?: string;
    setting_key?: string;
    file_count?: number;
  };
}

// Recent Activity functions
export const getRecentActivity = async (authToken: string, limit: number = 10): Promise<ApiResponse<{ status_code: number; activities: Activity[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/recent-activity', {
    auth_token: authToken,
    limit,
  });
};

// Server Usage interfaces
export interface ServerUsage {
  cpu_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  disk_read_mb_per_sec: number;
  disk_write_mb_per_sec: number;
  storage_used_gb: number;
  storage_total_gb: number;
  storage_percent: number;
  uptime_seconds: number;
  uptime_formatted: string;
  timestamp: number;
}

// Server Usage functions
export const getServerUsage = async (): Promise<ApiResponse<{ status_code: number; server_usage: ServerUsage }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/server-usage', {});
};

// Activity Metrics interfaces
export interface ActivityMetrics {
  total_users: number;
  total_channels: number;
  messages_per_hour: number;
  active_users_24h: number;
  current_online: number;
  engagement_rate: number;
  messages_per_active_user: number;
  channel_utilization: number;
  last_updated?: string | null;
}

// Server Overview interfaces
export interface ServerOverview {
  total_users: number;
  total_channels: number;
  messages_last_hour: number;
  active_users: number;
  messages_this_period: number;
}

// Activity Metrics functions (Admin Only)
export const getActivityMetrics = async (authToken: string): Promise<ApiResponse<{ status_code: number; activity_metrics: ActivityMetrics }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/activity-metrics', {
    auth_token: authToken,
  });
};

export const getServerOverview = async (authToken: string): Promise<ApiResponse<{ status_code: number; server_overview: ServerOverview }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/server-overview', {
    auth_token: authToken,
  });
};

// Server Logs interfaces
export interface ServerLogEntry {
  content: string;
  raw: string;
}

export interface ServerLogsResponse {
  status_code: number;
  logs: ServerLogEntry[];
  total_lines: number;
  filtered: boolean;
  log_file?: string;
  message?: string;
  available_log_files?: string[];
  searched_paths?: string[];
  note?: string;
}

export interface ServerLogsRequest {
  lines?: number;
  search?: string;
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

// Server Logs functions (Server Owner Only)
export const getServerLogs = async (authToken: string, request: ServerLogsRequest = {}): Promise<ApiResponse<ServerLogsResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/system/logs', {
    auth_token: authToken,
    ...request,
  });
};

export const clearServerLogs = async (_authToken: string): Promise<ApiResponse<{ status_code: number; message: string; lines_cleared?: number }>> => {
  return {
    success: false,
    error: 'Server-side log clearing is not available on this server version.',
  };
};
