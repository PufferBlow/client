import { Fragment } from "react";
import { catalogSrc } from "../../features/catalog/hooks";
import { useCustomEmoji } from "../../features/catalog/customEmojiContext";
import type { CatalogItem } from "../../features/catalog/api";
import { splitEmoji } from "../../lib/emoji";
import { emojiUrl } from "../../lib/twemoji";

/** One emoji as a Twemoji image; anything without artwork falls back to the plain character. */
export function Emoji({ char, size = "1.25em", className = "" }: { char: string; size?: number | string; className?: string }) {
  const url = emojiUrl(char);
  if (!url) return <span className={className}>{char}</span>;
  return (
    <img
      src={url}
      alt={char}
      draggable={false}
      style={{ width: size, height: size }}
      className={`inline-block select-text align-[-0.28em] ${className}`}
    />
  );
}

/** One of the instance's custom emoji (or a sticker used to react), drawn at emoji size. It can be animated. */
export function CustomEmoji({ item, size = "1.25em", className = "" }: { item: Pick<CatalogItem, "alias" | "display_name" | "sticker_url">; size?: number | string; className?: string }) {
  const src = catalogSrc(item);
  const name = item.alias ? `:${item.alias}:` : item.display_name;
  if (!src) return <span className={className}>{name}</span>;
  return <img src={src} alt={name} title={name} draggable={false} style={{ width: size, height: size }} className={`inline-block select-text object-contain align-[-0.28em] ${className}`} />;
}

/** A `:shortcode:` standing alone: no word character just before the first colon or after the last. */
const CUSTOM = /(?<![\w:]):([a-z0-9_]{2,32}):(?![\w:])/g;

function UnicodeText({ text, size }: { text: string; size?: number | string }) {
  const segments = splitEmoji(text);
  if (segments.every((s) => s.kind === "text")) return <>{text}</>;
  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === "emoji" ? <Emoji key={i} char={segment.value} size={size} /> : <span key={i}>{segment.value}</span>,
      )}
    </>
  );
}

/** Text with its emoji drawn as Twemoji, and the instance's custom `:shortcodes:` as their pictures. Text with neither renders as a plain string. */
export function EmojiText({ text, size }: { text: string; size?: number | string }) {
  const { byAlias } = useCustomEmoji();
  if (byAlias.size === 0 || !text.includes(":")) return <UnicodeText text={text} size={size} />;

  const parts: Array<{ text: string } | { item: CatalogItem }> = [];
  let last = 0;
  for (const match of text.matchAll(CUSTOM)) {
    const item = byAlias.get(match[1]!);
    if (!item) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ item });
    last = start + match[0].length;
  }
  if (parts.length === 0) return <UnicodeText text={text} size={size} />;
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{"item" in part ? <CustomEmoji item={part.item} size={size} /> : <UnicodeText text={part.text} size={size} />}</Fragment>
      ))}
    </>
  );
}
