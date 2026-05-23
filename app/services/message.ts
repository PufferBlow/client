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
  /**
   * Sticker IDs from the instance library to include on this message.
   * The server resolves each id to its storage URL + metadata and
   * appends it to the message's `attachments` list with
   * `type: "sticker"`. The client never needs to upload a sticker —
   * it's already on the server. Pass alongside `attachments`
   * (regular files) freely; both are merged server-side.
   */
  stickerIds?: string[];
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

  // Sticker refs ride through as a comma-separated id list — the
  // server resolves them into structured attachment dicts. Empty
  // list = field omitted, so legacy server builds that don't know
  // about the field still parse the form OK.
  if (messageData.stickerIds && messageData.stickerIds.length > 0) {
    formData.append('sticker_ids', messageData.stickerIds.join(','));
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

// ─────────────────────────────────────────────────────────────────────
// Bulk read-state mutations
// ─────────────────────────────────────────────────────────────────────

export interface MarkChannelReadResponse {
  status_code: number;
  channel_id: string;
  newly_marked_read: number;
}

export interface MarkServerReadResponse {
  status_code: number;
  channels_touched: number;
  newly_marked_read: number;
}

/**
 * "Mark As Read" for a single channel. Server-side this adds every
 * visible message (within the 7-day unread window) to the user's
 * read-history in one transaction — much faster than walking
 * `markMessageAsRead` per message, and idempotent on re-run.
 */
export const markChannelRead = async (
  hostPort: string,
  channelId: string,
  authToken: string,
): Promise<ApiResponse<MarkChannelReadResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post<MarkChannelReadResponse>(
    `/api/v1/channels/${channelId}/mark_all_read?auth_token=${encodeURIComponent(authToken)}`,
  );
};

/**
 * Server-wide "Mark All As Read." Single DB transaction; collapses
 * every unread dot the viewer sees in one round-trip.
 */
export const markServerRead = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<MarkServerReadResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post<MarkServerReadResponse>(
    `/api/v1/channels/mark_all_read?auth_token=${encodeURIComponent(authToken)}`,
  );
};

// ─────────────────────────────────────────────────────────────────────
// Notification preferences (per-channel mute + bulk mute-server)
// ─────────────────────────────────────────────────────────────────────

export interface NotificationPreference {
  user_id: string;
  channel_id: string;
  muted: boolean;
  mention_only: boolean;
  updated_at: string | null;
}

export interface ListNotificationPreferencesResponse {
  status_code: number;
  preferences: NotificationPreference[];
}

export interface UpsertNotificationPreferenceResponse {
  status_code: number;
  preference: NotificationPreference;
}

export interface BulkSetMuteResponse {
  status_code: number;
  muted: boolean;
  channels_total: number;
  channels_changed: number;
}

/**
 * List every notification preference the viewer has explicitly set.
 * Absence of a row means "use default (notify normally)" — only
 * deviations are stored, so the response is small in practice.
 * The client uses this on mount to seed a `muted-channels` set
 * for rendering the muted icon + suppressing the unread dot.
 */
export const listNotificationPreferences = async (
  hostPort: string,
  authToken: string,
): Promise<ApiResponse<ListNotificationPreferencesResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListNotificationPreferencesResponse>(
    '/api/v1/notifications/preferences',
    { auth_token: authToken },
  );
};

/**
 * Set the viewer's mute / mention-only preference for a channel.
 * Pass `muted: false, mention_only: false` to "unmute back to
 * default" (the server still persists the row to remember the
 * explicit choice; use `resetChannelNotificationPreference` to
 * fully delete it).
 */
export const setChannelNotificationPreference = async (
  hostPort: string,
  channelId: string,
  authToken: string,
  options: { muted?: boolean; mention_only?: boolean } = {},
): Promise<ApiResponse<UpsertNotificationPreferenceResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put<UpsertNotificationPreferenceResponse>(
    `/api/v1/notifications/preferences/${channelId}?auth_token=${encodeURIComponent(authToken)}`,
    {
      muted: Boolean(options.muted),
      mention_only: Boolean(options.mention_only),
    },
  );
};

/**
 * Delete the stored preference for a channel (back to defaults).
 * Returns `{existed: false}` when no row was stored — idempotent.
 */
export const resetChannelNotificationPreference = async (
  hostPort: string,
  channelId: string,
  authToken: string,
): Promise<ApiResponse<{ status_code: number; existed: boolean }>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<{ status_code: number; existed: boolean }>(
    `/api/v1/notifications/preferences/${channelId}`,
    { auth_token: authToken },
  );
};

/**
 * Bulk mute / unmute every accessible channel — backs the
 * "Mute Server" / "Unmute Server" dropdown affordance.
 * Single transaction server-side.
 */
export const bulkSetServerMute = async (
  hostPort: string,
  authToken: string,
  muted: boolean,
): Promise<ApiResponse<BulkSetMuteResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put<BulkSetMuteResponse>(
    `/api/v1/notifications/preferences?auth_token=${encodeURIComponent(authToken)}`,
    { muted },
  );
};
