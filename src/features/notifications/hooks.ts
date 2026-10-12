import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPreferences, setAllChannelsMuted, setChannelMuted, type ChannelPreference } from "./api";

export const notificationKeys = { preferences: ["notifications", "preferences"] as const };

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
