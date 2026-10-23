import { useId } from "react";
import { resolveAssetUrl } from "../../services/authed";
import { drawBadge, type RoleBadgeData } from "../../lib/roleBadges";

export interface RoleBadgeProps {
  badge: RoleBadgeData;
  /** Pixel size: 16 in chat and tags, 20 in lists, 32 in role settings, 64 in the editor. */
  size?: number;
  /** Names the role for screen readers and as a tooltip. Without it the badge is decorative. */
  label?: string;
  className?: string;
}

/**
 * A role badge: its tier's shape filled with its colour and the glyph in ink on top, or an uploaded
 * picture cropped to the shape.
 */
export function RoleBadge({ badge, size = 16, label, className = "" }: RoleBadgeProps) {
  const clip = useId();
  const d = drawBadge(badge, size);
  const picture = d.image ? resolveAssetUrl(d.image) : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`block flex-none ${className}`}
      data-tier={badge.tier}
    >
      {label && <title>{label}</title>}
      {picture ? (
        <>
          <defs>
            <clipPath id={clip}>
              <path d={d.shape} />
            </clipPath>
          </defs>
          <path d={d.shape} style={{ fill: d.fill }} />
          <image href={picture} x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        </>
      ) : (
        <>
          <path d={d.shape} style={{ fill: d.fill }} />
          {d.glyph && (
            <g transform={d.transform}>
              <path d={d.glyph} style={{ fill: "none", stroke: d.ink, strokeWidth: d.strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" }} />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
