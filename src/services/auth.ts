import { api, ApiError } from "./api";
import { createLogger } from "../lib/logger";
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

const log = createLogger("auth");

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
      log.warn("stored session is corrupt, ignoring it");
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
  log.debug(`session saved (${remember ? "remembered" : "this tab only"})`, {
    accessExpires: session.authExpiresAt,
    refreshExpires: session.refreshExpiresAt,
  });
}

/**
 * Bumped every time the session is cleared, so a token renewal that was already in flight
 * can tell it lost the race and must not write a fresh session back.
 */
let sessionEpoch = 0;

export function clearAuthToken() {
  sessionEpoch += 1;
  const expired = `${AUTH_TOKEN_KEY}=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = expired;
  // A cookie that was stored as Secure is only replaced by a Secure one, so expire that variant too.
  if (location.protocol === "https:") document.cookie = `${expired}; Secure`;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (getAuthToken()) log.warn("the auth cookie is still there after clearing it");
  else log.info("session cleared");
}

function startSession(tokens: AuthTokens | null, remember: boolean): AuthTokens {
  if (!tokens?.auth_token) {
    log.error("the instance answered a sign-in without a token");
    throw new Error("The instance returned an unexpected response.");
  }
  persistSession(tokens, remember);
  return tokens;
}

export async function login({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  log.info(`signing in as ${username} on ${instance.origin}`);
  const tokens = await api.get<AuthTokens>(`${getApiUrl(instance)}/api/v1/users/signin`, {
    query: { username, password },
  });
  log.info(`signed in as ${username}`);
  return startSession(tokens, remember);
}

export async function signup({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  log.info(`signing up as ${username} on ${instance.origin}`);
  const tokens = await api.post<AuthTokens>(`${getApiUrl(instance)}/api/v1/users/signup`, {
    json: { username, password },
  });
  return startSession(tokens, remember);
}

/**
 * How a refresh went: `renewed`; `rejected` (no refresh token, or the instance refused it, so
 * the user has to sign in again); or `unreachable` (the instance didn't answer, so the session
 * may well still be good once it is back).
 */
export type RenewOutcome = "renewed" | "rejected" | "unreachable";

/** Exchange the stored refresh token for a new pair, saying why when that fails. */
export async function renewSession(): Promise<RenewOutcome> {
  const session = readSession();
  const instance = getStoredInstance();
  if (!session || !instance) {
    log.debug("no session to renew");
    return "rejected";
  }
  log.debug("renewing the session");
  const epoch = sessionEpoch;

  try {
    const data = await api.post<AuthTokens>(`${getApiUrl(instance)}/api/v1/auth/refresh`, {
      json: { refresh_token: session.refreshToken },
    });
    if (epoch !== sessionEpoch) {
      log.info("dropping a session renewal that finished after sign-out");
      return "rejected";
    }
    if (!data?.auth_token) {
      log.warn("session renewal answered without a token");
      return "rejected";
    }
    persistSession({ ...data, refresh_token: data.refresh_token ?? session.refreshToken }, session.remember);
    log.info("session renewed");
    return "renewed";
  } catch (error) {
    const unanswered = error instanceof ApiError && (error.status === 0 || error.status >= 500);
    log.warn(`session renewal ${unanswered ? "got no answer from the instance" : "was refused"}`, error);
    return unanswered ? "unreachable" : "rejected";
  }
}

/** Exchange the stored refresh token for a new pair. Returns false when it can't be refreshed. */
export async function refreshSession(): Promise<boolean> {
  return (await renewSession()) === "renewed";
}

/**
 * Drops the local session first, so signing out never waits on (or depends on) the instance,
 * then revokes the refresh token there as a best effort.
 */
export async function logout(): Promise<void> {
  log.info("signing out");
  const session = readSession();
  const instance = getStoredInstance();
  clearAuthToken();
  if (session && instance) {
    try {
      await api.post(`${getApiUrl(instance)}/api/v1/auth/revoke`, { json: { refresh_token: session.refreshToken } });
    } catch (error) {
      // The local session is cleared regardless.
      log.warn("couldn't revoke the refresh token on the instance", error);
    }
  }
}
