/**
 * Per-instance health tracker.
 *
 * Federation means the client routinely talks to several
 * instances: the viewer's home, joined remotes, and any
 * federation peer reached through ActivityPub. Each can be up,
 * down, or flaky independently. Surfacing that distinction in
 * the UI is the difference between "everything's broken" and
 * "one of your remotes is having a moment."
 *
 * This module is the source of truth. The flow:
 *
 *   1. `apiClient` calls `markHealthy(host, ...)` on every 2xx,
 *      and `markUnhealthy(host, code, ...)` on every fetch
 *      failure / 5xx / `instance.unreachable`-style error.
 *   2. UI components subscribe via `useInstanceHealth(host)` and
 *      render a status dot, an inline "this server is having
 *      issues" notice, or — for the user's HOME instance — the
 *      top-of-app `OfflineBanner`.
 *   3. The `OfflineBanner` consults `getHomeInstanceHealth()` +
 *      `networkStatus` to decide between "device offline" vs
 *      "home instance offline" copy.
 *
 * Why a separate tracker rather than reading per-component error
 * state: most "this instance is down" indicators need to render
 * in places that don't make requests themselves (the rail, the
 * top banner). Centralising the state means those passive
 * surfaces can react to failures discovered by ANY request — a
 * /channels/load failure in the main pane updates the rail dot
 * for the same instance, no extra wiring.
 */

import { ErrorCode, type ErrorCodeValue } from "./apiError";

/** Health classification for one instance at one moment in time. */
export type InstanceHealthKind =
  /** Recent request succeeded (within the freshness window). */
  | "healthy"
  /** Most recent request failed but we haven't given up yet. */
  | "degraded"
  /** Repeated failures or an explicit instance_unreachable error. */
  | "unreachable"
  /** No data yet — first request hasn't returned. */
  | "unknown";

export interface InstanceHealthSnapshot {
  hostPort: string;
  kind: InstanceHealthKind;
  /** Timestamp of the most recent successful response. 0 = never. */
  lastHealthyAt: number;
  /** Timestamp of the most recent observed failure. 0 = never. */
  lastFailureAt: number;
  /** Most recent failure's error_code (from the typed envelope). */
  lastErrorCode: ErrorCodeValue | string | null;
  /** Count of consecutive failures since the last success. The
   *  "consecutive" qualifier matters: a single 500 doesn't mean
   *  the instance is down; three in a row probably does. */
  consecutiveFailures: number;
}

type Listener = (snapshot: InstanceHealthSnapshot) => void;

/** How many consecutive failures push state from `degraded` to
 *  `unreachable`. Tuned for "doesn't trigger on a single hiccup,
 *  does trigger when something is genuinely wrong." */
const UNREACHABLE_FAILURE_THRESHOLD = 3;

/** A success older than this is considered stale — the instance
 *  goes from `healthy` back to `unknown` if nothing's happened in
 *  a while. Lets the UI distinguish "we have evidence it's up" from
 *  "we have no evidence either way." */
const HEALTHY_FRESHNESS_MS = 5 * 60 * 1000;

/**
 * Error codes that should NOT push an instance into the
 * unreachable state. A 401 on this device doesn't mean the
 * instance is broken — it means our token is bad. Same for 403,
 * 404 on user-specific resources, etc. We only treat
 * network-level / 5xx failures as evidence of an instance being
 * unhealthy.
 */
const NON_HEALTH_CODES = new Set<string>([
  ErrorCode.AUTH_TOKEN_REQUIRED,
  ErrorCode.AUTH_INVALID_TOKEN,
  ErrorCode.AUTH_USER_BANNED,
  ErrorCode.AUTH_PRIVILEGE_DENIED,
  ErrorCode.AUTH_INVALID_CREDENTIALS,
  ErrorCode.VALIDATION_FIELD_REQUIRED,
  ErrorCode.VALIDATION_FIELD_TYPE,
  ErrorCode.VALIDATION_FIELD_RANGE,
  ErrorCode.VALIDATION_PAYLOAD_MALFORMED,
  ErrorCode.VALIDATION_PAYLOAD_TOO_LARGE,
  ErrorCode.RESOURCE_NOT_FOUND,
  ErrorCode.RESOURCE_CONFLICT,
  ErrorCode.RESOURCE_ALREADY_EXISTS,
]);

