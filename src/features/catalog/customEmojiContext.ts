import { createContext, useContext } from "react";
import type { CatalogItem } from "./api";

export interface CustomEmojiIndex {
  /** Custom emoji by `:alias:`. */
  byAlias: ReadonlyMap<string, CatalogItem>;
  /** Every catalog item by id: what a `sticker:<id>` reaction points at. */
  byId: ReadonlyMap<string, CatalogItem>;
}

export const NO_CUSTOM_EMOJI: CustomEmojiIndex = { byAlias: new Map(), byId: new Map() };

export const CustomEmojiContext = createContext<CustomEmojiIndex>(NO_CUSTOM_EMOJI);

/** The instance's custom emoji, for drawing `:alias:` in text and `sticker:<id>` reactions. Empty outside the app shell. */
export const useCustomEmoji = () => useContext(CustomEmojiContext);
