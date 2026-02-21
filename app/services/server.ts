import type { ApiResponse } from './apiClient';

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

const unsupportedServerOperation = <T>(operation: string): ApiResponse<T> => ({
  success: false,
  error: `${operation} is not available in the current single-instance server API.`,
});

// Server API functions
export const getServers = async (_hostPort: string, _authToken: string): Promise<ApiResponse<Server[]>> => {
  return unsupportedServerOperation<Server[]>('Listing servers');
};

export const getServer = async (_hostPort: string, _serverId: string, _authToken: string): Promise<ApiResponse<Server>> => {
  return unsupportedServerOperation<Server>('Fetching server by id');
};

export const createServer = async (_hostPort: string, _serverData: CreateServerRequest, _authToken: string): Promise<ApiResponse<Server>> => {
  return unsupportedServerOperation<Server>('Creating servers');
};

export const updateServer = async (_hostPort: string, _serverId: string, _serverData: Partial<CreateServerRequest>, _authToken: string): Promise<ApiResponse<Server>> => {
  return unsupportedServerOperation<Server>('Updating servers');
};

export const deleteServer = async (_hostPort: string, _serverId: string, _authToken: string): Promise<ApiResponse<void>> => {
  return unsupportedServerOperation<void>('Deleting servers');
};

export const joinServer = async (_hostPort: string, _inviteCode: string, _authToken: string): Promise<ApiResponse<Server>> => {
  return unsupportedServerOperation<Server>('Joining servers');
};

export const leaveServer = async (_hostPort: string, _serverId: string, _authToken: string): Promise<ApiResponse<void>> => {
  return unsupportedServerOperation<void>('Leaving servers');
};

// Invite API functions
export const getServerInvites = async (_hostPort: string, _serverId: string, _authToken: string): Promise<ApiResponse<Invite[]>> => {
  return unsupportedServerOperation<Invite[]>('Listing server invites');
};

export const createInvite = async (_hostPort: string, _serverId: string, _inviteData: CreateInviteRequest, _authToken: string): Promise<ApiResponse<Invite>> => {
  return unsupportedServerOperation<Invite>('Creating invites');
};

export const deleteInvite = async (_hostPort: string, _inviteId: string, _authToken: string): Promise<ApiResponse<void>> => {
  return unsupportedServerOperation<void>('Deleting invites');
};
