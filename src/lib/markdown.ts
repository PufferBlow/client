/**
 * The chat dialect of Markdown, the way Discord reads it: bold, italics, underline, strikethrough,
 * inline and fenced code, `||spoilers||`, headings, `-#` subtext, quotes, lists and links. It is
 * parsed to a small tree and rendered as React elements, never as HTML, so message text can't
 * inject markup. Anything that doesn't parse as formatting stays as the literal text.
 */

import { mentionAt } from "./mentions";
import { shortcodeAt } from "./shortcodes";

export type Inline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  /** `@name`; whether it is a real person is for the renderer to decide. */
  | { type: "mention"; name: string }
  | { type: "strong" | "em" | "underline" | "strike" | "spoiler"; children: Inline[] }
  /** `embed` is true for a bare URL; masked `[text](url)` and `<url>` links never embed. */
  | { type: "link"; href: string; children: Inline[]; embed: boolean };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "subtext"; children: Inline[] }
  | { type: "quote"; children: Block[] }
  | { type: "codeblock"; lang: string | null; value: string }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] };

type Wrapper = "strong" | "em" | "underline" | "strike" | "spoiler";

// Tried in this order at each position, so `**` wins over `*` and `__` over `_`.
const DELIMITERS: { marker: string; type: Wrapper }[] = [
  { marker: "||", type: "spoiler" },
  { marker: "**", type: "strong" },
  { marker: "__", type: "underline" },
  { marker: "~~", type: "strike" },
  { marker: "*", type: "em" },
  { marker: "_", type: "em" },
];

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const MAX_DEPTH = 8;

// ---------------------------------------------------------------- blocks

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const match of text.matchAll(/```([\s\S]+?)```/g)) {
    const start = match.index ?? 0;
    blocks.push(...parseLines(text.slice(last, start).replace(/\n$/, ""), 0));
    blocks.push(codeBlock(match[1] ?? ""));
    last = start + match[0].length;
    if (text[last] === "\n") last += 1;
  }
  blocks.push(...parseLines(text.slice(last), 0));
  return blocks;
}

function codeBlock(raw: string): Block {
  // "```js\n…" names a language; "```one line```" doesn't.
  const named = /^([\w#+.-]{1,24})\n([\s\S]*)$/.exec(raw);
  const value = (named ? (named[2] ?? "") : raw.replace(/^\n/, "")).replace(/\n$/, "");
  return { type: "codeblock", lang: named?.[1] ?? null, value };
}

function parseLines(text: string, depth: number): Block[] {
  if (!text) return [];
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (depth === 0 && line.startsWith(">>> ")) {
      // Quotes everything to the end of the message.
      flush();
      blocks.push({ type: "quote", children: parseLines([line.slice(4), ...lines.slice(i + 1)].join("\n"), 1) });
      return blocks;
    }

    if (depth === 0 && isQuoteLine(line)) {
      flush();
      const quoted: string[] = [];
      for (; i < lines.length && isQuoteLine(lines[i] ?? ""); i++) quoted.push((lines[i] ?? "").replace(/^> ?/, ""));
      i -= 1;
      blocks.push({ type: "quote", children: parseLines(quoted.join("\n"), 1) });
      continue;
    }

    const heading = /^(#{1,3}) +(\S.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: (heading[1] ?? "#").length as 1 | 2 | 3, children: parseInline(heading[2] ?? "") });
      continue;
    }

    const subtext = /^-# +(\S.*)$/.exec(line);
    if (subtext) {
      flush();
      blocks.push({ type: "subtext", children: parseInline(subtext[1] ?? "") });
      continue;
    }

    const item = listItem(line);
    if (item) {
      flush();
      const items: Inline[][] = [];
      for (; i < lines.length; i++) {
        const next = listItem(lines[i] ?? "");
        if (!next || next.ordered !== item.ordered) break;
        items.push(parseInline(next.content));
      }
      i -= 1;
      blocks.push({ type: "list", ordered: item.ordered, start: item.start, items });
      continue;
    }

    paragraph.push(line);
  }
  flush();
  return blocks;
}

const isQuoteLine = (line: string) => line.startsWith("> ") || line === ">";

function listItem(line: string): { ordered: boolean; start: number; content: string } | null {
  const bullet = /^\s*[-*] +(\S.*)$/.exec(line);
  if (bullet) return { ordered: false, start: 1, content: bullet[1] ?? "" };
  const numbered = /^\s*(\d{1,9})[.)] +(\S.*)$/.exec(line);
  if (numbered) return { ordered: true, start: Number(numbered[1]), content: numbered[2] ?? "" };
  return null;
}

