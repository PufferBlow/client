import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface WebFingerLink {
  rel: string;
  href?: string;
  type?: string;
}

export interface WebFingerResponse {
  subject: string;
  aliases?: string[];
  links?: WebFingerLink[];
}

export interface ActivityPubActorDocument {
  '@context'?: string | string[];
  id: string;
  type: string;
  preferredUsername?: string;
  inbox?: string;
  outbox?: string;
  [key: string]: unknown;
}

export interface ActivityPubOutboxPage {
  '@context'?: string | string[];
  id: string;
  type: string;
  partOf?: string;
  orderedItems: Record<string, unknown>[];
}

export interface FollowRemoteActorResponse {
  status_code: number;
  message: string;
  result: Record<string, unknown>;
}

/**
 * Typed attachment payload accepted by `POST /api/v1/dms/send`.
 *
 * Two shapes the server accepts (mixable in the same array):
 *   * Plain URL string — legacy / minimal shape; renderer infers
 *     MIME from the URL extension. Fine for `/storage/<hash>.png`
 *     but breaks for hash-only URLs where the renderer can't
 *     tell an image from a generic file.
 *   * Typed object — `{url, filename, type, size}` carrying the
 *     MIME hint the renderer needs. The storage upload response
 *     already includes filename + type + size, so it's cheap to
 *     keep them around end-to-end.
 *
 * New code should ALWAYS send the typed object. The string shape
 * stays in the type union for back-compat with any older client
 * builds still calling this service.
 */
export type DirectMessageAttachmentInput =
  | string
  | { url: string; filename?: string; type?: string; size?: number; lqip_url?: string | null };

export interface SendDirectMessageRequest {
  auth_token: string;
  peer: string;
  message: string;
  sent_at?: string;
  attachments?: DirectMessageAttachmentInput[];
  /** Sticker IDs from the instance library. Server resolves to URLs
   *  and merges into `attachments` before federating. */
  sticker_ids?: string[];
}

export interface SendDirectMessageResponse {
  status_code: number;
  message: string;
  result: Record<string, unknown>;
}

export interface DirectMessagePayload {
  message_id: string;
  conversation_id?: string;
  sender_user_id?: string;
  sender_id?: string;
  message: string;
  sent_at: string;
  attachments?: unknown[];
  /** Edit metadata. ``edit_count === 0`` means never edited; the
   *  renderer's "edited" / "edited N times" badge only shows when
   *  this is > 0. ``last_edited_at`` is null in the unedited case. */
  edit_count?: number;
  last_edited_at?: string | null;
  /** Legacy field — older builds shipped the sender's username here.
   *  Server now populates `sender_username` instead; keep this for
   *  fall-through compatibility when consuming caches written by
   *  older clients. */
  username?: string;
  /** Hydrated server-side (`MessagesManager._hydrate_messages`) by
   *  joining the sender's `users` row. The DM read path uses the
   *  same hydration pipeline as channel messages, so all of these
   *  are populated identically. */
  sender_username?: string;
  sender_avatar_url?: string | null;
  sender_avatar_lqip_url?: string | null;
  sender_banner_url?: string | null;
  sender_banner_lqip_url?: string | null;
  sender_status?: string;
  sender_roles?: string[];
  sender_about?: string | null;
  sender_last_seen?: string | null;
  sender_created_at?: string | null;
}

export interface LoadDirectMessagesResponse {
  status_code: number;
  conversation_id: string;
  peer_actor_uri: string;
  messages: DirectMessagePayload[];
}

const createFederationClient = (instance?: string) => createApiClient(instance);

// ActivityPub discovery happens against the selected home instance, which then
// resolves remote actors through WebFinger and ActivityPub routes.
export const resolveActorHandle = async (
  resource: string,
  instance?: string,
): Promise<ApiResponse<WebFingerResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.get('/.well-known/webfinger', { resource });
};

export const getActorDocument = async (
  userId: string,
  instance?: string,
): Promise<ApiResponse<ActivityPubActorDocument>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.get(`/ap/users/${encodeURIComponent(userId)}`);
};

