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

/** Display names of a user's roles, falling back to the raw ids. */
export function roleNames(profile: WithRoles): string[] {
  if (profile.resolved_roles?.length) return profile.resolved_roles.map((r) => r.role_name);
  return profile.roles_ids ?? [];
}
