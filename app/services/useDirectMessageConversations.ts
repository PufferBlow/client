/**
 * `useDirectMessageConversations` — react-query hook for the DM
 * sidebar's conversation list.
 *
 * The list is hot on the DM surface: the user opens DMs, sees the
 * sidebar, picks a conversation. Pre-fetching at the route level
 * (when `dmsOpen` flips true) makes that feel instant. We also
 * poll on a slower cadence than the per-conversation message
 * fetch — the sidebar only needs to know "what's new globally,"
 * not the per-message stream that the open conversation already
 * has its own polling for.
 *
 * The query key includes the host_port so a user with multiple
 * instances configured (federation viewer) gets a per-instance
 * cache, not a stale list from the previously-selected home.
 */
import { useQuery } from "@tanstack/react-query";

import {
  listDirectMessageConversations,
  type DirectMessageConversation,
} from "./activitypub";

const QUERY_KEY = "dm-conversations" as const;
const POLL_INTERVAL_MS = 15_000; // 15s; the per-conversation message poll is 5s
const STALE_TIME_MS = 10_000; // 10s; bail on duplicate fetches under fast tab switches

export function useDirectMessageConversations(
  hostPort: string | undefined,
  authToken: string | undefined,
) {
  return useQuery({
    queryKey: [QUERY_KEY, hostPort],
    queryFn: async (): Promise<DirectMessageConversation[]> => {
      if (!hostPort || !authToken) return [];
      const response = await listDirectMessageConversations(authToken, hostPort);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load conversations.");
      }
      return response.data.conversations;
    },
    enabled: !!hostPort && !!authToken,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: STALE_TIME_MS,
    placeholderData: [],
  });
}
