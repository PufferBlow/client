import { useId } from "react";

/**
 * The Pufferblow puffer face (brand sheet v2: `brand/ui-mockups-v2/export/pufferblow-logo`).
 *
 * Drawn inline so the colour follows the surface it sits on: the face is a solid fill seen through
 * a mask, so the eyes and mouth are real cut-outs, not painted dots. At 32 px and above it is the
 * full mark (spines all round); below that the simplified mark (three spines, bigger eyes) that
 * the brand sheet calls for. The switch happens automatically.
 */

export type BrandTone = "gold" | "ink" | "paper" | "current";

const TONES: Record<BrandTone, string> = {
  /** White, the mark on dark surfaces (default). */
  paper: "#f2f2f2",
  /** Black, the mark on light surfaces. */
  ink: "#000000",
  /** The brand accent (white, in the black-and-white palette). */
  gold: "#ffffff",
  /** Whatever colour the surrounding text has, so CSS (hover, selected) can recolour the mark. */
  current: "currentColor",
};

const SMALL_BELOW_PX = 32;

const FULL = {
  body: { x: 13, y: 33, width: 94, height: 64, rx: 32 },
  spines:
    "M22 48Q14.03 36.69 12 23Q27.26 26.06 40 35ZM80 35Q92.74 26.06 108 23Q105.97 36.69 98 48ZM50 34Q52.67 22.84 60 14Q67.33 22.84 70 34ZM14 61Q9.68 63.74 6 70Q7.16 76.74 15 80ZM105 80Q109.84 76.74 114 70Q113.32 63.74 106 61ZM30 92Q24.59 98.53 24 107Q36.16 103.83 46 96ZM74 96Q83.84 103.83 96 107Q95.41 98.53 90 92Z",
  strokeWidth: 6,
  eyes: { left: { cx: 43, cy: 61, r: 11.5 }, right: { cx: 77, cy: 61, r: 11.5 } },
  mouth: { cx: 60, cy: 84, rx: 7.5, ry: 5.5 },
};

const SMALL = {
  body: { x: 10, y: 34, width: 100, height: 68, rx: 34 },
  spines: "M22 50Q12.76 36.92 11 21Q28.24 24.9 42 36ZM78 36Q91.76 24.9 109 21Q107.24 36.92 98 50ZM48 36Q51.34 23.11 60 13Q68.66 23.11 72 36Z",
  strokeWidth: 7,
  eyes: { left: { cx: 41, cy: 66, r: 14 }, right: { cx: 79, cy: 66, r: 14 } },
  mouth: { cx: 60, cy: 90, rx: 8, ry: 6 },
};

export interface PufferblowBrandProps {
  size?: number;
  tone?: BrandTone;
  className?: string;
}

export function PufferblowBrand({ size = 32, tone = "paper", className }: PufferblowBrandProps) {
  const maskId = `pufferblow-face-${useId().replace(/:/g, "")}`;
  const small = size < SMALL_BELOW_PX;
  const shape = small ? SMALL : FULL;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Pufferblow"
      data-variant={small ? "small" : "full"}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#000" />
          <rect {...shape.body} fill="#fff" />
          <path d={shape.spines} fill="#fff" stroke="#fff" strokeWidth={shape.strokeWidth} strokeLinejoin="round" />
          <circle {...shape.eyes.left} fill="#000" />
          <circle {...shape.eyes.right} fill="#000" />
          <ellipse {...shape.mouth} fill="#000" />
        </mask>
      </defs>
      <rect width="120" height="120" fill={TONES[tone]} mask={`url(#${maskId})`} />
    </svg>
  );
}

interface BrandLockupProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number;
  tone?: BrandTone;
  className?: string;
}

/** Mark plus the Marcellus wordmark, as used for headers and the auth screens. */
export function BrandLockup({ size = 34, tone = "paper", className }: BrandLockupProps) {
  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")} style={{ gap: size * 0.35 }}>
      <PufferblowBrand size={size} tone={tone} />
      <span className="font-display leading-none tracking-[0.005em]" style={{ fontSize: size * 0.7 }}>
        Pufferblow
      </span>
    </span>
  );
}
