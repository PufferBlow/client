// Builds src/lib/emojiShortcodes.json: `:name:` -> emoji, from the same Twemoji set the picker uses.
// Run after upgrading @emoji-mart/data:  node scripts/generate-emoji-shortcodes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../node_modules/@emoji-mart/data/sets/15/twitter.json", import.meta.url));
const target = fileURLToPath(new URL("../src/lib/emojiShortcodes.json", import.meta.url));
const { emojis, aliases } = JSON.parse(readFileSync(source, "utf8"));

const codes = {};
for (const [id, emoji] of Object.entries(emojis)) {
  const native = emoji.skins?.[0]?.native;
  if (native) codes[id.toLowerCase()] = native;
}
for (const [alias, id] of Object.entries(aliases ?? {})) {
  const native = codes[String(id).toLowerCase()];
  if (native && !(alias.toLowerCase() in codes)) codes[alias.toLowerCase()] = native;
}

const sorted = Object.fromEntries(Object.entries(codes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(target, JSON.stringify(sorted) + "\n");
console.log(`wrote ${Object.keys(sorted).length} shortcodes to ${target}`);
