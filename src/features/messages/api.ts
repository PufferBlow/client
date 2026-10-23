import { api } from "../../services/api";
import { authed, requireSession } from "../../services/authed";
import { normalizeMessage, type WireMessage } from "./normalize";
import type { Message, MessagePage } from "./types";

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
/** Sends over HTTP (the route that takes attachments). A retry with the same `nonce` never posts twice. */
export async function sendMessage(
  channelId: string,
  input: { text: string; files?: File[]; replyToMessageId?: string; nonce?: string; onUploadProgress?: (loaded: number, total: number) => void },
): Promise<Message> {
  const { origin, token } = requireSession();
  const form = new FormData();
  form.set("auth_token", token);
  form.set("message", input.text);
  for (const file of input.files ?? []) form.append("attachments", file);
  if (input.replyToMessageId) form.set("reply_to_message_id", input.replyToMessageId);
  if (input.nonce) form.set("nonce", input.nonce);

  const { message_data } = await api.post<SendMessageResponse>(`${origin}${channelPath(channelId)}/send_message`, {
    form,
    timeout: 60_000,
    ...(input.onUploadProgress && input.files?.length ? { onUploadProgress: input.onUploadProgress } : {}),
  });
  return normalizeMessage(message_data, channelId);
}

interface SearchResponse {
  messages: WireMessage[];
  scanned: number;
  truncated_scan: boolean;
}

export interface SearchResult {
  /** Newest first. */
  messages: Message[];
  /** How many recent messages the server looked through. */
  scanned: number;
  /** True when the channel had more history than the server scans, so older matches may be missing. */
  truncated: boolean;
}

/** Substring search over a channel's recent messages (the server decrypts and scans them; there is no full-text index). */
export async function searchMessages(channelId: string, query: string, limit = 20): Promise<SearchResult> {
  const res = await authed.query<SearchResponse>("GET", `${channelPath(channelId)}/search`, { query: { q: query, limit } });
  return { messages: (res.messages ?? []).map((m) => normalizeMessage(m, channelId)), scanned: res.scanned ?? 0, truncated: res.truncated_scan === true };
}

/** Files a moderation report for a message; the server checks you can see its channel. */
export async function reportMessage(messageId: string, category: string, description?: string): Promise<void> {
  await authed.body("POST", "/api/v1/moderation/reports/messages", {
    message_ids: [messageId],
    category,
    ...(description ? { description } : {}),
  });
}
