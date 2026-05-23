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
//
// Two ways to page through channel history:
//
//   1. `before` (opaque cursor) — preferred for new code. Server-side
//      keyset pagination is O(log N + limit) regardless of how deep
//      in the channel you've scrolled. The server returns
//      `next_cursor` in the response (see `loadMessages` below); pass
//      that value back as the `before` arg here for the next page.
//      `next_cursor === null` means there is no older history.
//
//   2. Legacy `page` numbering — translated server-side into a bounded
//      keyset walk. The server caps the reachable depth (currently
//      ~2000 rows) and returns 400 past that, so deep scroll-back on
//      a busy channel MUST use the cursor path.
//
// `getMessages` keeps the "give me an array, ignore pagination
// details" shape for the call sites that don't care about cursors
// yet. New call sites that want scroll-back should call `loadMessages`
// directly so they can read `next_cursor` off the response.
export const getMessages = async (hostPort: string, channelId: string, authToken: string, limit = 50, before?: string): Promise<ApiResponse<Message[]>> => {
  const apiClient = createApiClient(hostPort);
  const params: Record<string, string> = {
    auth_token: authToken,
    messages_per_page: Math.min(limit, 50).toString(),
  };

  if (before) {
    // Cursor mode — server ignores `page` when this is set.
    params.before_cursor = before;
  } else {
    params.page = '1';
  }

  const response = await apiClient.get<{ status_code: number; messages: Message[]; next_cursor?: string | null }>(
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
 *
 * Note the legacy `truncated_scan` field: on a Postgres-backed server
 * this is always `false` (ranked search via tsvector/GIN doesn't
 * "scan" — it's an index lookup with no truncation), and `scanned`
 * holds the hit count rather than a candidate-scan count. The field
 * is preserved for back-compat with SQLite test deployments and
 * older server builds that still use the decrypt-and-scan fallback.
 * New UI code should treat `truncated_scan: true` as "this is a
 * legacy server, the result set may be incomplete," and otherwise
 * present the result as complete.
 */
export interface ChannelSearchResponse {
  status_code: number;
  messages: Message[];
  query: string;
  scanned: number;
  truncated_scan: boolean;
}

/**
 * Ranked search across a channel's messages.
 *
 * On a Postgres-backed server, the query goes through a tsvector +
 * GIN index, scored with `ts_rank_cd`, with attachment filenames
 * included in the index (so "report.pdf" finds attachment-only
 * messages). Cost is O(matches), not O(channel size), so the
 * `scanLimit` option below is silently ignored on the ranked path —
 * it's only honoured by the SQLite fallback for the test harness.
 *
 * Results are returned best-rank-first, with the most recent matches
 * outranking older matches at the same score.
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

/**
 * Response payload for `loadMessages`. `next_cursor` is populated when
 * the call used keyset (`beforeCursor`) pagination — pass it back as
 * `beforeCursor` to fetch the next older page. `null` means "no
 * older history" or "this request didn't use cursor mode."
 */
export interface LoadMessagesResponse {
  status_code: number;
  messages: Message[];
  next_cursor?: string | null;
}

/**
 * Load a channel's messages.
 *
 * Two modes (mutually exclusive — `beforeCursor` wins when both are set):
 *
 *   * `beforeCursor` — server-side keyset pagination, O(log N + limit)
 *     regardless of channel size. Read `next_cursor` off the response;
 *     pass it back as `beforeCursor` to fetch older messages. `null`
 *     `next_cursor` means you reached the start of history. Prefer this
 *     for any scroll-back UI.
 *
 *   * `page` / `messagesPerPage` — legacy numeric paging. Translated
 *     server-side into a bounded keyset walk; the server caps reachable
 *     depth (~2000 rows) and returns 400 past that, so deep scroll-back
 *     MUST use the cursor mode above.
 */
export const loadMessages = async (
  hostPort: string,
  channelId: string,
  authToken: string,
  page?: number,
  messagesPerPage?: number,
  beforeCursor?: string,
): Promise<ApiResponse<LoadMessagesResponse>> => {
  const apiClient = createApiClient(hostPort);
  const params: Record<string, string> = {
    auth_token: authToken,
    messages_per_page: (messagesPerPage || 20).toString(),
  };
  if (beforeCursor) {
    params.before_cursor = beforeCursor;
  } else {
    params.page = (page || 1).toString();
  }
  return apiClient.get<LoadMessagesResponse>(
    `/api/v1/channels/${channelId}/load_messages`,
    params,
  );
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
