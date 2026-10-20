import { api, ApiError } from "./api";
import { createLogger } from "../lib/logger";
import { getApiUrl, getStoredInstance, setStoredInstance } from "./instance";
import type { InstanceConfig } from "./types";

/** Flat body returned by `POST /users/signin`, `POST /users/signup` and `POST /auth/refresh`. */
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
const ACTIVE_ACCOUNT_KEY = "pb_active_account";

export interface StoredSession {
  /**
   * Null when the desktop app's main process holds it (`electron/sessionVault.ts`): the page then
   * never sees the long-lived credential, only the access tokens the main process hands back.
   */
  refreshToken: string | null;
  authExpiresAt: string | null;
  refreshExpiresAt: string | null;
  remember: boolean;
}

/** A person on an instance, the same name wherever it is used: "ada@chat.example:7575". */
export function accountIdFor(username: string, instance: InstanceConfig): string {
  return `${username.trim().toLowerCase()}@${instance.raw}`;
}

/** Which saved account the live session belongs to, or null for one from before accounts. */
export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setActiveAccountId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    else localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  } catch {
    log.warn("couldn't remember which account is active");
  }
}

/** A saved copy of the live session, so another account can take its place and be switched back to. */
export interface SessionSnapshot {
  authToken: string;
  session: StoredSession;
}

export function snapshotSession(): SessionSnapshot | null {
  const session = readSession();
  const authToken = getAuthToken();
  return session && authToken ? { authToken, session } : null;
}

/** Make a saved session the live one. In the desktop app the caller also activates it in the vault. */
export function restoreSession({ authToken, session }: SessionSnapshot): void {
  writeSession(
    { auth_token: authToken, auth_token_expire_time: session.authExpiresAt ?? undefined, refresh_token_expire_time: session.refreshExpiresAt ?? undefined },
    session.remember,
    session.refreshToken,
  );
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

/** The desktop app's refresh-token vault, when running there. */
const vault = () => (typeof window === "undefined" ? undefined : window.electron?.session);

function storedApiUrl(): string | null {
  const instance = getStoredInstance();
  return instance ? getApiUrl(instance) : null;
}

/**
 * Persist a session. With "remember me" the cookie lives as long as the refresh
 * token; without it, only as long as the (short-lived) access token.
 *
 * In the desktop app the refresh token goes to the main process, encrypted with the OS
 * keychain, and is not kept here; a browser, or a system without a keychain, keeps it in web
 * storage. `apiUrl` is the instance the refresh token belongs to (the stored instance by default).
 */
export async function persistSession(
  tokens: AuthTokens,
  remember: boolean,
  apiUrl = storedApiUrl(),
  /** Runs in the same tick the session is written, so the token and the instance it belongs to change together. */
  commit?: () => void,
): Promise<void> {
  const bridge = vault();
  if (bridge && apiUrl && tokens.refresh_token) {
    const epoch = sessionEpoch;
    const stored = await bridge.store(apiUrl, tokens.refresh_token, remember, getActiveAccountId() ?? undefined).catch(() => false);
    if (epoch !== sessionEpoch) return; // signed out meanwhile (which also cleared the vault)
    if (stored) {
      writeSession(tokens, remember, null);
      commit?.();
      return;
    }
    log.warn("no OS keychain for the session, keeping it in web storage");
  }
  writeSession(tokens, remember, tokens.refresh_token);
  commit?.();
}

type AccessTokens = Pick<AuthTokens, "auth_token" | "auth_token_expire_time" | "refresh_token_expire_time">;

function writeSession(tokens: AccessTokens, remember: boolean, refreshToken: string | null): void {
  const authExpiry = parseDate(tokens.auth_token_expire_time);
  const refreshExpiry = parseDate(tokens.refresh_token_expire_time);
  const cookieExpiry = remember ? (refreshExpiry ?? authExpiry) : authExpiry;

  const secure = location.protocol === "https:" ? "; Secure" : "";
  const expires = cookieExpiry ? `; Expires=${cookieExpiry.toUTCString()}` : "";
  document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(tokens.auth_token)}; Path=/; SameSite=Lax${expires}${secure}`;

  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const session: StoredSession = {
    refreshToken,
    authExpiresAt: authExpiry?.toISOString() ?? null,
    refreshExpiresAt: refreshExpiry?.toISOString() ?? null,
    remember,
  };
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  log.debug(`session saved (${remember ? "remembered" : "this tab only"}${refreshToken === null ? ", refresh token in the OS keychain" : ""})`, {
    accessExpires: session.authExpiresAt,
    refreshExpires: session.refreshExpiresAt,
  });
}

/**
 * Bumped every time the session is cleared, so a token renewal that was already in flight
 * can tell it lost the race and must not write a fresh session back.
 */
let sessionEpoch = 0;

const clearedListeners = new Set<() => void>();

/** Run `listener` whenever the live session is cleared (sign-out, or a session the instance refused). */
export function onSessionCleared(listener: () => void): void {
  clearedListeners.add(listener);
}

export function clearAuthToken() {
  sessionEpoch += 1;
  clearedListeners.forEach((listener) => listener());
  const expired = `${AUTH_TOKEN_KEY}=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = expired;
  // A cookie that was stored as Secure is only replaced by a Secure one, so expire that variant too.
  if (location.protocol === "https:") document.cookie = `${expired}; Secure`;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  void vault()?.clear().catch(() => undefined);
  if (getAuthToken()) log.warn("the auth cookie is still there after clearing it");
  else log.info("session cleared");
}

