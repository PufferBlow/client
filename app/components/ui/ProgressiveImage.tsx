import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Skeleton } from "./Skeleton";

/**
 * ProgressiveImage — render an image with a three-stage load
 * sequence so the user always sees SOMETHING in the slot, never
 * an empty grey box waiting for bytes:
 *
 *   1. **Skeleton**   — initial render, no LQIP available yet OR
 *                       no LQIP exists for this asset. A pulsing
 *                       tinted rectangle/circle occupies the slot.
 *   2. **Placeholder**— LQIP (a ~32 px WebP downloaded in 1 RTT)
 *                       is up. Painted into the slot with a blur
 *                       filter so the low resolution feels intentional
 *                       rather than broken. Acts as a "color +
 *                       composition preview" while the full image
 *                       continues to stream.
 *   3. **Full**       — the real asset has finished loading.
 *                       Crossfades over the placeholder so the
 *                       transition reads as one continuous reveal,
 *                       not a swap.
 *
 * On error (e.g. 404, network drop), the slot collapses back to
 * the `fallback` node — typically a letter chip or an identicon.
 *
 * The component is generic enough for avatars, banners, message
 * image attachments, and server icons; consumers control sizing
 * by passing through `className` and `wrapperClassName`.
 *
 * Two implementation notes worth not glossing over:
 *
 *   - The full image is preloaded via a hidden `new Image()`
 *     rather than mounted into the DOM as `<img display:none>`.
 *     `Image()` triggers the same network request the browser
 *     would have made for an `<img>`, but the swap-in is
 *     synchronous (we just set `loaded=true`), which makes the
 *     crossfade timing deterministic. Mounting two `<img>`s and
 *     toggling visibility worked but caused a one-frame flash
 *     because React flushed the visibility change before the
 *     browser finished decoding the new image.
 *
 *   - The placeholder uses `object-fit: cover` always. If the
 *     consumer needs a different fit they pass it via the
 *     `fit` prop — but the placeholder MUST match the full
 *     image's fit, otherwise the blurred preview composes
 *     differently from the real asset and the crossfade looks
 *     like a slow pan.
 */
interface ProgressiveImageProps {
  /** Full-resolution URL. Required. */
  src: string;
  /** LQIP URL. Optional — falls back to skeleton when absent. */
  placeholderSrc?: string | null;
  /** Accessibility label. Use "" only for decorative images. */
  alt: string;
  /** Tailwind class applied to the inner <img> elements. */
  className?: string;
  /** Tailwind class applied to the wrapping <div>. Controls slot size. */
  wrapperClassName?: string;
  /** Inline style on the wrapper (for non-Tailwind sizing). */
  style?: CSSProperties;
  /** CSS `object-fit` for both placeholder and full image. Default 'cover'. */
  fit?: "cover" | "contain" | "fill" | "scale-down" | "none";
  /**
   * Fallback rendered when the full image fails to load AND no
   * placeholder is available (or the placeholder is also broken).
   * Typically a letter chip with the user's initial.
   */
  fallback?: ReactNode;
  /** Native `<img>` `loading` attribute. Default 'lazy'. */
  loading?: "lazy" | "eager";
  /** Native `<img>` `referrerPolicy`. Default 'no-referrer'. */
  referrerPolicy?: "no-referrer" | "strict-origin-when-cross-origin" | "origin";
  /**
   * Sizing strategy. Two modes:
   *
   *   - 'fixed' (default): the wrapper has an externally-defined
   *     size (avatars, banners — a `w-32 h-32` parent). Both the
   *     placeholder and full image fill the slot with
   *     `position: absolute`. The slot's height is whatever the
   *     wrapper says.
   *
   *   - 'intrinsic': the full image's natural aspect ratio drives
   *     the layout (used by message attachments where a portrait
   *     photo should stay tall and a landscape photo wide). The
   *     full image renders in normal flow; the placeholder /
   *     skeleton sit behind it (`absolute inset-0`) so they
   *     match its eventual size once the full image lays out.
   *     Until the full image arrives the skeleton still has
   *     SOME height because the wrapper carries a `min-height`
   *     fallback (set via `style`).
   */
  sizing?: "fixed" | "intrinsic";
  /**
   * Tailwind classes applied to the full <img> when `sizing` is
   * 'intrinsic'. Required for that mode — lets the consumer set
   * the natural-size caps (e.g. `max-h-96 max-w-full object-contain`).
   */
  intrinsicImgClassName?: string;
}

