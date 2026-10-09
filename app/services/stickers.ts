/**
 * Sticker service — thin TypeScript wrapper over `/api/v1/stickers/*`.
 *
 * Mirrors the friends-service layout: pure network surface + types
 * here, react-query hook wrappers next to the picker that consumes
 * them. Keeps the surface easy to mock in tests and re-usable from
 * non-React contexts (CLI tooling, server-side rendering, etc).
 */
import type { ApiResponse } from "./apiClient";
import { createApiClient } from "./apiClient";

/**
 * Wire shape of one sticker — matches `ServerStickers.to_dict()` on
 * the server. `sticker_url` is the canonical storage URL (relative
 * on most instances; pipe through `createFullUrl` before rendering).
 */
export interface StickerRecord {
  sticker_id: string;
  sticker_url: string;
  filename: string;
  display_name: string;
  /** Optional `:shortcode:` for type-to-send. `null` when unset. */
  alias: string | null;
  uploaded_by: string | null;
  usage_count: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ListStickersResponse {
  status_code: number;
  stickers: StickerRecord[];
}

export interface StickerSingleResponse {
  status_code: number;
  sticker: StickerRecord;
}

export interface DeleteStickerResponse {
  status_code: number;
  deleted: boolean;
}

/**
 * Public sticker list — open to any signed-in user. Returns the
 * library ordered by usage_count desc then created_at desc so the
 * picker shows "most popular" at the top and freshest-uploads-next.
 */
export const listStickers = async (
  hostPort: string | undefined,
  authToken: string,
): Promise<ApiResponse<ListStickersResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListStickersResponse>("/api/v1/stickers", {
    auth_token: authToken,
  });
};

/**
 * Admin-only list including deactivated stickers — for the
 * management UI.
 */
export const listAllStickers = async (
  hostPort: string | undefined,
  authToken: string,
): Promise<ApiResponse<ListStickersResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.get<ListStickersResponse>("/api/v1/stickers/all", {
    auth_token: authToken,
  });
};

/**
 * Upload + register a sticker. Multipart body so the file rides
 * through the same code path channel attachments use. Returns the
 * new sticker row so the caller can append to its cached library
 * without a refetch.
 */
export const uploadSticker = async (
  hostPort: string | undefined,
  authToken: string,
  file: File,
  displayName: string,
  alias?: string,
): Promise<ApiResponse<StickerSingleResponse>> => {
  const apiClient = createApiClient(hostPort);
  const body = new FormData();
  body.append("file", file);
  body.append("display_name", displayName);
  if (alias && alias.trim()) {
    body.append("alias", alias.trim());
  }
  return apiClient.post<StickerSingleResponse>(
    `/api/v1/stickers?auth_token=${encodeURIComponent(authToken)}`,
    body,
  );
};

/**
 * Patch a sticker's metadata. Pass only the fields that actually
 * changed — undefined fields are left alone server-side.
 *
 * Pass `alias: ""` (empty string) to clear the alias. Pass
 * `is_active: false` to soft-deactivate (preserves the row + usage
 * stats; the picker hides it but already-sent messages keep
 * rendering).
 */
export const updateSticker = async (
  hostPort: string | undefined,
  authToken: string,
  stickerId: string,
  patch: { display_name?: string; alias?: string; is_active?: boolean },
): Promise<ApiResponse<StickerSingleResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.patch<StickerSingleResponse>(
    `/api/v1/stickers/${stickerId}?auth_token=${encodeURIComponent(authToken)}`,
    patch,
  );
};

/**
 * Hard-delete a sticker from the catalog. Already-sent messages
 * referencing the storage URL keep rendering — only the picker
 * entry goes away.
 */
export const deleteSticker = async (
  hostPort: string | undefined,
  authToken: string,
  stickerId: string,
): Promise<ApiResponse<DeleteStickerResponse>> => {
  const apiClient = createApiClient(hostPort);
  return apiClient.delete<DeleteStickerResponse>(
    `/api/v1/stickers/${stickerId}`,
    { auth_token: authToken },
  );
};

/**
 * Encode a sticker reference as a reaction key.
 *
 * Reactions are stored as arbitrary strings server-side; sticker
 * reactions use the prefix convention `sticker:<sticker_id>` so the
 * render path can distinguish them from unicode emoji with a cheap
 * string check. Pure formatter so it stays trivially testable.
 */
export const stickerReactionKey = (stickerId: string): string =>
  `sticker:${stickerId}`;

/**
 * Decode a reaction key back to a sticker_id, or null if the key
 * isn't a sticker reaction. The render side calls this to decide
 * whether to look up a sticker URL or render the key as a unicode
 * grapheme.
 */
export const parseStickerReactionKey = (key: string): string | null => {
  if (!key.startsWith("sticker:")) return null;
  const id = key.slice("sticker:".length);
  return id || null;
};
