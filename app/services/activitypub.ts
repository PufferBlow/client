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

export const getWebFinger = async (
  resource: string,
  hostPort?: string
): Promise<ApiResponse<WebFingerResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/.well-known/webfinger', { resource });
};

export const getActivityPubActor = async (
  userId: string,
  hostPort?: string
): Promise<ApiResponse<ActivityPubActorDocument>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/ap/users/${encodeURIComponent(userId)}`);
};

export const getActivityPubOutbox = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  hostPort?: string
): Promise<ApiResponse<ActivityPubOutboxPage>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/ap/users/${encodeURIComponent(userId)}/outbox`, {
    page: String(page),
    limit: String(limit),
  });
};

export const followRemoteActor = async (
  authToken: string,
  remoteHandle: string,
  hostPort?: string
): Promise<ApiResponse<FollowRemoteActorResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/federation/follow', {
    auth_token: authToken,
    remote_handle: remoteHandle,
  });
};

export const sendDirectMessage = async (
  request: SendDirectMessageRequest,
  hostPort?: string
): Promise<ApiResponse<SendDirectMessageResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/dms/send', request);
};

export const loadDirectMessages = async (
  authToken: string,
  peer: string,
  page: number = 1,
  messagesPerPage: number = 20,
  hostPort?: string
): Promise<ApiResponse<LoadDirectMessagesResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/dms/messages', {
    auth_token: authToken,
    peer,
    page: String(page),
    messages_per_page: String(messagesPerPage),
  });
};
