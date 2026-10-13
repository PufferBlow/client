import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  listPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  setAllChannelsMuted,
  setChannelMuted,
  type AppNotification,
  type ChannelPreference,
} from "./api";

export const notificationKeys = {
  preferences: ["notifications", "preferences"] as const,
  list: ["notifications", "list"] as const,
};

/** The viewer's notifications (mentions), newest first. Kept fresh by `notification.created` events. */
export function useNotifications() {
  return useQuery({ queryKey: notificationKeys.list, queryFn: () => listNotifications(), staleTime: 30_000 });
}

/** How many notifications are still unread: the inbox badge. */
export function useUnreadNotificationCount(): number {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

/** Notification types that put a red badge on a channel: someone replied to you, or pinged you. */
export const PING_TYPES: ReadonlySet<string> = new Set(["mention", "reply"]);

/** Unread pings (replies to you and @-mentions) per channel id. */
export function useChannelPings(): Record<string, number> {
  const { data } = useNotifications();
  const pings: Record<string, number> = {};
  for (const n of data ?? []) {
    if (!n.read && n.channelId && PING_TYPES.has(n.type)) pings[n.channelId] = (pings[n.channelId] ?? 0) + 1;
  }
  return pings;
}

/** Marks one notification read and shows it as read at once. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id: string) => {
      queryClient.setQueryData<AppNotification[]>(notificationKeys.list, (list) => list?.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list });
      const previous = queryClient.getQueryData<AppNotification[]>(notificationKeys.list);
      queryClient.setQueryData<AppNotification[]>(notificationKeys.list, (list) => list?.map((n) => ({ ...n, read: true })));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(notificationKeys.list, context?.previous),
  });
}

const EMPTY: ReadonlySet<string> = new Set();

/** Ids of the channels the viewer has muted. Empty while loading or if the lookup fails. */
export function useMutedChannels(): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: listPreferences,
    staleTime: 60_000,
    select: (prefs) => new Set(prefs.filter((p) => p.muted).map((p) => p.channel_id)),
  });
  return data ?? EMPTY;
}

const asMuted = (channelId: string): ChannelPreference => ({ channel_id: channelId, muted: true, mention_only: false });

/**
 * Optimistic mute switches: the sidebar updates at once and rolls back if the server refuses.
 */
function useOptimisticMute<V>(
  mutationFn: (variables: V) => Promise<void>,
  apply: (prefs: ChannelPreference[], variables: V) => ChannelPreference[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.preferences });
      const previous = queryClient.getQueryData<ChannelPreference[]>(notificationKeys.preferences);
      queryClient.setQueryData<ChannelPreference[]>(notificationKeys.preferences, (prefs) => apply(prefs ?? [], variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(notificationKeys.preferences, context?.previous);
    },
  });
}

export function useMuteChannel() {
  return useOptimisticMute(
    ({ channelId, muted }: { channelId: string; muted: boolean }) => setChannelMuted(channelId, muted),
    (prefs, { channelId, muted }) => {
      const rest = prefs.filter((p) => p.channel_id !== channelId);
      return muted ? [...rest, asMuted(channelId)] : rest;
    },
  );
}

export function useMuteAllChannels() {
  return useOptimisticMute(
    ({ muted }: { muted: boolean; channelIds: string[] }) => setAllChannelsMuted(muted),
    (prefs, { muted, channelIds }) => {
      if (!muted) return [];
      const known = new Set(prefs.map((p) => p.channel_id));
      return [...prefs.map((p) => ({ ...p, muted: true })), ...channelIds.filter((id) => !known.has(id)).map(asMuted)];
    },
  );
}
