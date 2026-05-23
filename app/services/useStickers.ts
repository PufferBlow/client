/**
 * `useStickers` — react-query hook for the instance sticker library.
 *
 * The picker calls this on every chat open, so we lean on react-query
 * caching aggressively. `staleTime` matches the server-side TTL
 * (5 minutes) — admin actions that mutate the library invalidate the
 * query so the picker sees the change on the next mount.
 *
 * One key per host_port so a user with multiple instances configured
 * (federation viewer, multi-server account) gets a clean per-instance
 * cache without manual scope juggling.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteSticker,
  listAllStickers,
  listStickers,
  updateSticker,
  uploadSticker,
  type StickerRecord,
} from "./stickers";

const STICKERS_QUERY_KEY = "stickers" as const;
const STICKERS_STALE_TIME_MS = 5 * 60 * 1000; // matches server TTL

/**
 * Active stickers (the picker view). Returns empty list while
 * loading so consumers can skip an extra `isLoading` check when
 * iterating.
 */
export function useStickers(hostPort: string | undefined, authToken: string | undefined) {
  const query = useQuery({
    queryKey: [STICKERS_QUERY_KEY, "active", hostPort],
    queryFn: async (): Promise<StickerRecord[]> => {
      if (!hostPort || !authToken) return [];
      const response = await listStickers(hostPort, authToken);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load stickers.");
      }
      return response.data.stickers;
    },
    enabled: !!hostPort && !!authToken,
    staleTime: STICKERS_STALE_TIME_MS,
    // Render a fresh empty array on disabled / pre-load so callers
    // don't have to guard against `undefined.length`.
    placeholderData: [],
  });
  return query;
}

/**
 * All stickers including deactivated — admin management view only.
 */
export function useAllStickers(hostPort: string | undefined, authToken: string | undefined) {
  return useQuery({
    queryKey: [STICKERS_QUERY_KEY, "all", hostPort],
    queryFn: async (): Promise<StickerRecord[]> => {
      if (!hostPort || !authToken) return [];
      const response = await listAllStickers(hostPort, authToken);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load stickers.");
      }
      return response.data.stickers;
    },
    enabled: !!hostPort && !!authToken,
    // Admin view wants freshness over speed — re-fetch on every mount.
    staleTime: 0,
    placeholderData: [],
  });
}

/**
 * Sticker library mutations. Returns the four CRUD verbs bundled so
 * the admin UI imports one hook and reads the union of mutation states.
 *
 * Every mutation invalidates both the active list and the all-list so
 * the picker AND the management view re-fetch after a write — they
 * share a library and a stale picker after an upload feels broken.
 */
export function useStickerMutations(
  hostPort: string | undefined,
  authToken: string | undefined,
) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [STICKERS_QUERY_KEY],
    });
  };

  const upload = useMutation({
    mutationFn: async (args: { file: File; displayName: string; alias?: string }) => {
      if (!hostPort || !authToken) throw new Error("Not signed in.");
      const response = await uploadSticker(
        hostPort,
        authToken,
        args.file,
        args.displayName,
        args.alias,
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Sticker upload failed.");
      }
      return response.data.sticker;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (args: {
      stickerId: string;
      displayName?: string;
      alias?: string;
      isActive?: boolean;
    }) => {
      if (!hostPort || !authToken) throw new Error("Not signed in.");
      const response = await updateSticker(hostPort, authToken, args.stickerId, {
        display_name: args.displayName,
        alias: args.alias,
        is_active: args.isActive,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Sticker update failed.");
      }
      return response.data.sticker;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (stickerId: string) => {
      if (!hostPort || !authToken) throw new Error("Not signed in.");
      const response = await deleteSticker(hostPort, authToken, stickerId);
      if (!response.success) {
        throw new Error(response.error || "Sticker delete failed.");
      }
      return true;
    },
    onSuccess: invalidate,
  });

  return { upload, update, remove };
}

/**
 * Index a sticker list by ID for O(1) lookup at render time. The
 * MessageRenderer + reaction-pill components both need this; doing
 * the indexing once in a memoised hook is cheaper than calling
 * `.find()` per message render.
 */
export function indexStickersById(
  stickers: StickerRecord[] | undefined,
): Map<string, StickerRecord> {
  const map = new Map<string, StickerRecord>();
  if (!stickers) return map;
  for (const s of stickers) map.set(s.sticker_id, s);
  return map;
}

/**
 * Index by URL — for cases where the wire only carries the URL
 * (DM attachments are `list[str]`, so the renderer reverse-lookups
 * the sticker_id from the URL to know it's a sticker vs an arbitrary
 * image).
 */
export function indexStickersByUrl(
  stickers: StickerRecord[] | undefined,
): Map<string, StickerRecord> {
  const map = new Map<string, StickerRecord>();
  if (!stickers) return map;
  for (const s of stickers) map.set(s.sticker_url, s);
  return map;
}
