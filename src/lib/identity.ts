/**
 * Identity: the colour, the fish and the banner pattern a person or a space gets before they choose
 * their own. Derived from the full handle, so every instance and every client computes the same
 * result and people are recognisable across the fediverse. Spaces use `space-id@instance`.
 *
 * The hash is the design language's (`identity.js`); do not change it, or people change colour.
 */

export const TONES = ["brass", "coral", "rose", "violet", "sky", "sage"] as const;
export const EXPRESSIONS = ["default", "happy", "wink", "sleepy", "surprised", "grumpy"] as const;
export const BANNER_PATTERNS = ["ripple", "burst", "halftone", "crowd"] as const;

export type Tone = (typeof TONES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type BannerPattern = (typeof BANNER_PATTERNS)[number];

export const TONE_HEX: Record<Tone, string> = {
  brass: "#e3ae4f",
  coral: "#ec8a6f",
  rose: "#e59ac0",
  violet: "#a99cf2",
  sky: "#7fc0e3",
  sage: "#9fcf8a",
};

export interface Identity {
  expression: Expression;
  tone: Tone;
  pattern: BannerPattern;
  hex: string;
}

/** `handle` is `name@instance` (or any stable string); it is trimmed and lower-cased first. */
export function identity(handle: string): Identity {
  let h = 7;
  for (const c of handle.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // `>>>`, not the reference's `>>`: the hash is unsigned, and a signed shift of a value over 2^31
  // goes negative and picks no tone at all. The two agree wherever the reference works.
  const tone = TONES[(h >>> 4) % 6]!;
  return { expression: EXPRESSIONS[h % 6]!, tone, pattern: BANNER_PATTERNS[(h >>> 8) % 4]!, hex: TONE_HEX[tone] };
}

// The fish and the patterns ship with the app (bundled, so they resolve the same in the browser and
// in the desktop build). Every file is a small SVG.
const avatarFiles = import.meta.glob("../assets/pb/avatars/*.svg", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;
const patternFiles = import.meta.glob("../assets/pb/patterns/*.svg", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

const byName = (files: Record<string, string>): Map<string, string> =>
  new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1).replace(/\.svg$/, ""), url]));
const AVATARS = byName(avatarFiles);
const PATTERNS = byName(patternFiles);

/** The fish for an expression and a colour; any of the twelve tones the art comes in. */
export function fishUrl(expression: Expression, tone: string): string {
  return AVATARS.get(`pb-avatar-${expression}-${tone}`) ?? AVATARS.get("pb-avatar-default-ash") ?? "";
}

export function patternUrl(name: "bubbles" | "crop" | "fish" | "fishfull" | "ring" | "school" | "tile"): string {
  return PATTERNS.get(`${name}-ink`) ?? "";
}

/** The default avatar for a handle, when its owner has not chosen one and the server did not assign one. */
export function defaultAvatarUrl(handle: string): string {
  const { expression, tone } = identity(handle);
  return fishUrl(expression, tone);
}

const INK = "rgba(10,10,10,.12)";

/** A banner background: the colour with one of four patterns, centred where the avatar overlaps it. */
export function bannerCss(hex: string, pattern: BannerPattern, at = "14% 130%"): string {
  switch (pattern) {
    case "ripple":
      return `repeating-radial-gradient(circle at ${at}, transparent 0 11px, ${INK} 11px 14px), ${hex}`;
    case "burst":
      return `radial-gradient(circle at ${at}, ${hex} 0 18%, transparent 46%), repeating-conic-gradient(from 0deg at ${at}, ${INK} 0 4deg, transparent 4deg 13deg), ${hex}`;
    case "halftone":
      return `radial-gradient(circle at ${at}, ${hex} 0 20%, transparent 60%), radial-gradient(circle, rgba(10,10,10,.2) 36%, transparent 40%) 0 0/9px 9px, ${hex}`;
    case "crowd":
      return `url(${patternUrl("tile")}) 0 0/36px 36px repeat, ${hex}`;
  }
}

/** The banner a handle gets by default. */
export function defaultBannerCss(handle: string, at?: string): string {
  const { hex, pattern } = identity(handle);
  return bannerCss(hex, pattern, at);
}
