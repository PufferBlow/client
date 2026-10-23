import { bannerCss, identity, TONE_HEX, type Tone } from "./identity";
import { spaceIconStyle, type SpaceIconStyle } from "./spaceIcon";

/** How the owner chose the server to look. Every part may be null: "the one derived from the server's id". */
export interface ServerLookChoice {
  icon_style?: SpaceIconStyle | null;
  tone?: Tone | null;
  tone2?: Tone | null;
  banner_pattern?: "ripple" | "burst" | "halftone" | "crowd" | "duo" | null;
}

export const ICON_STYLE_CHOICES: ReadonlyArray<{ id: SpaceIconStyle; label: string }> = [
  { id: "initials", label: "Initials" },
  { id: "crop", label: "Peeking fish" },
  { id: "bubble", label: "Bubble" },
  { id: "school", label: "School" },
];

export const SERVER_BANNER_CHOICES = [
  { id: "ripple", label: "Ripple" },
  { id: "burst", label: "Burst" },
  { id: "halftone", label: "Halftone" },
  { id: "crowd", label: "Crowd" },
  { id: "duo", label: "Two colours" },
] as const;

export interface ServerLook {
  iconStyle: SpaceIconStyle;
  tone: Tone;
  tone2: Tone;
  hex: string;
  hex2: string;
  bannerPattern: (typeof SERVER_BANNER_CHOICES)[number]["id"];
  /** The banner background for the choice; `at` is where the pattern is centred. */
  banner: (at?: string) => string;
}

/** What the server looks like: the owner's choices, and for any they did not make, what its id gives. */
export function serverLookOf(id: string, choice?: ServerLookChoice | null): ServerLook {
  const derived = identity(id);
  const tone = choice?.tone ?? derived.tone;
  const tone2 = choice?.tone2 ?? (tone === "sky" ? "violet" : "sky");
  const hex = TONE_HEX[tone];
  const hex2 = TONE_HEX[tone2];
  const bannerPattern = choice?.banner_pattern ?? derived.pattern;
  return {
    iconStyle: choice?.icon_style ?? spaceIconStyle(id),
    tone,
    tone2,
    hex,
    hex2,
    bannerPattern,
    banner: (at = "14% 130%") => (bannerPattern === "duo" ? `linear-gradient(120deg, ${hex} 0%, ${hex2} 100%)` : bannerCss(hex, bannerPattern, at)),
  };
}
