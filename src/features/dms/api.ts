import { authed } from "../../services/authed";
import { asPresence } from "../members/presence";
import { normalizeMessage, reactionsFromView, type WireMessage } from "../messages/normalize";
import type { Attachment, MessagePage, Reaction } from "../messages/types";
import type { PresenceStatus } from "../users/types";

const DMS = "/api/v1/dms";
/** The most the server returns per page. */
export const DM_PAGE_SIZE = 50;

/** One DM conversation, as the conversation list shows it. */
export interface Conversation {
  id: string;
  peerUserId: string;
  peerUsername: string;
  /** Home instance of the peer as the server reports it. */
  peerHost: string;
  peerAvatarUrl: string | null;
  peerStatus: PresenceStatus;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageSenderIsMe: boolean;
}

interface WireConversation {
  conversation_id: string;
  peer_user_id: string;
  peer_username: string;
  peer_origin_server?: string | null;
  peer_avatar_url?: string | null;
  peer_status?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_message_sender_is_me?: boolean;
}

/**
 * How to address a peer in the DM API: a bare username on this instance, `name@host` for
 * someone on another. `myHost` is the viewer's own instance (from their profile).
 */
export function peerHandle(person: { username: string; host: string }, myHost?: string): string {
  const remote = person.host && person.host !== myHost;
  return remote ? `${person.username}@${person.host}` : person.username;
}

export async function listConversations(): Promise<Conversation[]> {
  const { conversations } = await authed.query<{ conversations?: WireConversation[] }>("GET", `${DMS}/conversations`);
  return (conversations ?? []).map((c) => ({
    id: c.conversation_id,
    peerUserId: c.peer_user_id,
    peerUsername: c.peer_username,
    peerHost: c.peer_origin_server ?? "",
    peerAvatarUrl: c.peer_avatar_url ?? null,
    peerStatus: asPresence(c.peer_status ?? undefined),
    lastMessageAt: c.last_message_at ?? null,
    lastMessagePreview: c.last_message_preview ?? "",
    lastMessageSenderIsMe: c.last_message_sender_is_me === true,
  }));
}

/** Page 1 is the newest messages; each page is oldest first. */
export async function loadDirectMessages(peer: string, page: number): Promise<{ conversationId: string; page: MessagePage }> {
  const data = await authed.query<{ conversation_id: string; messages?: WireMessage[] }>("GET", `${DMS}/messages`, {
    query: { peer, page, messages_per_page: DM_PAGE_SIZE },
  });
  const messages = (data.messages ?? []).map((raw) => normalizeMessage(raw, data.conversation_id));
  return {
    conversationId: data.conversation_id,
    page: { messages, nextCursor: messages.length >= DM_PAGE_SIZE ? String(page + 1) : null },
  };
}

/** Uploads one file for a DM; the message then refers to it by URL. */
export async function uploadAttachment(file: File): Promise<Attachment> {
  const form = new FormData();
  form.set("file", file);
  form.set("directory", "attachments");
  const uploaded = await authed.query<{ url: string; filename?: string; type?: string; size?: number }>("POST", "/api/v1/storage/upload", {
    form,
    timeout: 60_000,
  });
  return { url: uploaded.url, filename: uploaded.filename ?? file.name, type: uploaded.type ?? file.type, size: uploaded.size ?? file.size };
}

export async function sendDirectMessage(input: {
  peer: string;
  text: string;
  attachments: Attachment[];
  replyToMessageId?: string;
}): Promise<{ conversationId: string; messageId: string }> {
  const { result } = await authed.body<{ result: { conversation_id: string; message_id: string } }>("POST", `${DMS}/send`, {
    peer: input.peer,
    message: input.text,
    attachments: input.attachments,
    ...(input.replyToMessageId ? { reply_to_message_id: input.replyToMessageId } : {}),
  });
  return { conversationId: result.conversation_id, messageId: result.message_id };
}

/** Where a message is forwarded to: the DM with a person, or a channel of this instance. */
export type ForwardTarget = { peer: string } | { channelId: string };

/**
 * Forwards a message (a channel's or a DM's). `peer` is a bare username here or `name@host` for
 * someone on another instance. The server re-sends the text and attachments as the caller and
 * marks the copy as forwarded. For a DM it also says which conversation that is.
 */
export async function forwardMessage(messageId: string, target: ForwardTarget): Promise<{ conversationId: string | null }> {
  const body = "peer" in target ? { peer: target.peer } : { channel_id: target.channelId };
  const { result } = await authed.body<{ result?: { conversation_id?: string } }>("POST", `/api/v1/messages/${encodeURIComponent(messageId)}/forward`, body);
  return { conversationId: result?.conversation_id ?? null };
}

export async function editDirectMessage(messageId: string, text: string) {
  const result = await authed.body<{ message: string; edit_count: number; last_edited_at: string | null }>(
    "PATCH",
    `${DMS}/messages/${encodeURIComponent(messageId)}`,
    { message: text },
  );
  return { text: result.message, editCount: result.edit_count, editedAt: result.last_edited_at };
}

export async function deleteDirectMessage(messageId: string): Promise<void> {
  await authed.query("DELETE", `${DMS}/messages/${encodeURIComponent(messageId)}`);
}

export async function setDirectReaction(messageId: string, emoji: string, present: boolean): Promise<Reaction[]> {
  const path = `${DMS}/messages/${encodeURIComponent(messageId)}/reactions`;
  const result = present
    ? await authed.body<{ reactions?: unknown }>("POST", path, { emoji })
    : await authed.query<{ reactions?: unknown }>("DELETE", path, { query: { emoji } });
  return reactionsFromView(result.reactions);
}
