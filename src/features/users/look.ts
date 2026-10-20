import { bannerCss, EXPRESSIONS, identity, TONE_HEX, TONES, type BannerPattern, type Expression, type Tone } from "../../lib/identity";
import type { UserProfile } from "./types";

/**
 * How a person has chosen to look (the profile settings the instance stores) and what that turns
 * into on screen. Everything is a choice from a short list, and the colour is only ever mixed into
 * a dark card at a fixed, low strength, so white text stays readable whatever someone picks: they
 * choose the colour, never the text colour.
 */

export type Frame = "none" | "ring" | "spines" | "bubbles";
export type CardTheme = "mono" | "tinted" | "duo";
export type NameFont = "marcellus" | "barlow" | "condensed";
export type Motion = "puff" | "still";
export type BannerChoice = BannerPattern | "duo";
export type SectionName = "play" | "mains" | "accounts" | "badges";

export interface ProfileSettings {
  /** Null: the face derived from the handle. */
  expression: Expression | null;
  frame: Frame;
  /** Null: the colour derived from the handle. */
  tone: Tone | null;
  /** The second colour of a `duo` card or banner. Null: the next colour along. */
  tone2: Tone | null;
  card_theme: CardTheme;
  /** Null: the pattern derived from the handle. */
  banner_pattern: BannerChoice | null;
  name_font: NameFont;
  motion: Motion;
  sections: Record<SectionName, boolean>;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  expression: null,
  frame: "none",
  tone: null,
  tone2: null,
  card_theme: "mono",
  banner_pattern: null,
  name_font: "barlow",
  motion: "puff",
  sections: { play: true, mains: true, accounts: false, badges: true },
};

export const FRAMES: ReadonlyArray<{ id: Frame; label: string }> = [
  { id: "none", label: "None" },
  { id: "ring", label: "Ring" },
  { id: "spines", label: "Spines" },
  { id: "bubbles", label: "Bubbles" },
];
export const CARD_THEMES: ReadonlyArray<{ id: CardTheme; label: string }> = [
  { id: "mono", label: "Mono" },
  { id: "tinted", label: "Tinted" },
  { id: "duo", label: "Two-tone" },
];
export const BANNER_CHOICES: ReadonlyArray<{ id: BannerChoice; label: string }> = [
  { id: "ripple", label: "Ripples" },
  { id: "burst", label: "Spike burst" },
  { id: "halftone", label: "Halftone" },
  { id: "crowd", label: "Fish crowd" },
  { id: "duo", label: "Gradient" },
];
export const NAME_FONTS: ReadonlyArray<{ id: NameFont; label: string }> = [
  { id: "marcellus", label: "Marcellus" },
  { id: "barlow", label: "Barlow" },
  { id: "condensed", label: "Condensed" },
];
export const MOTIONS: ReadonlyArray<{ id: Motion; label: string }> = [
  { id: "puff", label: "Puff on hover" },
  { id: "still", label: "Still" },
];

/** The lengths the instance enforces. */
export const LIMITS = { pronouns: 40, custom_status: 60, about: 190 } as const;

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
const pickOrNull = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** The settings a profile carries, with defaults for anything missing and nothing unexpected let through. */
export function settingsOf(profile: Pick<UserProfile, "profile_settings"> | null | undefined): ProfileSettings {
  const raw = profile?.profile_settings;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS, sections: { ...DEFAULT_SETTINGS.sections } };
  const sections = { ...DEFAULT_SETTINGS.sections };
  for (const name of Object.keys(sections) as SectionName[]) if (typeof raw.sections?.[name] === "boolean") sections[name] = raw.sections[name];
  return {
    expression: pickOrNull(EXPRESSIONS, raw.expression),
    frame: pick(FRAMES.map((f) => f.id), raw.frame, "none"),
    tone: pickOrNull(TONES, raw.tone),
    tone2: pickOrNull(TONES, raw.tone2),
    card_theme: pick(CARD_THEMES.map((t) => t.id), raw.card_theme, "mono"),
    banner_pattern: pickOrNull(BANNER_CHOICES.map((b) => b.id), raw.banner_pattern),
    name_font: pick(NAME_FONTS.map((f) => f.id), raw.name_font, "barlow"),
    motion: pick(MOTIONS.map((m) => m.id), raw.motion, "puff"),
    sections,
  };
}

/** The whole settings object as a minimal patch against another (for saving only what changed). */
export function settingsPatch(from: ProfileSettings, to: ProfileSettings): Partial<Omit<ProfileSettings, "sections">> & { sections?: Partial<Record<SectionName, boolean>> } {
  const patch: Record<string, unknown> = {};
  for (const key of ["expression", "frame", "tone", "tone2", "card_theme", "banner_pattern", "name_font", "motion"] as const) {
    if (from[key] !== to[key]) patch[key] = to[key];
  }
  const sections: Partial<Record<SectionName, boolean>> = {};
  for (const name of Object.keys(to.sections) as SectionName[]) if (from.sections[name] !== to.sections[name]) sections[name] = to.sections[name];
  if (Object.keys(sections).length > 0) patch.sections = sections;
  return patch;
}

