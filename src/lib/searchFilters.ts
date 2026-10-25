/**
 * The filters in the search box, typed the way Discord has them: `from:ada has:image before:2026-03-31`.
 * They stay as text in the field; this reads them out, and builds the ones the server takes.
 */

export const HAS_OPTIONS = [
  { value: "link", hint: "a web address" },
  { value: "file", hint: "a document or other file" },
  { value: "image", hint: "a picture" },
  { value: "video", hint: "a video" },
  { value: "sound", hint: "audio" },
  { value: "sticker", hint: "a sticker" },
] as const;

export const AUTHOR_OPTIONS = [
  { value: "user", hint: "sent by a person" },
  { value: "bot", hint: "sent by a bot" },
] as const;

export type FilterKey = "from" | "mentions" | "in" | "has" | "before" | "after" | "during" | "author";

const KEYS: readonly FilterKey[] = ["from", "mentions", "in", "has", "before", "after", "during", "author"];
const TOKEN = new RegExp(`(^|\\s)(${KEYS.join("|")}):(\\S*)`, "gi");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedSearch {
  /** What is left of the field once the filters are taken out. */
  text: string;
  from?: string;
  mentions?: string;
  inChannel?: string;
  has: string[];
  before?: string;
  after?: string;
  during?: string;
  author?: "user" | "bot";
  /** Filters that were typed but cannot be used, in the words they were typed. */
  problems: string[];
}

const clean = (value: string) => value.replace(/^[@#]/, "").trim();

/** Takes the filters out of what was typed. A filter with nothing after the colon yet is not one. */
export function parseSearch(input: string): ParsedSearch {
  const out: ParsedSearch = { text: "", has: [], problems: [] };
  const rest = input.replace(TOKEN, (_all, lead: string, rawKey: string, rawValue: string) => {
    const key = rawKey.toLowerCase() as FilterKey;
    const value = clean(rawValue);
    if (!value) return lead;
    switch (key) {
      case "from":
      case "mentions":
        out[key] = value;
        break;
      case "in":
        out.inChannel = value;
        break;
      case "has": {
        const kind = value.toLowerCase();
        if (HAS_OPTIONS.some((o) => o.value === kind)) {
          if (!out.has.includes(kind)) out.has.push(kind);
        } else out.problems.push(`has:${value}`);
        break;
      }
      case "before":
      case "after":
      case "during":
        if (DAY.test(value) && !Number.isNaN(Date.parse(value))) out[key] = value;
        else out.problems.push(`${key}:${value}`);
        break;
      case "author": {
        const kind = value.toLowerCase();
        if (kind === "user" || kind === "bot") out.author = kind;
        else out.problems.push(`author:${value}`);
        break;
      }
    }
    return lead;
  });
  out.text = rest.replace(/\s+/g, " ").trim();
  return out;
}

/** The days a search covers, from `before`, `after` and `during` (the day itself: after the day before, before the day after). */
export function dayRange(parsed: Pick<ParsedSearch, "before" | "after" | "during">): { after?: string; before?: string } {
  const shift = (day: string, by: number) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + by);
    return d.toISOString().slice(0, 10);
  };
  return {
    after: parsed.during ? shift(parsed.during, -1) : parsed.after,
    before: parsed.during ? shift(parsed.during, 1) : parsed.before,
  };
}

/** What the server is asked, besides the text. */
export interface ServerFilters {
  fromUserId?: string;
  mentions?: string;
  has?: string[];
  before?: string;
  after?: string;
  authorType?: "user" | "bot";
}

export const hasServerFilters = (f: ServerFilters) => Boolean(f.fromUserId || f.mentions || f.has?.length || f.before || f.after || f.authorType);

/** The text with one filter set to `value`, replacing the one already there, or taken out when `value` is empty. */
export function withFilter(input: string, key: FilterKey, value: string): string {
  const pattern = new RegExp(`(^|\\s)${key}:\\S*`, "gi");
  const without = input.replace(pattern, "$1").replace(/\s+/g, " ").trim();
  if (!value) return without;
  return `${without}${without ? " " : ""}${key}:${value}`;
}

/**
 * The word being typed at the end of the field, and what to offer for it: the filter menu when it is
 * empty, the values of a filter once its `key:` is there, nothing otherwise.
 */
export function currentWord(input: string): { start: number; key: FilterKey | null; partial: string; empty: boolean } {
  const match = /(\S*)$/.exec(input)!;
  const word = match[1]!;
  const start = input.length - word.length;
  const colon = word.indexOf(":");
  const key = colon > 0 ? (word.slice(0, colon).toLowerCase() as FilterKey) : null;
  if (key && KEYS.includes(key)) return { start, key, partial: word.slice(colon + 1), empty: false };
  return { start, key: null, partial: word, empty: word.length === 0 };
}
