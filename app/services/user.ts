import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';
import type { User } from '../models';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { secureStorage, migrateToSecureStorage } from './secureStorage';
import {
  clearSessionTokens,
  logoutCurrentSession,
  persistSessionTokens,
  getAuthTokenForRequests,
} from './authSession';
import {
  issueDecentralizedChallenge,
  verifyDecentralizedChallenge,
  persistNodeSessionToken,
} from './decentralizedAuth';
import { normalizeInstance, resolveStoredInstance } from './instance';

// Role definitions
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

export interface RoleInfo {
  id: UserRole;
  name: string;
  color: string;
  description: string;
}

export interface ResolvedRole {
  role_id: string;
  role_name: string;
  privileges_ids: string[];
  is_system: boolean;
}

// Role configurations
export const USER_ROLES: Record<UserRole, RoleInfo> = {
  [UserRole.OWNER]: {
    id: UserRole.OWNER,
    name: 'Server Owner',
    color: 'var(--color-info)',
    description: 'Full server control and management'
  },
  [UserRole.ADMIN]: {
    id: UserRole.ADMIN,
    name: 'Administrator',
    color: 'var(--color-error)',
    description: 'Server administration and moderation'
  },
  [UserRole.MODERATOR]: {
    id: UserRole.MODERATOR,
    name: 'Moderator',
    color: 'var(--color-accent)',
    description: 'Content moderation and community management'
  },
  [UserRole.USER]: {
    id: UserRole.USER,
    name: 'Member',
    color: 'var(--color-text-muted)',
    description: 'Regular server member'
  }
};

export const DEFAULT_AVATAR_BACKGROUND = 'f1edd1';

export const createFallbackAvatarUrl = (seed: string): string =>
  `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || 'user')}&backgroundColor=${DEFAULT_AVATAR_BACKGROUND}`;

export const getUserAccentColor = (rolesIds: string[] | undefined): string => {
  if (rolesIds?.some((role) => role.toLowerCase() === UserRole.OWNER)) {
    return 'var(--color-info)';
  }
  if (rolesIds?.some((role) => role.toLowerCase() === UserRole.ADMIN)) {
    return 'var(--color-error)';
  }
  if (rolesIds?.some((role) => role.toLowerCase() === UserRole.MODERATOR)) {
    return 'var(--color-accent)';
  }
  return 'var(--color-primary)';
};

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
  refresh_token?: string;
  token_type?: string;
  auth_token_expire_time?: string;
  refresh_token_expire_time?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: 'online' | 'idle' | 'afk' | 'dnd' | 'offline';
  bio?: string;
  joinedAt: string;
  roles: UserRole[];
  primaryRole: UserRole;
}

export interface ApiUserProfile {
  user_id: string;
  username: string;
  about?: string;
  avatar_url?: string;
  banner_url?: string;
  status: 'online' | 'offline' | 'idle' | 'afk' | 'dnd';
  origin_server: string;
  inbox_id?: string;
  roles_ids: string[];
  resolved_roles?: ResolvedRole[];
  resolved_privileges?: string[];
  moderation_state?: {
    is_banned: boolean;
    ban_reason?: string | null;
    banned_at?: string | null;
    timeout_until?: string | null;
    timeout_reason?: string | null;
    is_timed_out: boolean;
  };
  last_seen?: string;
  joined_servers_ids: any[];
  created_at: string;
  updated_at: string;
}

// User authentication functions
export const login = async (hostPort: string, credentials: LoginCredentials): Promise<ApiResponse<AuthToken>> => {
  const apiClient = createApiClient(hostPort);
  console.log(`📡 Login function called. Sending request to: ${normalizeInstance(hostPort)}/api/v1/users/signin`);
  console.log('📤 Request data:', { username: credentials.username, password: '[REDACTED]' });

  const response = await apiClient.get<AuthToken>('/api/v1/users/signin', {
    username: credentials.username,
    password: credentials.password,
  });

  console.log('📥 Response received:', { success: response.success, error: response.error, hasData: !!response.data });
  return response;
};

export const signup = async (hostPort: string, credentials: SignupCredentials): Promise<ApiResponse<AuthToken>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/signup', {
    username: credentials.username,
    password: credentials.password,
  });
};

