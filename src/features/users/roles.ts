import { identity } from "../../lib/identity";
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
 * Whether this user may ping the whole channel with `@everyone`: owners, admins and moderators,
 * who share the `moderate_content` privilege. The server decides for real; this only decides
 * whether to offer it.
 */
export function canMentionEveryone(profile: (WithRoles & Pick<UserProfile, "resolved_privileges">) | null | undefined): boolean {
  if (!profile) return false;
  return isServerOwner(profile) || (profile.resolved_privileges ?? []).includes("moderate_content");
}

/** Roles every account has, which say nothing about a person. */
const ORDINARY_ROLES = new Set(["member", "user", "everyone"]);
/** Roles that outrank the rest, in order. Any other role comes after them, in the order it was given. */
const RANKED_ROLES = [OWNER_ROLE_ID, "admin", "moderator"];

export interface ShownRole {
  id: string;
  name: string;
  /** The role's identity colour: roles are one of the things that may be coloured. */
  colour: string;
}

/**
 * The one role worth printing beside someone's name: the highest of owner, admin and moderator, else
 * the first role that is not the default one. Nothing for an ordinary member. Roles carry no colour on
 * the server yet, so each gets the identity colour its id hashes to, the same on every client.
 */
export function shownRole(profile: WithRoles | null | undefined): ShownRole | undefined {
  if (!profile) return undefined;
  const named = new Map((profile.resolved_roles ?? []).map((r) => [r.role_id, r.role_name]));
  const ids = [...new Set([...(profile.roles_ids ?? []), ...named.keys()])].filter((id) => !ORDINARY_ROLES.has(id.toLowerCase()));
  const id = RANKED_ROLES.find((r) => ids.includes(r)) ?? ids[0];
  if (!id) return undefined;
  const name = named.get(id) ?? id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { id, name, colour: identity(`role:${id}`).hex };
}

/** Display names of a user's roles, falling back to the raw ids. */
export function roleNames(profile: WithRoles): string[] {
  if (profile.resolved_roles?.length) return profile.resolved_roles.map((r) => r.role_name);
  return profile.roles_ids ?? [];
}
