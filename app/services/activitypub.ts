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

export interface SendDirectMessageRequest {
  auth_token: string;
  peer: string;
  message: string;
  sent_at?: string;
  attachments?: string[];
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
  username?: string;
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

// Backward-compatible aliases while the rest of the client migrates off the
// older generic naming.
export const getWebFinger = resolveActorHandle;
export const getActivityPubActor = getActorDocument;
export const getActivityPubOutbox = getActorOutbox;
export const followRemoteActor = followRemoteAccount;
export const sendDirectMessage = sendFederatedDirectMessage;
export const loadDirectMessages = loadFederatedDirectMessages;
