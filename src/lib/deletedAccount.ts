/**
 * An account its owner deleted is left under a name like `deleted_1a2b3c4d` (the server does not let anyone sign up
 * with one), so what they wrote keeps its place. People see "Deleted user" instead of that name.
 */
const GHOST_NAME = /^deleted_[0-9a-f]{8}$/;

export const isDeletedAccount = (username: string | null | undefined): boolean =>
  !!username && GHOST_NAME.test(username);

/** The name to show for an author: theirs, or "Deleted user". */
export const shownName = (username: string): string =>
  isDeletedAccount(username) ? "Deleted user" : username;
