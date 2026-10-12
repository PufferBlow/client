import { messageFromView, reactionsFromView } from "../messages/normalize";
import type { Message, Reaction } from "../messages/types";
import { asPresence } from "../members/presence";
import type { PresenceStatus } from "../users/types";
import type { EventFrame } from "./protocol";

export type RealtimeEvent =
  | { kind: "message"; message: Message }
  | { kind: "message_edited"; channelId: string; messageId: string; text: string; editCount: number; editedAt: string | null }
  | { kind: "message_deleted"; channelId: string; messageId: string }
  | { kind: "reactions"; channelId: string; messageId: string; reactions: Reaction[] }
  | { kind: "presence"; userId: string; status: PresenceStatus }
  /** A channel was renamed, changed privacy, deleted, or this connection lost access to it. */
  | { kind: "channel"; channelId: string; change: "updated" | "deleted" | "revoked" }
  | { kind: "notification" };

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

    case "channel.updated":
      if (data.deleted === true) return { kind: "channel", channelId, change: "deleted" };
      if (data.access === "revoked") return { kind: "channel", channelId, change: "revoked" };
      return { kind: "channel", channelId, change: "updated" };

    case "notification.created":
      return { kind: "notification" };

    default:
      return null;
  }
}
