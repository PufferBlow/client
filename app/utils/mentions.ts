/**
 * Utilities for @mention parsing, autocomplete detection, and highlight sets.
 */

/** Matches @username tokens that are not preceded by a word character. */
export const MENTION_REGEX = /(?<![^\s([{])@([\w.-]+)/g;

/**
 * Parse every @username token in `content` and resolve it against `users`.
 * Returns deduplicated list of matched users (skips self when `selfId` given).
 */
export function parseMentions(
  content: string,
  users: { user_id: string; username: string }[],
  selfId?: string,
): { userId: string; username: string }[] {
  const matches = [...content.matchAll(MENTION_REGEX)];
  const seen = new Map<string, string>(); // userId → username
  for (const match of matches) {
    const handle = match[1].toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === handle);
    if (user && user.user_id !== selfId) {
      seen.set(user.user_id, user.username);
    }
  }
  return Array.from(seen.entries()).map(([userId, username]) => ({ userId, username }));
}

/**
 * Given the full textarea `value` and the current `cursorPos`, return the
 * partial query after the last `@` that is "open" (no space since the `@`),
 * or `null` if the cursor is not inside a mention.
 *
 * Examples:
 *   "hello @ali|ce"  → "alice"  (cursor at |)
 *   "hello @alice |" → null     (space after alice — mention is closed)
 *   "test @ |"       → null     (@ followed by space)
 */
export function extractMentionQuery(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos);
  // Walk backwards from cursor to find @
  const atIndex = before.lastIndexOf('@');
  if (atIndex === -1) return null;
  // Make sure there's no whitespace between @ and cursor
  const fragment = before.slice(atIndex + 1);
  if (/\s/.test(fragment)) return null;
  // Make sure the @ is not in the middle of a word (preceded by a non-space char)
  if (atIndex > 0 && /\w/.test(before[atIndex - 1])) return null;
  return fragment;
}

/**
 * Replace the open @query at cursor with `@username ` and return the new
 * string plus the updated cursor position.
 */
export function insertMentionAtCursor(
  value: string,
  cursorPos: number,
  username: string,
): { newValue: string; newCursor: number } {
  const before = value.slice(0, cursorPos);
  const atIndex = before.lastIndexOf('@');
  const after = value.slice(cursorPos);
  const newValue = `${value.slice(0, atIndex)}@${username} ${after}`;
  const newCursor = atIndex + username.length + 2; // '@' + username + ' '
  return { newValue, newCursor };
}
