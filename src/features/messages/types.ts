export interface Attachment {
  url: string;
  filename: string;
  /** MIME type (or "sticker"). */
  type: string;
  size?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

/** Client-side message model. Built from either wire shape by `normalizeMessage`. */
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  /** Kept exactly as the server sent it; it is also used to build pagination cursors. */
  sentAt: string;
  attachments: Attachment[];
  reactions: Reaction[];
  editCount: number;
  editedAt: string | null;
  /** Join/pin notices and similar. Absent means an ordinary user message. */
  kind?: "user" | "system";
  /**
   * Local delivery state of a message this client is sending. Absent once the server has it.
   * A `pending` or `failed` message has a local id and exists only in this client's cache.
   */
  status?: "pending" | "failed";
  /** Idempotency key of a local message; a retry reuses it so the server cannot post twice. */
  nonce?: string;
  /** Why a `failed` message did not go out. */
  failure?: { message: string; retryable: boolean };
}

export interface MessagePage {
  /** Oldest first. */
  messages: Message[];
  /** Pass as `before_cursor` to load older messages; null when history is exhausted. */
  nextCursor: string | null;
}
