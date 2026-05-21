import { useMemo } from "react";

/**
 * Twemoji — render a single emoji character as Twitter's SVG glyph
 * via the jdecked/twemoji CDN, with a graceful fallback to the
 * platform's native emoji on load failure.
 *
 * Why bother with Twemoji rather than native emoji?
 *
 *   - Cross-platform consistency. A 🎉 looks different on
 *     Windows / macOS / Linux / Android. Twemoji ships one set
 *     so the same reaction looks identical to every viewer.
 *   - Older Windows versions render some emoji as monochrome
 *     line glyphs (no color). Twemoji renders in color
 *     everywhere.
 *   - It's the same set Discord, Twitter, GitHub use, so users
 *     are already accustomed to it.
 *
 * The CDN we use is `cdn.jsdelivr.net/gh/jdecked/twemoji@latest`
 * — the actively-maintained fork (Twitter's original was
 * archived). SVG (not PNG) so the assets stay sharp at every
 * size the app renders them at (reaction pills, picker grid,
 * markdown body).
 *
 * Implementation notes:
 *
 *   - Codepoint conversion follows the official Twemoji
 *     algorithm: split into codepoints, drop the U+FE0F
 *     variation selector when the character has a base
 *     codepoint above U+1F000 (the standard's own rule), join
 *     with `-`, lowercase hex.
 *   - On `onError`, swap the <img> for a native-text fallback.
 *     The user still sees an emoji; it just won't be the
 *     Twemoji one for that specific glyph (most commonly a
 *     brand-new emoji the CDN hasn't published yet).
 */
interface TwemojiProps {
  /** Single emoji character (or short multi-codepoint sequence like 🇫🇷 or 👨‍👩‍👧). */
  emoji: string;
  /**
   * Render size in pixels. Used for both width and height. The
   * SVG is vector so any size works; this prop just stamps a
   * pixel-precise box so the surrounding layout doesn't reflow
   * on load.
   */
  size?: number;
  /** Extra Tailwind classes for the wrapping <span>. */
  className?: string;
}

// Codepoint conversion. Adapted from the jdecked/twemoji conversion
// rules. Returns a `-`-joined lowercase hex codepoint sequence
// suitable for slotting into the CDN URL.
function emojiToCodepointSequence(emoji: string): string {
  // Split into individual codepoints (handles surrogate pairs).
  const codepoints: number[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) codepoints.push(cp);
  }
  // Skip U+FE0F (variation selector "presentation as emoji")
  // EXCEPT in ZWJ sequences where it's significant. Twemoji's
  // own algorithm: keep FE0F only when the sequence has a ZWJ.
  const hasZwj = codepoints.includes(0x200d);
  const filtered = hasZwj
    ? codepoints
    : codepoints.filter((cp) => cp !== 0xfe0f);
  return filtered.map((cp) => cp.toString(16)).join("-");
}

const TWEMOJI_BASE_URL =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

export function Twemoji({ emoji, size = 20, className = "" }: TwemojiProps) {
  // Memoize the URL so re-renders don't re-derive the codepoint
  // string. Cheap, but emoji frequently appear hundreds of times
  // on a busy message list.
  const url = useMemo(() => {
    const code = emojiToCodepointSequence(emoji);
    if (!code) return null;
    return `${TWEMOJI_BASE_URL}/${code}.svg`;
  }, [emoji]);

  if (!url) {
    // Fallback path for inputs we couldn't parse (empty string,
    // exotic non-emoji glyph). Render the raw character so we
    // never display a broken image.
    return (
      <span className={className} aria-label={emoji}>
        {emoji}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center align-text-bottom ${className}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      role="img"
      aria-label={emoji}
    >
      <img
        src={url}
        alt={emoji}
        draggable={false}
        style={{ width: "100%", height: "100%" }}
        // If the CDN doesn't have this codepoint (brand-new emoji
        // the fork hasn't published yet), swap in the native
        // text rather than rendering a broken-image icon.
        onError={(event) => {
          const img = event.currentTarget;
          const parent = img.parentElement;
          if (parent && !parent.dataset.twemojiFallback) {
            parent.dataset.twemojiFallback = "1";
            parent.textContent = emoji;
            parent.style.lineHeight = "1";
          }
        }}
      />
    </span>
  );
}
