import { useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadProgress } from "../transfers/store";
import { hasServerFilters, type ServerFilters } from "../../lib/searchFilters";
import { loadMessages, reportMessage, searchMessages, sendMessage } from "./api";
import { ApiError } from "../../services/api";
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
import { dropQueuedReactions, heldFiles, holdFiles, isLocalId, queueReaction, releaseFiles, takeQueuedReactions, toggleReaction } from "./pending";
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

/** Searches a channel (or a DM conversation) for `query`, narrowed by `filters`; either may be empty, not both. */
export function useMessageSearch(channelId: string, query: string, dm = false, filters: ServerFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["messages", "search", channelId, query, filters] as const,
    queryFn: () => searchMessages(channelId, query, 20, dm, filters),
    enabled: enabled && (query.length >= MIN_SEARCH_LENGTH ? true : query.length === 0 && hasServerFilters(filters)),
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
  if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 409 && error.status !== 429) {
    // The instance refused it (too large, not allowed...): say why; retrying won't help.
    return { message: error.message || "The message couldn't be sent.", retryable: false };
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
 * Sends with an optimistic message. The composer clears at once; the row shows as pending (with
 * on-device previews of any files), becomes the server's message once it has it, or turns into a
 * failed row with Retry. Every send carries a nonce that a retry reuses, so a message the server
 * did commit is never posted twice.
 *
 * Text goes over the socket; attachments cannot, so a message with files goes through the HTTP
 * upload route (which honours the nonce too).
 */
export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient();
  const commands = useMessageCommands();
  const update = useMessageCache(channelId);

  const post = useCallback(
    (input: { text: string; files: File[]; nonce: string; replyToMessageId?: string; onUploadProgress?: (loaded: number, total: number) => void }) =>
      input.files.length || !commands
        ? sendMessage(channelId, input)
        : commands.createMessage({ channelId, content: input.text, nonce: input.nonce, replyToMessageId: input.replyToMessageId }),
    [commands, channelId],
  );

  // Reactions added while the message was pending, sent now that it has its real id. The row keeps
  // showing them meanwhile; if one can't be added, the row falls back to what the server has.
  const flushReactions = useCallback(
    async (localId: string, message: Message) => {
      const emojis = takeQueuedReactions(localId);
      let reactions = message.reactions;
      for (const emoji of emojis) {
        try {
          reactions = await requireCommands(commands).setReaction(channelId, message.id, emoji, true);
        } catch {
          // The message itself is sent; a lost reaction is not worth an error.
        }
      }
      if (emojis.length) update((cache) => setReactions(cache, message.id, reactions));
    },
    [commands, channelId, update],
  );

  const deliver = useCallback(
    async (localId: string, nonce: string, text: string, replyToMessageId?: string) => {
      try {
        const message = await post({
          text,
          files: heldFiles(localId),
          nonce,
          replyToMessageId,
          onUploadProgress: (loaded, total) => uploadProgress.set(localId, { loaded, total }),
        });
        const cache = queryClient.getQueryData<MessageCache>(messageKeys.channel(channelId));
        const optimistic = flattenMessages(cache).find((m) => m.id === localId)?.reactions ?? [];
        releaseFiles(localId);
        update((c) => settlePending(c, localId, optimistic.length ? { ...message, reactions: optimistic } : message));
        void flushReactions(localId, message);
      } catch (error) {
        update((cache) => failPending(cache, localId, describeFailure(error)));
      } finally {
        uploadProgress.clear(localId);
      }
    },
    [post, queryClient, channelId, update, flushReactions],
  );

  /** A sticker is a message of its own: sent over HTTP (the route that resolves it), then shown as it arrives. */
  const sendSticker = useCallback(
    async (stickerId: string, replyTo?: ReplyPreview): Promise<void> => {
      const message = await sendMessage(channelId, { text: "", stickerIds: [stickerId], replyToMessageId: replyTo?.id, nonce: crypto.randomUUID() });
      update((cache) => upsertMessage(cache, message));
    },
    [channelId, update],
  );

  const send = useCallback(
    async ({ text, files = [], replyTo }: SendInput): Promise<void> => {
      const cached = queryClient.getQueryData<MessageCache>(messageKeys.channel(channelId));
      const replyToMessageId = replyTo?.id;
      const nonce = crypto.randomUUID();

      // Nothing on screen to show a pending row in: send and wait.
      if (!cached) {
        const message = await post({ text, files, nonce, replyToMessageId });
        update((cache) => upsertMessage(cache, message));
        return;
      }

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
        attachments: files.length ? holdFiles(localId, files) : [],
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
    [queryClient, channelId, update, post, deliver],
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

  const discard = useCallback(
    (localId: string) => {
      releaseFiles(localId);
      dropQueuedReactions(localId);
      update((cache) => removeMessage(cache, localId));
    },
    [update],
  );

  return { send, sendSticker, retry, discard };
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
  const queryClient = useQueryClient();
  const update = useMessageCache(channelId);
  const commands = useMessageCommands();
  return useMutation({
    mutationFn: async ({ id, emoji, present }: { id: string; emoji: string; present: boolean }) => {
      if (isLocalId(id)) {
        // Still sending: show it now and add it for real once the message has its id.
        queueReaction(id, emoji, present);
        const me = queryClient.getQueryData<UserProfile>(userKeys.profile)?.user_id ?? "";
        const cache = queryClient.getQueryData<MessageCache>(messageKeys.channel(channelId));
        return toggleReaction(flattenMessages(cache).find((m) => m.id === id)?.reactions ?? [], emoji, me, present);
      }
      return requireCommands(commands).setReaction(channelId, id, emoji, present);
    },
    onSuccess: (reactions, { id }) => update((cache) => setReactions(cache, id, reactions)),
  });
}

export function useReportMessage() {
  return useMutation({
    mutationFn: ({ id, category, description }: { id: string; category: string; description?: string }) =>
      reportMessage(id, category, description),
  });
}
