import { useQuery } from "@tanstack/react-query";
import { listVoiceParticipants } from "./api";

export const voiceKeys = {
  participants: (channelId: string) => ["voice", "participants", channelId] as const,
};

const POLL_MS = 10_000;

/**
 * Who is in a voice channel's call. The API has no push for this, so channels you are not in are
 * polled; a channel you have joined shows the live list from the call instead.
 */
export function useVoiceParticipants(channelId: string, enabled = true) {
  return useQuery({
    queryKey: voiceKeys.participants(channelId),
    queryFn: () => listVoiceParticipants(channelId),
    enabled,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  });
}
