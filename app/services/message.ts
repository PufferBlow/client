import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Message } from '../models';

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface SendMessageRequest {
  content: string;
  attachments?: File[];
}

export interface SearchResult {
  id: string;
  type: 'message' | 'user' | 'channel';
  title: string;
  subtitle?: string;
  content?: string;
  timestamp?: string;
}

// Message API functions
export const getMessages = async (hostPort: string, channelId: string, authToken: string, limit = 50, before?: string): Promise<ApiResponse<Message[]>> => {
  const apiClient = createApiClient(hostPort);
  const params: Record<string, string> = {
    channel_id: channelId,
    auth_token: authToken,
    limit: limit.toString(),
  };

  if (before) {
    params.before = before;
  }

  return apiClient.get('/api/v1/messages', params);
};

export const sendMessage = async (hostPort: string, channelId: string, messageData: SendMessageRequest, authToken: string): Promise<ApiResponse<Message>> => {
  const apiClient = createApiClient(hostPort);

  // Create FormData for multipart/form-data requests (needed for file uploads)
  const formData = new FormData();
  formData.append('auth_token', authToken);

  // Add message content if provided
  if (messageData.content && messageData.content.trim()) {
    formData.append('message', messageData.content.trim());
  }

  // Add attachments if provided
  if (messageData.attachments && messageData.attachments.length > 0) {
    messageData.attachments.forEach((file, index) => {
      formData.append('attachments', file);
    });
  }

  // Use correct endpoint with channel_id as path parameter
  return apiClient.post(`/api/v1/channels/${channelId}/send_message`, formData);
};

export const updateMessage = async (hostPort: string, messageId: string, content: string, authToken: string): Promise<ApiResponse<Message>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put(`/api/v1/messages/${messageId}`, {
    content,
    auth_token: authToken,
  });
};

export const deleteMessage = async (hostPort: string, messageId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/messages/${messageId}?auth_token=${authToken}`);
};

export const addReaction = async (hostPort: string, messageId: string, emoji: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post(`/api/v1/messages/${messageId}/reactions`, {
    emoji,
    auth_token: authToken,
  });
};

export const removeReaction = async (hostPort: string, messageId: string, emoji: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?auth_token=${authToken}`);
};

export const searchMessages = async (hostPort: string, query: string, authToken: string): Promise<ApiResponse<SearchResult[]>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/search', {
    q: query,
    auth_token: authToken,
  });
};