export const getUserProfile = async (hostPort: string, userId: string, authToken: string): Promise<ApiResponse<UserProfile>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
};

export const getUserProfileById = async (hostPort: string, userId: string, authToken: string): Promise<ApiResponse<{ user_data: any }>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
};

export const getUserProfileByIdWithQuery = async (hostPort: string, userId: string, authToken: string): Promise<ApiResponse<UserProfile>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
};

export interface GetUserProfileResponse {
  status_code: number;
    user_data: {
    user_id: string;
    username: string;
    about?: string;
    avatar_url?: string;
    banner_url?: string;
    status: 'online' | 'offline' | 'idle' | 'afk' | 'dnd';
    origin_server: string;
    inbox_id?: string;
      roles_ids: string[];
    resolved_roles?: ResolvedRole[];
    resolved_privileges?: string[];
    moderation_state?: {
      is_banned: boolean;
      ban_reason?: string | null;
      banned_at?: string | null;
      timeout_until?: string | null;
      timeout_reason?: string | null;
      is_timed_out: boolean;
    };
    last_seen?: string;
    joined_servers_ids: any[];
    created_at: string;
    updated_at: string;
    auth_token_expire_time?: string;
  };
}



export const getCurrentUserProfile = async (hostPort: string, authToken: string): Promise<ApiResponse<GetUserProfileResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.post('/api/v1/users/profile', {
    auth_token: authToken,
  });
};

export interface ListUsersResponse {
  status_code: number;
  users: Array<{
    user_id: string;
    username: string;
    avatar_url?: string | null;
    avatar?: string | null;
    status: 'online' | 'offline' | 'idle' | 'afk' | 'dnd';
    last_seen: string;
    conversations: any[];
    contacts: any[];
    joined_servers_ids: any[];
    auth_token: string;
    auth_token_expire_time: string;
    created_at: string;
    updated_at: string;
    roles_ids: string[];
    resolved_roles?: ResolvedRole[];
    resolved_privileges?: string[];
    moderation_state?: {
      is_banned: boolean;
      ban_reason?: string | null;
      banned_at?: string | null;
      timeout_until?: string | null;
      timeout_reason?: string | null;
      is_timed_out: boolean;
    };
    is_admin: boolean;
    is_owner: boolean;
  }>;
}

export const hasResolvedPrivilege = (
  userLike:
    | {
        resolved_privileges?: string[];
        is_admin?: boolean;
        is_owner?: boolean;
      }
    | null
    | undefined,
  privilegeId: string,
): boolean => {
  if (!userLike) return false;
  return (
    Boolean(userLike.is_owner) ||
    Boolean(userLike.is_admin) ||
    Boolean(userLike.resolved_privileges?.includes(privilegeId))
  );
};

export const getResolvedRoleNames = (
  userLike:
    | {
        resolved_roles?: ResolvedRole[];
        roles_ids?: string[];
      }
    | null
    | undefined,
): string[] => {
  if (userLike?.resolved_roles?.length) {
    return userLike.resolved_roles.map((role) => role.role_name);
  }

  const fallbackRoles = getUserRoles(userLike?.roles_ids);
  return fallbackRoles.map((role) => getRoleInfo(role).name);
};

// DisplayUser interface for UI display purposes
export interface DisplayUser {
  id: string;
  username: string;
  avatar?: string;
  banner?: string;
  accentColor?: string;
  bannerColor?: string;
  customStatus?: string;
  externalLinks?: { platform: string; url: string }[];
  status: 'online' | 'idle' | 'afk' | 'offline' | 'dnd';
  bio?: string;
  joinedAt: string;
  originServer?: string;
  roles: string[];
  activity?: {
    type: 'playing' | 'listening' | 'watching' | 'streaming';
    name: string;
    details?: string;
  };
  mutualServers?: number;
  mutualFriends?: number;
  badges?: string[];
}

export const listUsers = async (authToken: string): Promise<ApiResponse<ListUsersResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/users/list', { auth_token: authToken });
};

// Update user profile functions
export interface UpdateUsernameRequest {
  auth_token: string;
  new_username: string;
}

export interface UpdateStatusRequest {
  auth_token: string;
  status: 'online' | 'offline' | 'idle' | 'afk' | 'dnd';
}

