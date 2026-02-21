import { type ReactNode, useEffect, useMemo, useRef } from "react";

export type ContextMenuTone = "default" | "danger" | "warning" | "success";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: ContextMenuTone;
  onSelect: () => void;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  items: ContextMenuItem[];
  minWidth?: number;
}

const toneClassMap: Record<ContextMenuTone, string> = {
  default: "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
  danger:
    "text-[var(--color-error)] hover:bg-[var(--color-error)]/10 border-l border-[var(--color-error)]/40",
  warning:
    "text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 border-l border-[var(--color-warning)]/40",
  success:
    "text-[var(--color-success)] hover:bg-[var(--color-success)]/10 border-l border-[var(--color-success)]/40",
};

/**
 * Shared context menu with consistent interaction and monochrome styling.
 */
export function ContextMenu({
  isOpen,
  position,
  onClose,
  items,
  minWidth = 208,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen, onClose]);

  const safePosition = useMemo(() => {
    const gap = 8;
    const width = minWidth;
    const maxHeight = 360;
    const x = Math.min(Math.max(gap, position.x), window.innerWidth - width - gap);
    const y = Math.min(Math.max(gap, position.y), window.innerHeight - maxHeight - gap);
    return { x, y };
  }, [position, minWidth]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button className="fixed inset-0 z-40" onClick={onClose} aria-label="Close menu backdrop" />
      <div
        ref={menuRef}
        className="pb-menu fixed z-50 max-h-96 overflow-y-auto rounded-lg py-1"
        style={{ left: safePosition.x, top: safePosition.y, minWidth }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${toneClassMap[item.tone || "default"]}`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

