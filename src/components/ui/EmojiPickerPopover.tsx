import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CatalogItem } from "../../features/catalog/api";
import { CatalogPicker } from "./CatalogPicker";
import EmojiPicker from "./EmojiPicker";
import { clampToViewport } from "./menuPosition";

// The emoji grid is 8 columns of 38px plus padding and scrollbar (332px) and 392px tall, under a 40px
// row of tabs, inside a 1px border; the popover is exactly this size from the first frame.
const TABS_HEIGHT = 40;
const EMOJI_SIZE = { width: 334, height: 394 };

type Tab = "emoji" | "custom" | "stickers";

interface Props {
  x: number;
  y: number;
  /** A standard emoji was chosen. */
  onSelect: (emoji: string) => void;
  /** A custom emoji of the instance was chosen. Without this the Custom tab is not offered. */
  onCustom?: (item: CatalogItem) => void;
  /** A sticker was chosen. Without this the Stickers tab is not offered. */
  onSticker?: (item: CatalogItem) => void;
  onClose: () => void;
}

/** The emoji picker floating at a point, dismissed like a menu (outside click, Escape, resize). */
export function EmojiPickerPopover({ x, y, onSelect, onCustom, onSticker, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const hasTabs = Boolean(onCustom ?? onSticker);
  const PICKER_SIZE = useMemo(() => ({ width: EMOJI_SIZE.width, height: EMOJI_SIZE.height + (hasTabs ? TABS_HEIGHT : 0) }), [hasTabs]);
  const [tab, setTab] = useState<Tab>("emoji");
  const [position, setPosition] = useState(() =>
    clampToViewport({ x, y }, PICKER_SIZE, { width: window.innerWidth, height: window.innerHeight }),
  );
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    setPosition(clampToViewport({ x, y }, PICKER_SIZE, { width: window.innerWidth, height: window.innerHeight }));
  }, [x, y, PICKER_SIZE]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => onCloseRef.current();
    const onPointerDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: "emoji", label: "Emoji" },
    ...(onCustom ? [{ id: "custom" as const, label: "Custom" }] : []),
    ...(onSticker ? [{ id: "stickers" as const, label: "Stickers" }] : []),
  ];

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label="Choose an emoji"
      style={{ left: position.left, top: position.top, width: PICKER_SIZE.width, height: PICKER_SIZE.height }}
      className="fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-secondary shadow-modal"
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasTabs && (
        <div role="tablist" aria-label="Kinds of emoji" style={{ height: TABS_HEIGHT }} className="flex shrink-0 items-center gap-1 border-b border-border-secondary px-2.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`pb-label-button h-7 cursor-pointer rounded-sm border-0 px-3 text-[11.5px] transition-colors duration-(--motion-fast) ${tab === t.id ? "bg-text text-on-primary" : "bg-transparent text-text-tertiary hover:bg-active hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" className="min-h-0 flex-1">
        {tab === "emoji" && <EmojiPicker onSelect={(emoji) => onSelect(emoji.native)} />}
        {tab === "custom" && onCustom && <CatalogPicker kind="emoji" onPick={onCustom} />}
        {tab === "stickers" && onSticker && <CatalogPicker kind="sticker" onPick={onSticker} />}
      </div>
    </div>,
    document.body,
  );
}