export interface UpdatePasswordRequest {
  auth_token: string;
  new_password: string;
  old_password: string;
}

export interface ResetAuthTokenRequest {
  auth_token: string;
  password: string;
}

export interface UpdateBioRequest {
  auth_token: string;
  about: string;
}

export interface UpdateAvatarRequest {
  auth_token: string;
  avatar?: File | string; // Can be a File object or a URL string
}

export interface UpdateBannerRequest {
  auth_token: string;
  banner?: File | string; // Can be a File object or a URL string
}

export interface UpdateProfileResponse {
  status_code: number;
  message: string;
}

export interface ResetAuthTokenResponse extends UpdateProfileResponse {
  auth_token: string;
  refresh_token?: string;
  token_type?: string;
  auth_token_expire_time: string;
  refresh_token_expire_time?: string;
}

export const updateUsername = async (request: UpdateUsernameRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', {
    auth_token: request.auth_token,
    new_username: request.new_username
  });
};

export const updateUserStatus = async (request: UpdateStatusRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', {
    auth_token: request.auth_token,
    status: request.status
  });
};

export const updatePassword = async (request: UpdatePasswordRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', {
    auth_token: request.auth_token,
    new_password: request.new_password,
    old_password: request.old_password
  });
};

export const resetAuthToken = async (request: ResetAuthTokenRequest): Promise<ApiResponse<ResetAuthTokenResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post('/api/v1/users/profile/reset-auth-token', request as unknown as Record<string, string>);
};

export const updateBio = async (request: UpdateBioRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', {
    auth_token: request.auth_token,
    about: request.about
  });
};

export const updateAvatar = async (request: UpdateAvatarRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  const formData = new FormData();

  formData.append('auth_token', request.auth_token);
  if (request.avatar) {
    if (request.avatar instanceof File) {
      formData.append('file', request.avatar);
    } else {
      formData.append('avatar_url', request.avatar);
    }
  }

  return apiClient.post('/api/v1/users/profile/avatar', formData as unknown as Record<string, string>);
};

export const updateBanner = async (request: UpdateBannerRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  const formData = new FormData();

  formData.append('auth_token', request.auth_token);
  if (request.banner) {
    if (request.banner instanceof File) {
      formData.append('file', request.banner);
    } else {
      formData.append('banner_url', request.banner);
    }
  }

  return apiClient.post('/api/v1/users/profile/banner', formData as unknown as Record<string, string>);
};

// Role utility functions
export const getUserRoles = (rolesIds: string[] | undefined): UserRole[] => {
  if (!rolesIds || !Array.isArray(rolesIds)) return [UserRole.USER];

  // Map API role IDs to our enum, filtering out invalid ones
  const validRoles: UserRole[] = [];
  for (const roleId of rolesIds) {
    switch (roleId.toLowerCase()) {
      case 'owner': validRoles.push(UserRole.OWNER); break;
      case 'admin': validRoles.push(UserRole.ADMIN); break;
      case 'moderator': validRoles.push(UserRole.MODERATOR); break;
      case 'user': validRoles.push(UserRole.USER); break;
      default: break; // Ignore unknown roles
    }
  }

  // Always include USER role if no valid roles found
  return validRoles.length > 0 ? validRoles : [UserRole.USER];
};

export const getPrimaryRole = (roles: UserRole[]): UserRole => {
  // Return the highest priority role (order: owner > admin > moderator > user)
  const priorityOrder = [UserRole.OWNER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.USER];
  for (const role of priorityOrder) {
    if (roles.includes(role)) return role;
  }
  return UserRole.USER;
};

export const hasRole = (userRoles: UserRole[], requiredRole: UserRole): boolean => {
  return userRoles.includes(requiredRole);
};

export const hasRoleOrHigher = (userRoles: UserRole[], minimumRole: UserRole): boolean => {
  const roleHierarchy = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN, UserRole.OWNER];
  const userRoleIndex = Math.max(...userRoles.map(role => roleHierarchy.indexOf(role)));
  const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);
  return userRoleIndex >= minimumRoleIndex;
};

export const getRoleInfo = (role: UserRole): RoleInfo => {
  return USER_ROLES[role] || USER_ROLES[UserRole.USER];
};

