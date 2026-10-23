import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveAssetUrl } from "../../services/authed";
import { deleteCatalogItem, listAllCatalog, listCatalog, updateCatalogItem, uploadCatalogItem, type CatalogItem } from "./api";

export const catalogKeys = { active: ["catalog", "active"] as const, all: ["catalog", "all"] as const };

/** What the picker offers. The catalog changes rarely, so it is read once in a while. */
export const useCatalog = () => useQuery({ queryKey: catalogKeys.active, queryFn: listCatalog, staleTime: 5 * 60_000, retry: false });
export const useAllCatalog = () => useQuery({ queryKey: catalogKeys.all, queryFn: listAllCatalog, staleTime: 15_000, retry: false });

/** Add, hide and remove catalog items; the picker and the management list both refresh. */
export function useCatalogAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["catalog"] });
  return {
    upload: useMutation({ mutationFn: uploadCatalogItem, onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, ...change }: { id: string; display_name?: string; alias?: string; is_active?: boolean }) => updateCatalogItem(id, change), onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteCatalogItem, onSuccess: refresh }),
  };
}

/** The picture of a catalog item, ready to use as an `img` source. */
export const catalogSrc = (item: Pick<CatalogItem, "sticker_url">) => resolveAssetUrl(item.sticker_url);
