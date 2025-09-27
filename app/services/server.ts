import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

// Server interfaces
export interface Server {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isPrivate: boolean;
  createdAt: string;
  memberCount: number;
  channels: string[]; // Channel IDs
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  isPrivate: boolean;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  createdBy: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
}

export interface CreateInviteRequest {
  maxUses?: number;
  expiresAt?: Date;
  isPermanent?: boolean;
}

// Server API functions
export const getServers = async (hostPort: string, authToken: string): Promise<ApiResponse<Server[]>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get('/api/v1/servers', {
    auth_token: authToken,
  });
};

export const getServer = async (hostPort: string, serverId: string, authToken: string): Promise<ApiResponse<Server>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/api/v1/servers/${serverId}`, {
    auth_token: authToken,
  });
};

export const createServer = async (hostPort: string, serverData: CreateServerRequest, authToken: string): Promise<ApiResponse<Server>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/servers', {
    ...serverData,
    auth_token: authToken,
  });
};

export const updateServer = async (hostPort: string, serverId: string, serverData: Partial<CreateServerRequest>, authToken: string): Promise<ApiResponse<Server>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put(`/api/v1/servers/${serverId}`, {
    ...serverData,
    auth_token: authToken,
  });
};

export const deleteServer = async (hostPort: string, serverId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/servers/${serverId}?auth_token=${authToken}`);
};

export const joinServer = async (hostPort: string, inviteCode: string, authToken: string): Promise<ApiResponse<Server>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/servers/join', {
    invite_code: inviteCode,
    auth_token: authToken,
  });
};

export const leaveServer = async (hostPort: string, serverId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post(`/api/v1/servers/${serverId}/leave`, {
    auth_token: authToken,
  });
};

// Invite API functions
export const getServerInvites = async (hostPort: string, serverId: string, authToken: string): Promise<ApiResponse<Invite[]>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get(`/api/v1/servers/${serverId}/invites`, {
    auth_token: authToken,
  });
};

export const createInvite = async (hostPort: string, serverId: string, inviteData: CreateInviteRequest, authToken: string): Promise<ApiResponse<Invite>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post(`/api/v1/servers/${serverId}/invites`, {
    ...inviteData,
    auth_token: authToken,
  });
};

export const deleteInvite = async (hostPort: string, inviteId: string, authToken: string): Promise<ApiResponse<void>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete(`/api/v1/invites/${inviteId}?auth_token=${authToken}`);
};
