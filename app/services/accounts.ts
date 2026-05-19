/**
 * Persistent registry of accounts the user has signed into across one or
 * more Pufferblow instances. Backed by `localStorage` (keys
 * `pufferblow-accounts` and `pufferblow-active-account-id`) so it survives
 * across desktop / web sessions.
 *
 * Auth tokens are stored alongside the account record because the rest of the
 * codebase already keeps the active token in localStorage / cookies; moving
 * the per-account tokens into a more secure store (Electron keytar, browser
 * `PasswordCredential`, etc.) is a v1.1 hardening item.
 */

import { normalizeInstance } from "./instance";

/** One signed-in identity at one instance. */
export interface SavedAccount {
  /** Stable id derived from `${hostPort}::${userId}`. Used as the React key
   * and the value of the active-account pointer. */
  id: string;
  /** Normalized origin, e.g. "https://chat.example.com". */
  hostPort: string;
  /** The user's server-side `user_id`. */
  userId: string;
  /** Snapshot username at the time of save; refreshed on every `rememberAccount`. */
  username: string;
  /** Long-lived auth token used by the API client. */
  authToken: string;
  /** Optional refresh token, if the auth flow returned one. */
  refreshToken?: string;
  /**
   * ISO timestamp at which the stored `authToken` expires. Used by the
   * multi-account refresher so a backgrounded account can be kept alive
   * without the user switching to it first. Optional because pre-v1.0
   * SavedAccount rows wrote token strings without expiry metadata.
   */
  authTokenExpireTime?: string;
  /** ISO timestamp at which the stored `refreshToken` expires. */
  refreshTokenExpireTime?: string;
  /** OAuth-style token type (Bearer, etc.), echoed by the refresh endpoint. */
  tokenType?: string;
  /** Snapshot avatar URL, may be relative. */
  avatarUrl?: string | null;
  /** Snapshot status at save time. Purely cosmetic. */
  status?: string;
  /** ISO timestamp of last use; updated on every switch. */
  lastUsedAt: string;
}

const ACCOUNTS_KEY = "pufferblow-accounts";
const ACTIVE_ID_KEY = "pufferblow-active-account-id";

const isBrowser = (): boolean => typeof window !== "undefined" && typeof localStorage !== "undefined";

/** Derive the stable id for an account given its instance + user. */
export const buildAccountId = (hostPort: string, userId: string): string => {
  const normalized = (() => {
    try {
      return normalizeInstance(hostPort);
    } catch {
      return hostPort;
    }
  })();
  return `${normalized}::${userId}`;
};

const readAccountsFromStorage = (): SavedAccount[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter to entries that have the required shape; tolerant to schema drift.
    return parsed.filter(
      (entry): entry is SavedAccount =>
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.hostPort === "string" &&
        typeof entry.userId === "string" &&
        typeof entry.username === "string" &&
        typeof entry.authToken === "string",
    );
  } catch {
    return [];
  }
};

const writeAccountsToStorage = (accounts: SavedAccount[]): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("accounts: failed to write account list", error);
  }
};

/** Return all saved accounts, newest-used first. */
export const listAccounts = (): SavedAccount[] => {
  const accounts = readAccountsFromStorage();
  return [...accounts].sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
};

/** Currently-active account id, or null if none has been set. */
export const getActiveAccountId = (): string | null => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_ID_KEY);
};

/** Resolve the active account record, or null. */
export const getActiveAccount = (): SavedAccount | null => {
  const id = getActiveAccountId();
  if (!id) return null;
  return listAccounts().find((account) => account.id === id) ?? null;
};

/**
 * Insert or update an account record. Idempotent on `${hostPort}::${userId}` —
 * a second sign-in for the same identity overwrites stale username/avatar/
 * token fields rather than creating a duplicate row.
 *
 * Also marks the account as active so the next session-restore loads it.
 */
export const rememberAccount = (
  input: Omit<SavedAccount, "id" | "lastUsedAt"> & { lastUsedAt?: string },
): SavedAccount => {
  const normalizedHost = (() => {
    try {
      return normalizeInstance(input.hostPort);
    } catch {
      return input.hostPort;
    }
  })();
  const id = buildAccountId(normalizedHost, input.userId);
  const lastUsedAt = input.lastUsedAt ?? new Date().toISOString();

  const accounts = readAccountsFromStorage();
  const existingIndex = accounts.findIndex((account) => account.id === id);
  const merged: SavedAccount = {
    id,
    hostPort: normalizedHost,
    userId: input.userId,
    username: input.username,
    authToken: input.authToken,
    refreshToken: input.refreshToken,
    authTokenExpireTime: input.authTokenExpireTime,
    refreshTokenExpireTime: input.refreshTokenExpireTime,
    tokenType: input.tokenType,
    avatarUrl: input.avatarUrl ?? null,
    status: input.status,
    lastUsedAt,
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = { ...accounts[existingIndex], ...merged };
  } else {
    accounts.push(merged);
  }
  writeAccountsToStorage(accounts);

  setActiveAccountId(id);
  return merged;
};

/**
 * In-place rewrite of an account's token fields after a successful
 * refresh. Used by the multi-account refresher to update tokens for a
 * non-active account without touching its `lastUsedAt` (which would
 * incorrectly bump the dropdown ordering).
 *
 * No-op if the id isn't in storage.
 */
export const updateAccountTokens = (
  id: string,
  tokens: {
    authToken: string;
    refreshToken?: string;
    authTokenExpireTime?: string;
    refreshTokenExpireTime?: string;
    tokenType?: string;
  },
): void => {
  const accounts = readAccountsFromStorage();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return;
  accounts[index] = {
    ...accounts[index],
    authToken: tokens.authToken,
    refreshToken: tokens.refreshToken ?? accounts[index].refreshToken,
    authTokenExpireTime:
      tokens.authTokenExpireTime ?? accounts[index].authTokenExpireTime,
    refreshTokenExpireTime:
      tokens.refreshTokenExpireTime ?? accounts[index].refreshTokenExpireTime,
    tokenType: tokens.tokenType ?? accounts[index].tokenType,
  };
  writeAccountsToStorage(accounts);
};

/** Remove an account from the registry. Clears the active pointer if it was active. */
export const forgetAccount = (id: string): void => {
  const accounts = readAccountsFromStorage().filter((account) => account.id !== id);
  writeAccountsToStorage(accounts);
  if (getActiveAccountId() === id) {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACTIVE_ID_KEY);
  }
};

/** Mark `id` as the active account; pass `null` to clear. */
export const setActiveAccountId = (id: string | null): void => {
  if (!isBrowser()) return;
  if (id === null) {
    window.localStorage.removeItem(ACTIVE_ID_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_ID_KEY, id);
};

/**
 * Touch an account's `lastUsedAt` to `now`. Use after a successful switch so
 * the dropdown shows the most-recently-used identity at the top.
 */
export const touchAccount = (id: string): void => {
  const accounts = readAccountsFromStorage();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return;
  accounts[index] = { ...accounts[index], lastUsedAt: new Date().toISOString() };
  writeAccountsToStorage(accounts);
};
