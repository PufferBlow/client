import { useMemo, type ReactNode } from "react";
import { kindOf, type CatalogItem } from "./api";
import { CustomEmojiContext, NO_CUSTOM_EMOJI, type CustomEmojiIndex } from "./customEmojiContext";
import { useCatalog } from "./hooks";

/** Makes the instance's custom emoji available to everything below, so `:alias:` in text and `sticker:<id>` reactions can be drawn. */
export function CustomEmojiProvider({ children }: { children: ReactNode }) {
  const { data } = useCatalog();
  const index = useMemo<CustomEmojiIndex>(() => {
    if (!data?.length) return NO_CUSTOM_EMOJI;
    const byAlias = new Map<string, CatalogItem>();
    const byId = new Map<string, CatalogItem>();
    for (const item of data) {
      byId.set(item.sticker_id, item);
      if (kindOf(item) === "emoji" && item.alias) byAlias.set(item.alias, item);
    }
    return { byAlias, byId };
  }, [data]);
  return <CustomEmojiContext.Provider value={index}>{children}</CustomEmojiContext.Provider>;
}
