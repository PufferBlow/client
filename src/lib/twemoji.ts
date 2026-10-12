import { emojiFileName } from "./emoji";

// Every Twemoji SVG ships with the app, so emoji draw offline and without asking a CDN.
const twemoji = import.meta.glob<string>("/node_modules/@twemoji/svg/*.svg", { query: "?url", import: "default", eager: true });

/** URL of the bundled Twemoji artwork for an emoji, or undefined when there is none. */
export function emojiUrl(emoji: string): string | undefined {
  return twemoji[`/node_modules/@twemoji/svg/${emojiFileName(emoji)}.svg`];
}
