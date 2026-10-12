import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessagePage, Reaction } from "./types";

/** Cached history for one channel. `pages[0]` is the newest page; later pages are older. */
export type MessageCache = InfiniteData<MessagePage, unknown>;

export const messageKeys = {
  channel: (channelId: string) => ["messages", channelId] as const,
};

function mapMessages(cache: MessageCache, fn: (message: Message) => Message): MessageCache {
  return { ...cache, pages: cache.pages.map((page) => ({ ...page, messages: page.messages.map(fn) })) };
}

/** Oldest-to-newest list for rendering. */
export function flattenMessages(cache: MessageCache | undefined): Message[] {
  if (!cache) return [];
  return [...cache.pages].reverse().flatMap((page) => page.messages);
}

/**
 * Add a message to the newest page, or merge it into the cached copy. Live pushes arrive
 * twice (broadcast plus catch-up) and the sender also gets its own message back, so this
 * has to be idempotent. A merge keeps cached reactions when the push carries none.
 */
export function upsertMessage(cache: MessageCache | undefined, message: Message): MessageCache | undefined {
  if (!cache) return cache;

  const exists = cache.pages.some((page) => page.messages.some((m) => m.id === message.id));
  if (exists) {
    return mapMessages(cache, (m) =>
      m.id === message.id ? { ...m, ...message, reactions: message.reactions.length > 0 ? message.reactions : m.reactions } : m,
    );
  }

  const [newest, ...older] = cache.pages;
  if (!newest) return cache;
  return { ...cache, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] };
}

export function patchMessage(cache: MessageCache | undefined, id: string, patch: Partial<Message>): MessageCache | undefined {
  return cache && mapMessages(cache, (m) => (m.id === id ? { ...m, ...patch } : m));
}

export function setReactions(cache: MessageCache | undefined, id: string, reactions: Reaction[]): MessageCache | undefined {
  return patchMessage(cache, id, { reactions });
}

export function removeMessage(cache: MessageCache | undefined, id: string): MessageCache | undefined {
  return (
    cache && {
      ...cache,
      pages: cache.pages.map((page) => ({ ...page, messages: page.messages.filter((m) => m.id !== id) })),
    }
  );
}

/** Swap a locally created message for the server's copy, whichever of the two arrived first. */
export function settlePending(cache: MessageCache | undefined, localId: string, message: Message): MessageCache | undefined {
  return upsertMessage(removeMessage(cache, localId), message);
}

export function failPending(cache: MessageCache | undefined, localId: string, failure: { message: string; retryable: boolean }): MessageCache | undefined {
  return patchMessage(cache, localId, { status: "failed", failure });
}

export function restartPending(cache: MessageCache | undefined, localId: string): MessageCache | undefined {
  return patchMessage(cache, localId, { status: "pending", failure: undefined });
}

const isLocal = (m: Message) => m.status !== undefined;
const time = (iso: string) => Date.parse(iso);

/** True when at least one message in the resynced window is already cached. */
export function overlapsCache(cache: MessageCache | undefined, messages: Message[]): boolean {
  if (!cache) return false;
  const ids = new Set(messages.map((m) => m.id));
  return cache.pages.some((page) => page.messages.some((m) => ids.has(m.id)));
}

/**
 * Bring a channel's cache in line with the server's recent window: add what is missing, take
 * the server's copy of what is there, and drop cached messages inside the window that the
 * server no longer has (deleted while this client was away). Messages this client is still
 * sending, or that failed to send, are never touched, and nothing older than the window is.
 */
export function reconcileWindow(cache: MessageCache | undefined, messages: Message[]): MessageCache | undefined {
  if (!cache || messages.length === 0) return cache;

  const windowStart = Math.min(...messages.map((m) => time(m.sentAt)));
  const ids = new Set(messages.map((m) => m.id));

  let next: MessageCache = {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((m) => isLocal(m) || ids.has(m.id) || time(m.sentAt) < windowStart),
    })),
  };
  for (const message of messages) next = upsertMessage(next, message) ?? next;
  return next;
}
