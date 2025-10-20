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
  return apiClient.post('/api/v1/channels', {
    server_id: serverId,
    auth_token: authToken,
  });
};

export const listChannels = async (authToken: string): Promise<ApiResponse<{ status_code: number; channels: Channel[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/channels/list/', {
    auth_token: authToken
  });
};

export const createChannel = async (channelData: { channel_name: string; is_private: boolean }, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/channels/create/', {
    auth_token: authToken,
    channel_name: channelData.channel_name,
    is_private: channelData.is_private,
  });
};

export const updateChannel = async (channelId: string, channelData: Partial<CreateChannelRequest>, authToken: string): Promise<ApiResponse<Channel>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/channels/${channelId}/update`, {
    auth_token: authToken,
    ...channelData
  });
};

export const deleteChannel = async (channelId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/delete`, {
    auth_token: authToken
  });
};

export const loadMessages = async (channelId: string, authToken: string, page?: number, messages_per_page?: number): Promise<ApiResponse<{ status_code: number; messages: Message[] }>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/channels/${channelId}/load_messages`, {
    auth_token: authToken,
    page: (page || 1).toString(),
    messages_per_page: (messages_per_page || 20).toString()
  });
};

// Add user to private channel (Admin only)
export const addUserToChannel = async (channelId: string, userIdToAdd: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/channels/${channelId}/add_user`, {
    auth_token: authToken,
    to_add_user_id: userIdToAdd,
  });
};

// Remove user from private channel (Admin only)
export const removeUserFromChannel = async (channelId: string, userIdToRemove: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/remove_user`, {
    auth_token: authToken,
    to_remove_user_id: userIdToRemove,
  });
};

// Delete message (Owner/Admin)
export const deleteMessage = async (channelId: string, messageId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.delete(`/api/v1/channels/${channelId}/delete_message`, {
    auth_token: authToken,
    message_id: messageId,
  });
};

// Mark message as read
export const markMessageAsRead = async (channelId: string, messageId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.put(`/api/v1/channels/${channelId}/mark_message_as_read`, {
    auth_token: authToken,
    message_id: messageId,
  });
};

export const sendMessage = async (channelId: string, message: string, authToken: string): Promise<ApiResponse<Message>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/channels/${channelId}/send_message`, {
    auth_token: authToken,
    message: message,
  });
};
