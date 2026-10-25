import { type RoleBadgeData } from "@pufferblow/spines";
import { createContext } from "react";

/**
 * `@name` mentions. A mention starts with `@` at the start of the text or after whitespace and
 * runs over letters, digits and `. _ -` (at most 32), the same rule the server uses to decide who
 * to notify. `@everyone` is not a person: it pings the whole channel and the server only honours
 * it from owners, admins and moderators.
 */

export const EVERYONE = "everyone";
const NAME_CHAR = /[A-Za-z0-9._-]/;

/** The name right after an `@` at `at` (trailing dots are punctuation), or null if it isn't a mention. */
export function mentionAt(text: string, at: number): string | null {
  if (text[at] !== "@") return null;
  if (at > 0 && !/\s/.test(text.charAt(at - 1))) return null;
  const match = /^@([A-Za-z0-9._-]{1,32})/.exec(text.slice(at));
  const name = match?.[1]?.replace(/\.+$/, "") ?? "";
  return name || null;
}

/** Whether `text` mentions `username` by name (case-insensitive). */
export function mentionsUser(text: string, username: string): boolean {
  const wanted = username.toLowerCase();
  for (let i = text.indexOf("@"); i >= 0; i = text.indexOf("@", i + 1)) {
    if (mentionAt(text, i)?.toLowerCase() === wanted) return true;
  }
  return false;
}

/** What the viewer knows about mentions, so only real people (and `@everyone`) are highlighted. */
export interface MentionDirectory {
  /** The viewer's own username, whose mentions stand out. */
  me?: string;
  /** Lower-cased usernames that exist on this server. */
  known: ReadonlySet<string>;
  /** The instance each person (by user id) belongs to, so remote authors can carry their host. */
  hosts?: ReadonlyMap<string, string>;
  /** The viewer's own instance: authors from anywhere else are remote. */
  home?: string;
  /** The badge to draw beside each person's name (by user id): that of their highest role that has one. */
  roles?: ReadonlyMap<string, { name: string; badge: RoleBadgeData }>;
  /** Each person's current picture (by user id): messages carry the one from when they were sent. */
  avatars?: ReadonlyMap<string, string | null>;
  /** How each person (by user id) chose to look: their frame and name style follow them into chat. */
  looks?: ReadonlyMap<string, { nameFont: string; nameStyle: { fontSmall: string; letterSpacing: string; textTransform: string }; frame: string }>;
}

export const MentionDirectoryContext = createContext<MentionDirectory>({ known: new Set() });

// ---------------------------------------------------------------- the composer's suggestion list

/** The `@word` the caret is in: where the `@` is and what has been typed after it. */
export interface MentionQuery {
  start: number;
  query: string;
}

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  let i = caret;
  while (i > 0 && NAME_CHAR.test(text.charAt(i - 1))) i -= 1;
  if (i === 0 || text.charAt(i - 1) !== "@") return null;
  const start = i - 1;
  if (start > 0 && !/\s/.test(text.charAt(start - 1))) return null;
  const query = text.slice(i, caret);
  return query.length > 32 ? null : { start, query };
}

export interface Mentionable {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** `@everyone`, shown with its own icon. */
  everyone?: boolean;
}

/** The suggestions for what has been typed: names that start with it first, then ones that contain it. */
export function matchMentionables(candidates: Mentionable[], query: string, limit = 8): Mentionable[] {
  const needle = query.toLowerCase();
  const starts: Mentionable[] = [];
  const contains: Mentionable[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    if (name.startsWith(needle)) starts.push(candidate);
    else if (needle && name.includes(needle)) contains.push(candidate);
  }
  const byName = (a: Mentionable, b: Mentionable) => a.name.localeCompare(b.name);
  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit);
}

/** `text` with the `@word` being typed replaced by `@name `, and where the caret goes after it. */
export function insertMention(text: string, query: MentionQuery, caret: number, name: string): { text: string; caret: number } {
  const insert = `@${name} `;
  const after = text.slice(caret);
  // A space is already there after the caret: don't add a second.
  const tail = after.startsWith(" ") ? after.slice(1) : after;
  return { text: text.slice(0, query.start) + insert + tail, caret: query.start + insert.length };
}
