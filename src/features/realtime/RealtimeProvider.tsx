import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMatch } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken, refreshSession } from "../../services/auth";
import { getStoredInstance, getWebSocketUrl } from "../../services/instance";
import { channelKeys, useChannels } from "../channels/hooks";
import { friendKeys } from "../friends/hooks";
import { messageKeys, overlapsCache, reconcileWindow, type MessageCache } from "../messages/cache";
import { userKeys } from "../users/hooks";
import { applyEvent } from "./applyEvent";
import type { ConnectionStatus } from "./client";
import { ConnectionStatusContext } from "./connection";
import { MessageCommandsContext } from "./commandsContext";
import { DEFAULT_RESYNC_LIMIT } from "./messageCommands";
import { RealtimeSession } from "./session";

function buildSocketUrl(): string | null {
  const instance = getStoredInstance();
  const token = getAuthToken();
  if (!instance || !token) return null;
  return `${getWebSocketUrl(instance)}/ws?protocol=1&auth_token=${encodeURIComponent(token)}`;
}

/**
 * Owns the instance websocket while the dashboard is mounted. Events fold into the query cache;
 * the message hooks send their commands through the same connection.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const { data: channels } = useChannels();

  // The handler reads the active channel through a ref so the socket isn't rebuilt on navigation.
  const activeChannelId = useMatch("/dashboard/channels/:channelId")?.params.channelId;
  const activeChannelRef = useRef(activeChannelId);
  activeChannelRef.current = activeChannelId;

  const session = useMemo(
    () =>
      new RealtimeSession({
        buildUrl: buildSocketUrl,
        refreshCredentials: refreshSession,
        onStatus: setStatus,
        onEvent: (event) => applyEvent(queryClient, event, { activeChannelId: activeChannelRef.current }),
        openChannelIds: () =>
          queryClient
            .getQueryCache()
            .findAll({ queryKey: ["messages"] })
            .filter((query) => query.queryKey[1] !== "search")
            .map((query) => String(query.queryKey[1])),
        onResync: (channelId, messages) => {
          const key = messageKeys.channel(channelId);
          const cache = queryClient.getQueryData<MessageCache>(key);
          if (!cache) return;
          // A full window with no message in common means more was missed than one resync can cover.
          if (messages.length >= DEFAULT_RESYNC_LIMIT && !overlapsCache(cache, messages)) {
            void queryClient.invalidateQueries({ queryKey: key });
            return;
          }
          queryClient.setQueryData<MessageCache>(key, reconcileWindow(cache, messages));
        },
        // Messages are resynced per channel; everything else is simply refetched.
        onReconnect: () => {
          void queryClient.invalidateQueries({ queryKey: channelKeys.unread });
          void queryClient.invalidateQueries({ queryKey: channelKeys.list });
          void queryClient.invalidateQueries({ queryKey: userKeys.list });
          void queryClient.invalidateQueries({ queryKey: friendKeys.all });
        },
      }),
    [queryClient],
  );

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  // Channels created after the socket opened have to be subscribed to explicitly.
  useEffect(() => {
    if (status === "connected" && channels) session.syncChannels(channels.map((c) => c.channel_id));
  }, [session, status, channels]);

  return (
    <ConnectionStatusContext.Provider value={status}>
      <MessageCommandsContext.Provider value={session.commands}>{children}</MessageCommandsContext.Provider>
    </ConnectionStatusContext.Provider>
  );
}
