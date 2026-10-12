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
