import { useQuery } from "@tanstack/react-query";
import { getInstanceHealth, getPublicHealth } from "./api";

export const healthKeys = { details: ["health", "details"] as const, public: ["health", "public"] as const };

const POLL_MS = 30_000;

/** The detailed health, for admins. Polled while the tab is visible (React Query pauses it when it is hidden). */
export function useInstanceHealth() {
  return useQuery({ queryKey: healthKeys.details, queryFn: getInstanceHealth, refetchInterval: POLL_MS, staleTime: POLL_MS / 2, retry: false });
}

/** Whether the instance says it is well, for everyone. A failed check is not "degraded": it says nothing. */
export function usePublicHealth() {
  return useQuery({ queryKey: healthKeys.public, queryFn: getPublicHealth, refetchInterval: POLL_MS, staleTime: POLL_MS / 2, retry: false });
}
