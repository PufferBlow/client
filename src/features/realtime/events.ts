import { messageFromView, normalizeMessage, reactionsFromView, type WireMessage } from "../messages/normalize";
import type { Message, Reaction } from "../messages/types";
import { asPresence } from "../members/presence";
import type { PresenceStatus } from "../users/types";
import type { EventFrame } from "./protocol";

export type RealtimeEvent =
  /** `dm` marks direct messages (their `channelId` is the conversation id). */
  | { kind: "message"; message: Message; dm?: boolean }
  | { kind: "message_edited"; channelId: string; messageId: string; text: string; editCount: number; editedAt: string | null }
  | { kind: "message_deleted"; channelId: string; messageId: string; dm?: boolean }
  | { kind: "reactions"; channelId: string; messageId: string; reactions: Reaction[] }
  | { kind: "presence"; userId: string; status: PresenceStatus }
  /**
   * A channel was renamed or changed privacy, deleted, or this connection lost access to it; or it
   * was created or shared with this connection, which the server has already subscribed.
   */
  | { kind: "channel"; channelId: string; change: "updated" | "deleted" | "revoked" | "created" | "granted" }
  | { kind: "notification" }
  /** Someone started typing; `scope` is the channel id, or the conversation id for a DM. */
  | { kind: "typing"; scope: string; userId: string; expiresInMs: number };

/** Used when a server leaves `expires_in_ms` out; matches the server's own default. */
const DEFAULT_TYPING_MS = 8_000;

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** Map a v1 event frame to what the cache layer understands. Unknown event names are ignored. */
export function toRealtimeEvent(frame: EventFrame): RealtimeEvent | null {
  const { data } = frame;
  const channelId = str(data.channel_id) || frame.channelId || "";

  switch (frame.name) {
    case "message.created": {
      const message = messageFromView(data, channelId);
      return message ? { kind: "message", message } : null;
    }

    case "message.updated":
      return {
        kind: "message_edited",
        channelId,
        messageId: str(data.id),
        text: str(data.content),
        editCount: typeof data.edit_count === "number" ? data.edit_count : 0,
        editedAt: typeof data.last_edited_at === "string" ? data.last_edited_at : null,
      };

    case "message.deleted":
      return { kind: "message_deleted", channelId, messageId: str(data.id) };

    case "reaction.added":
    case "reaction.removed":
      return { kind: "reactions", channelId, messageId: str(data.message_id), reactions: reactionsFromView(data.reactions) };

    case "presence.changed":
      return { kind: "presence", userId: str(data.user_id), status: asPresence(str(data.status)) };

    case "channel.created":
      return { kind: "channel", channelId, change: "created" };

    case "channel.updated":
      if (data.deleted === true) return { kind: "channel", channelId, change: "deleted" };
      if (data.access === "revoked") return { kind: "channel", channelId, change: "revoked" };
      if (data.access === "granted") return { kind: "channel", channelId, change: "granted" };
      return { kind: "channel", channelId, change: "updated" };

    case "notification.created":
      return { kind: "notification" };

    case "typing.started": {
      const scope = str(data.conversation_id) || channelId;
      const userId = str(data.user_id);
      if (!scope || !userId) return null;
      const expires = typeof data.expires_in_ms === "number" && data.expires_in_ms > 0 ? data.expires_in_ms : DEFAULT_TYPING_MS;
      return { kind: "typing", scope, userId, expiresInMs: Math.min(expires, 30_000) };
    }

    // Direct messages: the conversation id stands in for the channel id.
    case "dm.message.created": {
      const conversationId = str(data.conversation_id);
      if (!conversationId || !str(data.message_id)) return null;
      const wire = { ...data, sent_at: str(data.sent_at) || new Date().toISOString() } as unknown as WireMessage;
      return { kind: "message", message: normalizeMessage(wire, conversationId), dm: true };
    }

    case "dm.message.updated":
      return {
        kind: "message_edited",
        channelId: str(data.conversation_id),
        messageId: str(data.message_id),
        text: str(data.message),
        editCount: typeof data.edit_count === "number" ? data.edit_count : 0,
        editedAt: typeof data.last_edited_at === "string" ? data.last_edited_at : null,
      };

    case "dm.message.deleted":
      return { kind: "message_deleted", channelId: str(data.conversation_id), messageId: str(data.message_id), dm: true };

    case "dm.reaction.updated":
      return { kind: "reactions", channelId: str(data.conversation_id), messageId: str(data.message_id), reactions: reactionsFromView(data.reactions) };

    default:
      return null;
  }
}
