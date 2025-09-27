import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { User } from '../models';

// User authentication interfaces
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignupCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  auth_token: string;
  auth_token_expire_time?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  bio?: string;
  joinedAt: string;
  roles: string[];
}

// User authentication functions
export const login = async (hostPort: string, credentials: LoginCredentials): Promise<ApiResponse<AuthToken>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/users/signin', credentials as unknown as Record<string, string>);
};

export const signup = async (hostPort: string, credentials: SignupCredentials): Promise<ApiResponse<AuthToken>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/signup', credentials as unknown as Record<string, string>);
};

export const getUserProfile = async (hostPort: string, userId: string, authToken: string): Promise<ApiResponse<UserProfile>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
};

// Utility functions
export const extractUserIdFromToken = (authToken: string): string => {
  return authToken.split('.')[0];
};
