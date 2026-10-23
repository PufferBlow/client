import codes from "./emojiShortcodes.json";

/**
 * `:name:` emoji shortcodes, e.g. `:tada:` for 🎉. A shortcode is letters, digits and `_ + -`
 * between two colons. It only counts when it stands alone: `10:30:45` and `a:b:c` are ordinary
 * text. The table is generated from the picker's Twemoji set (`scripts/generate-emoji-shortcodes.mjs`).
 */

const TABLE: Readonly<Record<string, string>> = codes;
const NAMES = Object.keys(TABLE);
const NAME_CHAR = /[a-z0-9_+-]/i;
const WORD_CHAR = /[A-Za-z0-9_]/;
/** Typing `:s` would match half the table; suggestions start at two letters. */
export const MIN_QUERY = 2;

/** The emoji for a shortcode name (without colons), or undefined. Case-insensitive. */
export function shortcodeEmoji(name: string): string | undefined {
  return TABLE[name.toLowerCase()];
}

/** True when the colon at `at` cannot open a shortcode because of what precedes it. */
function blockedBefore(text: string, at: number): boolean {
  return at > 0 && (WORD_CHAR.test(text.charAt(at - 1)) || text.charAt(at - 1) === ":");
}

/**
 * The shortcode starting at `at` (which must hold a `:`): its length in characters and its emoji,
 * or null. Standing alone means no word character just before the opening colon or just after the
 * closing one.
 */
export function shortcodeAt(text: string, at: number): { length: number; emoji: string } | null {
  if (text[at] !== ":" || blockedBefore(text, at)) return null;
  let end = at + 1;
  while (end < text.length && end - at <= 65 && NAME_CHAR.test(text.charAt(end))) end += 1;
  if (end === at + 1 || text[end] !== ":") return null;
  if (WORD_CHAR.test(text.charAt(end + 1))) return null;
  const emoji = shortcodeEmoji(text.slice(at + 1, end));
  return emoji ? { length: end + 1 - at, emoji } : null;
}

/**
 * `text` with every `:name:` written out as its emoji. Code (inline and fenced) is left alone, and so
 * is any name in `keep` (the instance's own custom emoji, which are typed the same way).
 */
export function replaceShortcodes(text: string, keep?: ReadonlySet<string>): string {
  if (!text.includes(":")) return text;
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : replaceOutsideCode(part, keep)))
    .join("");
}

function replaceOutsideCode(text: string, keep?: ReadonlySet<string>): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const found = text[i] === ":" ? shortcodeAt(text, i) : null;
    if (found && keep?.has(text.slice(i + 1, i + found.length - 1).toLowerCase())) {
      out += text.slice(i, i + found.length);
      i += found.length;
      continue;
    }
    if (found) {
      out += found.emoji;
      i += found.length;
    } else {
      out += text.charAt(i);
      i += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the composer's suggestion list

/** The `:word` the caret is in: where the colon is and what has been typed after it. */
export interface ShortcodeQuery {
  start: number;
  query: string;
}

export function findShortcodeQuery(text: string, caret: number): ShortcodeQuery | null {
  let i = caret;
  while (i > 0 && NAME_CHAR.test(text.charAt(i - 1))) i -= 1;
  if (i === 0 || text.charAt(i - 1) !== ":") return null;
  const start = i - 1;
  if (blockedBefore(text, start)) return null;
  const query = text.slice(i, caret);
  return query.length >= MIN_QUERY && query.length <= 32 ? { start, query } : null;
}

export interface ShortcodeSuggestion {
  name: string;
  emoji: string;
}

/** Shortcodes for what has been typed: names that start with it first, then ones that contain it. */
export function matchShortcodes(query: string, limit = 8): ShortcodeSuggestion[] {
  const needle = query.toLowerCase();
  if (needle.length < MIN_QUERY) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of NAMES) {
    if (name.startsWith(needle)) starts.push(name);
    else if (name.includes(needle)) contains.push(name);
  }
  // Shorter names are usually the common ones (`smile` before `smiling_face_with_...`).
  const byLength = (a: string, b: string) => a.length - b.length || a.localeCompare(b);
  return [...starts.sort(byLength), ...contains.sort(byLength)].slice(0, limit).map((name) => ({ name, emoji: TABLE[name]! }));
}

/** `text` with the `:word` being typed replaced by the emoji and a space; where the caret goes after it. */
export function insertShortcode(text: string, query: ShortcodeQuery, caret: number, emoji: string): { text: string; caret: number } {
  const after = text.slice(caret);
  const tail = after.startsWith(" ") ? after.slice(1) : after;
  const insert = `${emoji} `;
  return { text: text.slice(0, query.start) + insert + tail, caret: query.start + insert.length };
}

/**
 * If the character just typed closed a shortcode (`:tada:` with the caret after the second colon),
 * the text with it replaced by the emoji, else null.
 */
export function completeTypedShortcode(text: string, caret: number): { text: string; caret: number } | null {
  if (text.charAt(caret - 1) !== ":") return null;
  let i = caret - 1;
  while (i > 0 && NAME_CHAR.test(text.charAt(i - 1))) i -= 1;
  if (i === 0 || text.charAt(i - 1) !== ":") return null;
  const start = i - 1;
  const found = shortcodeAt(text.slice(0, caret), start);
  if (!found || start + found.length !== caret) return null;
  return { text: text.slice(0, start) + found.emoji + text.slice(caret), caret: start + found.emoji.length };
}
