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

export interface GetUserProfileResponse {
  status_code: number;
  user_data: {
    user_id: string;
    username: string;
    password: string;
    status: 'online' | 'offline' | 'idle' | 'inactive';
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
  };
}

export const getCurrentUserProfile = async (hostPort: string, authToken: string): Promise<ApiResponse<GetUserProfileResponse>> => {
  const apiClient = createApiClient(hostPort);
  const userId = extractUserIdFromToken(authToken);
  return apiClient.get('/api/v1/users/profile', {
    user_id: userId,
    auth_token: authToken,
  });
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

export interface UpdateProfileResponse {
  status_code: number;
  message: string;
}

export interface ResetAuthTokenResponse extends UpdateProfileResponse {
  auth_token: string;
  auth_token_expire_time: string;
}

export const updateUsername = async (hostPort: string, request: UpdateUsernameRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const updateUserStatus = async (hostPort: string, request: UpdateStatusRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const updatePassword = async (hostPort: string, request: UpdatePasswordRequest): Promise<ApiResponse<UpdateProfileResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put('/api/v1/users/profile', request as unknown as Record<string, string>);
};

export const resetAuthToken = async (hostPort: string, request: ResetAuthTokenRequest): Promise<ApiResponse<ResetAuthTokenResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.put('/api/v1/users/profile/reset-auth-token', request as unknown as Record<string, string>);
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
  return cookies.hostPort || null;
};

// Profile cache management
class ProfileCache {
  private cache: Map<string, any> = new Map();
  private readonly CACHE_KEY = 'pufferblow_user_profile';
  private readonly CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined') return;

      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data && parsed.timestamp) {
          const age = Date.now() - parsed.timestamp;
          if (age < this.CACHE_EXPIRY) {
            this.cache.set('profile', parsed.data);
          } else {
            // Expired, remove from storage
            localStorage.removeItem(this.CACHE_KEY);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load profile from storage:', error);
      // Clear corrupted data
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.CACHE_KEY);
      }
    }
  }

  private saveToStorage(data: any) {
    try {
      if (typeof window === 'undefined') return;

      const toStore = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn('Failed to save profile to storage:', error);
    }
  }

  get(): any | null {
    return this.cache.get('profile') || null;
  }

  set(data: any) {
    this.cache.set('profile', data);
    this.saveToStorage(data);
  }

  clear() {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.CACHE_KEY);
    }
  }

  has(): boolean {
    return this.cache.has('profile');
  }
}

export const profileCache = new ProfileCache();

// User activity and status management
class UserActivityTracker {
  private activityTimeout: NodeJS.Timeout | null = null;
  private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private isTracking = false;
  private lastActivity = Date.now();

  constructor() {
    this.setupActivityListeners();
    this.setupVisibilityListener();
  }

  private setupActivityListeners() {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      this.lastActivity = Date.now();
      this.resetInactiveTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the inactive timer
    this.resetInactiveTimer();
  }

  private setupVisibilityListener() {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, could be switching tabs or minimizing
        // We'll handle offline status in beforeunload
      } else {
        // Tab is visible again, update status to online and reset activity
        this.lastActivity = Date.now();
        this.resetInactiveTimer();
        // Update status to online when user comes back
        this.updateStatus('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle tab/window close
    const handleBeforeUnload = async () => {
      await this.updateStatus('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  private resetInactiveTimer() {
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    this.activityTimeout = setTimeout(async () => {
      await this.updateStatus('inactive');
    }, this.INACTIVE_TIMEOUT);
  }

  private async updateStatus(status: 'online' | 'offline' | 'idle' | 'inactive') {
    try {
      const hostPort = getHostPortFromCookies() || 'localhost:7575';
      const authToken = getAuthTokenFromCookies();

      if (!authToken) return;

      const response = await updateUserStatus(hostPort, { auth_token: authToken, status });

      if (response.success) {
        // Update cached profile
        const cachedProfile = profileCache.get();
        if (cachedProfile) {
          cachedProfile.status = status;
          profileCache.set(cachedProfile);
        }

        console.log(`Status updated to: ${status}`);
      } else {
        console.error('Failed to update status:', response.error);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  public startTracking() {
    if (!this.isTracking) {
      this.isTracking = true;
      this.lastActivity = Date.now();
      this.resetInactiveTimer();
    }
  }

  public stopTracking() {
    this.isTracking = false;
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }
  }

  public getLastActivity(): number {
    return this.lastActivity;
  }

  public getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivity;
  }
}

export const userActivityTracker = new UserActivityTracker();
