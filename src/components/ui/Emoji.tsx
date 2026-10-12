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

/** Text with its emoji drawn as Twemoji. Text without emoji renders as a plain string. */
export function EmojiText({ text }: { text: string }) {
  const segments = splitEmoji(text);
  if (segments.every((s) => s.kind === "text")) return <>{text}</>;
  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === "emoji" ? <Emoji key={i} char={segment.value} /> : <span key={i}>{segment.value}</span>,
      )}
    </>
  );
}
