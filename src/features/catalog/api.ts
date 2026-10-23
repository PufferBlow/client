import { authed } from "../../services/authed";

/** One row of the instance's catalog: a sticker (sent as a message) or a custom emoji (typed `:alias:`, or used to react). */
export interface CatalogItem {
  sticker_id: string;
  sticker_url: string;
  filename: string;
  display_name: string;
  /** The `:shortcode:` people type. Always set for an emoji. */
  alias: string | null;
  /** Instances older than custom emoji send no kind: everything they list is a sticker. */
  kind?: "sticker" | "emoji";
  is_active: boolean;
  usage_count?: number;
}

export type CatalogKind = "sticker" | "emoji";

const STICKERS = "/api/v1/stickers";

export const kindOf = (item: CatalogItem): CatalogKind => (item.kind === "emoji" ? "emoji" : "sticker");

/** What the picker offers: every active item. */
export async function listCatalog(): Promise<CatalogItem[]> {
  const { stickers } = await authed.query<{ stickers: CatalogItem[] }>("GET", STICKERS);
  return stickers ?? [];
}

/** What the control panel manages: every item, hidden ones included. Needs the privilege to manage stickers. */
export async function listAllCatalog(): Promise<CatalogItem[]> {
  const { stickers } = await authed.query<{ stickers: CatalogItem[] }>("GET", `${STICKERS}/all`);
  return stickers ?? [];
}

export async function uploadCatalogItem(input: {
  file: File;
  name: string;
  alias?: string;
  kind: CatalogKind;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<CatalogItem> {
  const form = new FormData();
  form.set("file", input.file, input.file.name);
  form.set("display_name", input.name);
  form.set("kind", input.kind);
  if (input.alias) form.set("alias", input.alias);
  const { sticker } = await authed.query<{ sticker: CatalogItem }>("POST", STICKERS, { form, onUploadProgress: input.onProgress, timeout: 60_000 });
  return sticker;
}

export const updateCatalogItem = (id: string, change: { display_name?: string; alias?: string; is_active?: boolean }) =>
  authed.query<{ sticker: CatalogItem }>("PATCH", `${STICKERS}/${encodeURIComponent(id)}`, { json: change }).then((r) => r.sticker);

export const deleteCatalogItem = (id: string) => authed.query<unknown>("DELETE", `${STICKERS}/${encodeURIComponent(id)}`).then(() => undefined);