// ---------------------------------------------------------------- inline

export function parseInline(text: string, options: { links?: boolean } = {}, depth = 0): Inline[] {
  const links = options.links ?? true;
  const out: Inline[] = [];
  let buffer = "";
  const pushText = () => {
    if (buffer) out.push({ type: "text", value: buffer });
    buffer = "";
  };
  // A marker with no closer after one position has none after any later one either.
  const unclosed = new Set<string>();

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length && ASCII_PUNCTUATION.test(text.charAt(i + 1))) {
      buffer += text.charAt(i + 1);
      i += 2;
      continue;
    }

    if (ch === "`") {
      const run = runLength(text, i, "`");
      const close = findBacktickClose(text, i + run, run);
      if (close >= 0) {
        pushText();
        let value = text.slice(i + run, close);
        if (value.length > 2 && value.startsWith(" ") && value.endsWith(" ") && value.trim()) value = value.slice(1, -1);
        out.push({ type: "code", value });
        i = close + run;
      } else {
        buffer += "`".repeat(run);
        i += run;
      }
      continue;
    }

    if (ch === "@") {
      const name = mentionAt(text, i);
      if (name) {
        pushText();
        out.push({ type: "mention", name });
        i += 1 + name.length;
        continue;
      }
    }

    if (ch === ":") {
      // `:tada:` reads as the emoji (it is drawn from the text like any other emoji).
      const code = shortcodeAt(text, i);
      if (code) {
        buffer += code.emoji;
        i += code.length;
        continue;
      }
    }

    if (depth < MAX_DEPTH) {
      const wrapped = matchWrapper(text, i, unclosed);
      if (wrapped) {
        pushText();
        out.push({ type: wrapped.type, children: parseInline(wrapped.inner, options, depth + 1) });
        i = wrapped.end;
        continue;
      }
    }

    if (links) {
      const link = matchLink(text, i, depth);
      if (link) {
        pushText();
        out.push(link.node);
        i = link.end;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }
  pushText();
  return out;
}

function matchWrapper(text: string, i: number, unclosed: Set<string>): { type: Wrapper; inner: string; end: number } | null {
  for (const { marker, type } of DELIMITERS) {
    if (!text.startsWith(marker, i) || unclosed.has(marker)) continue;
    const open = i + marker.length;
    const close = findClose(text, open, marker);
    if (close < 0) {
      unclosed.add(marker);
      continue;
    }
    const inner = text.slice(open, close);
    if (marker.length === 1) {
      // `2 * 3 * 4` isn't italics, and neither is snake_case_name.
      if (/\s/.test(inner.charAt(0)) || /\s/.test(inner.charAt(inner.length - 1))) continue;
      if (marker === "_" && (WORD_CHAR.test(text[i - 1] ?? "") || WORD_CHAR.test(text[close + 1] ?? ""))) continue;
    }
    return { type, inner, end: close + marker.length };
  }
  return null;
}

/** Index of the closing marker, skipping escapes and code spans; -1 when there is none. */
function findClose(text: string, from: number, marker: string): number {
  const single = marker.length === 1;
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (ch === "\\") {
      j += 1;
      continue;
    }
    if (ch === "`") {
      const run = runLength(text, j, "`");
      const close = findBacktickClose(text, j + run, run);
      j = (close >= 0 ? close + run : j + run) - 1;
      continue;
    }
    if (!text.startsWith(marker, j)) continue;
    if (single) {
      // `*a **b** c*`: a doubled marker belongs to the bold, not to this pair.
      if (text[j + 1] === marker) {
        j += 1;
        continue;
      }
      if (j > from) return j;
      continue;
    }
    // `***both***`: the closing `**` is the last two of the run, leaving `*…*` inside.
    let close = j;
    while (text[close + marker.length] === marker[0]) close += 1;
    if (close > from) return close;
    j = close + marker.length - 1;
  }
  return -1;
}

