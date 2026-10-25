import { useState } from "react";
import { Search } from "lucide-react";
import { kindOf, type CatalogItem, type CatalogKind } from "../../features/catalog/api";
import { catalogSrc, useCatalog } from "../../features/catalog/hooks";
import { Skeleton } from "@pufferblow/spines";

const nameOf = (item: CatalogItem) => item.alias ? `:${item.alias}:` : item.display_name;

function GridSkeleton({ kind }: { kind: CatalogKind }) {
  const sticker = kind === "sticker";
  return (
    <div aria-hidden="true" className={`grid gap-1 ${sticker ? "grid-cols-4" : "grid-cols-8"}`}>
      {Array.from({ length: sticker ? 12 : 32 }, (_, i) => (
        <Skeleton key={i} className={sticker ? "aspect-square" : "size-9.5 rounded-lg"} />
      ))}
    </div>
  );
}

/**
 * The instance's custom emoji or stickers as a grid to pick from: a search field over it, animated
 * pictures playing as they are. Used as a tab of the emoji picker.
 */
export function CatalogPicker({ kind, onPick }: { kind: CatalogKind; onPick: (item: CatalogItem) => void }) {
  const { data, isPending, error, refetch } = useCatalog();
  const [query, setQuery] = useState("");
  const sticker = kind === "sticker";
  const noun = sticker ? "stickers" : "custom emoji";

  const items = (data ?? []).filter((item) => kindOf(item) === kind && item.is_active);
  const q = query.trim().toLowerCase().replace(/^:|:$/g, "");
  const shown = q ? items.filter((i) => i.display_name.toLowerCase().includes(q) || (i.alias ?? "").includes(q)) : items;

  let body;
  if (isPending) body = <GridSkeleton kind={kind} />;
  else if (error)
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-sm text-text-muted">
        <p className="m-0">Couldn&apos;t load the {noun}.</p>
        <button type="button" className="cursor-pointer rounded-lg border-0 bg-surface-tertiary px-3 py-1.5 text-text hover:bg-active" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  else if (items.length === 0)
    body = (
      <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
        <p className="pb-title m-0 text-[17px]">No {noun} yet</p>
        <p className="pb-meta m-0 text-[13px]">Whoever runs this server can add them in the control panel.</p>
      </div>
    );
  else if (shown.length === 0) body = <p className="pb-meta m-0 px-2 py-10 text-center text-[13px]">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>;
  else
    body = (
      <div className={`grid gap-1 ${sticker ? "grid-cols-4" : "grid-cols-8"}`}>
        {shown.map((item) => (
          <button
            key={item.sticker_id}
            type="button"
            title={nameOf(item)}
            aria-label={nameOf(item)}
            onClick={() => onPick(item)}
            className={`grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 hover:bg-active focus-visible:shadow-[0_0_0_2px_var(--color-text)] ${sticker ? "aspect-square p-1.5" : "size-9.5"}`}
          >
            <img src={catalogSrc(item)} alt="" loading="lazy" draggable={false} className={`object-contain ${sticker ? "size-full" : "size-7"}`} />
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <label className="relative block">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          aria-label={`Search ${noun}`}
          placeholder={`Search ${noun}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-xl border border-border-secondary bg-surface py-0 pl-9 pr-3 text-[13.5px] text-text outline-none placeholder:text-text-muted focus:border-text/60"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}
