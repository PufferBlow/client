import { api } from "../../services/api";
import { authed, requireSession } from "../../services/authed";
import { type RoleBadgeData } from "@pufferblow/spines";
import type { AuditEntry } from "./moderation";

const SYSTEM = "/api/v1/system";
const MODERATION = "/api/v1/moderation";

// ---- roles

export interface Role {
  role_id: string;
  role_name: string;
  privileges_ids: string[];
  /** Built in: owner, admin, moderator and member cannot be edited or deleted. */
  is_system: boolean;
  user_count: number;
  /** The mark after the name of whoever holds the role; instances before role badges send none. */
  badge?: RoleBadgeData | null;
}

export interface Privilege {
  privilege_id: string;
  privilege_name: string;
  category: string;
}

export async function listRoles(): Promise<Role[]> {
  const { roles } = await authed.body<{ roles: Role[] }>("POST", `${SYSTEM}/roles/list`);
  return roles ?? [];
}

export async function listPrivileges(): Promise<Privilege[]> {
  const { privileges } = await authed.body<{ privileges: Privilege[] }>("POST", `${SYSTEM}/privileges/list`);
  return privileges ?? [];
}

export interface RoleChange {
  role_name: string;
  privileges_ids: string[];
  /** Set or change the badge. */
  badge?: RoleBadgeData;
  /** Take the badge off. */
  remove_badge?: boolean;
}

export const createRole = (role: RoleChange) => authed.body<{ role: Role }>("POST", `${SYSTEM}/roles`, role as unknown as Record<string, unknown>);
export const updateRole = (roleId: string, role: RoleChange) =>
  authed.body<{ role: Role }>("PUT", `${SYSTEM}/roles/${encodeURIComponent(roleId)}`, role as unknown as Record<string, unknown>);

/** Uploads the picture for an image badge (a 128 × 128 PNG); the badge then points at the address returned. */
export async function uploadBadgeImage(file: File, onProgress?: (loaded: number, total: number) => void): Promise<string> {
  const { origin, token } = requireSession();
  const form = new FormData();
  form.append("auth_token", token);
  form.append("file", file, file.name);
  const { url } = await api.request<{ url: string }>("POST", `${origin}${SYSTEM}/role-badge-images`, { form, onUploadProgress: onProgress });
  return url;
}
export const deleteRole = (roleId: string) => authed.query<unknown>("DELETE", `${SYSTEM}/roles/${encodeURIComponent(roleId)}`);
/** Replaces everything the person holds; an empty list gives them the default role. */
export const setUserRoles = (userId: string, rolesIds: string[]) =>
  authed.body<unknown>("PUT", `${SYSTEM}/users/${encodeURIComponent(userId)}/roles`, { roles_ids: rolesIds });

// ---- moderation

const target = (userId: string) => encodeURIComponent(userId);
export const banUser = (userId: string, reason?: string) => authed.body<unknown>("POST", `${MODERATION}/users/${target(userId)}/ban`, reason ? { reason } : {});
export const unbanUser = (userId: string) => authed.query<unknown>("DELETE", `${MODERATION}/users/${target(userId)}/ban`);
export const timeoutUser = (userId: string, minutes: number, reason?: string) =>
  authed.body<unknown>("POST", `${MODERATION}/users/${target(userId)}/timeout`, { duration_minutes: minutes, ...(reason ? { reason } : {}) });
export const clearTimeout = (userId: string) => authed.query<unknown>("DELETE", `${MODERATION}/users/${target(userId)}/timeout`);

export interface Report {
  id: string;
  type: "message_report" | "user_report";
  status: "pending" | "resolved";
  category: string;
  description: string | null;
  reporter: { id: string; username: string } | null;
  reported_at: string;
  message_ids?: string[];
  channel_ids?: string[];
  sender?: { id: string; username: string } | null;
  target_user?: { id: string | null; username: string };
}

export async function listReports(limit = 200): Promise<Report[]> {
  const { reports } = await authed.body<{ reports: Report[] }>("POST", `${MODERATION}/reports`, { limit });
  return reports ?? [];
}

export const resolveReport = (reportId: string, action: string, reason?: string) =>
  authed.body<unknown>("POST", `${MODERATION}/reports/${encodeURIComponent(reportId)}/resolve`, { action, ...(reason ? { reason } : {}) });

// ---- audit log

/** Instances older than this client cap the window at 200, so ask for no more than that. */
export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const { activities } = await authed.body<{ activities: AuditEntry[] }>("POST", `${SYSTEM}/recent-activity`, { limit });
  return activities ?? [];
}

// ---- blocked IP addresses

export interface BlockedIp {
  ip: string;
  reason: string | null;
  blocked_at: string;
  /** How many times it has been turned away since. */
  attempts?: number;
}

export async function listBlockedIps(): Promise<BlockedIp[]> {
  const { blocked_ips } = await authed.body<{ blocked_ips: BlockedIp[] }>("POST", "/api/v1/blocked-ips/list");
  return blocked_ips ?? [];
}
export const blockIp = (ip: string, reason: string) => authed.body<unknown>("POST", "/api/v1/blocked-ips/block", { ip, reason });
export const unblockIp = (ip: string) => authed.body<unknown>("POST", "/api/v1/blocked-ips/unblock", { ip });

// ---- server settings

/** What `PUT /system/server-info` takes; send only what changed. Sizes are in MB. */
export interface ServerSettingsChange {
  server_name?: string;
  server_description?: string;
  welcome_message?: string;
  is_private?: boolean;
  /** Who may join: anyone, with an invitation code, or by asking and being approved. */
  join_mode?: "open" | "invite" | "request";
  max_message_length?: number;
  max_image_size?: number;
  max_video_size?: number;
  max_sticker_size?: number;
  max_gif_size?: number;
  /** File extensions without the dot, lower case. */
  allowed_image_types?: string[];
  allowed_video_types?: string[];
  allowed_file_types?: string[];
  allowed_sticker_types?: string[];
  allowed_gif_types?: string[];
}
export const updateServerSettings = (change: ServerSettingsChange) => authed.body<unknown>("PUT", `${SYSTEM}/server-info`, change as Record<string, unknown>);

export const updateServerAppearance = (change: { avatar_kind?: "identicon"; banner_kind?: "default" | "solid"; accent_color?: string; shuffle_avatar_seed?: boolean; look?: Record<string, string | null> }) =>
  authed.body<unknown>("PUT", `${SYSTEM}/server-appearance`, change as Record<string, unknown>);
