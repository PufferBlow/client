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
import { dmKeys } from "./keys";

export function useConversations() {
  return useQuery({ queryKey: dmKeys.conversations, queryFn: listConversations, staleTime: 30_000 });
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

  const deliver = useCallback(
    async (localId: string, input: SendInput) => {
      try {
        const attachments = await Promise.all((input.files ?? []).map(uploadAttachment));
        const { messageId } = await sendDirectMessage({ peer, text: input.text, attachments, replyToMessageId: input.replyTo?.id });
        const me = queryClient.getQueryData<UserProfile>(userKeys.profile);
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
        update((cache) => settlePending(cache, localId, sent));
        void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
      } catch {
        update((cache) => failPending(cache, localId, { message: "The message couldn't be sent.", retryable: true }));
      }
    },
    [peer, conversationId, queryClient, update],
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
        attachments: [],
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
  const update = useConversationCache(conversationId);
  return useMutation({
    mutationFn: ({ id, emoji, present }: { id: string; emoji: string; present: boolean }) => setDirectReaction(id, emoji, present),
    onSuccess: (reactions, { id }) => update((cache) => setReactions(cache, id, reactions)),
  });
}
