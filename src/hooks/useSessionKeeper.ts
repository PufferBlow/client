import { useEffect } from "react";
import { useNavigate } from "react-router";
import { clearAuthToken, getAuthToken, msUntilAuthExpiry, refreshSession } from "../services/auth";

const CHECK_INTERVAL_MS = 30_000;
const REFRESH_AHEAD_MS = 2 * 60_000;

/**
 * Keeps the access token fresh while the app is open: renews it shortly before it expires,
 * and sends the user back to sign-in if the session can no longer be renewed.
 */
export function useSessionKeeper(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const remaining = msUntilAuthExpiry();
      const needsRefresh = !getAuthToken() || (remaining !== null && remaining < REFRESH_AHEAD_MS);
      if (!needsRefresh) return;

      const renewed = await refreshSession();
      if (!renewed && !cancelled && !getAuthToken()) {
        clearAuthToken();
        navigate("/login", { replace: true });
      }
    };

    void check();
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [navigate]);
}
