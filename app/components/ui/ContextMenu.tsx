import { type ReactNode, useEffect, useMemo, useRef } from "react";

export type ContextMenuTone = "default" | "danger" | "warning" | "success";

/**
 * An action row in the context menu. Renders as a clickable button.
 */
export interface ContextMenuActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: ContextMenuTone;
  onSelect: () => void;
  /** Optional flag to render the item but mark it as separator-after. */
  separator?: never;
}

/**
 * A visual separator row. Used to group related actions inside the menu
 * (e.g. neutral actions / destructive actions / moderation actions).
 */
export interface ContextMenuSeparatorItem {
  id: string;
  separator: true;
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem;

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  items: ContextMenuItem[];
  minWidth?: number;
}

// Tones now use the brand color palette directly so destructive and
// warning actions stand out from neutral ones at a glance. The hover
// background tints with the same color at low alpha so the row reads
// as "this is the dangerous one I'm about to click" without shouting.
const toneClassMap: Record<ContextMenuTone, string> = {
  default:
    "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
  danger:
    "text-[var(--color-error)] hover:bg-[var(--color-error)]/12",
  warning:
    "text-[var(--color-warning)] hover:bg-[var(--color-warning)]/12",
  success:
    "text-[var(--color-success)] hover:bg-[var(--color-success)]/12",
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
    // The y-clamp's purpose is to keep the menu from rendering OFF
    // the bottom of the viewport. A previous version used
    // `Math.round(window.innerHeight * 0.8)` as the assumed menu
    // height -- that meant every menu was pushed up into the top
    // 20% of the screen, far from where the user clicked. Reverted
    // to a smaller estimate (320px) which covers the height of a
    // typical menu without over-correcting. Menus that genuinely
    // need more vertical space are still bounded by the rendered
    // `max-h-[80vh] overflow-y-auto` below, so they scroll instead
    // of clipping when they hit the viewport bottom.
    const estimatedMenuHeight = 320;
    const x = Math.min(Math.max(gap, position.x), window.innerWidth - width - gap);
    const y = Math.min(
      Math.max(gap, position.y),
      Math.max(gap, window.innerHeight - estimatedMenuHeight - gap),
    );
    return { x, y };
  }, [position, minWidth]);

  if (!isOpen) {
    return null;
  }

  // Defensive separator collapse:
  //
  //   - Drop leading separators (a divider at the very top of the
  //     menu is meaningless — there's nothing above to divide it
  //     from).
  //   - Collapse runs of consecutive separators into one (two
  //     separators in a row are always a layout bug — the section
  //     between them was conditionally rendered and came up empty).
  //   - Drop trailing separators (a divider at the very bottom is
  //     just an empty 1-px stripe under the last action).
  //
  // Consumers should still avoid pushing empty separators, but this
  // pass makes the menu robust against privilege-gated sections
  // that collapse to zero items at runtime — the dangling divider
  // the user reported is exactly the pattern this catches.
  const visibleItems = collapseSeparators(items);

  return (
    <>
      <button className="fixed inset-0 z-40" onClick={onClose} aria-label="Close menu backdrop" />
      <div
        ref={menuRef}
        className="pb-menu fixed z-50 max-h-[80vh] overflow-y-auto rounded-xl py-1"
        style={{ left: safePosition.x, top: safePosition.y, minWidth }}
      >
        {visibleItems.map((item) =>
          "separator" in item ? (
            <div
              key={item.id}
              role="separator"
              aria-orientation="horizontal"
              className="my-1 h-px bg-[var(--color-border)]/60"
            />
          ) : (
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
          ),
        )}
      </div>
    </>
  );
}

/**
 * Strip leading, trailing, and consecutive separators from a
 * context-menu items array. Exported indirectly via the component
 * — see the comment block at the call site for rationale.
 */
function collapseSeparators(items: ContextMenuItem[]): ContextMenuItem[] {
  const result: ContextMenuItem[] = [];
  let pendingSeparator: ContextMenuSeparatorItem | null = null;
  for (const item of items) {
    // Use a type predicate so the narrowing flows into the
    // assignment below. ``"separator" in item`` widens to
    // ``ContextMenuItem`` in TS' control-flow analysis when the
    // union members both have an ``id`` field, which broke
    // ``pendingSeparator = item``. The explicit predicate locks
    // the narrowing.
    if (isSeparator(item)) {
      // Hold the separator — only emit it once we see a real action
      // following it. Consecutive separators collapse because each
      // new one replaces the held value.
      if (result.length > 0) {
        pendingSeparator = item;
      }
      continue;
    }
    if (pendingSeparator) {
      result.push(pendingSeparator);
      pendingSeparator = null;
    }
    result.push(item);
  }
  // pendingSeparator at this point would be a trailing separator —
  // intentionally NOT pushed.
  return result;
}

function isSeparator(item: ContextMenuItem): item is ContextMenuSeparatorItem {
  return (item as ContextMenuSeparatorItem).separator === true;
}
