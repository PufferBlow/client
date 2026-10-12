import { useState } from "react";
import { PRESENCE } from "../../features/members/presence";
import type { PresenceStatus } from "../../features/users/types";
import { gradientFor, initialsFor } from "../../lib/avatar";
import { resolveAssetUrl } from "../../services/authed";

interface AvatarProps {
  name: string;
  /** Backend `/storage/...` path or absolute URL. Falls back to initials on a gradient. */
  src?: string | null;
  /** Keeps the fallback colour stable across renames; defaults to the name. */
  seed?: string;
  size?: number;
  presence?: PresenceStatus;
  /** Colour of the surface behind the avatar, so the presence dot is cut out of it. */
  ringColor?: string;
  className?: string;
}

export function Avatar({ name, src, seed, size = 40, presence, ringColor = "var(--color-surface)", className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const url = resolveAssetUrl(src);
  const showImage = url !== undefined && url !== failedSrc;
  const dot = Math.max(10, Math.round(size * 0.33));

  return (
    <div
      className={["relative grid shrink-0 place-items-center rounded-full font-heading font-bold text-on-primary", className]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size, background: gradientFor(seed ?? name), fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" onError={() => setFailedSrc(url)} />
      ) : (
        initialsFor(name)
      )}
      {presence && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{ width: dot, height: dot, background: PRESENCE[presence].color, border: `3px solid ${ringColor}` }}
        />
      )}
    </div>
  );
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={[
        "grid h-[18px] min-w-5 place-items-center rounded-full bg-error px-1.5 font-sans text-[10.5px] font-bold leading-none text-white",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
