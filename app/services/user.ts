import type { ApiResponse } from './apiClient';
import { ApiClient, createApiClient } from './apiClient';
import type { User } from '../models';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

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
  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseUrl = isDevelopment ? '' : `http://${hostPort}`;
  const apiClient = new ApiClient(baseUrl);
  return apiClient.get('/api/v1/users/signin', credentials as unknown as Record<string, string>);
};

export const signup = async (hostPort: string, credentials: SignupCredentials): Promise<ApiResponse<AuthToken>> => {
  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseUrl = isDevelopment ? '' : `http://${hostPort}`;
  const apiClient = new ApiClient(baseUrl);
  return apiClient.post(`/api/v1/users/signup?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`);
};

export const getUserProfile = async (userId: string, authToken: string): Promise<ApiResponse<UserProfile>> => {
  const apiClient = createApiClient();
  return apiClient.get('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
};

export interface GetUserProfileResponse {
  status_code: number;
  user_data: {
    user_id: string;
    username: string;
    password: string;
    about: string;
    avatar_url: string;
    banner_url: string;
    status: 'online' | 'offline' | 'idle' | 'dnd';
    origin_server: string;
    inbox_id: string;
    roles_ids: string[];
    last_seen: string;
    joined_servers_ids: any[];
    auth_token: string;
    auth_token_expire_time: string;
    created_at: string;
    updated_at: string;
  };
}

export const getUserProfileById = async (userId: string, authToken: string): Promise<ApiResponse<GetUserProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/users/profile?user_id=${encodeURIComponent(userId)}&auth_token=${encodeURIComponent(authToken)}`);
};

export const getCurrentUserProfile = async (authToken: string): Promise<ApiResponse<GetUserProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/users/profile?user_id=${encodeURIComponent(extractUserIdFromToken(authToken))}&auth_token=${encodeURIComponent(authToken)}`);
};

export interface ListUsersResponse {
  status_code: number;
  users: Array<{
    user_id: string;
    username: string;
    status: 'online' | 'offline' | 'idle' | 'inactive' | 'dnd';
    last_seen: string;
    conversations: any[];
    contacts: any[];
    joined_servers_ids: any[];
    auth_token: string;
    auth_token_expire_time: string;
    created_at: string;
    updated_at: string;
    is_admin: boolean;
    is_owner: boolean;
  }>;
}

export const listUsers = async (authToken: string): Promise<ApiResponse<ListUsersResponse>> => {
  const apiClient = createApiClient();
  return apiClient.get(`/api/v1/users/list?auth_token=${encodeURIComponent(authToken)}`);
};

// Update user profile functions
export interface UpdateUsernameRequest {
  auth_token: string;
  new_username: string;
}

export interface UpdateStatusRequest {
  auth_token: string;
  status: 'online' | 'offline' | 'idle' | 'inactive';
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
  auth_token_expire_time: string;
}

export const updateUsername = async (request: UpdateUsernameRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const updateUserStatus = async (request: UpdateStatusRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const updatePassword = async (request: UpdatePasswordRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const resetAuthToken = async (request: ResetAuthTokenRequest): Promise<ApiResponse<ResetAuthTokenResponse>> => {
  const apiClient = createApiClient();
  return apiClient.put('/api/v1/users/profile/reset-auth-token', request as unknown as Record<string, string>);
};

export const updateAvatar = async (request: UpdateAvatarRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  const formData = new FormData();

  formData.append('auth_token', request.auth_token);
  if (request.avatar) {
    if (request.avatar instanceof File) {
      formData.append('avatar', request.avatar);
    } else {
      formData.append('avatar_url', request.avatar);
    }
  }

  return apiClient.put('/api/v1/users/profile/avatar', formData as unknown as Record<string, string>);
};

export const updateBanner = async (request: UpdateBannerRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient();
  const formData = new FormData();

  formData.append('auth_token', request.auth_token);
  if (request.banner) {
    if (request.banner instanceof File) {
      formData.append('banner', request.banner);
    } else {
      formData.append('banner_url', request.banner);
    }
  }

  return apiClient.put('/api/v1/users/profile/banner', formData as unknown as Record<string, string>);
};

// Utility functions
export const extractUserIdFromToken = (authToken: string): string => {
  return authToken.split('.')[0];
};

export const getAuthTokenFromCookies = (): string | null => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);
  return cookies.authToken || null;
};

export const getHostPortFromCookies = (): string | null => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);
  return cookies.serverHostPort || null;
};