async function startSession(tokens: AuthTokens | null, remember: boolean, instance: InstanceConfig, username: string): Promise<AuthTokens> {
  if (!tokens?.auth_token) {
    log.error("the instance answered a sign-in without a token");
    throw new Error("The instance returned an unexpected response.");
  }
  // The new session is the active account from here on (an earlier one was saved before sign-in).
  setActiveAccountId(accountIdFor(username, instance));
  // The instance is only changed together with the session: a sign-in that fails must leave the
  // live session pointing at the instance its token belongs to.
  await persistSession(tokens, remember, getApiUrl(instance), () => setStoredInstance(instance));
  return tokens;
}

export async function login({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  log.info(`signing in as ${username} on ${instance.origin}`);
  const url = `${getApiUrl(instance)}/api/v1/users/signin`;
  let tokens: AuthTokens;
  try {
    // In the body, never the URL: query strings end up in access logs, proxies and history.
    tokens = await api.post<AuthTokens>(url, { json: { username, password } });
  } catch (error) {
    // An instance from before POST sign-in existed only knows the query form.
    if (!(error instanceof ApiError && error.status === 405)) throw error;
    log.warn("this instance only accepts sign-in in the URL; update it to keep passwords out of its logs");
    tokens = await api.get<AuthTokens>(url, { query: { username, password } });
  }
  log.info(`signed in as ${username}`);
  return startSession(tokens, remember, instance, username);
}

export async function signup({ username, password, instance, remember }: Credentials): Promise<AuthTokens> {
  log.info(`signing up as ${username} on ${instance.origin}`);
  const tokens = await api.post<AuthTokens>(`${getApiUrl(instance)}/api/v1/users/signup`, {
    json: { username, password },
  });
  return startSession(tokens, remember, instance, username);
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

  if (session.refreshToken === null) return renewThroughVault(session, epoch);

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
    await persistSession({ ...data, refresh_token: data.refresh_token ?? session.refreshToken }, session.remember, getApiUrl(instance));
    log.info("session renewed");
    return "renewed";
  } catch (error) {
    const unanswered = error instanceof ApiError && (error.status === 0 || error.status >= 500);
    log.warn(`session renewal ${unanswered ? "got no answer from the instance" : "was refused"}`, error);
    return unanswered ? "unreachable" : "rejected";
  }
}

/** Renewal for a desktop session: the main process holds the refresh token and does the call. */
async function renewThroughVault(session: StoredSession, epoch: number): Promise<RenewOutcome> {
  const bridge = vault();
  if (!bridge) return "rejected";
  const result = await bridge.refresh().catch(() => ({ outcome: "unreachable" as const }));
  if (epoch !== sessionEpoch) {
    log.info("dropping a session renewal that finished after sign-out");
    return "rejected";
  }
  if (result.outcome !== "renewed") {
    log.warn(`session renewal ${result.outcome === "unreachable" ? "got no answer from the instance" : "was refused"}`);
    return result.outcome;
  }
  writeSession(result.tokens, session.remember, null);
  log.info("session renewed");
  return "renewed";
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
  // A desktop session is revoked by the main process, which holds its refresh token. Queued first,
  // so it reads the token before clearAuthToken() below asks the main process to forget it.
  if (session?.refreshToken === null) void vault()?.revoke().catch(() => undefined);
  clearAuthToken();
  if (session?.refreshToken && instance) {
    try {
      await api.post(`${getApiUrl(instance)}/api/v1/auth/revoke`, { json: { refresh_token: session.refreshToken } });
    } catch (error) {
      // The local session is cleared regardless.
      log.warn("couldn't revoke the refresh token on the instance", error);
    }
  }
}