export function ProgressiveImage({
  src,
  placeholderSrc,
  alt,
  className = "",
  wrapperClassName = "",
  style,
  fit = "cover",
  fallback,
  loading = "lazy",
  referrerPolicy = "no-referrer",
  sizing = "fixed",
  intrinsicImgClassName = "",
}: ProgressiveImageProps) {
  // null = not yet attempted; true = full image loaded; false = full image failed.
  const [loaded, setLoaded] = useState<null | boolean>(null);
  // Track whether the placeholder itself failed too. When both
  // fail we fall through to the `fallback` node.
  const [placeholderFailed, setPlaceholderFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset when the source URL changes so consumers can switch
  // images without unmounting.
  useEffect(() => {
    setLoaded(null);
    setPlaceholderFailed(false);
  }, [src]);

  // Preload the full image off-DOM and flip `loaded` once it's
  // decoded. Using `Image()` rather than a stacked second <img>
  // because the decode-then-flip path produces a cleaner
  // crossfade (see the component docstring).
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    imageRef.current = img;
    img.onload = () => {
      // Only commit the state change if we're still the active
      // image (the src didn't change to something else while
      // this one was decoding). Otherwise the previous src's
      // load event would race the new src's reset effect.
      if (imageRef.current === img) {
        setLoaded(true);
      }
    };
    img.onerror = () => {
      if (imageRef.current === img) {
        setLoaded(false);
      }
    };
    img.referrerPolicy = referrerPolicy;
    img.src = src;
    return () => {
      // Detach handlers so a stale load event from a previous
      // URL doesn't write into the wrong state.
      img.onload = null;
      img.onerror = null;
      if (imageRef.current === img) {
        imageRef.current = null;
      }
    };
  }, [src, referrerPolicy]);

  // Hard-fail branch: full image broken AND no usable placeholder.
  // Show the consumer's fallback (or nothing) so we don't render
  // a broken-image icon into the avatar slot.
  if (loaded === false && (!placeholderSrc || placeholderFailed)) {
    return (
      <div className={wrapperClassName} style={style}>
        {fallback ?? null}
      </div>
    );
  }

  const showFull = loaded === true;
  const showPlaceholder =
    !!placeholderSrc && !placeholderFailed && loaded !== true;
  const showSkeleton = !placeholderSrc && loaded !== true;

  // Intrinsic mode: full <img> is the layout-defining element,
  // skeleton + placeholder sit behind it (absolute inset-0). The
  // wrapper gets a `min-height` while we wait so the skeleton has
  // somewhere to paint even before the natural aspect ratio is
  // known.
  if (sizing === "intrinsic") {
    return (
      <div
        className={`relative ${wrapperClassName}`}
        style={{ minHeight: showFull ? undefined : "8rem", ...style }}
      >
        {showSkeleton && (
          <Skeleton
            variant="rect"
            width="100%"
            height="100%"
            className="absolute inset-0"
          />
        )}
        {placeholderSrc && !placeholderFailed && (
          <img
            src={placeholderSrc}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full ${className}`}
            style={{
              objectFit: fit,
              filter: "blur(8px)",
              transform: "scale(1.05)",
              transition: "opacity 220ms ease-out",
              opacity: showPlaceholder ? 1 : 0,
            }}
            loading="eager"
            decoding="async"
            referrerPolicy={referrerPolicy}
            onError={() => setPlaceholderFailed(true)}
          />
        )}
        {/*
          The full image renders inline so the layout's height
          is driven by its natural aspect ratio. We can't
          eagerly hide it pre-load (display:none would break
          the browser's decode pipeline), so we keep it
          mounted at opacity 0 and let the preloader hook flip
          it on.
        */}
        <img
          src={src}
          alt={alt}
          className={`relative ${intrinsicImgClassName}`}
          style={{
            objectFit: fit,
            transition: "opacity 240ms ease-out",
            opacity: showFull ? 1 : 0,
          }}
          loading={loading}
          decoding="async"
          referrerPolicy={referrerPolicy}
        />
      </div>
    );
  }

  // Fixed mode: wrapper has external sizing. Both layers stack
  // absolutely.
  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={style}
    >
      {showSkeleton && (
        <Skeleton
          variant="rect"
          width="100%"
          height="100%"
          className="absolute inset-0 !rounded-none"
        />
      )}
      {placeholderSrc && !placeholderFailed && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full ${className}`}
          style={{
            objectFit: fit,
            // 8px blur is enough to make the 32px source look
            // intentional without producing the "vaseline on
            // the lens" look that larger blur values give.
            filter: "blur(8px)",
            // The blur expands beyond the element box; this
            // keeps it inside.
            transform: "scale(1.05)",
            transition: "opacity 220ms ease-out",
            opacity: showPlaceholder ? 1 : 0,
          }}
          loading="eager"
          decoding="async"
          referrerPolicy={referrerPolicy}
          onError={() => setPlaceholderFailed(true)}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${className}`}
        style={{
          objectFit: fit,
          transition: "opacity 240ms ease-out",
          opacity: showFull ? 1 : 0,
        }}
        loading={loading}
        decoding="async"
        referrerPolicy={referrerPolicy}
      />
    </div>
  );
}
