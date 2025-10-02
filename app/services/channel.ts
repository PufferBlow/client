import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Channel } from '../models';

export interface CreateChannelRequest {
  name: string;
  type: 'text' | 'voice';
  description?: string;
}

// Channel API functions
export const getChannels = async (serverId: string, authToken: string): Promise<ApiResponse<Channel[]>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/channels', {
    server_id: serverId,
    auth_token: authToken,
  });
};

export const listChannels = async (authToken: string): Promise<ApiResponse<{ status_code: number; channels: Channel[] }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/list?auth_token=${encodeURIComponent(authToken)}`);
};

export const createChannel = async (channelData: { channel_name: string; is_private: boolean }, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/channels/create?auth_token=${encodeURIComponent(authToken)}`, channelData);
};

export const updateChannel = async (channelId: string, channelData: Partial<CreateChannelRequest>, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/channels/${channelId}`, {
    ...channelData,
    auth_token: authToken,
  });
};

export const deleteChannel = async (channelId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}?auth_token=${authToken}`);
};
