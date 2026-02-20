import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import { secureStorage } from './secureStorage';

export interface DecentralizedChallengeResponse {
  status_code: number;
  challenge_id: string;
  challenge_nonce: string;
  expires_at: string;
}

export interface DecentralizedVerifyResponse {
  status_code: number;
  session_id: string;
  session_token: string;
  node_id: string;
  expires_at: string;
  scopes: string[];
}

export interface DecentralizedSessionIntrospectResponse {
  status_code: number;
  active: boolean;
  session_id: string;
  user_id: string;
  node_id: string;
  node_public_key: string;
  expires_at: string;
  scopes: string[];
}

export const issueDecentralizedChallenge = async (
  authToken: string,
  nodeId: string
): Promise<ApiResponse<DecentralizedChallengeResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/auth/decentralized/challenge', {
    auth_token: authToken,
    node_id: nodeId,
  });
};

export const verifyDecentralizedChallenge = async (payload: {
  challenge_id: string;
  node_public_key: string;
  challenge_signature: string;
  shared_secret: string;
}): Promise<ApiResponse<DecentralizedVerifyResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/auth/decentralized/verify', payload);
};

export const introspectDecentralizedSession = async (
  sessionToken: string
): Promise<ApiResponse<DecentralizedSessionIntrospectResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/auth/decentralized/introspect', {
    session_token: sessionToken,
  });
};

export const revokeDecentralizedSession = async (
  authToken: string,
  sessionId: string
): Promise<ApiResponse<{ status_code: number; message: string; session_id: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/auth/decentralized/revoke', {
    auth_token: authToken,
    session_id: sessionId,
  });
};

export const persistNodeSessionToken = async (sessionToken: string): Promise<void> => {
  await secureStorage.set('node_session_token', sessionToken);
  if (typeof window !== 'undefined') {
    localStorage.setItem('node_session_token', sessionToken);
    sessionStorage.setItem('node_session_token', sessionToken);
  }
};

export const clearNodeSessionToken = async (): Promise<void> => {
  await secureStorage.delete('node_session_token');
  if (typeof window !== 'undefined') {
    localStorage.removeItem('node_session_token');
    sessionStorage.removeItem('node_session_token');
  }
};
