import type { Message, ReplyPreview } from "./types";

/** The preview a reply carries of `message`, built locally for the pending row. */
export function toReplyPreview(message: Message): ReplyPreview {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorAvatarUrl: message.authorAvatarUrl,
    text: message.text,
    hasAttachments: message.attachments.length > 0,
    deleted: false,
  };
}
