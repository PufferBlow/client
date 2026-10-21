import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useChannels } from "../channels/hooks";
import { listVoiceParticipants } from "./api";
import { voiceKeys } from "./hooks";
import type { VoiceParticipant } from "./types";

const POLL_MS = 10_000;

export interface InVoice {
  channelId: string;
  channelName: string;
  participant: VoiceParticipant;
}

/**
 * Who is in a voice room anywhere on the instance, by user id. There is no push for this, so the
 * rooms are polled together (the same keys the channel list uses, so nothing is fetched twice).
 */
export function useVoiceRoster(): ReadonlyMap<string, InVoice> {
  const { data: channels = [] } = useChannels();
  const rooms = useMemo(() => channels.filter((c) => c.channel_type === "voice" || c.channel_type === "mixed"), [channels]);
  const results = useQueries({
    queries: rooms.map((room) => ({
      queryKey: voiceKeys.participants(room.channel_id),
      queryFn: () => listVoiceParticipants(room.channel_id),
      refetchInterval: POLL_MS,
      staleTime: POLL_MS / 2,
    })),
  });

  return useMemo(() => {
    const roster = new Map<string, InVoice>();
    rooms.forEach((room, i) => {
      for (const participant of results[i]?.data ?? []) roster.set(participant.userId, { channelId: room.channel_id, channelName: room.channel_name, participant });
    });
    return roster;
    // `results` is a new array every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, results.map((r) => r.dataUpdatedAt).join(",")]);
}
