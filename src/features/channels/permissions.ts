import type { UserProfile } from "../users/types";

type Viewer = Pick<UserProfile, "resolved_privileges"> | null | undefined;

const has = (viewer: Viewer, privilege: string) => Boolean(viewer?.resolved_privileges?.includes(privilege));

/**
 * What the sidebar offers. The backend enforces each privilege on its own routes; this only
 * keeps actions the viewer can't perform out of the menu.
 */
export const canCreateChannels = (viewer: Viewer) => has(viewer, "create_channels");
export const canEditChannels = (viewer: Viewer) => has(viewer, "edit_channels");
export const canDeleteChannels = (viewer: Viewer) => has(viewer, "delete_channels");
