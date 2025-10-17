import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Channel } from '../models';
import type { Message } from '../models';

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
  return apiClient.post(`/api/v1/channels/create?auth_token=${encodeURIComponent(authToken)}&channel_name=${encodeURIComponent(channelData.channel_name)}&is_private=${channelData.is_private}`);
};

export const updateChannel = async (channelId: string, channelData: Partial<CreateChannelRequest>, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/update?auth_token=${encodeURIComponent(authToken)}&${new URLSearchParams(channelData as any).toString()}`);
};

export const deleteChannel = async (channelId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/delete?auth_token=${authToken}`);
};

export const loadMessages = async (channelId: string, authToken: string): Promise<ApiResponse<{ status_code: number; messages: Message[] }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/load_messages?auth_token=${encodeURIComponent(authToken)}`);
};

// Get a specific message by ID
export const getMessageById = async (messageId: string, authToken: string): Promise<ApiResponse<{ message: Message }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/messages/${messageId}?auth_token=${encodeURIComponent(authToken)}`);
};

// Get messages around a specific message for context
export const loadChannelMessagesAroundMessage = async (messageId: string, authToken: string, limit = 20): Promise<ApiResponse<{ messages: Message[] }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/messages/${messageId}/context?auth_token=${encodeURIComponent(authToken)}&limit=${limit}`);
};

export const sendMessage = async (channelId: string, message: string, authToken: string): Promise<ApiResponse<Message>> => {
  const apiClient = createApiClient();

  // Send message and auth_token as URL parameters
  return apiClient.post(`/api/v1/channels/${channelId}/send_message?message=${encodeURIComponent(message)}&auth_token=${encodeURIComponent(authToken)}`);
};
