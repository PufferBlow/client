/**
 * Role badges, as drawn by the design language (`spines/specs/role-badges.html`): a small mark after a
 * person's name that says what they do in a space. The shape says who gave the role, the colour is one of
 * the identity colours (plus white and grey) and the glyph is always ink.
 *
 * The same rules are enforced by the instance (`pufferblow/api/utils/role_badges.py`); this file only
 * knows how to draw what it sends.
 */

export type BadgeTier = "staff" | "community" | "system";
export type BadgeTone = "brass" | "coral" | "rose" | "violet" | "sky" | "sage" | "white" | "grey";

export interface RoleBadgeData {
  tier: BadgeTier;
  tone: BadgeTone;
  /** A glyph name, or `"image"` with `image_url`. */
  glyph: string;
  /** The address of an uploaded 128 × 128 picture, for `glyph: "image"`. */
  image_url?: string | null;
}

export const BADGE_TONES: readonly BadgeTone[] = ["brass", "coral", "rose", "violet", "sky", "sage", "white", "grey"];
export const BADGE_PALETTE: Record<BadgeTone, string> = {
  brass: "#e3ae4f",
  coral: "#ec8a6f",
  rose: "#e59ac0",
  violet: "#a99cf2",
  sky: "#7fc0e3",
  sage: "#9fcf8a",
  white: "#f2f2f2",
  grey: "#9a9a9a",
};
/** The glyph's ink: it stays above 7:1 on every fill. */
export const BADGE_INK = "#0a0a0a";

/** Glyph drawings on a 24-unit grid, stroked and never filled. */
export const BADGE_GLYPHS: Record<string, string> = {
  crown: "M3.5 8.5l4.5 4 4-7 4 7 4.5-4-1.8 10.5H5.3z",
  key: "M3.5 15a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM11.2 11.8L20 3M16.5 6.5l3 3M14 9l2.2 2.2",
  shield: "M12 3l7.5 3v5.5c0 4.8-3.2 8-7.5 9.5-4.3-1.5-7.5-4.7-7.5-9.5V6zM8.8 12.2l2.3 2.3 4.3-4.6",
  lifebuoy: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  target: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM12 12h.01",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z",
  broadcast: "M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2",
  brush: "M15 4.5l4.5 4.5L10 18.5 5.5 14zM5.5 14L4 20l6-1.5",
  code: "M8.5 7l-5 5 5 5M15.5 7l5 5-5 5M13.5 5l-3 14",
  heart: "M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10M12 13v4M8.5 20h7M10 17h4",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  bot: "M5 9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5zM12 7V4M9.5 13h.01M14.5 13h.01M2.5 12v3M21.5 12v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  bubbles: "M4 14.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0zM13.5 6.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM15 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0z",
  globe: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM12 3a13 13 0 0 0 0 18a13 13 0 0 0 0-18zM3 12h18",
  music: "M9 18V6l10-2v12M4 18a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0zM14 16a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z",
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M16 9.5h4M4 14.5h4M16 14.5h4",
  gamepad:
    "M6.5 7h11a4 4 0 0 1 4 4.5l-.7 4.5a2.5 2.5 0 0 1-4.3 1.3L15 16H9l-1.5 1.3a2.5 2.5 0 0 1-4.3-1.3l-.7-4.5a4 4 0 0 1 4-4.5zM8 10v3M6.5 11.5h3M15.5 11h.01M17.5 13h.01",
  mic: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21",
};
export const GLYPH_NAMES = Object.keys(BADGE_GLYPHS);
export const IMAGE_GLYPH = "image";

/** Spines cut from the logo: a ring with eight notches. */
function spinedShape(): string {
  const p = (r: number, a: number) => `${(16 + r * Math.sin(a)).toFixed(2)} ${(16 - r * Math.cos(a)).toFixed(2)}`;
  let d = "M4 16a12 12 0 1 0 24 0a12 12 0 1 0-24 0z";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    d += `M${p(10.5, a - 0.3)}Q${p(13.2, a - 0.1)} ${p(15.8, a)}Q${p(13.2, a + 0.1)} ${p(10.5, a + 0.3)}z`;
  }
  return d;
}

/** The three shapes on a 32-unit grid: spined for staff, a rounded square for community, a circle for the system. */
export const BADGE_SHAPES: Record<BadgeTier, string> = {
  staff: spinedShape(),
  community: "M10 1h12a9 9 0 0 1 9 9v12a9 9 0 0 1-9 9H10a9 9 0 0 1-9-9V10a9 9 0 0 1 9-9z",
  system: "M1 16a15 15 0 1 0 30 0a15 15 0 1 0-30 0z",
};