class InstanceHealth {
  private map: Map<string, InstanceHealthSnapshot> = new Map();
  /** Listeners scoped to a specific host_port — UI subscribes to
   *  "tell me when THIS instance's health changes." */
  private hostListeners: Map<string, Set<Listener>> = new Map();
  /** Global listeners — fire on every state change for any host.
   *  Used by the banner so it can re-evaluate without subscribing
   *  to every host individually. */
  private globalListeners: Set<Listener> = new Set();
  /** Which host_port the viewer considers their home instance.
   *  Updated explicitly by the app after login; surfaces matter
   *  because home-down → big banner, remote-down → small badge. */
  private homeHostPort: string | null = null;

  // ── Public surface ─────────────────────────────────────────
  setHomeHostPort(hostPort: string | null): void {
    this.homeHostPort = hostPort ? normaliseHostPort(hostPort) : null;
  }

  getHomeHostPort(): string | null {
    return this.homeHostPort;
  }

  /** Get the current snapshot for a host. Returns an `unknown`
   *  snapshot when we've never seen the host — cheap default so
   *  consumers don't have to null-check. */
  get(hostPort: string | undefined): InstanceHealthSnapshot {
    if (!hostPort) return this.empty("");
    const key = normaliseHostPort(hostPort);
    return this.map.get(key) ?? this.empty(key);
  }

  /** Snapshot for the viewer's home instance, or null if no home
   *  is set (e.g. logged-out app shell). */
  getHome(): InstanceHealthSnapshot | null {
    if (!this.homeHostPort) return null;
    return this.get(this.homeHostPort);
  }

  /** Record a successful response from a host. The host transitions
   *  to `healthy` and `consecutiveFailures` resets to 0. */
  markHealthy(hostPort: string | undefined): void {
    if (!hostPort) return;
    const key = normaliseHostPort(hostPort);
    const now = Date.now();
    const current = this.map.get(key) ?? this.empty(key);
    const next: InstanceHealthSnapshot = {
      ...current,
      hostPort: key,
      kind: "healthy",
      lastHealthyAt: now,
      consecutiveFailures: 0,
    };
    this.map.set(key, next);
    this.emit(key, next);
  }

  /** Record a failed response from a host. We only let
   *  health-relevant codes (network / 5xx / instance.unreachable)
   *  actually move the needle — auth/permission/validation
   *  failures aren't evidence of an instance being down. */
  markUnhealthy(
    hostPort: string | undefined,
    code: ErrorCodeValue | string | null,
  ): void {
    if (!hostPort) return;
    const key = normaliseHostPort(hostPort);
    const now = Date.now();
    const current = this.map.get(key) ?? this.empty(key);

    // Auth / validation / "user error" outcomes don't reflect on
    // instance health. Skip them — but still record the timestamp
    // so debugging surfaces have something to work with.
    if (code && NON_HEALTH_CODES.has(code)) {
      const next: InstanceHealthSnapshot = {
        ...current,
        hostPort: key,
        lastFailureAt: now,
        lastErrorCode: code,
      };
      this.map.set(key, next);
      this.emit(key, next);
      return;
    }

    const consecutiveFailures = current.consecutiveFailures + 1;
    const kind: InstanceHealthKind =
      code === ErrorCode.INSTANCE_UNREACHABLE ||
      code === ErrorCode.INSTANCE_HOME_UNREACHABLE ||
      code === ErrorCode.CLIENT_NETWORK_OFFLINE ||
      consecutiveFailures >= UNREACHABLE_FAILURE_THRESHOLD
        ? "unreachable"
        : "degraded";

    const next: InstanceHealthSnapshot = {
      hostPort: key,
      kind,
      lastHealthyAt: current.lastHealthyAt,
      lastFailureAt: now,
      lastErrorCode: code,
      consecutiveFailures,
    };
    this.map.set(key, next);
    this.emit(key, next);
  }

  /** Subscribe to changes for a specific host. */
  subscribeHost(hostPort: string, listener: Listener): () => void {
    const key = normaliseHostPort(hostPort);
    let set = this.hostListeners.get(key);
    if (!set) {
      set = new Set();
      this.hostListeners.set(key, set);
    }
    set.add(listener);
    return () => {
      const inner = this.hostListeners.get(key);
      if (!inner) return;
      inner.delete(listener);
      if (inner.size === 0) this.hostListeners.delete(key);
    };
  }

  /** Subscribe to any health change. Used by the offline banner. */
  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  // ── Internals ──────────────────────────────────────────────
  private empty(hostPort: string): InstanceHealthSnapshot {
    return {
      hostPort,
      kind: "unknown",
      lastHealthyAt: 0,
      lastFailureAt: 0,
      lastErrorCode: null,
      consecutiveFailures: 0,
    };
  }

