import { useState } from "react";
import { ACTIVITY_COLOR, PRESENCE } from "../../features/members/presence";
import type { PresenceStatus } from "../../features/users/types";
import { defaultAvatarUrl, identity } from "../../lib/identity";
import { resolveAssetUrl } from "../../services/authed";

interface AvatarProps {
  name: string;
  /** Backend `/storage/...` path or absolute URL. Falls back to the fish for the name. */
  src?: string | null;
  /** Keeps the fallback fish stable across renames; defaults to the name. */
  seed?: string;
  size?: number;
  presence?: PresenceStatus;
  /** "In a call" or "in a game": the sage dot, shown over the presence dot. */
  activity?: boolean;
  /** Colour of the surface behind the avatar, so the dot is cut out of it. */
  ringColor?: string;
  /** Speaking: the sage ring that pulses. The only animated ring. */
  speaking?: boolean;
  /** Muted or deafened: a still white ring. */
  muted?: boolean;
  /** Mentioned you and you have not read it: spines bristle out around the avatar. */
  bristle?: boolean;
  className?: string;
}

/**
 * A person: always a circle. Below 24px there is no dot. The dot is about 30% of the size and cut
 * out of the surface by a 3px ring of its colour; idle is hollow; offline has none and dims the
 * avatar to 55%.
 */
export function Avatar({ name, src, seed, size = 40, presence, activity, ringColor = "var(--color-surface)", speaking, muted, bristle, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const url = resolveAssetUrl(src);
  const showImage = url !== undefined && url !== failedSrc;
  const dot = Math.max(10, Math.round(size * 0.3));
  const look = presence ? PRESENCE[presence] : undefined;
  const showDot = size >= 24 && (activity || (look !== undefined && look.dot !== "none"));
  const dim = look?.dot === "none" && !activity;

  let ring: string | undefined;
  if (speaking) ring = undefined; // the animation draws it
  else if (muted) ring = `0 0 0 2px ${ringColor}, 0 0 0 4px var(--color-text)`;

  return (
    <div
      className={["relative shrink-0 rounded-full", speaking ? "pb-anim-speaking" : "", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, opacity: dim ? 0.55 : 1, boxShadow: ring, ["--pb-ring-gap" as string]: ringColor }}
      aria-hidden="true"
    >
      {bristle && <Bristle size={size} colour={identity(seed ?? name).hex} />}
      <img
        src={showImage ? url : defaultAvatarUrl(seed ?? name)}
        alt=""
        draggable={false}
        className="h-full w-full rounded-full object-cover"
        onError={() => setFailedSrc(url)}
      />
      {showDot && (
        <span
          className="absolute rounded-full"
          style={{
            width: dot,
            height: dot,
            right: -1,
            bottom: -1,
            background: activity ? ACTIVITY_COLOR : look?.dot === "hollow" ? ringColor : look?.color,
            boxShadow: `${!activity && look?.dot === "hollow" ? `inset 0 0 0 3px ${look.color}, ` : ""}0 0 0 3px ${ringColor}`,
          }}
        />
      )}
    </div>
  );
}

const SPINE = "M-5 0Q-2 -9 0 -14Q2 -9 5 0Z";

/** Twelve spines in the person's colour that breathe in and out behind the avatar. */
function Bristle({ size, colour }: { size: number; colour: string }) {
  const reach = size * 0.55;
  return (
    <svg
      aria-hidden="true"
      className="pb-anim-bristle pointer-events-none absolute overflow-visible"
      width={size * 1.5}
      height={size * 1.5}
      viewBox="-42 -42 84 84"
      style={{ left: -size * 0.25, top: -size * 0.25 }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={SPINE} fill={colour} transform={`rotate(${i * 30}) translate(0 ${-Math.min(30, reach)})`} />
      ))}
    </svg>
  );
}

/** A count on a tile, a channel or a tab. Red means someone mentioned you; grey is plain unread. */
export function CountBadge({ count, className, tone = "mention" }: { count: number; className?: string; tone?: "mention" | "unread" }) {
  if (count <= 0) return null;
  return (
    <span
      className={[
        "grid h-5 min-w-5 place-items-center rounded-[10px] px-1.5 font-sans text-[11px] font-bold leading-none",
        tone === "mention" ? "bg-error text-white" : "bg-surface-tertiary text-text-body",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