/** How much of the shape the glyph fills. */
const GLYPH_SCALE: Record<BadgeTier, number> = { staff: 0.6, community: 0.74, system: 0.7 };

export interface BadgeDrawing {
  shape: string;
  fill: string;
  ink: string;
  /** Moves and scales the 24-unit glyph into the middle of the shape. */
  transform: string;
  glyph: string | null;
  /** Stroke width in glyph units: it thickens at small sizes so the glyph stays readable at 16. */
  strokeWidth: number;
  image: string | null;
}

/** What to draw for a badge at a pixel size. Unknown glyphs draw as an empty shape, never as an error. */
export function drawBadge(badge: RoleBadgeData, size: number): BadgeDrawing {
  const tier: BadgeTier = badge.tier in BADGE_SHAPES ? badge.tier : "community";
  const k = GLYPH_SCALE[tier];
  const strokePx = size <= 16 ? 1.55 : size <= 20 ? 1.75 : size <= 32 ? 2.2 : size * 0.05;
  const offset = 16 - 12 * k;
  const image = badge.glyph === IMAGE_GLYPH && badge.image_url ? badge.image_url : null;
  return {
    shape: BADGE_SHAPES[tier],
    fill: BADGE_PALETTE[badge.tone] ?? BADGE_PALETTE.grey,
    ink: BADGE_INK,
    transform: `translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${k})`,
    glyph: image ? null : (BADGE_GLYPHS[badge.glyph] ?? null),
    strokeWidth: +((strokePx * 32) / (size * k)).toFixed(2),
    image,
  };
}

/** Staff first, then community, then system. */
export const TIER_ORDER: Record<BadgeTier, number> = { staff: 0, community: 1, system: 2 };

export interface BadgePreset {
  name: string;
  glyph: string;
  tier: BadgeTier;
  tone: BadgeTone;
}

/**
 * The sixteen the design starts every space with. Owner, Admin and Moderator are the built-in roles and
 * the last four are given by Pufferblow, so only the nine in between are offered when making a role.
 */
export const DEFAULT_BADGES: readonly BadgePreset[] = [
  { name: "Owner", glyph: "crown", tier: "staff", tone: "brass" },
  { name: "Admin", glyph: "key", tier: "staff", tone: "coral" },
  { name: "Moderator", glyph: "shield", tier: "staff", tone: "sky" },
  { name: "Helper", glyph: "lifebuoy", tier: "community", tone: "sage" },
  { name: "Coach", glyph: "target", tier: "community", tone: "violet" },
  { name: "Event host", glyph: "star", tier: "community", tone: "rose" },
  { name: "Streamer", glyph: "broadcast", tier: "community", tone: "coral" },
  { name: "Artist", glyph: "brush", tier: "community", tone: "violet" },
  { name: "Developer", glyph: "code", tier: "community", tone: "sky" },
  { name: "Supporter", glyph: "heart", tier: "community", tone: "rose" },
  { name: "Ranked", glyph: "trophy", tier: "community", tone: "white" },
  { name: "Veteran", glyph: "flame", tier: "community", tone: "brass" },
  { name: "Bot", glyph: "bot", tier: "system", tone: "white" },
  { name: "Verified", glyph: "check", tier: "system", tone: "sky" },
  { name: "New fish", glyph: "bubbles", tier: "system", tone: "sage" },
  { name: "Guest", glyph: "globe", tier: "system", tone: "grey" },
];

/** What can be picked as a starting point for a new role. */
export const ROLE_PRESETS = DEFAULT_BADGES.filter((p) => p.tier === "community");

/** Tier names as shown to people. */
export const TIER_LABEL: Record<BadgeTier, string> = { staff: "Staff", community: "Community", system: "System" };

/** The text colour of a role tag: the badge's own colour. */
export const badgeColour = (badge: Pick<RoleBadgeData, "tone">): string => BADGE_PALETTE[badge.tone] ?? BADGE_PALETTE.grey;

/** What a new badge starts as: the design's own example. */
export const NEW_BADGE: RoleBadgeData = { tier: "community", tone: "violet", glyph: "film" };

/** Privileges that mean a role can moderate, which the staff shape stands for (the instance checks the same). */
const MODERATION = ["ban_users", "mute_users", "moderate_content"];
export const canModerate = (privileges: Iterable<string>): boolean => [...privileges].some((p) => MODERATION.includes(p));

export const sameBadge = (a: RoleBadgeData | null | undefined, b: RoleBadgeData | null | undefined): boolean =>
  (a ?? null) === (b ?? null) || (!!a && !!b && a.tier === b.tier && a.tone === b.tone && a.glyph === b.glyph && (a.image_url ?? null) === (b.image_url ?? null));
