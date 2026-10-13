import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChannelChanges,
  createChannel,
  deleteChannel,
  getUnreadCounts,
  listChannels,
  markAllChannelsRead,
  markChannelRead,
  updateChannel,
} from "./api";
import { markAllNotificationsRead, markNotificationRead, type AppNotification } from "../notifications/api";
import { notificationKeys } from "../notifications/hooks";
import type { Channel, UnreadCounts } from "./types";

export const channelKeys = {
  list: ["channels", "list"] as const,
  unread: ["channels", "unread"] as const,
};

export function useChannels() {
  return useQuery({ queryKey: channelKeys.list, queryFn: listChannels, staleTime: 60_000 });
}

export function useUnreadCounts() {
  return useQuery({ queryKey: channelKeys.unread, queryFn: getUnreadCounts, staleTime: 30_000 });
}

/** Marks a channel read on the server and clears its badge immediately. */
export function useMarkChannelRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markChannelRead,
    onMutate: (channelId) => {
      queryClient.setQueryData<UnreadCounts>(channelKeys.unread, (counts) =>
        counts && counts[channelId] ? { ...counts, [channelId]: 0 } : counts,
      );
      // Reading a channel answers the replies and pings waiting in it too.
      const pending = (queryClient.getQueryData<AppNotification[]>(notificationKeys.list) ?? []).filter(
        (n) => !n.read && n.channelId === channelId,
      );
      if (pending.length > 0) {
        queryClient.setQueryData<AppNotification[]>(notificationKeys.list, (list) =>
          list?.map((n) => (n.channelId === channelId ? { ...n, read: true } : n)),
        );
        for (const n of pending) void markNotificationRead(n.id).catch(() => undefined);
      }
    },
  });
}

/** Clears every unread badge at once; rolls back if the server refuses. */
export function useMarkAllChannelsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllChannelsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: channelKeys.unread });
      const previous = queryClient.getQueryData<UnreadCounts>(channelKeys.unread);
      queryClient.setQueryData<UnreadCounts>(channelKeys.unread, (counts) =>
        counts ? Object.fromEntries(Object.keys(counts).map((id) => [id, 0])) : counts,
      );
      // "Everything read" includes the replies and pings waiting in those channels.
      if ((queryClient.getQueryData<AppNotification[]>(notificationKeys.list) ?? []).some((n) => !n.read)) {
        queryClient.setQueryData<AppNotification[]>(notificationKeys.list, (list) => list?.map((n) => ({ ...n, read: true })));
        void markAllNotificationsRead().catch(() => undefined);
      }
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(channelKeys.unread, context?.previous),
  });
}

/** Create, edit and delete keep the cached channel list in step with the server. */
export function useChannelAdmin() {
  const queryClient = useQueryClient();
  const refreshList = () => queryClient.invalidateQueries({ queryKey: channelKeys.list });

  const create = useMutation({
    mutationFn: createChannel,
    onSuccess: (channel) => {
      queryClient.setQueryData<Channel[]>(channelKeys.list, (list) => (list ? [...list, channel] : list));
      return refreshList();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ChannelChanges }) => updateChannel(id, changes),
    onSuccess: refreshList,
  });
  const remove = useMutation({
    mutationFn: deleteChannel,
    onSuccess: (_void, id) => {
      queryClient.setQueryData<Channel[]>(channelKeys.list, (list) => list?.filter((c) => c.channel_id !== id));
      return refreshList();
    },
  });

  return { create, update, remove };
}
