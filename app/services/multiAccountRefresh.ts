/**
 * Background refresher for the SavedAccount registry.
 *
 * The standard `authSession.startBackgroundAuthRefresh` only touches the
 * ACTIVE session — whatever's currently in cookies + storage. The other
 * accounts the user has signed into sit dormant; their auth tokens
 * expire on the server's schedule (15 min by default) and the moment
 * the user switches over they're greeted by an immediate
 * "session expired" bounce.
 *
 * This module ticks on its own interval, walks every SavedAccount, and
 * refreshes any whose auth token is within `REFRESH_BUFFER_MS` of
 * expiring. It calls the same `/api/v1/auth/refresh` endpoint the
 * active-session refresher uses, but with the per-account refresh
 * token instead of reading from cookies/localStorage. Successful
 * refreshes write back into the SavedAccount via `updateAccountTokens`.
 *
 * The active account is intentionally SKIPPED here — its refresh is
 * already owned by `authSession`, and double-refreshing it would
 * race the two paths against each other.
 */

import {
  getActiveAccountId,
  listAccounts,
  updateAccountTokens,
  type SavedAccount,
} from "./accounts";
import { resolveInstance } from "./instance";
import { logger } from "../utils/logger";

/** Refresh threshold: kick in this many ms before the auth token expires. */
const REFRESH_BUFFER_MS = 2 * 60_000;

/** Top-of-the-minute tick is fine; account tokens last 15 min by default. */
const TICK_INTERVAL_MS = 60_000;

let tickHandle: number | null = null;
const inFlight = new Set<string>();

function isExpiringSoon(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return false;
  return ms - Date.now() <= REFRESH_BUFFER_MS;
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return false;
  return Date.now() >= ms;
}

/**
 * Refresh ONE account's tokens against its home instance.
 *
 * Direct against the instance's `/api/v1/auth/refresh` — no shared
 * state, no cookie manipulation. Returns true on success so the caller
 * (the loop, or a one-shot retry path) can act on outcomes.
 */
async function refreshOneAccount(account: SavedAccount): Promise<boolean> {
  if (!account.refreshToken) return false;
  if (isExpired(account.refreshTokenExpireTime)) return false;

  if (inFlight.has(account.id)) return false;
  inFlight.add(account.id);
  try {
    const apiBaseUrl = (() => {
      try {
        return resolveInstance(account.hostPort).apiBaseUrl;
      } catch {
        return null;
      }
    })();
    if (!apiBaseUrl) return false;

    const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: account.refreshToken }),
    });
    if (!response.ok) {
      logger.auth.warn(
        "Background refresh for stored account failed",
        { accountId: account.id, status: response.status },
      );
      return false;
    }
    const payload = await response.json();
    if (!payload?.auth_token || !payload?.refresh_token) {
      logger.auth.warn(
        "Background refresh response missing tokens",
        { accountId: account.id },
      );
      return false;
    }
    updateAccountTokens(account.id, {
      authToken: payload.auth_token,
      refreshToken: payload.refresh_token,
      authTokenExpireTime: payload.auth_token_expire_time,
      refreshTokenExpireTime: payload.refresh_token_expire_time,
      tokenType: payload.token_type,
    });
    return true;
  } catch (error) {
    // Network blip, instance offline, CORS, etc. — non-fatal; next
    // tick will retry. We don't surface this to the user because a
    // dormant account expiring transparently in the background is
    // not actionable.
    logger.auth.debug(
      "Background refresh threw",
      { accountId: account.id, error: error instanceof Error ? error.message : String(error) },
    );
    return false;
  } finally {
    inFlight.delete(account.id);
  }
}

async function tick(): Promise<void> {
  const activeId = getActiveAccountId();
  const accounts = listAccounts();
  // Fan out: refresh in parallel rather than serially so a slow
  // instance doesn't block another instance's refresh.
  await Promise.allSettled(
    accounts
      .filter((account) => account.id !== activeId)
      .filter((account) => isExpiringSoon(account.authTokenExpireTime))
      .map((account) => refreshOneAccount(account)),
  );
}

/**
 * Start the background tick. Idempotent — calling it twice doesn't
 * create overlapping intervals. Returns a stopper so callers can
 * clean up in unmount handlers.
 */
export function startBackgroundAccountTokenRefresh(): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (tickHandle !== null) return stopBackgroundAccountTokenRefresh;

  // Run once at start so a freshly-mounted dashboard immediately
  // re-arms tokens that expired while the renderer was closed.
  void tick();
  tickHandle = window.setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);

  return stopBackgroundAccountTokenRefresh;
}

export function stopBackgroundAccountTokenRefresh(): void {
  if (tickHandle !== null && typeof window !== "undefined") {
    window.clearInterval(tickHandle);
  }
  tickHandle = null;
}
