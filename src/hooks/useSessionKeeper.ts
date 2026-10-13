import { useEffect } from "react";
import { getAuthToken, msUntilAuthExpiry, renewSession } from "../services/auth";
import { setInstanceStatus } from "../features/instance/status";

const CHECK_INTERVAL_MS = 30_000;
const REFRESH_AHEAD_MS = 2 * 60_000;

/**
 * Keeps the access token fresh while the app is open: renews it shortly before it expires. When
 * the instance refuses to renew it (and the old token is gone), the dashboard switches to its
 * "session ended" screen; when the instance just doesn't answer, it tries again next check.
 */
export function useSessionKeeper(): void {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const remaining = msUntilAuthExpiry();
      const needsRefresh = !getAuthToken() || (remaining !== null && remaining < REFRESH_AHEAD_MS);
      if (!needsRefresh) return;

      const outcome = await renewSession();
      if (cancelled) return;
      if (outcome === "rejected" && !getAuthToken()) setInstanceStatus("signed_out");
      else if (outcome === "unreachable") setInstanceStatus("unreachable");
    };

    void check();
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
}
