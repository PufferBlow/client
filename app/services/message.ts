import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { Message, MessageReaction } from '../models';

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
}

export type Reaction = MessageReaction;

export interface ReactionMutationResponse {
  status_code: number;
  message_id: string;
  channel_id: string;
  emoji: string;
  reactions: MessageReaction[];
  /** Set when add was a no-op (user already reacted with this emoji). */
  already_present?: boolean;
  /** Set when remove was a no-op (user hadn't reacted with this emoji). */
  already_absent?: boolean;
}

export interface SendMessageRequest {
  content: string;
  sentAt?: string;
  attachments?: File[];
}

export interface SendMessageResponse {
  status_code: number;
  message: string;
  message_id: string;
  attachments: string[];
  message_data?: Message;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'user' | 'channel';
  title: string;
  subtitle?: string;
  content?: string;
  timestamp?: string;
}

export interface MessageReadHistoryResponse {
  status_code: number;
  viewed_message_ids: string[];
  unread_counts: Record<string, number>;
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

export const sendMessage = async (
  hostPort: string | undefined,
  channelId: string,
  messageData: SendMessageRequest,
  authToken: string,
): Promise<ApiResponse<SendMessageResponse>> => {
  const apiClient = createApiClient(hostPort);

  // Always use FormData for consistency with backend expectations
  const formData = new FormData();
  formData.append('auth_token', authToken);

  // Add message content if provided
  if (messageData.content && messageData.content.trim()) {
    formData.append('message', messageData.content.trim());
  }

  if (messageData.sentAt) {
    formData.append('sent_at', messageData.sentAt);
  }

  // Add attachments if present
  if (messageData.attachments && messageData.attachments.length > 0) {
    messageData.attachments.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  // Use correct endpoint with channel_id as path parameter
  return apiClient.post<SendMessageResponse>(`/api/v1/channels/${channelId}/send_message`, formData);
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

export const addReaction = async (
  hostPort: string,
  channelId: string,
  messageId: string,
  emoji: string,
  authToken: string,
): Promise<ApiResponse<ReactionMutationResponse>> => {
  const apiClient = createApiClient(hostPort);
  // FastAPI route takes auth_token + emoji as query params; assemble them into
  // the URL because `apiClient.post` doesn't accept a params object.
  const query = new URLSearchParams({ auth_token: authToken, emoji }).toString();
  return apiClient.post<ReactionMutationResponse>(
    `/api/v1/channels/${channelId}/messages/${messageId}/reactions?${query}`,
  );
};

export const removeReaction = async (
  hostPort: string,
  channelId: string,
  messageId: string,
  emoji: string,
  authToken: string,
): Promise<ApiResponse<ReactionMutationResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<ReactionMutationResponse>(
    `/api/v1/channels/${channelId}/messages/${messageId}/reactions`,
    {
      auth_token: authToken,
      emoji,
    },
  );
};

/**
 * Server-side response shape for the channel /search endpoint.
 */
export interface ChannelSearchResponse {
  status_code: number;
  messages: Message[];
  query: string;
  scanned: number;
  truncated_scan: boolean;
}

/**
 * Search a channel for messages containing the given substring (case-
 * insensitive). The server decrypts and scans up to `scan_limit` recent
 * messages and returns up to `limit` matches, newest first. `truncated_scan`
 * is true when the channel has more history than the scan window covers.
 */
export const searchChannelMessages = async (
  hostPort: string,
  channelId: string,
  query: string,
  authToken: string,
  options: { limit?: number; scanLimit?: number } = {},
): Promise<ApiResponse<ChannelSearchResponse>> => {
  const apiClient = createApiClient(hostPort);
  const params: Record<string, string> = {
    auth_token: authToken,
    q: query,
  };
  if (options.limit !== undefined) params.limit = String(options.limit);
  if (options.scanLimit !== undefined) params.scan_limit = String(options.scanLimit);

  return apiClient.get<ChannelSearchResponse>(
    `/api/v1/channels/${channelId}/search`,
    params,
  );
};

/**
 * @deprecated Kept for older callers; the global dashboard search still calls
 * this. New code should use `searchChannelMessages` against a specific channel.
 */
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

export const getMessageReadHistory = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<MessageReadHistoryResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/channels/read-history', {
    auth_token: authToken,
  });
};
