import { createLogger } from "../lib/logger";
import { api, ApiError } from "./api";
import { homeOf, listAccounts, dropMembership, saveMembership, type Account } from "./accounts";
import { accountIdFor, getActiveAccountId, getAuthToken, snapshotFromTokens, type AuthTokens } from "./auth";
import { getApiUrl, getStoredInstance } from "./instance";
import type { InstanceConfig } from "./types";
import type { ServerInfo } from "../features/server/types";

/**
 * Joining a server with the account you already have. Nothing is created on the server and there is no password: the
 * account's own server signs a short statement ("this is alice@home, and she wants to join that server"), the server
 * being joined checks it, and answers with a session of its own, or says the request is waiting for a moderator.
 *
 * A joined server is saved next to the accounts (see `Membership`); opening it is switching to it, like switching accounts.
 */

const log = createLogger("servers");

/** The account the join is made with, and what it needs to be asked: its server, and a sign-in that still works. */
export interface HomeSession {
  account: Account | null;
  /** `name@server`, as the people on the server joined will see them. */
  handle: string;
  instance: InstanceConfig;
  token: string;
}

/** The home server's sign-in has run out. Only the live account can renew its own, so it has to be opened again. */
export class HomeSessionExpired extends Error {
  constructor(public home: Account | null) {
    super("Your sign-in on your own server has expired. Open it once to renew it, then try again.");
    this.name = "HomeSessionExpired";
  }
}

export class NotSignedIn extends Error {
  constructor() {
    super("Sign in first.");
    this.name = "NotSignedIn";
  }
}

/** Who is joining: the live account, or if the live one is itself a joined server, the account it was joined with. */
export function resolveHome(): HomeSession | null {
  const accounts = listAccounts();
  const activeId = getActiveAccountId();
  const active = accounts.find((a) => a.id === activeId);
  const home = active ? homeOf(active) : undefined;
  if (home) {
    const live = home.id === activeId;
    const token = live ? getAuthToken() : (home.snapshot?.authToken ?? null);
    return token ? { account: home, handle: `${home.username}@${home.instance.raw}`, instance: home.instance, token } : null;
  }
  // A session from before accounts were kept: the live one is all there is.
  const instance = getStoredInstance();
  const token = getAuthToken();
  return instance && token ? { account: null, handle: `you@${instance.raw}`, instance, token } : null;
}

interface JoinResponse extends AuthTokens {
  status: "joined" | "pending";
  request_id?: string;
  user?: { user_id: string; username: string };
}

export type JoinResult = { kind: "joined"; accountId: string } | { kind: "pending"; accountId: string };

const sameServer = (a: InstanceConfig, b: InstanceConfig) => a.raw.toLowerCase() === b.raw.toLowerCase() || a.origin.toLowerCase() === b.origin.toLowerCase();

const pendingId = (home: HomeSession, instance: InstanceConfig) => `pending:${home.account?.id ?? "home"}>${instance.raw}`;

/** The server's own name for itself, which is what an assertion has to be addressed to (not however it was typed). */
const addressOf = (instance: InstanceConfig, info: Pick<ServerInfo, "server_id"> | undefined) => info?.server_id || instance.raw;

async function assertionFor(home: HomeSession, audience: string): Promise<string> {
  try {
    const { assertion } = await api.post<{ assertion: string }>(`${getApiUrl(home.instance)}/api/v1/federation/assertions`, { json: { auth_token: home.token, audience } });
    return assertion;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.code === "auth.invalid_token")) throw new HomeSessionExpired(home.account);
    throw error;
  }
}

async function settle(home: HomeSession, instance: InstanceConfig, response: JoinResponse, serverName?: string): Promise<JoinResult> {
  const handle = home.handle;
  const homeId = home.account?.id ?? "";
  if (response.status === "pending") {
    const account: Account = {
      id: pendingId(home, instance),
      username: handle,
      avatarUrl: null,
      instance,
      snapshot: null,
      membership: { homeId, handle, status: "pending", requestId: response.request_id, serverName },
    };
    saveMembership(account);
    return { kind: "pending", accountId: account.id };
  }
  if (!response.user?.username || !response.auth_token) throw new Error("The server returned an unexpected response.");
  const id = accountIdFor(response.user.username, instance);
  const snapshot = await snapshotFromTokens(response, true, getApiUrl(instance), id);
  saveMembership({ id, username: response.user.username, avatarUrl: null, instance, snapshot, membership: { homeId, handle, status: "joined", serverName } });
  await dropMembership(pendingId(home, instance));
  // The account's own server keeps the list of what it has joined, so the list follows the account to other devices.
  void api.post(`${getApiUrl(home.instance)}/api/v1/users/joined-servers`, { json: { auth_token: home.token, target: instance.raw } }).catch(() => undefined);
  log.info(`joined ${instance.raw} as ${handle}`);
  return { kind: "joined", accountId: id };
}

/**
 * Join `instance` with the account in use. `info` is what the server said about itself (its public info), so the
 * assertion is addressed to the name the server uses for itself.
 */
export async function joinServer(instance: InstanceConfig, info: Pick<ServerInfo, "server_id" | "server_name"> | undefined, options: { inviteCode?: string; message?: string } = {}): Promise<JoinResult> {
  const home = resolveHome();
  if (!home) throw new NotSignedIn();
  if (sameServer(instance, home.instance)) throw new Error("That is your own server.");
  const assertion = await assertionFor(home, addressOf(instance, info));
  const response = await api.post<JoinResponse>(`${getApiUrl(instance)}/api/v1/federation/join`, {
    json: { assertion, invite_code: options.inviteCode?.trim() || undefined, message: options.message?.trim() || undefined },
  });
  return settle(home, instance, response, info?.server_name);
}

/** Ask again about a request that was waiting. Resolves with what it is now; a refusal removes the entry and throws. */
export async function checkRequest(account: Account, info?: Pick<ServerInfo, "server_id" | "server_name">): Promise<JoinResult> {
  const home = resolveHome();
  if (!home) throw new NotSignedIn();
  const assertion = await assertionFor(home, addressOf(account.instance, info));
  try {
    const response = await api.post<JoinResponse | { status: "none" }>(`${getApiUrl(account.instance)}/api/v1/federation/join/status`, { json: { assertion } });
    if (response.status === "none") {
      await dropMembership(account.id);
      throw new Error("That server has no request from you any more.");
    }
    return await settle(home, account.instance, response as JoinResponse, account.membership?.serverName);
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.membership_denied") await dropMembership(account.id);
    throw error;
  }
}

/** Give up a joined server (or a waiting request): the server is told, then it is forgotten here. */
export async function leaveServer(account: Account): Promise<void> {
  const home = resolveHome();
  const token = account.snapshot?.authToken;
  if (account.membership?.status === "joined" && token) {
    await api.post(`${getApiUrl(account.instance)}/api/v1/federation/leave`, { json: { auth_token: token } }).catch(() => undefined);
  }
  if (home) void api.post(`${getApiUrl(home.instance)}/api/v1/users/joined-servers/leave`, { json: { auth_token: home.token, target: account.instance.raw } }).catch(() => undefined);
  await dropMembership(account.id);
}
