import { useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadMessages, reportMessage, searchMessages, sendMessage } from "./api";
import { CommandError } from "../realtime/commands";
import { useMessageCommands } from "../realtime/commandsContext";
import { userKeys } from "../users/hooks";
import type { UserProfile } from "../users/types";
import {
  failPending,
  flattenMessages,
  messageKeys,
  patchMessage,
  removeMessage,
  restartPending,
  setReactions,
  settlePending,
  upsertMessage,
  type MessageCache,
} from "./cache";
import type { Message, ReplyPreview } from "./types";

export function useMessages(channelId: string) {
  const query = useInfiniteQuery({
    queryKey: messageKeys.channel(channelId),
    queryFn: ({ pageParam }) => loadMessages(channelId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: Infinity, // kept fresh by the realtime socket; refetched on reconnect
  });

  return { ...query, messages: flattenMessages(query.data) };
}

/** The server refuses shorter queries. */
export const MIN_SEARCH_LENGTH = 2;

export function useMessageSearch(channelId: string, query: string) {
  return useQuery({
    queryKey: ["messages", "search", channelId, query] as const,
    queryFn: () => searchMessages(channelId, query),
    enabled: query.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
  });
}

/** Typed `setQueryData` for one channel's message cache. */
function useMessageCache(channelId: string) {
  const queryClient = useQueryClient();
  return (update: (cache: MessageCache | undefined) => MessageCache | undefined) =>
    queryClient.setQueryData<MessageCache>(messageKeys.channel(channelId), update);
}

const FAILURE_COPY: Record<string, string> = {
  RATE_LIMITED: "You're sending too fast. Try again in a moment.",
  NOT_CONNECTED: "Not connected. Check your connection and retry.",
  DISCONNECTED: "The connection dropped. Retry to send it.",
  TIMEOUT: "The server didn't answer. Retry to send it.",
};

function describeFailure(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof CommandError) {
    return { message: FAILURE_COPY[error.code] ?? error.message, retryable: error.retryable };
  }
  return { message: "The message couldn't be sent.", retryable: true };
}

export interface SendInput {
  text: string;
  files?: File[];
  /** The message this replies to (its preview is shown on the pending row straight away). */
  replyTo?: ReplyPreview;
}

/**
 * Sends over the socket with an optimistic message. The composer clears at once; the row shows as
 * pending, becomes the server's message on the ack, or turns into a failed row with Retry. A retry
 * reuses the original nonce, so a message the server did commit is never posted twice.
 *
 * Attachments cannot travel over the socket, so those go through the HTTP upload route.
 */
export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient();
  const commands = useMessageCommands();
  const update = useMessageCache(channelId);

  const deliver = useCallback(
    async (localId: string, nonce: string, text: string, replyToMessageId?: string) => {
      if (!commands) return;
      try {
        const message = await commands.createMessage({ channelId, content: text, nonce, replyToMessageId });
        update((cache) => settlePending(cache, localId, message));
      } catch (error) {
        update((cache) => failPending(cache, localId, describeFailure(error)));
      }
    },
    [commands, channelId, update],
  );

  const send = useCallback(
    async ({ text, files, replyTo }: SendInput): Promise<void> => {
      const cached = queryClient.getQueryData<MessageCache>(messageKeys.channel(channelId));
      const replyToMessageId = replyTo?.id;

      // Files, no connection layer, or nothing on screen to show a pending row in: send and wait.
      if (files?.length || !commands || !cached) {
        const message = files?.length || !commands
          ? await sendMessage(channelId, { text, files, replyToMessageId })
          : await commands.createMessage({ channelId, content: text, nonce: crypto.randomUUID(), replyToMessageId });
        update((cache) => upsertMessage(cache, message));
        return;
      }

      const nonce = crypto.randomUUID();
      const localId = `local_${nonce}`;
      const me = queryClient.getQueryData<UserProfile>(userKeys.profile);
      const pending: Message = {
        id: localId,
        channelId,
        authorId: me?.user_id ?? "",
        authorName: me?.username ?? "You",
        authorAvatarUrl: me?.avatar_url ?? null,
        text,
        sentAt: new Date().toISOString(),
        attachments: [],
        reactions: [],
        editCount: 0,
        editedAt: null,
        status: "pending",
        nonce,
        ...(replyTo ? { replyTo } : {}),
      };
      update((cache) => upsertMessage(cache, pending));
      void deliver(localId, nonce, text, replyToMessageId);
    },
    [queryClient, commands, channelId, update, deliver],
  );

  const retry = useCallback(
    (localId: string) => {
      const cache = queryClient.getQueryData<MessageCache>(messageKeys.channel(channelId));
      const failed = flattenMessages(cache).find((m) => m.id === localId && m.status === "failed");
      if (!failed?.nonce) return;
      update((c) => restartPending(c, localId));
      void deliver(localId, failed.nonce, failed.text, failed.replyTo?.id);
    },
    [queryClient, channelId, update, deliver],
  );

  const discard = useCallback((localId: string) => update((cache) => removeMessage(cache, localId)), [update]);

  return { send, retry, discard };
}

/** Edit, delete and reactions only exist as socket commands; without a connection they fail with a plain message. */
function requireCommands<T>(commands: T | null | undefined): T {
  if (!commands) throw new Error("You are offline. Reconnect and try again.");
  return commands;
}

export function useEditMessage(channelId: string) {
  const update = useMessageCache(channelId);
  const commands = useMessageCommands();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => requireCommands(commands).editMessage(channelId, id, text),
    onSuccess: (result, { id }) =>
      update((cache) => patchMessage(cache, id, { text: result.text, editCount: result.editCount, editedAt: result.editedAt })),
  });
}

export function useDeleteMessage(channelId: string) {
  const update = useMessageCache(channelId);
  const commands = useMessageCommands();
  return useMutation({
    mutationFn: (id: string) => requireCommands(commands).deleteMessage(channelId, id),
    // Everyone else gets a `message.deleted` event; this removes it for the sender straight away.
    onSuccess: (_result, id) => update((cache) => removeMessage(cache, id)),
  });
}

export function useToggleReaction(channelId: string) {
  const update = useMessageCache(channelId);
  const commands = useMessageCommands();
  return useMutation({
    mutationFn: ({ id, emoji, present }: { id: string; emoji: string; present: boolean }) =>
      requireCommands(commands).setReaction(channelId, id, emoji, present),
    onSuccess: (reactions, { id }) => update((cache) => setReactions(cache, id, reactions)),
  });
}

export function useReportMessage() {
  return useMutation({
    mutationFn: ({ id, category, description }: { id: string; category: string; description?: string }) =>
      reportMessage(id, category, description),
  });
}
