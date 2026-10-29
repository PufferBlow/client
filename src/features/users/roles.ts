import { DEFAULT_BADGES, identity, type RoleBadgeData, TIER_ORDER } from "@pufferblow/spines";
import type { UserProfile } from "./types";

/** Backend role id for the server owner (`OWNER_ROLE_ID`). */
export const OWNER_ROLE_ID = "owner";

type WithRoles = Pick<UserProfile, "roles_ids" | "resolved_roles">;

/**
 * Whether this user owns the instance they belong to. The backend has no `is_owner` flag; it
 * defines ownership as holding the `owner` role (`UserManager.is_server_owner`). The server still
 * enforces this on every owner-only route, so this only decides what the UI shows.
 */
export function isServerOwner(profile: WithRoles | null | undefined): boolean {
  if (!profile) return false;
  return (
    (profile.roles_ids ?? []).includes(OWNER_ROLE_ID) ||
    (profile.resolved_roles ?? []).some((role) => role.role_id === OWNER_ROLE_ID)
  );
}

/**
 * Whether this user may ping the whole channel with `@everyone`: owners and moderators,
 * who share the `moderate_content` privilege. The server decides for real; this only decides
 * whether to offer it.
 */
export function canMentionEveryone(profile: (WithRoles & Pick<UserProfile, "resolved_privileges">) | null | undefined): boolean {
  if (!profile) return false;
  return isServerOwner(profile) || (profile.resolved_privileges ?? []).includes("moderate_content");
}

/** Roles every account has, which say nothing about a person. */
const ORDINARY_ROLES = new Set(["member", "user", "everyone"]);
/** Roles that outrank the rest of their tier, in order. Any other role comes after them, in the order it was given. */
const RANKED_ROLES = [OWNER_ROLE_ID, "moderator"];

/** What instances that predate role badges are drawn with: the badges the built-in roles have always had. */
const BUILT_IN_BADGES: Record<string, RoleBadgeData> = Object.fromEntries(
  DEFAULT_BADGES.filter((p) => RANKED_ROLES.includes(p.name.toLowerCase())).map((p) => [p.name.toLowerCase(), { tier: p.tier, tone: p.tone, glyph: p.glyph }]),
);

export interface RoleOfPerson {
  id: string;
  name: string;
  /** The role's badge, if it has one. */
  badge: RoleBadgeData | null;
  /** The role's identity colour, for a role with no badge to take its colour from. */
  colour: string;
}

const tidy = (id: string) => id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * The roles that say something about a person, in the order they are shown: staff first, then community,
 * then system, then the ones with no badge; inside a tier the built-in Owner and Moderator lead.
 */
export function rolesOf(profile: WithRoles | null | undefined): RoleOfPerson[] {
  if (!profile) return [];
  const resolved = new Map((profile.resolved_roles ?? []).map((r) => [r.role_id, r]));
  const ids = [...new Set([...(profile.roles_ids ?? []), ...resolved.keys()])].filter((id) => !ORDINARY_ROLES.has(id.toLowerCase()));
  return ids
    .map((id, given) => {
      const role = resolved.get(id);
      const badge = role?.badge ?? BUILT_IN_BADGES[id] ?? null;
      const rank = RANKED_ROLES.indexOf(id);
      return { id, given, badge, rank: rank === -1 ? RANKED_ROLES.length : rank, role };
    })
    .sort((a, b) => (a.badge ? TIER_ORDER[a.badge.tier] : 3) - (b.badge ? TIER_ORDER[b.badge.tier] : 3) || a.rank - b.rank || a.given - b.given)
    .map(({ id, badge, role }) => ({ id, name: role?.role_name ?? tidy(id), badge, colour: identity(`role:${id}`).hex }));
}

/** Where a role stands among the others: lower comes first. Staff, then community, then system, then no badge. */
export const roleOrder = (role: Pick<RoleOfPerson, "id" | "badge">): number => {
  const rank = RANKED_ROLES.indexOf(role.id);
  return (role.badge ? TIER_ORDER[role.badge.tier] : 3) * 10 + (rank === -1 ? RANKED_ROLES.length : rank);
};

export interface ShownBadge {
  id: string;
  name: string;
  badge: RoleBadgeData;
}

/**
 * The one badge worth drawing right after someone's name in chat and lists: that of the highest role
 * that has one. Nothing for an ordinary member, or when none of their roles has a badge.
 */
export function shownBadge(profile: WithRoles | null | undefined): ShownBadge | undefined {
  const role = rolesOf(profile).find((r) => r.badge);
  return role?.badge ? { id: role.id, name: role.name, badge: role.badge } : undefined;
}

/** Display names of a user's roles, falling back to the raw ids. */
export function roleNames(profile: WithRoles): string[] {
  if (profile.resolved_roles?.length) return profile.resolved_roles.map((r) => r.role_name);
  return profile.roles_ids ?? [];
}