export const getActorOutbox = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  instance?: string,
): Promise<ApiResponse<ActivityPubOutboxPage>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.get(`/ap/users/${encodeURIComponent(userId)}/outbox`, {
    page: String(page),
    limit: String(limit),
  });
};

export const followRemoteAccount = async (
  authToken: string,
  remoteHandle: string,
  instance?: string,
): Promise<ApiResponse<FollowRemoteActorResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.post('/api/v1/federation/follow', {
    auth_token: authToken,
    remote_handle: remoteHandle,
  });
};

export const sendFederatedDirectMessage = async (
  request: SendDirectMessageRequest,
  instance?: string,
): Promise<ApiResponse<SendDirectMessageResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.post('/api/v1/dms/send', request);
};

export const loadFederatedDirectMessages = async (
  authToken: string,
  peer: string,
  page: number = 1,
  messagesPerPage: number = 20,
  instance?: string,
): Promise<ApiResponse<LoadDirectMessagesResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.get('/api/v1/dms/messages', {
    auth_token: authToken,
    peer,
    page: String(page),
    messages_per_page: String(messagesPerPage),
  });
};

/**
 * One conversation entry in the sidebar conversation list. Mirrors
 * the wire shape returned by `GET /api/v1/dms/conversations`.
 *
 * Designed so the sidebar can render a row without a second fetch:
 * the peer's identity (username, origin, avatar, presence) and the
 * last message preview / timestamp are all here.
 */
export interface DirectMessageConversation {
  conversation_id: string;
  peer_user_id: string;
  peer_username: string;
  /** Empty string when the peer is local; non-empty federated host. */
  peer_origin_server: string;
  peer_avatar_url: string | null;
  peer_status: string;
  /** ISO 8601 timestamp of the most recent message. */
  last_message_at: string | null;
  /** Pre-truncated (server-side cap: 120 chars) text preview. */
  last_message_preview: string;
  /** True when the viewer was the sender of the latest message —
   *  lets the UI prefix the preview with "You: " for outgoing. */
  last_message_sender_is_me: boolean;
}

export interface ListDirectMessageConversationsResponse {
  status_code: number;
  conversations: DirectMessageConversation[];
}

export interface EditDirectMessageResponse {
  status_code: number;
  message_id: string;
  message: string;
  edit_count: number;
  last_edited_at: string;
}

/**
 * Edit a DM message's body. Only the original sender can edit;
 * the server returns 403 otherwise. The post-edit shape (new
 * body + edit_count + last_edited_at) comes back so the client
 * can update its cache without a separate fetch.
 */
export const editDirectMessage = async (
  authToken: string,
  messageId: string,
  newMessage: string,
  instance?: string,
): Promise<ApiResponse<EditDirectMessageResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.patch(`/api/v1/dms/messages/${encodeURIComponent(messageId)}`, {
    auth_token: authToken,
    message: newMessage,
  });
};

/**
 * List the viewer's DM conversations, most-recent-first.
 *
 * The sidebar consumes this on every chat open to populate the
 * conversation list. The response is pre-hydrated server-side
 * (peer info + last-message preview) so the UI doesn't need
 * follow-up calls per row.
 */
export const listDirectMessageConversations = async (
  authToken: string,
  instance?: string,
): Promise<ApiResponse<ListDirectMessageConversationsResponse>> => {
  const apiClient = createFederationClient(instance);
  return apiClient.get('/api/v1/dms/conversations', {
    auth_token: authToken,
  });
};

// Backward-compatible aliases while the rest of the client migrates off the
// older generic naming.
export const getWebFinger = resolveActorHandle;
export const getActivityPubActor = getActorDocument;
export const getActivityPubOutbox = getActorOutbox;
export const followRemoteActor = followRemoteAccount;
export const sendDirectMessage = sendFederatedDirectMessage;
export const loadDirectMessages = loadFederatedDirectMessages;
