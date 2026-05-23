/**
 * Renders a single reaction's visual — emoji glyph OR sticker
 * thumbnail — based on the reaction key.
 *
 * Reaction keys come in two shapes:
 *
 *   * Unicode emoji (e.g. ``"👍"``). Rendered via the shared
 *     ``Twemoji`` component so it picks up the consistent house-
 *     style emoji set across all platforms.
 *   * Instance sticker references encoded as ``"sticker:<sticker_id>"``.
 *     Looked up against the cached sticker library (passed in via
 *     ``stickersById``) and rendered as a 16px thumbnail.
 *
 * The component falls back to rendering the raw key as text when a
 * sticker reference can't be resolved (sticker deactivated /
 * deleted after the reaction was applied). Keeping the reaction
 * pill from blanking out is more important than rendering the
 * exact sticker — the count is still meaningful even if the
 * glyph is missing.
 */
import { Twemoji } from "./ui/Twemoji";
import type { StickerRecord } from "../services/stickers";
import { parseStickerReactionKey } from "../services/stickers";
import { createFullUrl } from "../services/user";

interface ReactionGlyphProps {
  /** The reaction key — either a Unicode emoji or `sticker:<id>`. */
  reactionKey: string;
  /** Cached sticker library indexed by sticker_id. Optional — when
   *  omitted, sticker references fall back to the text rendering. */
  stickersById?: Map<string, StickerRecord>;
  /** Visual size in CSS pixels. 14 matches the standard reaction
   *  pill glyph; larger sizes work for pickers and tooltips. */
  size?: number;
}

export function ReactionGlyph({ reactionKey, stickersById, size = 14 }: ReactionGlyphProps) {
  const stickerId = parseStickerReactionKey(reactionKey);
  if (stickerId && stickersById) {
    const sticker = stickersById.get(stickerId);
    if (sticker) {
      const url = createFullUrl(sticker.sticker_url) || sticker.sticker_url;
      return (
        <img
          src={url}
          alt={sticker.display_name}
          // `block` to drop the inline baseline gap, `object-contain`
          // so non-square stickers don't get squished into a square.
          className="block object-contain"
          style={{ width: size, height: size }}
          loading="lazy"
          draggable={false}
        />
      );
    }
    // Sticker no longer exists — show a generic placeholder glyph so
    // the pill stays readable. ⌷ is a unicode "rectangle with bullet"
    // that reads as "missing tile" without needing an image fetch.
    return (
      <span
        className="inline-block text-center text-[var(--color-text-muted)]"
        style={{ width: size, height: size, lineHeight: `${size}px`, fontSize: size - 2 }}
        aria-label="Missing sticker"
      >
        ⌷
      </span>
    );
  }
  return <Twemoji emoji={reactionKey} size={size} />;
}