function runLength(text: string, i: number, ch: string): number {
  let n = 0;
  while (text[i + n] === ch) n++;
  return n;
}

function findBacktickClose(text: string, from: number, run: number): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] !== "`") continue;
    const length = runLength(text, j, "`");
    if (length === run && j > from) return j;
    j += length - 1;
  }
  return -1;
}

function matchLink(text: string, i: number, depth: number): { node: Inline; end: number } | null {
  const rest = text.slice(i);

  if (text[i] === "[") {
    // `[label](https://…)`, or `[label](<https://…>)` which is the same here (masked links never embed).
    const masked = /^\[([^[\]\n]+)\]\(<?(https?:\/\/[^\s<>()]+(?:\([^\s<>()]*\)[^\s<>()]*)*)>?\)/.exec(rest);
    const href = masked && safeUrl(masked[2] ?? "");
    if (masked && href) {
      return {
        node: { type: "link", href, embed: false, children: parseInline(masked[1] ?? "", { links: false }, depth + 1) },
        end: i + masked[0].length,
      };
    }
    return null;
  }

  if (text[i] === "<") {
    // `<https://…>` links without an embed.
    const angled = /^<(https?:\/\/[^\s<>]+)>/.exec(rest);
    const href = angled && safeUrl(angled[1] ?? "");
    if (angled && href) return { node: { type: "link", href, embed: false, children: [{ type: "text", value: angled[1] ?? "" }] }, end: i + angled[0].length };
    return null;
  }

  if ((text[i] === "h" || text[i] === "H") && !WORD_CHAR.test(text[i - 1] ?? "")) {
    const bare = /^https?:\/\/[^\s<]+/i.exec(rest);
    if (!bare) return null;
    const raw = trimUrl(bare[0]);
    const href = safeUrl(raw);
    if (!href || raw.length <= "https://".length) return null;
    return { node: { type: "link", href, embed: true, children: [{ type: "text", value: raw }] }, end: i + raw.length };
  }

  return null;
}

/** Drops punctuation that ends the sentence rather than the URL. */
function trimUrl(url: string): string {
  let out = url;
  for (;;) {
    const last = out.charAt(out.length - 1);
    if (/[.,:;!?'"*_~|]/.test(last)) out = out.slice(0, -1);
    else if (last === ")" && count(out, "(") < count(out, ")")) out = out.slice(0, -1);
    else return out;
  }
}

const count = (text: string, ch: string) => text.split(ch).length - 1;

/** The URL, normalised, if it is http(s); anything else (javascript:, data:, …) is refused. */
export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- queries

/** Bare links in the message, in order and without repeats; spoilered ones are left out. */
export function embeddableUrls(blocks: Block[], limit = 3): string[] {
  const found: string[] = [];
  const visitInline = (nodes: Inline[]) => {
    for (const node of nodes) {
      if (found.length >= limit) return;
      if (node.type === "link") {
        if (node.embed && !found.includes(node.href)) found.push(node.href);
      } else if (node.type !== "text" && node.type !== "code" && node.type !== "mention" && node.type !== "spoiler") {
        visitInline(node.children);
      }
    }
  };
  const visitBlocks = (nodes: Block[]) => {
    for (const block of nodes) {
      if (block.type === "quote") visitBlocks(block.children);
      else if (block.type === "list") block.items.forEach(visitInline);
      else if (block.type !== "codeblock") visitInline(block.children);
    }
  };
  visitBlocks(blocks);
  return found;
}

/**
 * The message as one line of plain text, for previews (replies, notifications). Formatting is
 * dropped, and spoilers stay hidden as a bar of blocks so a preview can't give one away.
 */
export function toPlainText(text: string): string {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((node) => {
        if (node.type === "text" || node.type === "code") return node.value;
        if (node.type === "mention") return `@${node.name}`;
        if (node.type === "spoiler") return "█".repeat(Math.min(10, Math.max(4, inline(node.children).length)));
        return inline(node.children);
      })
      .join("");
  const block = (node: Block): string => {
    if (node.type === "codeblock") return node.value;
    if (node.type === "quote") return node.children.map(block).join(" ");
    if (node.type === "list") return node.items.map(inline).join(" ");
    return inline(node.children);
  };
  return parseMarkdown(text).map(block).join(" ").replace(/\s+/g, " ").trim();
}
