import { descriptionOf } from "../../lib/files";
import type { Attachment, Reaction } from "./types";

/**
 * Local state for messages that are still sending (their id is `local_<nonce>` until the server
 * has them): the files to resend on Retry, their on-device previews, and reactions added before
 * the message had a real id. Kept outside the query cache because `File` objects and object URLs
 * don't belong in it. Shared by channels and DMs.
 */

export const isLocalId = (id: string) => id.startsWith("local_");

interface PendingFiles {
  files: File[];
  previews: Attachment[];
}

const pendingFiles = new Map<string, PendingFiles>();

/** Remember a pending message's files and build its previews (images and video show at once). */
export function holdFiles(localId: string, files: File[]): Attachment[] {
  const canPreview = typeof URL.createObjectURL === "function";
  const previews = files.map((file) => ({
    url: canPreview ? URL.createObjectURL(file) : "",
    filename: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    ...(descriptionOf(file) ? { description: descriptionOf(file) } : {}),
  }));
  pendingFiles.set(localId, { files, previews });
  return previews;
}

export function heldFiles(localId: string): File[] {
  return pendingFiles.get(localId)?.files ?? [];
}

/** Forget a pending message's files once it is sent or discarded, releasing the previews. */
export function releaseFiles(localId: string): void {
  const held = pendingFiles.get(localId);
  if (!held) return;
  pendingFiles.delete(localId);
  for (const preview of held.previews) {
    if (preview.url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(preview.url);
  }
}

const queuedReactions = new Map<string, Map<string, boolean>>();

/** Note a reaction toggled on a pending message; it is sent once the message has its real id. */
export function queueReaction(localId: string, emoji: string, present: boolean): void {
  let queued = queuedReactions.get(localId);
  if (!queued) queuedReactions.set(localId, (queued = new Map()));
  queued.set(emoji, present);
}

/** The reactions to add now that the pending message has arrived (ones taken back are skipped). */
export function takeQueuedReactions(localId: string): string[] {
  const queued = queuedReactions.get(localId);
  queuedReactions.delete(localId);
  return queued ? [...queued].filter(([, present]) => present).map(([emoji]) => emoji) : [];
}

export function dropQueuedReactions(localId: string): void {
  queuedReactions.delete(localId);
}

/** `reactions` with `userId`'s `emoji` added or taken away, as the server would report it. */
export function toggleReaction(reactions: Reaction[], emoji: string, userId: string, present: boolean): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  const has = existing?.userIds.includes(userId) ?? false;
  if (present === has) return reactions;
  if (present) {
    return existing
      ? reactions.map((r) => (r === existing ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r))
      : [...reactions, { emoji, count: 1, userIds: [userId] }];
  }
  return reactions
    .map((r) => (r === existing ? { ...r, count: r.count - 1, userIds: r.userIds.filter((u) => u !== userId) } : r))
    .filter((r) => r.count > 0);
}

/** Between tests. */
export function resetPending(): void {
  for (const localId of [...pendingFiles.keys()]) releaseFiles(localId);
  queuedReactions.clear();
}