export const getHostPortFromStorage = (): string | null => {
  // First check cookies (both must match persistence)
  let hostPort = getHostPortFromCookies();
  if (hostPort) return decodeURIComponent(hostPort);
  // Then check storage
  if (typeof window !== 'undefined') {
    // First check sessionStorage (for non-remember me)
    hostPort = sessionStorage.getItem('serverHostPort');
    if (hostPort) return hostPort;
    // Then localStorage (for remember me)
    return localStorage.getItem('serverHostPort');
  }
  return null;
};

export const setHostPortToStorage = (hostPort: string, persistent: boolean = false): void => {
  if (typeof window === 'undefined') return;
  if (persistent) {
    localStorage.setItem('serverHostPort', hostPort);
    // Clear sessionStorage if setting persistent
    sessionStorage.removeItem('serverHostPort');
  } else {
    sessionStorage.setItem('serverHostPort', hostPort);
    // Clear localStorage if setting session
    localStorage.removeItem('serverHostPort');
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
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const response = await getCurrentUserProfile(authToken);
      if (!response.success || !response.data?.user_data) {
        throw new Error(response.error || 'Failed to fetch user profile');
      }

      const userData = response.data.user_data;
      // Generate avatar URL using DiceBear Bottts Neutral style
      const avatarUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(userData.username)}&backgroundColor=5865f2`;

    // Use avatar_url if available, otherwise generate one
    const finalAvatarUrl = userData.avatar_url || avatarUrl;

    // Assign roles based on API data - use roles_ids and check for admin/owner roles
    const defaultRoles = ['Member'];
    if (userData.roles_ids?.includes('owner') || userData.roles_ids?.includes('Owner')) {
      defaultRoles.push('Owner');
    }
    if (userData.roles_ids?.includes('admin') || userData.roles_ids?.includes('Admin')) {
      defaultRoles.push('Admin');
    }

    const user: User = {
      id: userData.user_id,
      username: userData.username,
      avatar: finalAvatarUrl,
      status: userData.status as 'online' | 'idle' | 'dnd' | 'offline',
      bio: userData.about || 'Passionate about decentralized technology and building the future of secure communication.',
      joinedAt: userData.created_at,
      roles: defaultRoles
    } as unknown as User;

      return user;
    },
    enabled: !!getAuthTokenFromCookies(), // Only run if we have a token
    staleTime: 0, // No caching, always fetch fresh data
    gcTime: 0, // No garbage collection, remove immediately
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

// Hook to update status
export const useUpdateStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: 'online' | 'offline' | 'idle' | 'dnd') => {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) throw new Error('No authentication token');

      const apiStatus = status === 'dnd' ? 'offline' : status; // Map dnd to offline for API
      const response = await updateUserStatus({ auth_token: authToken, status: apiStatus as any });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update status');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch current user profile
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.currentProfile() });
    },
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
    onSuccess: () => {
      // Clear query cache after token reset
      queryClient.clear();
    },
  });
};

// Hook to logout user
export const useLogout = () => {
  const queryClient = useQueryClient();

  return {
    logout: () => {
      queryClient.clear();
      // Additional cleanup can be added here
    }
  };
};

// User activity tracker hook - replaced with simple activity management
export const useActivityTracker = () => {
  const updateStatusMutation = useUpdateStatus();
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    const INACTIVE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    inactivityTimeoutRef.current = setTimeout(() => {
      updateStatusMutation.mutate('idle');
    }, INACTIVE_TIMEOUT);
  };

  const recordActivity = () => {
    lastActivityRef.current = Date.now();
    updateStatusMutation.mutate('online');
    resetInactivityTimer();
  };

  useEffect(() => {
    // Setup activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, recordActivity, { passive: true });
    });

    // Setup visibility listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden
      } else {
        // Tab is visible again
        recordActivity();
        updateStatusMutation.mutate('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Setup beforeunload
    const handleBeforeUnload = () => {
      updateStatusMutation.mutate('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Start tracking
    recordActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, []);

  return {
    recordActivity,
    lastActivity: lastActivityRef.current,
  };
};