export interface NameStyle {
  /** For the card (large) and for lists and chat (small). */
  font: string;
  fontSmall: string;
  letterSpacing: string;
  textTransform: "none" | "uppercase";
}

const NAME_STYLES: Record<NameFont, NameStyle> = {
  marcellus: { font: "400 28px/1.1 var(--pb-font-display)", fontSmall: "400 16px/1.2 var(--pb-font-display)", letterSpacing: "0", textTransform: "none" },
  barlow: { font: "700 25px/1.1 var(--pb-font-body)", fontSmall: "700 14.5px/1.2 var(--pb-font-body)", letterSpacing: "0", textTransform: "none" },
  condensed: { font: "700 27px/1 var(--pb-font-label)", fontSmall: "700 15px/1.2 var(--pb-font-label)", letterSpacing: "0.06em", textTransform: "uppercase" },
};

export interface Look {
  settings: ProfileSettings;
  handle: string;
  expression: Expression;
  tone: Tone;
  tone2: Tone;
  hex: string;
  hex2: string;
  /** The pattern in force: the one chosen, or the one the handle gives. */
  bannerPattern: BannerChoice;
  banner: string;
  /** Top of the card: the colour mixed into the dark card, never more than 24%. */
  cardTop: string;
  cardBackground: string;
  nameStyle: NameStyle;
  /** The cut-out ring around the large avatar, and the thin one used in lists and chat. */
  ring: string;
  ringSmall: string;
  /** Row tint in lists, and the colour of the primary button. */
  rowTint: string;
  buttonColour: string;
  puffsOnHover: boolean;
}

const mix = (colour: string, percent: number) => `color-mix(in srgb, ${colour} ${percent}%, #161616)`;

/** What someone's settings turn into, falling back to what their handle gives them. */
export function lookOf(
  profile: Pick<UserProfile, "username" | "origin_server" | "profile_settings">,
  draft?: ProfileSettings,
): Look {
  const settings = draft ?? settingsOf(profile);
  const handle = `${profile.username}@${profile.origin_server}`;
  const derived = identity(handle);
  const tone = settings.tone ?? derived.tone;
  const tone2 = settings.tone2 ?? TONES[(TONES.indexOf(tone) + 3) % TONES.length]!;
  const hex = TONE_HEX[tone];
  const hex2 = TONE_HEX[tone2];

  const cardTop = settings.card_theme === "mono" ? "#1f1f1f" : settings.card_theme === "tinted" ? mix(hex, 18) : mix(hex, 24);
  const cardBackground =
    settings.card_theme === "duo" ? `linear-gradient(180deg, ${cardTop} 0%, ${mix(hex2, 22)} 100%)` : cardTop;
  const pattern = settings.banner_pattern ?? derived.pattern;
  const banner = pattern === "duo" ? `linear-gradient(120deg, ${hex} 0%, ${hex2} 100%)` : bannerCss(hex, pattern, pattern === "crowd" ? undefined : "16% 130%");

  const ring = {
    none: `0 0 0 6px ${cardTop}`,
    ring: `0 0 0 4px ${cardTop}, 0 0 0 8px ${hex}`,
    spines: `0 0 0 6px ${cardTop}`,
    bubbles: `0 0 0 4px ${cardTop}, 0 0 0 6px ${hex}`,
  }[settings.frame];

  return {
    settings,
    handle,
    expression: settings.expression ?? derived.expression,
    tone,
    tone2,
    hex,
    hex2,
    bannerPattern: pattern,
    banner,
    cardTop,
    cardBackground,
    nameStyle: NAME_STYLES[settings.name_font],
    ring,
    // The gap takes the colour of whatever the avatar sits on (Avatar sets --pb-ring-gap).
    ringSmall: settings.frame === "none" ? "none" : `0 0 0 2px var(--pb-ring-gap, #161616), 0 0 0 3.5px ${hex}`,
    rowTint: settings.card_theme === "mono" ? "transparent" : `color-mix(in srgb, ${hex} 10%, transparent)`,
    buttonColour: settings.card_theme === "mono" ? "#f2f2f2" : hex,
    puffsOnHover: settings.motion === "puff",
  };
}

/** A random look, for "Surprise me". Sections are left as they are. */
export function randomSettings(current: ProfileSettings, random: () => number = Math.random): ProfileSettings {
  const choose = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  return {
    ...current,
    expression: choose(EXPRESSIONS),
    frame: choose(FRAMES).id,
    tone: choose(TONES),
    tone2: choose(TONES),
    card_theme: choose(CARD_THEMES).id,
    banner_pattern: choose(BANNER_CHOICES).id,
    name_font: choose(NAME_FONTS).id,
  };
}