// Permission checking functions
export const canManageServer = (userRoles: UserRole[]): boolean => {
  return hasRoleOrHigher(userRoles, UserRole.ADMIN);
};

export const canModerateContent = (userRoles: UserRole[]): boolean => {
  return hasRoleOrHigher(userRoles, UserRole.MODERATOR);
};

export const canManageChannels = (userRoles: UserRole[]): boolean => {
  return hasRoleOrHigher(userRoles, UserRole.MODERATOR);
};

// Utility functions
export const extractUserIdFromToken = (authToken: string): string => {
  return authToken.split('.')[0];
};

// Cache for synchronous access (updated asynchronously)
let authTokenCache: string | null = null;
let hostPortCache: string | null = null;
let cacheInitialized = false;
let cacheInitializing = false;

const initializeStorageCache = async () => {
  if (cacheInitialized || cacheInitializing) return;

  cacheInitializing = true;

  try {
    // Migrate any existing data to secure storage
    await migrateToSecureStorage();

    // Load cached values
    [authTokenCache, hostPortCache] = await Promise.all([
      secureStorage.get('auth_token'),
      secureStorage.get('host_port')
    ]);

    cacheInitialized = true;

    // Refresh cache periodically
    setInterval(async () => {
      const [token, hostPort] = await Promise.all([
        secureStorage.get('auth_token'),
        secureStorage.get('host_port')
      ]);
      authTokenCache = token;
      hostPortCache = hostPort;
    }, 30000); // Refresh every 30 seconds
  } catch (error) {
    console.error('Failed to initialize storage cache:', error);
  } finally {
    cacheInitializing = false;
  }
};

// Synchronous functions for backward compatibility
export const getAuthTokenFromCookies = (): string | null => {
  if (!cacheInitialized && !cacheInitializing) {
    // Initialize cache on first call
    initializeStorageCache().catch(console.error);
  }
  const liveToken = getAuthTokenForRequests();
  if (liveToken !== authTokenCache) {
    authTokenCache = liveToken;
  }
  return authTokenCache;
};

export const getHostPortFromCookies = (): string | null => {
  if (!cacheInitialized && !cacheInitializing) {
    // Initialize cache on first call
    initializeStorageCache().catch(console.error);
  }
  return hostPortCache;
};

export const getHostPortFromStorage = (): string | null => {
  // Use secure storage cache for browser/Tauri-compatible storage behavior
  const hostPort = hostPortCache;
  return hostPort ? decodeURIComponent(hostPort) : null;
};

// Async versions that properly wait for cache initialization
export const getAuthTokenFromStorageAsync = async (): Promise<string | null> => {
  if (!cacheInitialized) {
    await initializeStorageCache();
  }
  const liveToken = getAuthTokenForRequests();
  if (liveToken !== authTokenCache) {
    authTokenCache = liveToken;
  }
  return authTokenCache;
};

export const getHostPortFromStorageAsync = async (): Promise<string | null> => {
  if (!cacheInitialized) {
    await initializeStorageCache();
  }
  return hostPortCache ? decodeURIComponent(hostPortCache) : null;
};

// Utility function to convert relative URLs from server to full URLs
export const createFullUrl = (relativeUrl: string | undefined | null): string | undefined => {
  if (!relativeUrl) return undefined;

  // If it's already a full URL (starts with http), return as-is
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }

  // Resolve the active home instance and prepend it to create the full URL.
  const resolved = resolveStoredInstance(getHostPortFromStorage());
  if (!resolved) return relativeUrl; // Fallback to relative URL if no instance is configured.

  // Ensure we don't double-slash
  const cleanPath = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;

  return `${resolved.apiBaseUrl}${cleanPath}`;
};

