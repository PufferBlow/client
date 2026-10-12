/**
 * Emoji helpers shared by the renderer and the picker. Images are Twemoji (the set Discord uses),
 * addressed by the codepoint file names Twemoji publishes.
 */

const ZWJ = "‍";
const VS16 = "️";

// A keycap, a flag, or a pictographic base with optional variation selector/skin tone, joined by ZWJ.
const EMOJI_SEQUENCE =
  /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*)*/gu;

/**
 * True when a match should draw as an emoji. Symbols such as © or ™ are pictographic but are
 * ordinary text unless written with the emoji variation selector.
 */
function drawsAsEmoji(sequence: string): boolean {
  return /\p{Emoji_Presentation}/u.test(sequence) || sequence.includes(VS16) || sequence.includes(ZWJ) || sequence.includes("⃣");
}

export type EmojiSegment = { kind: "text"; value: string } | { kind: "emoji"; value: string };

/** Splits text into plain runs and emoji sequences, preserving order. */
export function splitEmoji(text: string): EmojiSegment[] {
  const segments: EmojiSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI_SEQUENCE)) {
    if (!drawsAsEmoji(match[0])) continue;
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: "text", value: text.slice(last, start) });
    segments.push({ kind: "emoji", value: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", value: text.slice(last) });
  return segments;
}

/** `1f469-200d-1f4bb`, the way Twemoji names its files (variation selectors dropped unless joined). */
export function emojiFileName(emoji: string): string {
  const points = Array.from(emoji, (ch) => ch.codePointAt(0)!.toString(16));
  const joined = emoji.includes(ZWJ);
  return (joined ? points : points.filter((p) => p !== "fe0f")).join("-");
}
