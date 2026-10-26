import { useQuery } from "@tanstack/react-query";
import type { VoiceRoom } from "./api";
import { getVoiceRoom } from "./api";

export const voiceKeys = {
  participants: (channelId: string) => ["voice", "participants", channelId] as const,
};

const POLL_MS = 10_000;

/**
 * Who is in a voice channel's call. The API has no push for this, so channels you are not in are
 * polled; a channel you have joined shows the live list from the call instead.
 */
export function useVoiceParticipants(channelId: string, enabled = true) {
  return useVoiceRoom(channelId, enabled, (room) => room.participants);
}

/** A channel's call: who is in it and when it began. Shares its cache with `useVoiceParticipants`. */
export function useVoiceRoom<T = VoiceRoom>(channelId: string, enabled = true, select?: (room: VoiceRoom) => T) {
  return useQuery({
    queryKey: voiceKeys.participants(channelId),
    queryFn: () => getVoiceRoom(channelId),
    enabled,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
    select: select as (room: VoiceRoom) => T,
  });
}
