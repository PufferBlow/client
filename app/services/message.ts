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

const unsupportedMessageOperation = <T>(operation: string): ApiResponse<T> => ({
  success: false,
  error: `${operation} is not available on the current server API.`,
});

// Message API functions
export const getMessages = async (hostPort: string, channelId: string, authToken: string, limit = 50, before?: string): Promise<ApiResponse<Message[]>> => {
  const apiClient = createApiClient(hostPort);
  const params: Record<string, string> = {
    auth_token: authToken,
    page: '1',
    messages_per_page: Math.min(limit, 50).toString(),
  };

  if (before) {
    params.before = before;
  }

  const response = await apiClient.get<{ status_code: number; messages: Message[] }>(
    `/api/v1/channels/${channelId}/load_messages`,
    params
  );

  if (!response.success) {
    return {
      success: false,
      error: response.error,
    };
  }

  return {
    success: true,
    data: response.data?.messages || [],
  };
};

export const sendMessage = async (hostPort: string, channelId: string, messageData: SendMessageRequest, authToken: string): Promise<ApiResponse<Message>> => {
  const apiClient = createApiClient(hostPort);

  // Always use FormData for consistency with backend expectations
  const formData = new FormData();
  formData.append('auth_token', authToken);

  // Add message content if provided
  if (messageData.content && messageData.content.trim()) {
    formData.append('message', messageData.content.trim());
  }

  // Add attachments if present
  if (messageData.attachments && messageData.attachments.length > 0) {
    messageData.attachments.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  // Use correct endpoint with channel_id as path parameter
  return apiClient.post(`/api/v1/channels/${channelId}/send_message`, formData);
};

export const updateMessage = async (_hostPort: string, _messageId: string, _content: string, _authToken: string): Promise<ApiResponse<Message>> => {
  return unsupportedMessageOperation<Message>('Editing messages');
};

export const deleteMessage = async (
  hostPort: string,
  messageId: string,
  authToken: string,
  channelId?: string
): Promise<ApiResponse<void>> => {
  if (!channelId) {
    return {
      success: false,
      error: 'channelId is required to delete messages with the current API',
    };
  }
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/channels/${channelId}/delete_message`, {
    auth_token: authToken,
    message_id: messageId,
  });
};

export const addReaction = async (_hostPort: string, _messageId: string, _emoji: string, _authToken: string): Promise<ApiResponse<void>> => {
  return unsupportedMessageOperation<void>('Message reactions');
};

export const removeReaction = async (_hostPort: string, _messageId: string, _emoji: string, _authToken: string): Promise<ApiResponse<void>> => {
  return unsupportedMessageOperation<void>('Message reactions');
};

export const searchMessages = async (_hostPort: string, _query: string, _authToken: string): Promise<ApiResponse<SearchResult[]>> => {
  return unsupportedMessageOperation<SearchResult[]>('Message search');
};

// Additional messaging functions moved from channel service
export const loadMessages = async (hostPort: string, channelId: string, authToken: string, page?: number, messages_per_page?: number): Promise<ApiResponse<{ status_code: number; messages: Message[] }>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/api/v1/channels/${channelId}/load_messages`, {
    auth_token: authToken,
    page: (page || 1).toString(),
    messages_per_page: (messages_per_page || 20).toString()
  });
};

export const markMessageAsRead = async (hostPort: string, channelId: string, messageId: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/api/v1/channels/${channelId}/mark_message_as_read`, {
    auth_token: authToken,
    message_id: messageId,
  }, undefined, 'PUT');
};
