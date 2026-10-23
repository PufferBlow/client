import { api } from "../../services/api";
import { requireSession } from "../../services/authed";

export type PictureKind = "avatar" | "banner";
export type PictureOwner = "profile" | "server";

/** What the instance stores as a picture. Animated ones are kept as they are: GIF, WebP and AVIF can all move. */
export const PICTURE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,.png,.jpg,.jpeg,.webp,.gif,.avif";
export const PICTURE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"] as const;

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** Whether the file can move: a GIF always may; a WebP or AVIF might, which only the instance can tell. */
export const mayAnimate = (file: Pick<File, "name" | "type">) => /^image\/(gif|webp|avif)$/.test(file.type) || ["gif", "webp", "avif"].includes(extensionOf(file.name));

/** Why a file cannot be a picture, in words for the person choosing it; null when it can. */
export function checkPicture(file: Pick<File, "name" | "type" | "size">, maxMb?: number | null): string | null {
  const known = (PICTURE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name)) || /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type);
  if (!known) return "That file is not a picture. Use a PNG, JPG, WebP, AVIF or GIF.";
  if (file.size === 0) return "That file is empty.";
  if (maxMb && file.size > maxMb * 1024 * 1024) return `That picture is larger than this instance allows (${maxMb} MB).`;
  return null;
}

const ROUTES: Record<PictureOwner, Record<PictureKind, { path: string; field: string }>> = {
  profile: {
    avatar: { path: "/api/v1/users/profile/avatar", field: "file" },
    banner: { path: "/api/v1/users/profile/banner", field: "file" },
  },
  server: {
    avatar: { path: "/api/v1/system/upload-avatar", field: "avatar" },
    banner: { path: "/api/v1/system/upload-banner", field: "banner" },
  },
};

/**
 * Upload a picture for the signed-in person's profile or for the server (which needs the privilege to
 * manage its settings). `onProgress` gets the bytes sent so far and the total. Resolves with the
 * picture's new address, so the caller can show it without waiting for a refetch.
 */
export async function uploadPicture(owner: PictureOwner, kind: PictureKind, file: File, onProgress?: (loaded: number, total: number) => void): Promise<string | null> {
  const { origin, token } = requireSession();
  const route = ROUTES[owner][kind];
  const form = new FormData();
  form.append("auth_token", token);
  form.append(route.field, file, file.name);
  const reply = await api.request<{ avatar_url?: string; banner_url?: string }>("POST", `${origin}${route.path}`, { form, onUploadProgress: onProgress, timeout: 120_000 });
  return (kind === "avatar" ? reply?.avatar_url : reply?.banner_url) ?? null;
}
