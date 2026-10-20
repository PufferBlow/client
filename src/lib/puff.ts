import { fishUrl, TONE_HEX, type Expression, type Tone } from "./identity";

/**
 * Puff reactions: six puffer faces instead of emoji, so reactions match the avatars. A puff
 * reaction is stored like any other reaction, as the string `puff:<face>`; clients that do not know
 * about faces just show that text, and nothing else on the server has to change.
 */

export const PUFF_FACES: ReadonlyArray<{ face: Expression; tone: Tone; label: string }> = [
  { face: "default", tone: "violet", label: "Puffed" },
  { face: "happy", tone: "coral", label: "Happy" },
  { face: "wink", tone: "sky", label: "Wink" },
  { face: "sleepy", tone: "brass", label: "Sleepy" },
  { face: "surprised", tone: "sage", label: "Surprised" },
  { face: "grumpy", tone: "rose", label: "Grumpy" },
];

const PREFIX = "puff:";

/** The reaction string for a face. */
export const puffReaction = (face: Expression): string => `${PREFIX}${face}`;

/** The face a reaction string names, or undefined when it is an ordinary emoji. */
export function parsePuff(reaction: string): { face: Expression; tone: Tone; label: string; url: string; hex: string } | undefined {
  if (!reaction.startsWith(PREFIX)) return undefined;
  const entry = PUFF_FACES.find((f) => f.face === reaction.slice(PREFIX.length));
  return entry ? { ...entry, url: fishUrl(entry.face, entry.tone), hex: TONE_HEX[entry.tone] } : undefined;
}
