import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "../../services/authed";
import { normalizeMessage, type WireMessage } from "../messages/normalize";
import type { Message } from "../messages/types";

const CHANNELS = "/api/v1/channels";

/** A message pinned in a channel, with who pinned it and when. */
export interface Pin {
  message: Message;
  pinnedBy: string;
  pinnedAt: string;
}

export interface Pins {
  pins: Pin[];
  /** The most a channel can hold. */
  limit: number;
}

export const pinKeys = { channel: (channelId: string) => ["channels", "pins", channelId] as const };

type WirePin = WireMessage & { pinned_by?: string; pinned_at?: string };

export async function listPins(channelId: string): Promise<Pins> {
  const { pins, limit } = await authed.query<{ pins?: WirePin[]; limit?: number }>("GET", `${CHANNELS}/${encodeURIComponent(channelId)}/pins`);
  return {
    pins: (pins ?? []).map((p) => ({ message: normalizeMessage(p, channelId), pinnedBy: p.pinned_by ?? "", pinnedAt: p.pinned_at ?? "" })),
    limit: limit ?? 50,
  };
}

const pinPath = (channelId: string, messageId: string) => `${CHANNELS}/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/pin`;

/** The channel's pinned messages. Only fetched when `enabled` (the pin list is opened). */
export function usePins(channelId: string, enabled = true) {
  return useQuery({ queryKey: pinKeys.channel(channelId), queryFn: () => listPins(channelId), enabled, staleTime: 30_000 });
}

/** Pin and unpin. The list is read again afterwards, so it shows what the server kept. */
export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: pinKeys.channel(channelId) });
  const pin = useMutation({ mutationFn: (messageId: string) => authed.query("PUT", pinPath(channelId, messageId)), onSuccess: refresh });
  const unpin = useMutation({ mutationFn: (messageId: string) => authed.query("DELETE", pinPath(channelId, messageId)), onSuccess: refresh });
  return { pin, unpin };
}
