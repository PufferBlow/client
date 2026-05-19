/**
 * Client surface for the joined-servers federation primitive.
 *
 * Since the v1.0 server_id rewrite the server identifier IS the
 * remote instance's `host:port`, which doubles as how the client
 * reaches it. "Joining" a server is the act of persisting that
 * domain into the user's `joined_servers_ids` list on their home
 * instance. Subsequent fetches against the joined server happen
 * directly via its public API; the home instance doesn't proxy.
 *
 * The functions here all talk to the user's HOME instance — never
 * to the joined target — because the joined-servers list lives on
 * the home server's Users row. The target's only role during a
 * join is responding to a metadata probe (server-info); that probe
 * is initiated by the home server, not by this client.
 */

import { createApiClient } from "./apiClient";
import { resolveInstance } from "./instance";

/** Subset of `/api/v1/system/server-info` we care about in the rail UI. */
export interface JoinedServerInfo {
  server_id: string;
  server_name: string;
  server_description?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
}

export interface JoinedServersList {
  /** All server_ids the user has joined. Always includes origin_server. */
  joined_servers: string[];
  /** The user's home instance. Treated specially (can't be left). */
  origin_server: string;
}

interface JoinErrorPayload {
  code?: string;
  message?: string;
}

export class JoinServerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "JoinServerError";
  }
}

/**
 * Fetch the joined-servers list from the user's home instance.
 *
 * Returns the raw server_id list plus the origin_server. The rail
 * resolves each id to a JoinedServerInfo separately via
 * `fetchServerInfo` so a single unreachable peer doesn't stall the
 * whole list.
 */
export async function getJoinedServers(authToken: string): Promise<JoinedServersList> {
  const client = createApiClient();
  const response = await client.get<JoinedServersList>(
    `/api/v1/users/joined-servers?auth_token=${encodeURIComponent(authToken)}`,
  );
  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load joined servers");
  }
  return response.data;
}

/**
 * Resolve a server_id (host:port) to its public server-info payload.
 *
 * Talks directly to the joined instance, NOT to the home server.
 * Caller is expected to handle the case where the target is
 * unreachable — that's normal for a peer that's offline, and the
 * rail surface should just show the avatar as a placeholder until
 * the target comes back.
 */
export async function fetchServerInfo(serverId: string): Promise<JoinedServerInfo | null> {
  let apiBaseUrl: string;
  try {
    apiBaseUrl = resolveInstance(serverId).apiBaseUrl;
  } catch {
    return null;
  }
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/system/server-info`, {
      // Don't carry auth_token here — server-info is the public
      // metadata endpoint. Sending credentials to an arbitrary peer
      // would leak the token.
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.server_info ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the home instance to add a remote server to the joined list.
 *
 * The home server is the one that does the metadata probe (it has
 * to verify the target before persisting). On success the home
 * server echoes back the target's server_info so the client can
 * render the new rail entry without a second round trip.
 *
 * Throws `JoinServerError` with a machine-readable code on failure
 * so callers can surface code-specific copy in the dialog.
 */
export async function joinServer(
  authToken: string,
  target: string,
): Promise<JoinedServerInfo> {
  const client = createApiClient();
  const response = await client.post<{ server_info: JoinedServerInfo }>(
    "/api/v1/users/joined-servers",
    { auth_token: authToken, target },
  );
  if (!response.success || !response.data?.server_info) {
    const fallback = response.error || "Failed to join server";
    // The server returns `{ detail: { code, message } }` for 4xx /
    // 5xx, which apiClient surfaces as `error`. Try to recover the
    // code from a structured failure shape so the caller can
    // branch on it.
    const code = _extractErrorCode(response);
    throw new JoinServerError(code || "unknown", fallback);
  }
  return response.data.server_info;
}

/**
 * Ask the home instance to drop a server from the joined list.
 *
 * The home instance can NOT be left this way — the home is the
 * account's root, and "leaving" it would only make sense as a
 * full account deletion (handled elsewhere).
 */
export async function leaveServer(authToken: string, target: string): Promise<void> {
  const client = createApiClient();
  // POST (not DELETE) because we need the body for auth_token +
  // target. See the route docstring.
  const response = await client.post<unknown>(
    "/api/v1/users/joined-servers/leave",
    { auth_token: authToken, target },
  );
  if (!response.success) {
    throw new JoinServerError(
      _extractErrorCode(response) || "unknown",
      response.error || "Failed to leave server",
    );
  }
}

function _extractErrorCode(response: { error?: string }): string | null {
  // apiClient stringifies the FastAPI error body into `error`.
  // Look for a JSON shape we recognize; fall back to null.
  if (!response.error) return null;
  try {
    const parsed = JSON.parse(response.error);
    if (parsed?.detail?.code) return String(parsed.detail.code);
  } catch {
    // Not JSON; the message might be the raw string itself.
  }
  return null;
}
