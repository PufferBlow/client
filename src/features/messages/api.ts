import { api } from "../../services/api";
import { authed, requireSession } from "../../services/authed";
import { normalizeMessage, normalizeReactions, type WireMessage } from "./normalize";
import type { Message, MessagePage, Reaction } from "./types";

export const PAGE_SIZE = 30;

const channelPath = (channelId: string) => `/api/v1/channels/${encodeURIComponent(channelId)}`;

interface LoadMessagesResponse {
  messages: WireMessage[];
  next_cursor: string | null;
}

/**
 * History has two modes. The first page uses `page=1` (newest N, oldest-first) and returns no
 * cursor; older pages use `before_cursor` (newest-first). Both are returned oldest-first here,
 * and a cursor is derived from the oldest message on the first page.
 */
export async function loadMessages(channelId: string, cursor: string | null): Promise<MessagePage> {
  const { messages, next_cursor } = await authed.query<LoadMessagesResponse>("GET", `${channelPath(channelId)}/load_messages`, {
    query: cursor ? { before_cursor: cursor, messages_per_page: PAGE_SIZE } : { page: 1, messages_per_page: PAGE_SIZE },
  });

  const normalized = (messages ?? []).map((m) => normalizeMessage(m, channelId));

  if (cursor) return { messages: normalized.reverse(), nextCursor: next_cursor };

  const oldest = normalized[0];
  const hasMore = normalized.length >= PAGE_SIZE && oldest !== undefined;
  return { messages: normalized, nextCursor: hasMore ? `${oldest.sentAt}|${oldest.id}` : null };
}

interface SendMessageResponse {
  message_data: WireMessage;
}

/** `send_message` is multipart and reads `auth_token` from a form field rather than the query. */
export async function sendMessage(channelId: string, input: { text: string; files?: File[] }): Promise<Message> {
  const { origin, token } = requireSession();
  const form = new FormData();
  form.set("auth_token", token);
  form.set("message", input.text);
  for (const file of input.files ?? []) form.append("attachments", file);

  const { message_data } = await api.post<SendMessageResponse>(`${origin}${channelPath(channelId)}/send_message`, {
    form,
    timeout: 60_000,
  });
  return normalizeMessage(message_data, channelId);
}

export interface EditResult {
  message: string;
  editCount: number;
  editedAt: string | null;
}

export async function editMessage(channelId: string, messageId: string, text: string): Promise<EditResult> {
  const res = await authed.body<{ message: string; edit_count: number; last_edited_at: string | null }>(
    "PATCH",
    `${channelPath(channelId)}/messages/${encodeURIComponent(messageId)}`,
    { message: text },
  );
  return { message: res.message, editCount: res.edit_count, editedAt: res.last_edited_at };
}

export async function deleteMessage(channelId: string, messageId: string): Promise<void> {
  await authed.query("DELETE", `${channelPath(channelId)}/delete_message`, { query: { message_id: messageId } });
}

interface ReactionResponse {
  reactions: { emoji: string; count: number; user_ids: string[] }[];
}

/** Add or remove the viewer's reaction; resolves with the message's full reaction list. */
export async function setReaction(channelId: string, messageId: string, emoji: string, present: boolean): Promise<Reaction[]> {
  const path = `${channelPath(channelId)}/messages/${encodeURIComponent(messageId)}/reactions`;
  const res = await authed.query<ReactionResponse>(present ? "POST" : "DELETE", path, { query: { emoji } });
  return normalizeReactions(res.reactions);
}

/** Files a moderation report for a message; the server checks you can see its channel. */
export async function reportMessage(messageId: string, category: string, description?: string): Promise<void> {
  await authed.body("POST", "/api/v1/moderation/reports/messages", {
    message_ids: [messageId],
    category,
    ...(description ? { description } : {}),
  });
}
