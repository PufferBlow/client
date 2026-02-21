import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Channel } from '../models';

export interface CreateChannelRequest {
  name: string;
  type: 'text' | 'voice' | 'mixed';
  description?: string;
}

// Voice channel interfaces - Updated for WebRTC direct implementation
export interface VoiceChannelJoinResponse {
  status_code: number;
  channel_id?: string;
  user_id?: string;
  participants?: number;
  participant_count?: number;
  webrtc_config?: any;
  error?: string;
}

export interface VoiceChannelStatusResponse {
  status_code: number;
  channel_id: string;
  room_name?: string;
  participants: Array<{
    user_id: string;
    username: string;
    avatar_url?: string;
    status?: string;
  }>;
  participant_count: number;
  error?: string;
}

const unsupportedChannelOperation = <T>(operation: string): ApiResponse<T> => ({
  success: false,
  error: `${operation} is not available on the current server API.`,
});

// Channel API functions
export const getChannels = async (serverId: string, authToken: string): Promise<ApiResponse<Channel[]>> => {
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



// Add user to private channel (Admin only)
export const addUserToChannel = async (channelId: string, userIdToAdd: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/add_user`, {
    auth_token: authToken,
    to_add_user_id: userIdToAdd,
  }, undefined, 'PUT');
};

// Remove user from private channel (Admin only)
export const removeUserFromChannel = async (channelId: string, userIdToRemove: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/remove_user`, {
    auth_token: authToken,
    to_remove_user_id: userIdToRemove,
  });
};



// Voice channel functions
export const joinVoiceChannel = async (channelId: string, authToken: string): Promise<ApiResponse<VoiceChannelJoinResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/join-audio`, {
    auth_token: authToken,
  }, undefined, 'POST');
};

export const leaveVoiceChannel = async (channelId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/leave-audio`, {
    auth_token: authToken,
  }, undefined, 'POST');
};

export const getVoiceChannelStatus = async (channelId: string, authToken: string): Promise<ApiResponse<VoiceChannelStatusResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/audio-status`, {
    auth_token: authToken,
  });
};