export const setHostPortToStorage = async (hostPort: string, persistent: boolean = false): Promise<void> => {
  if (typeof window === 'undefined') return;
  const normalizedHost = normalizeInstance(hostPort);

  try {
    // Update secure storage
    await secureStorage.set('host_port', normalizedHost);

    // Update cache immediately
    hostPortCache = normalizedHost;

    // Maintain backward compatibility with localStorage/sessionStorage
    if (persistent) {
      localStorage.setItem('host_port', normalizedHost);
      // Clear sessionStorage if setting persistent
      sessionStorage.removeItem('host_port');
    } else {
      sessionStorage.setItem('host_port', normalizedHost);
      // Clear localStorage if setting session
      localStorage.removeItem('host_port');
    }
  } catch (error) {
    console.error('Failed to set host port:', error);
    // Fallback to old method
    if (persistent) {
      localStorage.setItem('host_port', normalizedHost);
      sessionStorage.removeItem('host_port');
    } else {
      sessionStorage.setItem('host_port', normalizedHost);
      localStorage.removeItem('host_port');
    }
  }
};

// Helper to set auth token securely
export const setAuthTokenInStorage = async (token: string): Promise<void> => {
  try {
    // Update secure storage
    await secureStorage.set('auth_token', token);

    // Update cache immediately
    authTokenCache = token;
  } catch (error) {
    console.error('Failed to set auth token:', error);
    // Could add fallback to cookies here if needed
  }
};

// Centralized function to handle successful authentication
export const handleAuthentication = async (
  token: string,
  hostPort: string,
  rememberMe: boolean,
  expireTime?: string,
  refreshToken?: string,
  refreshTokenExpireTime?: string,
  tokenType?: string
) => {
  await setAuthTokenInStorage(token);
  await setHostPortToStorage(hostPort, rememberMe);

  persistSessionTokens({
    authToken: token,
    refreshToken,
    authTokenExpireTime: expireTime,
    refreshTokenExpireTime: refreshTokenExpireTime,
    tokenType,
    hostPort,
    rememberMe,
  });

  await bootstrapDecentralizedNodeSession(token);
};

const bootstrapDecentralizedNodeSession = async (authToken: string): Promise<void> => {
  const nodeId =
    (typeof window !== 'undefined' && localStorage.getItem('pufferblow_node_id')) ||
    '';
  const nodePublicKey =
    (typeof window !== 'undefined' && localStorage.getItem('pufferblow_node_public_key')) ||
    '';
  const sharedSecret =
    (typeof window !== 'undefined' && localStorage.getItem('pufferblow_node_shared_secret')) ||
    '';

  if (!nodeId || !nodePublicKey || !sharedSecret) {
    return;
  }

  try {
    const challengeResp = await issueDecentralizedChallenge(authToken, nodeId);
    if (!challengeResp.success || !challengeResp.data) return;

    const challengeSignature = await signChallengeNonce(
      challengeResp.data.challenge_nonce,
      sharedSecret
    );
    const verifyResp = await verifyDecentralizedChallenge({
      challenge_id: challengeResp.data.challenge_id,
      node_public_key: nodePublicKey,
      challenge_signature: challengeSignature,
      shared_secret: sharedSecret,
    });
    if (!verifyResp.success || !verifyResp.data?.session_token) return;

    await persistNodeSessionToken(verifyResp.data.session_token);
  } catch {
    // Ignore optional node session bootstrap errors.
  }
};

