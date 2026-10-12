import { api } from "./api";
import { getApiUrl, getStoredInstance } from "./instance";
import type { InstanceConfig } from "./types";

/** Flat body returned by `GET /users/signin`, `POST /users/signup` and `POST /auth/refresh`. */
export interface AuthTokens {
  auth_token: string;
  refresh_token: string;
  token_type?: string;
  auth_token_expire_time?: string;
  refresh_token_expire_time?: string;
}

export interface Credentials {
  username: string;
  password: string;
  instance: InstanceConfig;
  remember: boolean;
}

const AUTH_TOKEN_KEY = "auth_token";
const SESSION_KEY = "pb_session";

interface StoredSession {
  refreshToken: string;
  authExpiresAt: string | null;
  refreshExpiresAt: string | null;
  remember: boolean;
}

function readSession(): StoredSession | null {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw) as StoredSession;
    } catch {
      /* ignore corrupt entry */
    }
  }
  return null;
}

/** Whether this device chose "stay signed in" at login (defaults to true when unknown). */
export function isSessionRemembered(): boolean {
  return readSession()?.remember ?? true;
}

/** Milliseconds until the access token expires, or null when unknown / signed out. */
export function msUntilAuthExpiry(): number | null {
  const expiresAt = parseDate(readSession()?.authExpiresAt);
  return expiresAt ? expiresAt.getTime() - Date.now() : null;
}

export function getAuthToken(): string | null {
  const value = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${AUTH_TOKEN_KEY}=`))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Persist a session. With "remember me" the cookie lives as long as the refresh
 * token; without it, only as long as the (short-lived) access token.
 */
export function persistSession(tokens: AuthTokens, remember: boolean): void {
  const authExpiry = parseDate(tokens.auth_token_expire_time);
  const refreshExpiry = parseDate(tokens.refresh_token_expire_time);
  const cookieExpiry = remember ? (refreshExpiry ?? authExpiry) : authExpiry;

  const secure = location.protocol === "https:" ? "; Secure" : "";
  const expires = cookieExpiry ? `; Expires=${cookieExpiry.toUTCString()}` : "";
  document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(tokens.auth_token)}; Path=/; SameSite=Lax${expires}${secure}`;

  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const session: StoredSession = {
    refreshToken: tokens.refresh_token,
    authExpiresAt: authExpiry?.toISOString() ?? null,
    refreshExpiresAt: refreshExpiry?.toISOString() ?? null,
    remember,
  };
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAuthToken() {
  document.cookie = `${AUTH_TOKEN_KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function startSession(tokens: AuthTokens | null, remember: boolean): AuthTokens {
  if (!tokens?.auth_token) throw new Error("The instance returned an unexpected response.");
  persistSession(tokens, remember);
  return tokens;
}

export async function login({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  const tokens = await api.get<AuthTokens>(`${getApiUrl(instance)}/api/v1/users/signin`, {
    query: { username, password },
  });
  return startSession(tokens, remember);
}

export async function signup({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  const tokens = await api.post<AuthTokens>(`${getApiUrl(instance)}/api/v1/users/signup`, {
    json: { username, password },
  });
  return startSession(tokens, remember);
}

/** Exchange the stored refresh token for a new pair. Returns false when it can't be refreshed. */
export async function refreshSession(): Promise<boolean> {
  const session = readSession();
  const instance = getStoredInstance();
  if (!session || !instance) return false;

  try {
    const data = await api.post<AuthTokens>(`${getApiUrl(instance)}/api/v1/auth/refresh`, {
      json: { refresh_token: session.refreshToken },
    });
    if (!data?.auth_token) return false;
    persistSession({ ...data, refresh_token: data.refresh_token ?? session.refreshToken }, session.remember);
    return true;
  } catch {
    return false;
  }
}

/** Revoke the refresh token server-side (best effort), then drop the local session. */
export async function logout(): Promise<void> {
  const session = readSession();
  const instance = getStoredInstance();
  if (session && instance) {
    try {
      await api.post(`${getApiUrl(instance)}/api/v1/auth/revoke`, { json: { refresh_token: session.refreshToken } });
    } catch {
      // The local session is cleared regardless.
    }
  }
  clearAuthToken();
}
