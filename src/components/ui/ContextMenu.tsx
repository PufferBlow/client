import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clampToViewport } from "./menuPosition";

export type MenuEntry =
  | { kind: "item"; id: string; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }
  /** A row of compact buttons under a shared label, e.g. quick emoji reactions. */
  | { kind: "choices"; id: string; label: string; choices: { id: string; label: string; content: ReactNode; pressed?: boolean; onSelect: () => void }[] }
  | { kind: "separator"; id: string };

export interface ContextMenuProps {
  /** Where the pointer was (or the anchor's corner), in viewport coordinates. */
  x: number;
  y: number;
  entries: MenuEntry[];
  label: string;
  onClose: () => void;
}

const itemBase =
  "flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-sm outline-none focus-visible:bg-hover";

/**
 * A floating menu anchored at a point. Closes on outside click, Escape, scroll, resize and blur;
 * arrow keys move between items and focus returns to where it was when the menu closes.
 */
export function ContextMenu({ x, y, entries, label, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // Measure before paint, then place: the menu is invisible until it has a clamped position, so it never jumps.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition(clampToViewport({ x, y }, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [x, y, entries.length]);

  // Focus the first action on open and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const close = () => onCloseRef.current();
    const onPointerDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, []);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(index + 1);
    else if (e.key === "ArrowUp") go(index < 0 ? items.length - 1 : index - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  };

  const choose = (select: () => void) => {
    onClose();
    select();
  };

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      onKeyDown={move}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: position?.left ?? x, top: position?.top ?? y, visibility: position ? "visible" : "hidden" }}
      className="fixed z-[70] min-w-[220px] max-w-[300px] rounded-xl border border-border-secondary bg-surface-secondary p-1.5 text-text shadow-popover"
    >
      {entries.map((entry) => {
        if (entry.kind === "separator") return <div key={entry.id} role="separator" className="-mx-1.5 my-1.5 h-px bg-border-secondary" />;

        if (entry.kind === "choices") {
          return (
            <div key={entry.id} role="group" aria-label={entry.label} className="flex items-center gap-1 px-1 py-1">
              <span className="mr-1 text-[11px] uppercase tracking-[0.1em] text-text-muted">{entry.label}</span>
              {entry.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  role="menuitem"
                  aria-label={choice.label}
                  tabIndex={-1}
                  aria-pressed={choice.pressed}
                  onClick={() => choose(choice.onSelect)}
                  className={`grid h-8 w-8 place-items-center rounded-lg border-0 text-base outline-none hover:bg-hover focus-visible:bg-hover ${choice.pressed ? "bg-primary/15" : "bg-transparent"}`}
                >
                  {choice.content}
                </button>
              ))}
            </div>
          );
        }

        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            aria-disabled={entry.disabled || undefined}
            tabIndex={-1}
            onClick={() => !entry.disabled && choose(entry.onSelect)}
            className={[
              itemBase,
              entry.danger ? "text-error hover:bg-error/10 focus-visible:bg-error/10" : "text-text-secondary hover:bg-hover hover:text-text",
              entry.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
            ].join(" ")}
          >
            {entry.icon && <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">{entry.icon}</span>}
            <span className="flex-1">{entry.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
