import { createLogger } from "../lib/logger";
import {
  accountIdFor,
  getActiveAccountId,
  getAuthToken,
  logout,
  onSessionCleared,
  restoreSession,
  setActiveAccountId,
  snapshotSession,
  type SessionSnapshot,
} from "./auth";
import { getStoredInstance, setStoredInstance } from "./instance";
import type { InstanceConfig } from "./types";

/**
 * One account per instance, several instances. The live session (the cookie, `pb_session`, the
 * stored instance) is always the active account; every other account is kept here as a saved copy
 * of that session. Switching saves the live one, makes the chosen copy live, and reloads the app so
 * every query and the realtime connection start clean for the new person.
 */

const log = createLogger("accounts");
const KEY = "pb_accounts";

/**
 * What makes an entry a server joined with an account from somewhere else, not an account of its own: whose account it
 * was joined with (`homeId`), who that person is there (`handle`, as `name@home`), and whether they are in or waiting.
 */
export interface Membership {
  homeId: string;
  handle: string;
  status: "joined" | "pending";
  /** The request while it waits, to ask after it. */
  requestId?: string;
  serverName?: string;
}

export interface Account {
  id: string;
  username: string;
  avatarUrl: string | null;
  instance: InstanceConfig;
  /** The session as it was when the account was last live. Null if it was not kept (or a request still waits). */
  snapshot: SessionSnapshot | null;
  /** Set for a joined server; absent for a person's own account. */
  membership?: Membership;
}

const vault = () => (typeof window === "undefined" ? undefined : window.electron?.session);

function readList(store: Storage): Account[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Account[]).filter((a) => a && typeof a.id === "string" && a.instance?.origin) : [];
  } catch {
    log.warn("the saved account list is unreadable, starting over");
    return [];
  }
}

/** The accounts that are people's own, not servers joined with one of them. */
export const listPeople = (): Account[] => listAccounts().filter((a) => !a.membership);

/** The servers joined with accounts from elsewhere, optionally only those joined with one account. */
export const listMemberships = (homeId?: string): Account[] => listAccounts().filter((a) => a.membership && (homeId === undefined || a.membership.homeId === homeId));

/** The account a server was joined with. A person's own account is its own home. */
export function homeOf(account: Account): Account | undefined {
  return account.membership ? listAccounts().find((a) => a.id === account.membership!.homeId) : account;
}

