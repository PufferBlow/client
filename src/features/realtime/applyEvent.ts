import type { QueryClient } from "@tanstack/react-query";
import { channelKeys } from "../channels/hooks";
import { dmKeys } from "../dms/keys";
import { markDmRead, noteIncomingDm } from "../dms/unread";
import { notificationKeys } from "../notifications/hooks";
import type { UnreadCounts } from "../channels/types";
import { friendKeys } from "../friends/hooks";
import type { Friend } from "../friends/types";
import { messageKeys, patchMessage, removeMessage, setReactions, upsertMessage, type MessageCache } from "../messages/cache";
import { userKeys } from "../users/hooks";
import type { UserProfile } from "../users/types";
import type { RealtimeEvent } from "./events";

export interface EventContext {
  /** Channel currently on screen; messages arriving there are not counted as unread. */
  activeChannelId: string | undefined;
  /** The DM conversation on screen, if any. */
  activeConversationId?: string | undefined;
}

/** Fold one realtime event into the query cache. Only already-cached data is touched. */
export function applyEvent(queryClient: QueryClient, event: RealtimeEvent, context: EventContext): void {
  const updateMessages = (channelId: string, update: (cache: MessageCache | undefined) => MessageCache | undefined) =>
    queryClient.setQueryData<MessageCache>(messageKeys.channel(channelId), update);

  switch (event.kind) {
    case "message": {
      const { message } = event;
      updateMessages(message.channelId, (cache) => upsertMessage(cache, message));

      const myId = queryClient.getQueryData<UserProfile>(userKeys.profile)?.user_id;

      if (event.dm) {
        // The conversation list shows the latest message and orders by it.
        void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
        // Every message in a DM is worth a notification, reply or not, unless you are reading it.
        if (myId && message.authorId !== myId) {
          if (message.channelId === context.activeConversationId) markDmRead(myId, message.channelId);
          else noteIncomingDm(myId, message.channelId);
        }
        return;
      }

      if (message.channelId !== context.activeChannelId && message.authorId !== myId) {
        queryClient.setQueryData<UnreadCounts>(channelKeys.unread, (counts) => ({
          ...counts,
          [message.channelId]: (counts?.[message.channelId] ?? 0) + 1,
        }));
      }
      return;
    }

    case "message_edited":
      updateMessages(event.channelId, (cache) =>
        patchMessage(cache, event.messageId, { text: event.text, editCount: event.editCount, editedAt: event.editedAt }),
      );
      return;

    case "message_deleted":
      updateMessages(event.channelId, (cache) => removeMessage(cache, event.messageId));
      if (event.dm) void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
      return;

    case "reactions":
      updateMessages(event.channelId, (cache) => setReactions(cache, event.messageId, event.reactions));
      return;

    case "presence":
      queryClient.setQueryData<UserProfile[]>(userKeys.list, (users) =>
        users?.map((u) => (u.user_id === event.userId ? { ...u, status: event.status } : u)),
      );
      queryClient.setQueryData<UserProfile>(userKeys.profile, (me) =>
        me && me.user_id === event.userId ? { ...me, status: event.status } : me,
      );
      queryClient.setQueryData<Friend[]>(friendKeys.list, (friends) =>
        friends?.map((f) => (f.userId === event.userId ? { ...f, status: event.status } : f)),
      );
      return;

    case "channel":
      if (event.change === "deleted" || event.change === "revoked") queryClient.removeQueries({ queryKey: messageKeys.channel(event.channelId) });
      void queryClient.invalidateQueries({ queryKey: channelKeys.list });
      return;

    case "notification":
      void queryClient.invalidateQueries({ queryKey: channelKeys.unread });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      return;
  }
}
