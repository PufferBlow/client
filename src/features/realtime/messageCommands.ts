import { messageFromView, reactionsFromView } from "../messages/normalize";
import type { Message, Reaction } from "../messages/types";
import { CommandError, type CommandClient, type SendOptions } from "./commands";

/** What the message hooks need from the socket. `RealtimeSession` provides it. */
export interface MessageCommands {
  createMessage(
    input: { channelId: string; content: string; nonce: string; replyToMessageId?: string },
    options?: SendOptions,
  ): Promise<Message>;
  editMessage(channelId: string, messageId: string, content: string): Promise<EditResult>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  setReaction(channelId: string, messageId: string, emoji: string, present: boolean): Promise<Reaction[]>;
}

export interface EditResult {
  text: string;
  editCount: number;
  editedAt: string | null;
}

export interface ResyncResult {
  messages: Message[];
  seq: number | null;
  epoch: string | null;
}

export interface SubscribeResult {
  seq: number | null;
  epoch: string | null;
}

const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const malformed = (what: string) => new CommandError("INTERNAL", `The server sent an unreadable ${what}.`, false);

export const DEFAULT_RESYNC_LIMIT = 50;

export function messageCommands(client: CommandClient): MessageCommands {
  return {
    async createMessage({ channelId, content, nonce, replyToMessageId }, options) {
      const result = await client.send<{ message?: unknown }>(
        "message.create",
        { channel_id: channelId, content, nonce, ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}) },
        options,
      );
      const message = messageFromView(result.message, channelId);
      if (!message) throw malformed("message");
      return message;
    },

    async editMessage(channelId, messageId, content) {
      const result = await client.send("message.edit", { channel_id: channelId, message_id: messageId, content });
      return {
        text: asString(result.content) ?? content,
        editCount: asNumber(result.edit_count) ?? 0,
        editedAt: asString(result.last_edited_at),
      };
    },

    async deleteMessage(channelId, messageId) {
      await client.send("message.delete", { channel_id: channelId, message_id: messageId });
    },

    async setReaction(channelId, messageId, emoji, present) {
      const result = await client.send(present ? "reaction.add" : "reaction.remove", {
        channel_id: channelId,
        message_id: messageId,
        emoji,
      });
      return reactionsFromView(result.reactions);
    },
  };
}

export async function resyncChannel(client: CommandClient, channelId: string, limit = DEFAULT_RESYNC_LIMIT): Promise<ResyncResult> {
  const result = await client.send("events.resync", { channel_id: channelId, limit });
  const raw = Array.isArray(result.messages) ? result.messages : [];
  return {
    messages: raw.flatMap((view) => messageFromView(view, channelId) ?? []),
    seq: asNumber(result.seq),
    epoch: asString(result.epoch),
  };
}

export async function subscribeChannel(client: CommandClient, channelId: string): Promise<SubscribeResult> {
  const result = await client.send("channel.subscribe", { channel_id: channelId });
  return { seq: asNumber(result.seq), epoch: asString(result.epoch) };
}
