import { logger } from '../utils/logger';
import { normalizeInstance, resolveInstance } from './instance';

export interface PersistedSessionTokens {
  authToken: string;
  refreshToken?: string;
  authTokenExpireTime?: string;
  refreshTokenExpireTime?: string;
  hostPort?: string;
  rememberMe?: boolean;
  tokenType?: string;
}

export interface RefreshSessionResult {
  success: boolean;
  authToken?: string;
  refreshToken?: string;
  error?: string;
  shouldLogout?: boolean;
}

const AUTH_COOKIE_KEY = 'auth_token';
const HOST_COOKIE_KEY = 'host_port';
const STORAGE_KEYS = {
  refreshToken: 'refresh_token',
  authExpireAt: 'auth_token_expire_time',
  refreshExpireAt: 'refresh_token_expire_time',
  rememberMe: 'remember_me',
  tokenType: 'token_type',
} as const;
const REFRESH_CHECK_INTERVAL_MS = 30_000;
const REFRESH_BUFFER_MS = 2 * 60_000;

let refreshPromise: Promise<RefreshSessionResult> | null = null;
let refreshIntervalId: number | null = null;
let lifecycleListenersAttached = false;
let sessionExpiredHandler: (() => void) | undefined;

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';').map((entry) => entry.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(`${name}=`)) continue;
    const rawValue = cookie.slice(name.length + 1);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
};

const setCookie = (name: string, value: string, expiresAt?: string): void => {
  if (typeof document === 'undefined') return;
  const encodedValue = encodeURIComponent(value);
  const expires =
    expiresAt && !Number.isNaN(Date.parse(expiresAt))
      ? `; expires=${new Date(expiresAt).toUTCString()}`
      : '';
  document.cookie = `${name}=${encodedValue}; path=/; SameSite=Strict${expires}`;
};

const clearCookie = (name: string): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
};

const setStorageValue = (key: string, value: string, persistent: boolean): void => {
  if (typeof window === 'undefined') return;
  if (persistent) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, value);
  localStorage.removeItem(key);
};

const getStorageValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(key) || localStorage.getItem(key);
};

const removeStorageValue = (key: string): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};

const toHttpBaseUrl = (hostPort: string): string => resolveInstance(hostPort).apiBaseUrl;

const getRememberMe = (): boolean => {
  const stored = getStorageValue(STORAGE_KEYS.rememberMe);
  return stored === '1';
};

const getHostPortFromSession = (): string | null => {
  const fromStorage = getStorageValue(HOST_COOKIE_KEY);
  if (fromStorage) return fromStorage;
  const fromCookie = getCookie(HOST_COOKIE_KEY);
  return fromCookie || null;
};

const getRefreshToken = (): string | null => {
  return getStorageValue(STORAGE_KEYS.refreshToken);
};

const getAuthExpireTime = (): string | null => {
  return getStorageValue(STORAGE_KEYS.authExpireAt);
};

const getRefreshExpireTime = (): string | null => {
  return getStorageValue(STORAGE_KEYS.refreshExpireAt);
};

const isExpired = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) return false;
  return Date.now() >= expiresAtMs;
};

const shouldRefreshSoon = (): boolean => {
  const authExpireTime = getAuthExpireTime();
  if (!authExpireTime) return false;
  const authExpireMs = Date.parse(authExpireTime);
  if (Number.isNaN(authExpireMs)) return false;
  return authExpireMs - Date.now() <= REFRESH_BUFFER_MS;
};

const notifySessionExpired = (): void => {
  try {
    sessionExpiredHandler?.();
  } catch (error) {
    logger.auth.error('Session expired callback failed', error);
  }
};

const processSessionLifecycleRefresh = async (): Promise<void> => {
  const authToken = getAuthTokenForRequests();
  if (!authToken) return;
  if (!shouldRefreshSoon()) return;

  const result = await refreshAuthSession('lifecycle_check');
  if (!result.success && result.shouldLogout) {
    notifySessionExpired();
  }
};

const lifecycleRefreshHandler = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  void processSessionLifecycleRefresh();
};

const addLifecycleListeners = (): void => {
  if (typeof window === 'undefined' || lifecycleListenersAttached) return;
  window.addEventListener('focus', lifecycleRefreshHandler);
  window.addEventListener('online', lifecycleRefreshHandler);
  document.addEventListener('visibilitychange', lifecycleRefreshHandler);
  lifecycleListenersAttached = true;
};

const removeLifecycleListeners = (): void => {
  if (typeof window === 'undefined' || !lifecycleListenersAttached) return;
  window.removeEventListener('focus', lifecycleRefreshHandler);
  window.removeEventListener('online', lifecycleRefreshHandler);
  document.removeEventListener('visibilitychange', lifecycleRefreshHandler);
  lifecycleListenersAttached = false;
};

