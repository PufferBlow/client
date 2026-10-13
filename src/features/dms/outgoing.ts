import { createLogger } from "../../lib/logger";
import type { Conversation } from "./api";

/**
 * The server only lists a conversation once the other person has written back: it can't tell who
 * an outgoing-only conversation is with. So that a DM you just sent doesn't vanish from the list,
 * the client keeps its own record of the conversations it started, per account, and shows them
 * until the server knows them too.
 */

const log = createLogger("dms");
const key = (userId: string) => `pb_dm_outgoing:${userId}`;

export function readOutgoing(userId: string): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Conversation[]).filter((c) => typeof c?.id === "string" && typeof c.peerUsername === "string") : [];
  } catch {
    return [];
  }
}

function write(userId: string, conversations: Conversation[]): void {
  try {
    if (conversations.length === 0) localStorage.removeItem(key(userId));
    else localStorage.setItem(key(userId), JSON.stringify(conversations));
  } catch (error) {
    log.warn("couldn't save the conversations you started", error);
  }
}

/** Records (or refreshes) a conversation this account started. */
export function rememberOutgoing(userId: string, conversation: Conversation): void {
  const others = readOutgoing(userId).filter((c) => c.id !== conversation.id);
  write(userId, [conversation, ...others].slice(0, 200));
  log.debug(`remembered the conversation with ${conversation.peerUsername}`, { id: conversation.id });
}

const time = (c: Conversation) => (c.lastMessageAt ? Date.parse(c.lastMessageAt) || 0 : 0);

/** The server's list plus the conversations only this client knows about, most recent first. */
export function mergeOutgoing(server: Conversation[], userId: string | undefined): Conversation[] {
  if (!userId) return server;
  const known = new Set(server.map((c) => c.id));
  const local = readOutgoing(userId);
  // Once the server lists a conversation it is the better source, so the local copy is dropped.
  const stale = local.filter((c) => known.has(c.id));
  if (stale.length > 0) write(userId, local.filter((c) => !known.has(c.id)));
  const extra = local.filter((c) => !known.has(c.id));
  return extra.length === 0 ? server : [...server, ...extra].sort((a, b) => time(b) - time(a));
}

/** A conversation entry for someone addressed as `name` (this instance) or `name@host`. */
export function conversationFor(input: {
  id: string;
  peer: string;
  myHost: string;
  preview: string;
}): Conversation {
  const at = input.peer.lastIndexOf("@");
  const username = at > 0 ? input.peer.slice(0, at) : input.peer;
  return {
    id: input.id,
    peerUserId: input.peer, // only an avatar seed until the server says who it is
    peerUsername: username,
    peerHost: at > 0 ? input.peer.slice(at + 1) : input.myHost,
    peerAvatarUrl: null,
    peerStatus: "offline",
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: input.preview,
    lastMessageSenderIsMe: true,
  };
}