const signChallengeNonce = async (
  nonce: string,
  sharedSecret: string
): Promise<string> => {
  const enc = new TextEncoder();
  const keyData = enc.encode(sharedSecret);
  const msgData = enc.encode(nonce);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper to clear auth token from storage
export const clearAuthTokenFromStorage = async (): Promise<void> => {
  try {
    await secureStorage.delete('auth_token');
    authTokenCache = null;
    clearSessionTokens();
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }
};

// React Query hooks for user operations

// Query keys
export const USER_QUERY_KEYS = {
  profile: (userId: string) => ['user', 'profile', userId],
  currentProfile: () => ['user', 'profile', 'current'],
} as const;

// Hook to fetch current user profile
export const useCurrentUserProfile = () => {
  return useQuery({
    queryKey: USER_QUERY_KEYS.currentProfile(),
    queryFn: async () => {
      // Use async versions to ensure cache is initialized
      const authToken = await getAuthTokenFromStorageAsync();
      if (!authToken) throw new Error('No authentication token');

      const hostPort = await getHostPortFromStorageAsync();
      if (!hostPort) throw new Error('No home instance configured');

      const response = await getCurrentUserProfile(hostPort, authToken);
      if (!response.success || !response.data?.user_data) {
        throw new Error(response.error || 'Failed to fetch user profile');
      }

      const userData = response.data.user_data;
      // Generate avatar URL using DiceBear Bottts Neutral style as fallback
      const avatarUrl = createFallbackAvatarUrl(userData.username);

      // Create full URLs for avatar and banner from server-relative paths
      const fullAvatarUrl = createFullUrl(userData.avatar_url);
      const fullBannerUrl = createFullUrl(userData.banner_url);

      // Use avatar_url if available, otherwise generate one
      const finalAvatarUrl = fullAvatarUrl || avatarUrl;

      // Parse roles from API response
      const userRoles = getUserRoles(userData.roles_ids);
      const primaryRole = getPrimaryRole(userRoles);

      const user: User = {
        // Core API fields
        user_id: userData.user_id,
        username: userData.username,
        about: userData.about,
        avatar_url: fullAvatarUrl,
        banner_url: fullBannerUrl,
        inbox_id: userData.inbox_id,
        origin_server: userData.origin_server,
        status: userData.status as 'online' | 'idle' | 'afk' | 'dnd' | 'offline',
        roles_ids: userData.roles_ids,
        resolved_roles: userData.resolved_roles,
        resolved_privileges: userData.resolved_privileges,
        last_seen: userData.last_seen,
        joined_servers_ids: userData.joined_servers_ids,
        auth_token: authToken,
        raw_auth_token: authToken,
        auth_token_expire_time: userData.auth_token_expire_time,
        created_at: userData.created_at,
        updated_at: userData.updated_at,

        // Legacy alias fields for backward compatibility
        id: userData.user_id,
        bio: userData.about || 'No bio provided.',
        avatar: finalAvatarUrl,
        password: '', // Not returned by API for security
        conversations: [], // Legacy field
        contacts: [], // Legacy field
        is_admin: hasRole(userRoles, UserRole.ADMIN),
        is_owner: hasRole(userRoles, UserRole.OWNER),
        roles: userRoles,
        joinedAt: userData.created_at,
      };

      return user;
    },
    enabled: (() => {
      // Use a separate query to check if we have credentials
      const checkCredentials = async () => {
        const [authToken, hostPort] = await Promise.all([
          getAuthTokenFromStorageAsync(),
          getHostPortFromStorageAsync()
        ]);
        return !!(authToken && hostPort);
      };

      // For the enabled check, we need to use the synchronous version
      // but we'll rely on the cache being initialized by previous calls
      const syncToken = getAuthTokenFromCookies();
      const syncHostPort = getHostPortFromStorage();
      return !!(syncToken && syncHostPort);
    })(),
    staleTime: 5 * 60 * 1000, // 5 minutes - consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes after unmount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
};

// Hook to update username
export const useUpdateUsername = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updateUsername({ auth_token: authToken, new_username: newUsername });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update username');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch current user profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.currentProfile() });
    },
  });
};

// Hook to update status (frequent updates - no profile invalidation to prevent excessive API calls)
export const useUpdateStatus = () => {
  return useMutation({
    mutationFn: async (status: 'online' | 'offline' | 'idle' | 'afk' | 'dnd') => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updateUserStatus({ auth_token: authToken, status });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update status');
      }
      return response.data;
    },
    // Removed onSuccess callback to prevent constant profile invalidation
  });
};

// Hook to login user
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { username: string; password: string; hostPort: string; rememberMe: boolean }) => {
      const response = await login(data.hostPort, {
        username: data.username,
        password: data.password
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      return { data: response.data, rememberMe: data.rememberMe, hostPort: data.hostPort };
    },
    onSuccess: (result) => {
      // Clear previous user data
      queryClient.clear();
    },
  });
};

// Hook to update avatar
export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (avatar: File | string) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updateAvatar({ auth_token: authToken, avatar });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update avatar');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch current user profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.currentProfile() });
    },
  });
};

// Hook to update bio
export const useUpdateBio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (about: string) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updateBio({ auth_token: authToken, about });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update bio');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch current user profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.currentProfile() });
    },
  });
};

// Hook to update banner
export const useUpdateBanner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (banner: File | string) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updateBanner({ auth_token: authToken, banner });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update banner');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch current user profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.currentProfile() });
    },
  });
};

