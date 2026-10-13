import { useEffect, useSyncExternalStore } from "react";
import { createLogger } from "../../lib/logger";
import { useMyProfile } from "../users/hooks";
import type { Conversation } from "./api";

/**
 * Which direct messages you haven't seen. Every message in a DM counts, whether or not it is a
 * reply, so a conversation shows a red count for each message that arrived while you weren't
 * looking at it. The server doesn't track this for DMs, so it is kept on this device, per account.
 *
 * Messages that arrive while the app is open are counted exactly. Ones that arrived while it was
 * closed show as a single unread (the conversation list says its last message is newer than when
 * you last opened it). Nothing from before this device first looked counts as unread, so a fresh
 * install doesn't start with every conversation lit up.
 */

const log = createLogger("dms");
const key = (userId: string) => `pb_dm_unread:${userId}`;

interface DmUnreadState {
  /** When this device first started keeping track. */
  since: string;
  /** Messages seen arriving, per conversation, since it was last opened. */
  counts: Record<string, number>;
  /** When each conversation was last opened. */
  read: Record<string, string>;
}

const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

export function readDmUnread(userId: string): DmUnreadState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(userId)) ?? "null") as Partial<DmUnreadState> | null;
    if (parsed && typeof parsed.since === "string") return { since: parsed.since, counts: parsed.counts ?? {}, read: parsed.read ?? {} };
  } catch {
    // Unreadable: start over below.
  }
  const fresh: DmUnreadState = { since: new Date().toISOString(), counts: {}, read: {} };
  save(userId, fresh);
  return fresh;
}

function save(userId: string, state: DmUnreadState): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch (error) {
    log.warn("couldn't save which direct messages are unread", error);
  }
}

/** A message arrived in a conversation you aren't looking at. */
export function noteIncomingDm(userId: string, conversationId: string): void {
  const state = readDmUnread(userId);
  state.counts[conversationId] = (state.counts[conversationId] ?? 0) + 1;
  save(userId, state);
  emit();
}

/** You opened (or are looking at) a conversation. */
export function markDmRead(userId: string, conversationId: string): void {
  const state = readDmUnread(userId);
  delete state.counts[conversationId];
  state.read[conversationId] = new Date().toISOString();
  save(userId, state);
  emit();
}

/** How many unread messages `conversation` has. */
export function unreadIn(state: DmUnreadState, conversation: Conversation): number {
  const seen = state.counts[conversation.id] ?? 0;
  if (seen > 0) return seen;
  if (conversation.lastMessageSenderIsMe || !conversation.lastMessageAt) return 0;
  const since = Date.parse(state.read[conversation.id] ?? state.since);
  return Date.parse(conversation.lastMessageAt) > since ? 1 : 0;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY: DmUnreadState = { since: "", counts: {}, read: {} };

/** The unread count of each conversation and their total, kept current as messages arrive. */
export function useDmUnread(conversations: Conversation[]): { countFor: (conversation: Conversation) => number; total: number } {
  const { data: me } = useMyProfile();
  useSyncExternalStore(subscribe, () => version);
  const state = me ? readDmUnread(me.user_id) : EMPTY;
  const countFor = (conversation: Conversation) => (me ? unreadIn(state, conversation) : 0);
  return { countFor, total: conversations.reduce((sum, c) => sum + countFor(c), 0) };
}

/** Marks a conversation read while it is open, and again whenever it changes. */
export function useMarkDmRead(conversationId: string): void {
  const { data: me } = useMyProfile();
  const userId = me?.user_id;
  useEffect(() => {
    if (userId && conversationId) markDmRead(userId, conversationId);
  }, [userId, conversationId]);
}
