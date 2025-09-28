import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Channel } from '../models';

export interface CreateChannelRequest {
  name: string;
  type: 'text' | 'voice';
  description?: string;
}

// Channel API functions
export const getChannels = async (hostPort: string, serverId: string, authToken: string): Promise<ApiResponse<Channel[]>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/channels', {
    server_id: serverId,
    auth_token: authToken,
  });
};

export const listChannels = async (hostPort: string, authToken: string): Promise<ApiResponse<{ status_code: number; channels: Channel[] }>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/api/v1/channels/list?auth_token=${encodeURIComponent(authToken)}`);
};

export const createChannel = async (hostPort: string, channelData: { channel_name: string; is_private: boolean }, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post(`/api/v1/channels/create?auth_token=${encodeURIComponent(authToken)}`, channelData);
};

export const updateChannel = async (hostPort: string, channelId: string, channelData: Partial<CreateChannelRequest>, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put(`/api/v1/channels/${channelId}`, {
    ...channelData,
    auth_token: authToken,
  });
};

export const deleteChannel = async (hostPort: string, channelId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/channels/${channelId}?auth_token=${authToken}`);
};