// Hook to update password
export const useUpdatePassword = () => {
  return useMutation({
    mutationFn: async (data: { new_password: string; old_password: string }) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await updatePassword({
        auth_token: authToken,
        new_password: data.new_password,
        old_password: data.old_password,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update password');
      }
      return response.data;
    },
  });
};

// Hook to reset auth token
export const useResetAuthToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await resetAuthToken({
        auth_token: authToken,
        password,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to reset auth token');
      }
      return response.data;
    },
    onSuccess: async (data) => {
      if (data?.auth_token) {
        const hostPort = await getHostPortFromStorageAsync();
        const rememberMe =
          typeof window !== 'undefined'
            ? (sessionStorage.getItem('remember_me') || localStorage.getItem('remember_me')) === '1'
            : true;
        if (hostPort) {
          await handleAuthentication(
            data.auth_token,
            hostPort,
            rememberMe,
            data.auth_token_expire_time,
            data.refresh_token,
            data.refresh_token_expire_time,
            data.token_type
          );
        }
      }
      // Clear query cache after token reset
      queryClient.clear();
    },
  });
};

// Hook to fetch individual user profile by ID
export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: USER_QUERY_KEYS.profile(userId),
    queryFn: async () => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const hostPort = getHostPortFromStorage();
      if (!hostPort) throw new Error('No home instance configured');

      const response = await getUserProfileById(hostPort, userId, authToken);
      if (!response.success || !response.data?.user_data) {
        throw new Error(response.error || 'Failed to fetch user profile');
      }

      const userData = response.data.user_data;

      // Create full URLs for avatar and banner from server-relative paths
      const fullAvatarUrl = createFullUrl(userData.avatar_url);
      const fullBannerUrl = createFullUrl(userData.banner_url);

      // Parse roles from API response
      const userRoles = getUserRoles(userData.roles_ids);
      const primaryRole = getPrimaryRole(userRoles);

      const user: User = {
        // Core API fields
        user_id: userData.user_id,
        username: userData.username,
        about: userData.about,
        avatar_url: fullAvatarUrl,
        banner_url: fullBannerUrl,
        inbox_id: userData.inbox_id,
        origin_server: userData.origin_server,
        status: userData.status as 'online' | 'idle' | 'afk' | 'dnd' | 'offline',
        roles_ids: userData.roles_ids,
        resolved_roles: userData.resolved_roles,
        resolved_privileges: userData.resolved_privileges,
        last_seen: userData.last_seen,
        joined_servers_ids: userData.joined_servers_ids,
        auth_token: authToken,
        raw_auth_token: authToken,
        auth_token_expire_time: userData.auth_token_expire_time,
        created_at: userData.created_at,
        updated_at: userData.updated_at,

        // Legacy alias fields for backward compatibility
        id: userData.user_id,
        bio: userData.about || 'No bio provided.',
        avatar: fullAvatarUrl,
        password: '', // Not returned by API for security
        conversations: [], // Legacy field
        contacts: [], // Legacy field
        is_admin: hasRole(userRoles, UserRole.ADMIN),
        is_owner: hasRole(userRoles, UserRole.OWNER),
        roles: userRoles,
        joinedAt: userData.created_at,
      };

      return user;
    },
    enabled: !!userId && !!getAuthTokenFromCookies(), // Only run if we have a userId and token
    staleTime: 5 * 60 * 1000, // 5 minutes - consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes after unmount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
};

// Hook to logout user
export const useLogout = () => {
  const queryClient = useQueryClient();

  return {
    logout: () => {
      queryClient.clear();
      authTokenCache = null;
      void logoutCurrentSession();
    }
  };
};

// Server statistics functions
export interface ServerStatsResponse {
  statistics: {
    total_users?: number;
    active_users?: number;
    total_channels?: number;
    total_messages?: number;
    server_health?: number;
    message_rate_per_hour?: number;
    peak_online_users?: number;
    messages_today?: number;
    storage_used?: string;
    channels_created_this_month?: number;
  };
}

export const getServerStats = async (authToken: string): Promise<ApiResponse<ServerStatsResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/system/server-stats');
};
