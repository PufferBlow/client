import type { CSSProperties } from "react";
import { identity, patternUrl, TONE_HEX } from "../../lib/identity";
import { spaceIconStyle, spaceInitials, type SpaceIconStyle } from "../../lib/spaceIcon";

const LAYOUT: Record<SpaceIconStyle, { place: string; pad: string; fs: number; deco: string | null; letters: 1 | 2 | 0 }> = {
  initials: { place: "center", pad: "0", fs: 38, deco: null, letters: 2 },
  crop: { place: "start start", pad: "12% 0 0 16%", fs: 40, deco: "crop", letters: 1 },
  bubble: { place: "center", pad: "6% 6% 0 0", fs: 32, deco: "ring", letters: 1 },
  school: { place: "center", pad: "0", fs: 30, deco: "school", letters: 0 },
};

export interface SpaceIconProps {
  /** Stable id (host, space id): picks the colour and the style. */
  id: string;
  name: string;
  /** A picture, if the space has one; it replaces the default icon. */
  src?: string | null;
  size?: number;
  /** Corner radius; spaces are rounded squares (30% of the size) unless it is told otherwise. */
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** A space: a rounded square in its identity colour, with one of four default styles, or its own picture. */
export function SpaceIcon({ id, name, src, size = 48, radius, className, style }: SpaceIconProps) {
  const box: CSSProperties = { width: size, height: size, borderRadius: radius ?? "30%", ...style };
  if (src) {
    return <img src={src} alt="" draggable={false} className={`shrink-0 object-cover ${className ?? ""}`} style={box} />;
  }
  const look = LAYOUT[spaceIconStyle(id)];
  const text = spaceInitials(name);
  const label = look.letters === 2 ? text : look.letters === 1 ? text.slice(0, 1) : "";
  const deco = look.deco ? `url(${patternUrl(look.deco as "crop" | "ring" | "school")}) center/100% ${look.deco === "crop" ? "100%" : "auto"} no-repeat` : "none";
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 overflow-hidden font-display leading-none text-on-primary ${className ?? ""}`}
      style={{
        ...box,
        background: TONE_HEX[identity(id).tone],
        containerType: "size",
        placeItems: look.place,
        padding: look.pad,
        boxSizing: "border-box",
      }}
    >
      <span className="pointer-events-none absolute inset-0" style={{ background: deco }} />
      <span className="relative" style={{ fontSize: `${look.fs}cqw` }}>
        {label}
      </span>
    </span>
  );
}