/** Every saved account. A session that was not to be remembered lives in this tab's storage only. */
export function listAccounts(): Account[] {
  const tab = readList(sessionStorage);
  const tabIds = new Set(tab.map((a) => a.id));
  return [...tab, ...readList(localStorage).filter((a) => !tabIds.has(a.id))].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * A saved session keeps the lifetime its owner chose at sign-in: "stay signed in" ones may be kept
 * on this device, the others only for as long as this tab.
 */
function save(accounts: Account[]): void {
  const forTab = accounts.filter((a) => a.snapshot?.session.remember === false);
  const forDevice = accounts.filter((a) => a.snapshot?.session.remember !== false);
  try {
    localStorage.setItem(KEY, JSON.stringify(forDevice));
    sessionStorage.setItem(KEY, JSON.stringify(forTab));
  } catch (error) {
    log.warn("couldn't save the account list", error);
  }
}

// A session that is cleared (signed out, or refused by its instance) must not linger as a copy that
// could be switched back to: its account stays listed, but has to sign in again.
onSessionCleared(() => {
  const id = getActiveAccountId();
  if (!id) return;
  const accounts = listAccounts();
  if (accounts.some((a) => a.id === id && a.snapshot)) save(accounts.map((a) => (a.id === id ? { ...a, snapshot: null } : a)));
});

/** Save a joined server (or change it: a request that was approved, a session that was renewed). */
export function saveMembership(account: Account): void {
  upsert(account);
}

/** Forget a joined server. Its desktop session goes with it. */
export async function dropMembership(id: string): Promise<void> {
  save(listAccounts().filter((a) => a.id !== id));
  await vault()?.forget(id).catch(() => undefined);
}

function upsert(account: Account): void {
  const rest = listAccounts().filter((a) => a.id !== account.id);
  save([account, ...rest].sort((a, b) => a.id.localeCompare(b.id)));
}

/**
 * Keep the live session's account up to date in the list. Called whenever the signed-in person's
 * profile is known. A session from before accounts existed gets its name here (and in the desktop
 * vault, where it was stored as the default account).
 */
export async function rememberActiveAccount(profile: { username: string; avatar_url?: string | null }): Promise<void> {
  const instance = getStoredInstance();
  if (!instance) return;
  const id = accountIdFor(profile.username, instance);
  const bridge = vault();
  if (getActiveAccountId() === null) {
    setActiveAccountId(id);
    // Only a vault that actually holds the old, unnamed session can rename it.
    await bridge?.rename("default", id).catch(() => false);
  } else if (getActiveAccountId() !== id) {
    // The profile belongs to someone else (a username change would land here too): follow it.
    setActiveAccountId(id);
  }
  const kept = listAccounts().find((a) => a.id === id)?.membership;
  upsert({ id, username: profile.username, avatarUrl: profile.avatar_url ?? null, instance, snapshot: snapshotSession(), ...(kept ? { membership: kept } : {}) });
}

/** Save the live session, so a different sign-in can replace it and this one can come back. */
export function saveActiveAccount(): void {
  const id = getActiveAccountId();
  const live = listAccounts().find((a) => a.id === id);
  const snapshot = snapshotSession();
  if (live && snapshot) upsert({ ...live, snapshot });
}

/** Make `id` the live account and reload. Resolves false (and changes nothing) if it cannot be. */
export async function switchAccount(id: string): Promise<boolean> {
  const target = listAccounts().find((a) => a.id === id);
  if (!target?.snapshot) {
    log.warn(`no saved session for ${id}`);
    return false;
  }
  saveActiveAccount();
  // Desktop sessions keep their refresh token in the main process, which must know who is active.
  if (target.snapshot.session.refreshToken === null && !(await vault()?.activate(id).catch(() => false))) {
    log.warn(`the desktop vault has no session for ${id}`);
    return false;
  }
  setStoredInstance(target.instance);
  restoreSession(target.snapshot);
  setActiveAccountId(id);
  log.info(`switched to ${id}`);
  return true;
}

/** Forget a saved account, never the live one (that is signing out). With nobody signed in, any can go. */
export async function removeAccount(id: string): Promise<void> {
  if (id === getActiveAccountId() && getAuthToken() !== null) return;
  // The servers joined with an account go when it does: there is nobody left to vouch for them.
  const gone = new Set(listAccounts().filter((a) => a.id === id || a.membership?.homeId === id).map((a) => a.id));
  save(listAccounts().filter((a) => !gone.has(a.id)));
  await Promise.all([...gone].map((goneId) => vault()?.forget(goneId).catch(() => undefined)));
}

/**
 * Sign the live account out. If another account is saved it becomes live; the result says where
 * the app should go: "switched" (reload into the new account) or "signed-out" (the login page).
 */
export async function signOutActiveAccount(): Promise<"switched" | "signed-out"> {
  const id = getActiveAccountId();
  const active = listAccounts().find((a) => a.id === id);
  // Signing out of a joined server leaves the account it was joined with alone; signing out of an account takes its servers.
  const leaving = active?.membership ? [id] : listAccounts().filter((a) => a.id === id || a.membership?.homeId === id).map((a) => a.id);
  await logout();
  if (id) save(listAccounts().filter((a) => !leaving.includes(a.id)));
  setActiveAccountId(null);
  const next = active?.membership ? listAccounts().find((a) => a.id === active.membership!.homeId && a.snapshot) : listPeople().find((a) => a.snapshot);
  if (next && (await switchAccount(next.id))) return "switched";
  return "signed-out";
}
