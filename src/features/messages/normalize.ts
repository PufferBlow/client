import { callLogOf } from "../calls/log";
import type { Attachment, Message, Reaction, ReplyPreview } from "./types";

/**
 * A message arrives in two shapes: the live broadcast / send response (`username`) and the
 * hydrated database shape used by history and catch-up pushes (`sender_username`).
 * Fields are all optional here so one normalizer can handle both.
 */
export interface WireMessage {
  message_id: string;
  channel_id?: string;
  sender_user_id?: string;
  /** Always "" in history responses; `sender_user_id` holds the real id. */
  sender_id?: string;
  username?: string;
  sender_username?: string;
  sender_avatar_url?: string | null;
  message?: string;
  sent_at: string;
  attachments?: Attachment[] | null;
  reactions?: { emoji: string; count?: number; user_ids?: string[] }[] | null;
  edit_count?: number;
  last_edited_at?: string | null;
  reply_to_message_id?: string | null;
  reply_to?: unknown;
  forwarded_from_message_id?: string | null;
}

export function normalizeReactions(raw: WireMessage["reactions"]): Reaction[] {
  return (raw ?? []).map((r) => ({
    emoji: r.emoji,
    userIds: r.user_ids ?? [],
    count: r.count ?? r.user_ids?.length ?? 0,
  }));
}

/**
 * The answered message's preview, from `reply_to` (both wire shapes use the same object). A reply
 * whose preview is missing still points at its target, shown as unavailable.
 */
export function replyFromWire(preview: unknown, replyToId: unknown): ReplyPreview | undefined {
  const fields = preview && typeof preview === "object" && !Array.isArray(preview) ? (preview as Record<string, unknown>) : null;
  const id = (fields && typeof fields.message_id === "string" ? fields.message_id : null) ?? (typeof replyToId === "string" && replyToId ? replyToId : null);
  if (!id) return undefined;
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    id,
    authorId: str(fields?.author_id),
    authorName: str(fields?.author_name),
    authorAvatarUrl: typeof fields?.author_avatar_url === "string" ? fields.author_avatar_url : null,
    text: str(fields?.content),
    hasAttachments: fields?.has_attachments === true,
    deleted: !fields || fields.deleted === true,
  };
}

/** `{ replyTo }` for a reply, nothing otherwise (so plain messages keep their exact shape). */
/** `{ forwarded: true }` for a forwarded message. The original's id is dropped on purpose. */
const forwardedField = (fromId: unknown) => (typeof fromId === "string" && fromId ? { forwarded: true as const } : {});

const replyField = (preview: unknown, replyToId: unknown) => {
  const replyTo = replyFromWire(preview, replyToId);
  return replyTo ? { replyTo } : {};
};

export function normalizeMessage(raw: WireMessage, fallbackChannelId = ""): Message {
  return {
    id: raw.message_id,
    channelId: raw.channel_id || fallbackChannelId,
    authorId: raw.sender_user_id || raw.sender_id || "",
    authorName: raw.username || raw.sender_username || "Unknown user",
    authorAvatarUrl: raw.sender_avatar_url ?? null,
    text: raw.message ?? "",
    sentAt: raw.sent_at,
    attachments: raw.attachments ?? [],
    reactions: normalizeReactions(raw.reactions),
    editCount: raw.edit_count ?? 0,
    editedAt: raw.last_edited_at ?? null,
    ...replyField(raw.reply_to, raw.reply_to_message_id),
    ...forwardedField(raw.forwarded_from_message_id),
    // A call's line is a notice about the conversation, not something a person wrote.
    ...(callLogOf(raw.attachments ?? undefined) ? { kind: "system" as const } : {}),
  };
}

/** True when the payload looks like a chat message (live pushes carry no `type`). */
export function isWireMessage(value: unknown): value is WireMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.message_id === "string" && typeof v.sent_at === "string" && !("type" in v);
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * Message object of protocol v1 (`message.created`, `message.create` acks, `events.resync`).
 * Returns null for anything without an id and a timestamp rather than guessing.
 */
export function messageFromView(view: unknown, fallbackChannelId = ""): Message | null {
  if (!record(view)) return null;
  const id = text(view.id);
  const sentAt = text(view.created_at);
  if (id === null || sentAt === null) return null;

  return {
    id,
    channelId: text(view.channel_id) || fallbackChannelId,
    authorId: text(view.author_id) ?? "",
    authorName: text(view.author_name) || "Unknown user",
    authorAvatarUrl: text(view.author_avatar_url),
    text: text(view.content) ?? "",
    sentAt,
    attachments: Array.isArray(view.attachments) ? (view.attachments as Attachment[]) : [],
    reactions: normalizeReactions(Array.isArray(view.reactions) ? (view.reactions as WireMessage["reactions"]) : []),
    editCount: typeof view.edit_count === "number" ? view.edit_count : 0,
    editedAt: text(view.last_edited_at),
    ...replyField(view.reply_to, view.reply_to_message_id),
    ...forwardedField(view.forwarded_from_message_id),
  };
}

/** Reaction list as it appears in v1 events and acks. */
export function reactionsFromView(view: unknown): Reaction[] {
  return normalizeReactions(Array.isArray(view) ? (view as WireMessage["reactions"]) : []);
}
