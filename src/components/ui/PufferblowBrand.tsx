/**
 * The Pufferblow puffer mark ("3a" in the brand sheet).
 *
 * Source: `UI mockups form/brand/p-mark-*.svg`. Drawn inline so the colour follows the
 * surface it sits on. Below 32 px the brand sheet calls for the simplified mark (fewer
 * spines, bigger eye, one bubble); that switch happens automatically.
 */

export type BrandTone = "gold" | "ink" | "paper";

const TONES: Record<BrandTone, { body: string; eye: string }> = {
  /** On dark surfaces (default). */
  gold: { body: "#e3ae4f", eye: "#0d0b09" },
  /** On brass or light surfaces. */
  ink: { body: "#1c1408", eye: "#efe6d4" },
  /** One-colour light mark on dark surfaces. */
  paper: { body: "#efe6d4", eye: "#0d0b09" },
};

const SMALL_BELOW_PX = 32;
const SPINE = "M43.2 31 Q43.8 22 46 14.5 Q50.6 22 52.8 31Z";
const TAIL = "M27 45 C19 39 13 33.5 6.5 32.5 C8.5 40 10 46.5 13.5 52 C10 57.5 8.5 64 6.5 71.5 C13 70.5 19 65 27 59Z";
const FULL_SPINES = [0, 31, 62, 118, 149, 180, 211, 329];
const SMALL_SPINES = [0, 45, 135, 180, 225, 315];

export interface PufferblowBrandProps {
  size?: number;
  tone?: BrandTone;
  className?: string;
}

export function PufferblowBrand({ size = 32, tone = "gold", className }: PufferblowBrandProps) {
  const { body, eye } = TONES[tone];
  const small = size < SMALL_BELOW_PX;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Pufferblow"
    >
      <path d={TAIL} fill={body} />
      {(small ? SMALL_SPINES : FULL_SPINES).map((angle) => (
        <path key={angle} d={SPINE} transform={`rotate(${angle} 48 52)`} fill={body} />
      ))}
      <circle cx="48" cy="52" r={small ? 25.5 : 25} fill={body} />

      {small ? (
        <>
          <circle cx="59" cy="45" r="7" fill={eye} />
          <circle cx="74" cy="55" r="4.4" fill={body} />
          <circle cx="75" cy="55" r="2.3" fill={eye} />
          <circle cx="86" cy="47" r="4" fill={body} />
        </>
      ) : (
        <>
          <circle cx="73.5" cy="55" r="4.6" fill={body} />
          <circle cx="59" cy="45" r="6.2" fill={eye} />
          <circle cx="61.2" cy="42.8" r="1.9" fill={body} />
          <circle cx="74.6" cy="55" r="2.1" fill={eye} />
          <circle cx="84.5" cy="48.5" r="3.4" stroke={body} strokeWidth="2.2" />
          <circle cx="92" cy="39.5" r="2.3" fill={body} />
        </>
      )}
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
export function BrandLockup({ size = 34, tone = "gold", className }: BrandLockupProps) {
  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")} style={{ gap: size * 0.35 }}>
      <PufferblowBrand size={size} tone={tone} />
      <span className="font-display leading-none tracking-[0.005em]" style={{ fontSize: size * 0.7 }}>
        Pufferblow
      </span>
    </span>
  );
}
