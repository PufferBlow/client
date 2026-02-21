import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Channel } from '../models';

export interface CreateChannelRequest {
  name: string;
  type: 'text' | 'voice' | 'mixed';
  description?: string;
}

export interface VoiceChannelJoinResponse {
  status_code: number;
  session_id: string;
  channel_id: string;
  join_token: string;
  signaling_url: string;
  ice_servers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  expires_at: string;
  participant_count: number;
  quality_profile: 'low' | 'balanced' | 'high';
  backend: 'sfu_v2';
}

export interface VoiceChannelStatusResponse {
  status_code: number;
  session_id: string;
  channel_id: string;
  is_active: boolean;
  quality_profile: 'low' | 'balanced' | 'high';
  participants: Array<{
    user_id: string;
    username?: string;
    is_connected: boolean;
    is_muted: boolean;
    is_deafened: boolean;
    is_speaking: boolean;
    joined_at?: string;
    disconnected_at?: string;
  }>;
  participant_count: number;
}

const unsupportedChannelOperation = <T>(operation: string): ApiResponse<T> => ({
  success: false,
  error: `${operation} is not available on the current server API.`,
});

export const getChannels = async (_serverId: string, _authToken: string): Promise<ApiResponse<Channel[]>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/channels');
};

export const listChannels = async (authToken: string): Promise<ApiResponse<{ status_code: number; channels: Channel[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/channels/list/', {
    auth_token: authToken
  });
};

export const createChannel = async (channelData: { channel_name: string; is_private: boolean; channel_type?: string }, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/channels/create/', {
    auth_token: authToken,
    channel_name: channelData.channel_name,
    is_private: channelData.is_private,
    channel_type: channelData.channel_type || 'text',
  });
};

export const updateChannel = async (_channelId: string, _channelData: Partial<CreateChannelRequest>, _authToken: string): Promise<ApiResponse<Channel>> => {
  return unsupportedChannelOperation<Channel>('Updating channels');
};

export const deleteChannel = async (channelId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/delete`, {
    auth_token: authToken
  });
};

export const addUserToChannel = async (channelId: string, userIdToAdd: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/add_user`, {
    auth_token: authToken,
    to_add_user_id: userIdToAdd,
  }, undefined, 'PUT');
};

export const removeUserFromChannel = async (channelId: string, userIdToRemove: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/remove_user`, {
    auth_token: authToken,
    to_remove_user_id: userIdToRemove,
  });
};

export const joinVoiceChannel = async (
  channelId: string,
  authToken: string,
  qualityProfile: 'low' | 'balanced' | 'high' = 'balanced'
): Promise<ApiResponse<VoiceChannelJoinResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v2/voice/channels/${channelId}/sessions`, {
    auth_token: authToken,
    quality_profile: qualityProfile,
  });
};

export const leaveVoiceChannel = async (
  _channelId: string,
  authToken: string,
  sessionId?: string
): Promise<ApiResponse<{ status_code: number; message: string; participant_count?: number; session_ended?: boolean }>> => {
  if (!sessionId) {
    return {
      success: false,
      error: 'Cannot leave voice session: missing session_id',
    };
  }

  const apiClient = createApiClient();
  return apiClient.post(`/api/v2/voice/sessions/${sessionId}/leave`, {
    auth_token: authToken,
  });
};

export const getVoiceChannelStatus = async (
  _channelId: string,
  authToken: string,
  sessionId?: string
): Promise<ApiResponse<VoiceChannelStatusResponse>> => {
  if (!sessionId) {
    return {
      success: false,
      error: 'Cannot fetch voice session status: missing session_id',
    };
  }

  const apiClient = createApiClient();
  return apiClient.get(`/api/v2/voice/sessions/${sessionId}`, {
    auth_token: authToken,
  });
};

export const applyVoiceSessionAction = async (
  sessionId: string,
  authToken: string,
  action: 'mute_self' | 'deafen_self' | 'set_input_device' | 'set_output_device',
  payload: Record<string, unknown> = {}
): Promise<ApiResponse<{ status_code: number }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v2/voice/sessions/${sessionId}/actions`, {
    auth_token: authToken,
    action,
    payload,
  });
};
