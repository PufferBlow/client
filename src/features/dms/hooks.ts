import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "../messages/cache";
import { dropQueuedReactions, holdFiles, isLocalId, queueReaction, releaseFiles, takeQueuedReactions, toggleReaction } from "../messages/pending";
import type { Message, ReplyPreview } from "../messages/types";
import { userKeys } from "../users/hooks";
import type { UserProfile } from "../users/types";
import {
  deleteDirectMessage,
  editDirectMessage,
  listConversations,
  loadDirectMessages,
  sendDirectMessage,
  setDirectReaction,
  uploadAttachment,
} from "./api";
import { combinedProgress, uploadProgress } from "../transfers/store";
import { dmKeys } from "./keys";
import { conversationFor, mergeOutgoing, rememberOutgoing } from "./outgoing";

/** The server's conversations plus the ones you started that it doesn't list yet (see `outgoing.ts`). */
export function useConversations() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: dmKeys.conversations,
    queryFn: async () => mergeOutgoing(await listConversations(), queryClient.getQueryData<UserProfile>(userKeys.profile)?.user_id),
    staleTime: 30_000,
  });
}

/** A conversation's history, newest page first; kept live by `dm.*` events. */
export function useDirectMessages(conversationId: string, peer: string) {
  const query = useInfiniteQuery({
    queryKey: messageKeys.channel(conversationId),
    queryFn: async ({ pageParam }) => (await loadDirectMessages(peer, Number(pageParam))).page,
    initialPageParam: "1" as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: Infinity,
    enabled: peer.length > 0,
  });
  return { ...query, messages: flattenMessages(query.data) };
}

/**
 * Opens the DM with `peer`: loads its newest page (which also says which conversation it is),
 * seeds the cache with it and goes there.
 */
export function useOpenDirectMessage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (peer: string) => loadDirectMessages(peer, 1),
    onSuccess: ({ conversationId, page }, peer) => {
      queryClient.setQueryData<MessageCache>(messageKeys.channel(conversationId), (cache) => cache ?? { pages: [page], pageParams: ["1"] });
      navigate(`/dashboard/dms/${encodeURIComponent(conversationId)}?peer=${encodeURIComponent(peer)}`);
    },
  });
}

function useConversationCache(conversationId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (update: (cache: MessageCache | undefined) => MessageCache | undefined) =>
      queryClient.setQueryData<MessageCache>(messageKeys.channel(conversationId), update),
    [queryClient, conversationId],
  );
}

interface SendInput {
  text: string;
  files?: File[];
  replyTo?: ReplyPreview;
}

/** What each pending or failed row needs to be retried (files can't live in the message cache). */
const pendingInputs = new Map<string, SendInput>();

/**
 * Sends with an optimistic pending row, like a channel: it settles into the real message once
 * the server has it, or turns into a failed row with Retry. Files are uploaded first.
 */
