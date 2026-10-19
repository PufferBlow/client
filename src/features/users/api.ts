import { api } from "../../services/api";
import { persistSession, type AuthTokens } from "../../services/auth";
import { authed, requireSession } from "../../services/authed";
import type { PresenceStatus, UserProfile } from "./types";

const USERS = "/api/v1/users";

export async function getMyProfile(): Promise<UserProfile> {
  const { user_data } = await authed.body<{ user_data: UserProfile }>("POST", `${USERS}/profile`);
  if (!user_data) throw new Error("The instance returned an unexpected response.");
  return user_data;
}

/** Every user on the instance, with presence. There is no per-channel member list. */
export async function listUsers(): Promise<UserProfile[]> {
  const { users } = await authed.query<{ users: UserProfile[] }>("GET", `${USERS}/list`);
  return users ?? [];
}

/** `PUT /profile` applies exactly one field per request, so each setter sends one. */
const editProfile = (fields: Record<string, string>) => authed.body<unknown>("PUT", `${USERS}/profile`, fields).then(() => undefined);

export const updateUsername = (newUsername: string) => editProfile({ new_username: newUsername });
export const updateAbout = (about: string) => editProfile({ about });
export const updateStatus = (status: PresenceStatus) => editProfile({ status });
export const changePassword = (oldPassword: string, newPassword: string) =>
  editProfile({ old_password: oldPassword, new_password: newPassword });

export async function updateAppearance(options: {
  accentColor?: string;
  avatarKind?: "identicon" | "image";
  bannerKind?: "default" | "solid" | "image";
  shuffleAvatarSeed?: boolean;
}): Promise<void> {
  await authed.body("PUT", `${USERS}/profile/appearance`, {
    accent_color: options.accentColor,
    avatar_kind: options.avatarKind,
    banner_kind: options.bannerKind,
    shuffle_avatar_seed: options.shuffleAvatarSeed ?? false,
  });
}

/**
 * Re-issue session tokens after confirming the password. The previous tokens stop
 * working, so the new pair replaces them for this device.
 */
export async function resetSessionTokens(password: string, remember: boolean): Promise<void> {
  const { origin, token } = requireSession();
  const tokens = await api.post<AuthTokens>(`${origin}${USERS}/profile/reset-auth-token`, {
    json: { auth_token: token, password },
  });
  if (!tokens?.auth_token) throw new Error("The instance returned an unexpected response.");
  await persistSession(tokens, remember);
}