export const getAuthTokenForRequests = (): string | null => {
  return getCookie(AUTH_COOKIE_KEY);
};

export const persistSessionTokens = (tokens: PersistedSessionTokens): void => {
  if (typeof window === 'undefined') return;
  const rememberMe = tokens.rememberMe ?? getRememberMe();

  setCookie(AUTH_COOKIE_KEY, tokens.authToken, tokens.authTokenExpireTime);
  if (tokens.hostPort) {
    const normalizedHost = normalizeInstance(tokens.hostPort);
    setStorageValue(HOST_COOKIE_KEY, normalizedHost, rememberMe);
    setCookie(HOST_COOKIE_KEY, normalizedHost);
  }

  if (tokens.refreshToken) {
    setStorageValue(STORAGE_KEYS.refreshToken, tokens.refreshToken, rememberMe);
  }
  if (tokens.authTokenExpireTime) {
    setStorageValue(STORAGE_KEYS.authExpireAt, tokens.authTokenExpireTime, rememberMe);
  }
  if (tokens.refreshTokenExpireTime) {
    setStorageValue(STORAGE_KEYS.refreshExpireAt, tokens.refreshTokenExpireTime, rememberMe);
  }
  if (tokens.tokenType) {
    setStorageValue(STORAGE_KEYS.tokenType, tokens.tokenType, rememberMe);
  }
  setStorageValue(STORAGE_KEYS.rememberMe, rememberMe ? '1' : '0', rememberMe);
};

export const clearSessionTokens = (): void => {
  clearCookie(AUTH_COOKIE_KEY);
  removeStorageValue(STORAGE_KEYS.refreshToken);
  removeStorageValue(STORAGE_KEYS.authExpireAt);
  removeStorageValue(STORAGE_KEYS.refreshExpireAt);
  removeStorageValue(STORAGE_KEYS.tokenType);
};

export const refreshAuthSession = async (
  reason: string = 'manual'
): Promise<RefreshSessionResult> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    const hostPort = getHostPortFromSession();

    if (!refreshToken) {
      clearSessionTokens();
      return { success: false, error: 'Missing refresh token', shouldLogout: true };
    }
    if (!hostPort) {
      return { success: false, error: 'Missing home instance' };
    }
    if (isExpired(getRefreshExpireTime())) {
      clearSessionTokens();
      return { success: false, error: 'Refresh token expired', shouldLogout: true };
    }

    const refreshUrl = `${toHttpBaseUrl(hostPort)}/api/v1/auth/refresh`;
    logger.auth.debug(`Refreshing auth session (${reason})`);

    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          clearSessionTokens();
        }
        return {
          success: false,
          error: errorText || `Refresh failed with status ${response.status}`,
          shouldLogout: response.status === 401 || response.status === 403,
        };
      }

      const payload = await response.json();
      if (!payload?.auth_token || !payload?.refresh_token) {
        return {
          success: false,
          error: 'Invalid refresh response payload',
          shouldLogout: true,
        };
      }

      persistSessionTokens({
        authToken: payload.auth_token,
        refreshToken: payload.refresh_token,
        authTokenExpireTime: payload.auth_token_expire_time,
        refreshTokenExpireTime: payload.refresh_token_expire_time,
        tokenType: payload.token_type,
        hostPort,
      });

      return {
        success: true,
        authToken: payload.auth_token,
        refreshToken: payload.refresh_token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown refresh error',
      };
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

export const startBackgroundAuthRefresh = (
  onSessionExpired?: () => void
): (() => void) => {
  sessionExpiredHandler = onSessionExpired;
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (refreshIntervalId !== null) {
    return stopBackgroundAuthRefresh;
  }

  addLifecycleListeners();
  void processSessionLifecycleRefresh();

  refreshIntervalId = window.setInterval(() => {
    void processSessionLifecycleRefresh();
  }, REFRESH_CHECK_INTERVAL_MS);

  return stopBackgroundAuthRefresh;
};

export const stopBackgroundAuthRefresh = (): void => {
  if (refreshIntervalId !== null && typeof window !== 'undefined') {
    window.clearInterval(refreshIntervalId);
  }
  refreshIntervalId = null;
  removeLifecycleListeners();
};

export const logoutCurrentSession = async (): Promise<void> => {
  const refreshToken = getRefreshToken();
  const hostPort = getHostPortFromSession();
  clearSessionTokens();

  if (refreshToken && hostPort) {
    const revokeUrl = `${toHttpBaseUrl(hostPort)}/api/v1/auth/revoke`;
    try {
      await fetch(revokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      logger.auth.warn('Failed to revoke refresh token during logout', error);
    }
  }
};
