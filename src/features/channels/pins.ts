import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "../../services/authed";
import { normalizeMessage, type WireMessage } from "../messages/normalize";
import type { Message } from "../messages/types";

const CHANNELS = "/api/v1/channels";
const DM_CONVERSATIONS = "/api/v1/dms/conversations";

/** Where a place's pins live: a channel, or a direct-message conversation (whose id stands in for the channel's). */
const base = (id: string, dm: boolean) => `${dm ? DM_CONVERSATIONS : CHANNELS}/${encodeURIComponent(id)}`;

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

export async function listPins(channelId: string, dm = false): Promise<Pins> {
  const { pins, limit } = await authed.query<{ pins?: WirePin[]; limit?: number }>("GET", `${base(channelId, dm)}/pins`);
  return {
    pins: (pins ?? []).map((p) => ({ message: normalizeMessage(p, channelId), pinnedBy: p.pinned_by ?? "", pinnedAt: p.pinned_at ?? "" })),
    limit: limit ?? 50,
  };
}

const pinPath = (channelId: string, messageId: string, dm: boolean) => `${base(channelId, dm)}/messages/${encodeURIComponent(messageId)}/pin`;

/** The channel's pinned messages. Only fetched when `enabled` (the pin list is opened). */
export function usePins(channelId: string, enabled = true, dm = false) {
  return useQuery({ queryKey: pinKeys.channel(channelId), queryFn: () => listPins(channelId, dm), enabled, staleTime: 30_000 });
}

/** Pin and unpin. The list is read again afterwards, so it shows what the server kept. */
export function usePinMessage(channelId: string, dm = false) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: pinKeys.channel(channelId) });
  const pin = useMutation({ mutationFn: (messageId: string) => authed.query("PUT", pinPath(channelId, messageId, dm)), onSuccess: refresh });
  const unpin = useMutation({ mutationFn: (messageId: string) => authed.query("DELETE", pinPath(channelId, messageId, dm)), onSuccess: refresh });
  return { pin, unpin };
}