  private emit(key: string, snapshot: InstanceHealthSnapshot) {
    const dispatch = (fn: Listener) => {
      try {
        fn(snapshot);
      } catch {
        // Listeners must not throw — defensive only.
      }
    };
    const hostSubs = this.hostListeners.get(key);
    if (hostSubs) {
      for (const fn of Array.from(hostSubs)) dispatch(fn);
    }
    for (const fn of Array.from(this.globalListeners)) dispatch(fn);
  }
}

/**
 * Canonicalise host_port so subsequent compares hit the same key.
 * The rest of the app's user-facing inputs accept lots of shapes
 * (`localhost:7575`, `https://localhost:7575`, `localhost:7575/`,
 * `LOCALHOST:7575`). Strip the scheme, trailing slash, and
 * lowercase the hostname; the port stays as-is.
 */
function normaliseHostPort(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/+$/, "");
  return s;
}

export const instanceHealth = new InstanceHealth();

// Auto-restore the home host on first import. On a hard refresh
// the React tree won't have called ``handleAuthentication`` again
// — the auth token is in storage but no code path has explicitly
// told the tracker "this is home". Without this restore, the
// next network failure against the home host would surface as
// ``instance.unreachable`` (per-instance badge) instead of
// ``instance.home_unreachable`` (top-of-app banner) — wrong
// signal, missed UX. Lazy `require` avoids a load-time cycle
// with the user module.
try {
  if (typeof window !== "undefined") {
    // Dynamic import — `instance.ts` exports the storage reader
    // without pulling React or other heavy modules.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const userMod = require("./user") as {
      getHostPortFromStorage?: () => string | null;
      getHostPortFromCookies?: () => string | null;
    };
    const stored =
      userMod.getHostPortFromStorage?.() || userMod.getHostPortFromCookies?.();
    if (stored) {
      instanceHealth.setHomeHostPort(stored);
    }
  }
} catch {
  // Best-effort. If the import fails the tracker still works,
  // just without the home-host hint until the next sign-in.
}

// ── React hooks ──────────────────────────────────────────────
import { useEffect, useState } from "react";

/**
 * Hook returning the health snapshot for a specific host.
 * Re-renders only when THIS host's state changes. Returns an
 * `unknown` snapshot when no host is passed.
 */
export function useInstanceHealth(
  hostPort: string | undefined,
): InstanceHealthSnapshot {
  const [snapshot, setSnapshot] = useState<InstanceHealthSnapshot>(() =>
    instanceHealth.get(hostPort),
  );
  useEffect(() => {
    if (!hostPort) return;
    setSnapshot(instanceHealth.get(hostPort));
    return instanceHealth.subscribeHost(hostPort, setSnapshot);
  }, [hostPort]);
  return snapshot;
}

/**
 * Hook returning the health snapshot for the user's home instance
 * (the one that holds their identity / friend graph). Used by the
 * top-of-app banner and any UI that needs to know "is the
 * authoritative server reachable?" without caring which host that
 * happens to be.
 */
export function useHomeInstanceHealth(): InstanceHealthSnapshot | null {
  const [snapshot, setSnapshot] = useState<InstanceHealthSnapshot | null>(() =>
    instanceHealth.getHome(),
  );
  useEffect(() => {
    const unsubscribe = instanceHealth.subscribeAll((s) => {
      const home = instanceHealth.getHomeHostPort();
      if (home && s.hostPort === home) {
        setSnapshot(s);
      }
    });
    // Re-read on mount in case the home host changed between
    // render and subscribe (e.g. user just signed in).
    setSnapshot(instanceHealth.getHome());
    return unsubscribe;
  }, []);
  return snapshot;
}

/**
 * Convenience: is this host considered healthy "enough" to attempt
 * fresh requests against? UIs use this to decide whether to dim a
 * server avatar, show a retry button, etc.
 */
export function isHostHealthy(snapshot: InstanceHealthSnapshot): boolean {
  if (snapshot.kind === "healthy") {
    // Stale-healthy: we haven't heard from this host recently, but
    // there's no evidence of failure either. Treat as healthy for
    // UI purposes — the next request will refresh.
    if (Date.now() - snapshot.lastHealthyAt > HEALTHY_FRESHNESS_MS) {
      return true;
    }
    return true;
  }
  if (snapshot.kind === "unknown") return true;
  return false;
}
