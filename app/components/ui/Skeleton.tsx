import type { CSSProperties } from "react";

/**
 * Skeleton — shape-only placeholder used while a piece of data
 * (a user profile, an avatar, a banner) is loading from the
 * network. Renders a tinted rectangle that pulses to indicate
 * activity is in flight.
 *
 * Use a Skeleton (not a spinner) when:
 *   - You know the eventual content's shape — same height, same
 *     rough width, same border radius. The placeholder occupies
 *     the slot so the layout doesn't jump when the content
 *     arrives. Spinners shift the layout twice (in and out) and
 *     also give no idea what's loading.
 *   - The wait is bounded (under ~5 s). For longer waits a more
 *     informative state is appropriate.
 *
 * The `variant` prop is a small enumerated shape preset rather
 * than a free className so the design language stays consistent
 * across the app. Add new shapes here when you find yourself
 * reaching for `rect` + custom radius — it's a smell.
 *
 *   - `circle` — avatars, presence dots. Renders a perfect
 *                circle at whatever size you pass.
 *   - `rect`   — squarish, slightly rounded. Cards, image
 *                attachments, message bubbles.
 *   - `pill`   — long-and-thin, fully rounded ends. Username
 *                lines, status badges, role chips.
 *   - `text`   — fixed `--color-surface-tertiary` tinted bar
 *                with `text-sm` height so it lines up with text
 *                inline. Drop into a flex row for "username
 *                loading…" placeholders.
 */
export type SkeletonVariant = "circle" | "rect" | "pill" | "text";

interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Width as Tailwind/CSS length. Required for non-text variants. */
  width?: number | string;
  /** Height as Tailwind/CSS length. Optional for `circle` (uses width). */
  height?: number | string;
  className?: string;
  /** Add an explicit aria-label for screen readers. Default is "Loading". */
  ariaLabel?: string;
}

export function Skeleton({
  variant = "rect",
  width,
  height,
  className = "",
  ariaLabel = "Loading",
}: SkeletonProps) {
  const radius =
    variant === "circle" ? "9999px" :
    variant === "pill" ? "9999px" :
    variant === "text" ? "4px" :
    "8px";

  const resolvedHeight =
    height ?? (variant === "circle" ? width : variant === "text" ? "0.875rem" : undefined);

  const style: CSSProperties = {
    width: width,
    height: resolvedHeight,
    borderRadius: radius,
    // Two-stage shimmer: the base is a tinted surface (so the
    // skeleton is visible against the page background), then the
    // `animate-pulse` utility fades the whole thing in and out.
    // Using a CSS variable so this responds to theme changes
    // without re-rendering.
    background: "var(--color-surface-tertiary)",
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={`animate-pulse ${className}`}
      style={style}
    />
  );
}

/**
 * SkeletonAvatar — preset for the most common skeleton shape
 * in the app. Wraps `Skeleton` with the canonical avatar sizing
 * (defaults to 40 px, same as the dashboard's message-row
 * avatar) so consumers don't have to remember the number.
 */
export function SkeletonAvatar({
  size = 40,
  className = "",
}: { size?: number; className?: string }) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      ariaLabel="Loading avatar"
    />
  );
}

/**
 * SkeletonBanner — full-width banner placeholder. Banners are
 * decorative and wide; a thin pulse strip on its own looks too
 * busy, so this one defaults to a slightly darker surface tint
 * and rounds the corners to match the banner card's own
 * rounding.
 */
export function SkeletonBanner({
  className = "",
  height = 160,
}: { className?: string; height?: number | string }) {
  return (
    <Skeleton
      variant="rect"
      width="100%"
      height={height}
      className={className}
      ariaLabel="Loading banner"
    />
  );
}
