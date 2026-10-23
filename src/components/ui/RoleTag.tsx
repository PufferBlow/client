import type { CSSProperties } from "react";
import { badgeColour, type RoleBadgeData } from "../../lib/roleBadges";
import { RoleBadge } from "./RoleBadge";

/**
 * A role on a person: its colour at 14% fill with full-strength text. A role with a badge leads with it;
 * one without keeps a dot in the role's identity colour.
 */
export function RoleTag({ name, colour, badge, dot = true }: { name: string; colour: string; badge?: RoleBadgeData | null; dot?: boolean }) {
  const tone = badge ? badgeColour(badge) : colour;
  return (
    <span
      className={`pb-role-tag inline-flex items-center gap-1.5 ${badge ? "!py-0 !pl-1 h-6" : ""}`}
      style={{ ["--role-colour" as string]: tone } as CSSProperties}
    >
      {badge ? <RoleBadge badge={badge} size={16} /> : dot && <span className="size-1.5 rounded-full" style={{ background: colour }} />}
      {name}
    </span>
  );
}
