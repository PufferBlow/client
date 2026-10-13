/**
 * Query keys for DMs. A conversation's messages live under the same key shape as a channel's
 * (`messageKeys.channel(conversationId)`), so the shared cache helpers and realtime handlers
 * work on both.
 */
export const dmKeys = {
  conversations: ["dms", "conversations"] as const,
};
