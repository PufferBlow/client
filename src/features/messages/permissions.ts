import type { UserProfile } from "../users/types";
import type { Message } from "./types";

type Viewer = Pick<UserProfile, "user_id" | "resolved_privileges"> | null | undefined;

/**
 * These decide which actions the UI offers. They are conveniences only: the backend checks
 * ownership and privileges again on every request and is the source of truth.
 */
const isAuthor = (message: Message, viewer: Viewer): boolean => Boolean(viewer && message.authorId && message.authorId === viewer.user_id);

export const canEditMessage = isAuthor;

/** Matches the backend: the sender, or anyone holding the `delete_messages` privilege. */
export function canDeleteMessage(message: Message, viewer: Viewer): boolean {
  return isAuthor(message, viewer) || Boolean(viewer?.resolved_privileges?.includes("delete_messages"));
}

/** You can't report yourself, and system notices have no author to report. */
export function canReportMessage(message: Message, viewer: Viewer): boolean {
  return Boolean(viewer) && message.kind !== "system" && Boolean(message.authorId) && !isAuthor(message, viewer);
}
