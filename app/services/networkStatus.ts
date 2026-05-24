/**
 * Device-level network status singleton.
 *
 * Tracks whether the user's MACHINE has internet connectivity at
 * all, distinct from whether any specific PufferBlow instance is
 * reachable (that's `instanceHealth`).
 *
 * Why these are two separate concerns:
 *
 *   - A federated app routinely talks to several instances. If
 *     one is down, the rest of the app should still work.
 *     Conflating "this instance is down" with "you're offline"
 *     would surface a global "you're offline" banner every time
 *     a remote instance hiccupped — false alarm.
 *
 *   - When the DEVICE is offline (laptop on a plane, phone in a
 *     tunnel) every instance is unreachable, no point retrying
 *     anything. WS reconnects should pause, composer sends
 *     should fail-fast rather than spinning for 30 seconds.
 *
 * Implementation: thin wrapper around `navigator.onLine` + the
 * standard `online` / `offline` window events. `navigator.onLine`
 * is HEURISTIC — it tells you about the OS-level network
 * interface, not whether DNS / specific hosts work. False
 * positives (`onLine: true` but the network is captive-portal-
 * walled) get caught by the request-level instanceHealth layer.
 * False negatives are rare; we trust the event.
 *
 * SSR-safe: when `window` isn't defined we default to "online"
 * so server-rendered pages don't hydrate with a wrong banner.
 */

type NetworkStatusListener = (online: boolean) => void;

/** Source of truth for whether the device is online. */
class NetworkStatus {
  private _online: boolean;
  private listeners: Set<NetworkStatusListener> = new Set();

  constructor() {
    // Default to true everywhere we don't have a definitive signal.
    // - SSR: we can't know yet; let the client side hydrate the
    //   real value via the listener.
    // - First page load on a flaky connection: `navigator.onLine`
    //   may not have settled yet; the first `offline` event will
    //   correct it.
    this._online =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  /** Current device-online status. Read freely; cheap. */
  get online(): boolean {
    return this._online;
  }

  /** Subscribe to status changes. Returns an unsubscribe fn. */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Manually nudge the status — used by background polls that
   *  detected a successful fetch even though `navigator.onLine`
   *  might still report `false` (rare but seen on some Android
   *  WebViews where the OS event arrives late). */
  markOnline = (): void => {
    if (this._online) return;
    this._online = true;
    this.emit(true);
  };

  /** Manually mark offline. Used when many consecutive requests
   *  fail with a network error while `navigator.onLine` insists
   *  we're online — e.g. captive portal pages that block traffic
   *  but pass the OS network-interface check. */
  markOffline = (): void => {
    if (!this._online) return;
    this._online = false;
    this.emit(false);
  };

  private handleOnline = () => {
    if (this._online) return;
    this._online = true;
    this.emit(true);
  };

  private handleOffline = () => {
    if (!this._online) return;
    this._online = false;
    this.emit(false);
  };

  private emit(online: boolean) {
    // Snapshot the listener set so a listener that unsubscribes
    // itself during dispatch doesn't mutate iteration.
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(online);
      } catch {
        // A listener that throws shouldn't break dispatch for the
        // others. Errors should be impossible — listeners are
        // pure setState calls — but defense in depth.
      }
    }
  }
}

export const networkStatus = new NetworkStatus();

// ── React hook ───────────────────────────────────────────────────
import { useEffect, useState } from "react";

/**
 * React hook for the device's online status. Re-renders whenever
 * the underlying status flips.
 *
 *   const isOnline = useNetworkStatus();
 *   if (!isOnline) return <OfflineBanner />;
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => networkStatus.online);
  useEffect(() => networkStatus.subscribe(setOnline), []);
  return online;
}