export function useSendDirectMessage(conversationId: string, peer: string) {
  const queryClient = useQueryClient();
  const update = useConversationCache(conversationId);

  const flushReactions = useCallback(
    async (localId: string, messageId: string) => {
      const emojis = takeQueuedReactions(localId);
      if (!emojis.length) return;
      let reactions: Message["reactions"] = [];
      for (const emoji of emojis) {
        try {
          reactions = await setDirectReaction(messageId, emoji, true);
        } catch {
          // The message itself is sent; a lost reaction is not worth an error.
        }
      }
      update((cache) => setReactions(cache, messageId, reactions));
    },
    [update],
  );

  const deliver = useCallback(
    async (localId: string, input: SendInput) => {
      try {
        const files = input.files ?? [];
        const forFile = combinedProgress(
          files.map((f) => f.size),
          (progress) => uploadProgress.set(localId, progress),
        );
        const attachments = await Promise.all(files.map((file, i) => uploadAttachment(file, forFile(i))));
        const { messageId, conversationId: sentTo } = await sendDirectMessage({ peer, text: input.text, attachments, replyToMessageId: input.replyTo?.id });
        const me = queryClient.getQueryData<UserProfile>(userKeys.profile);
        // The server won't list this conversation until they answer, so keep it ourselves.
        if (me) {
          rememberOutgoing(
            me.user_id,
            conversationFor({ id: sentTo || conversationId, peer, myHost: me.origin_server ?? "", preview: input.text || "Attachment" }),
          );
        }
        const sent: Message = {
          id: messageId,
          channelId: conversationId,
          authorId: me?.user_id ?? "",
          authorName: me?.username ?? "You",
          authorAvatarUrl: me?.avatar_url ?? null,
          text: input.text,
          sentAt: new Date().toISOString(),
          attachments,
          reactions: [],
          editCount: 0,
          editedAt: null,
          ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        };
        pendingInputs.delete(localId);
        releaseFiles(localId);
        // Reactions added while it was sending: keep showing them, then add them for real.
        const optimistic = flattenMessages(queryClient.getQueryData<MessageCache>(messageKeys.channel(conversationId))).find((m) => m.id === localId)?.reactions ?? [];
        update((cache) => settlePending(cache, localId, { ...sent, reactions: optimistic }));
        void flushReactions(localId, messageId);
        void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
      } catch {
        update((cache) => failPending(cache, localId, { message: "The message couldn't be sent.", retryable: true }));
      } finally {
        uploadProgress.clear(localId);
      }
    },
    [peer, conversationId, queryClient, update, flushReactions],
  );

  const send = useCallback(
    async (input: SendInput): Promise<void> => {
      const nonce = crypto.randomUUID();
      const localId = `local_${nonce}`;
      const me = queryClient.getQueryData<UserProfile>(userKeys.profile);
      const pending: Message = {
        id: localId,
        channelId: conversationId,
        authorId: me?.user_id ?? "",
        authorName: me?.username ?? "You",
        authorAvatarUrl: me?.avatar_url ?? null,
        text: input.text,
        sentAt: new Date().toISOString(),
        attachments: input.files?.length ? holdFiles(localId, input.files) : [],
        reactions: [],
        editCount: 0,
        editedAt: null,
        status: "pending",
        nonce,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      };
      pendingInputs.set(localId, input);
      update((cache) => upsertMessage(cache ?? { pages: [{ messages: [], nextCursor: null }], pageParams: ["1"] }, pending));
      await deliver(localId, input);
    },
    [queryClient, conversationId, update, deliver],
  );

  const retry = useCallback(
    (localId: string) => {
      const input = pendingInputs.get(localId);
      if (!input) return;
      update((cache) => restartPending(cache, localId));
      void deliver(localId, input);
    },
    [update, deliver],
  );

  const discard = useCallback(
    (localId: string) => {
      pendingInputs.delete(localId);
      releaseFiles(localId);
      dropQueuedReactions(localId);
      update((cache) => removeMessage(cache, localId));
    },
    [update],
  );

  return { send, retry, discard };
}

export function useEditDirectMessage(conversationId: string) {
  const update = useConversationCache(conversationId);
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => editDirectMessage(id, text),
    onSuccess: (result, { id }) => update((cache) => patchMessage(cache, id, result)),
  });
}

export function useDeleteDirectMessage(conversationId: string) {
  const update = useConversationCache(conversationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDirectMessage(id),
    onSuccess: (_result, id) => {
      update((cache) => removeMessage(cache, id));
      void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
    },
  });
}

export function useToggleDirectReaction(conversationId: string) {
  const queryClient = useQueryClient();
  const update = useConversationCache(conversationId);
  return useMutation({
    mutationFn: async ({ id, emoji, present }: { id: string; emoji: string; present: boolean }) => {
      if (isLocalId(id)) {
        // Still sending: show it now and add it for real once the message has its id.
        queueReaction(id, emoji, present);
        const me = queryClient.getQueryData<UserProfile>(userKeys.profile)?.user_id ?? "";
        const cache = queryClient.getQueryData<MessageCache>(messageKeys.channel(conversationId));
        return toggleReaction(flattenMessages(cache).find((m) => m.id === id)?.reactions ?? [], emoji, me, present);
      }
      return setDirectReaction(id, emoji, present);
    },
    onSuccess: (reactions, { id }) => update((cache) => setReactions(cache, id, reactions)),
  });
}
