import { useLayoutEffect, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const EDGE = 8;

export interface FloatingPanelProps {
  /** The control the panel hangs from. */
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Match the anchor's width (a dropdown) or size to the content (a calendar). */
  matchWidth?: boolean;
  label?: string;
  role?: string;
  className?: string;
}

/**
 * A surface that opens under a control, in front of everything (so no scroller or card clips it),
 * flips above when there is no room below, and closes on Escape or a press outside it.
 */
export function FloatingPanel({ anchor, onClose, children, matchWidth, label, role = "dialog", className = "" }: FloatingPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; minWidth?: number; visibility: "hidden" | "visible" }>({ top: 0, left: 0, visibility: "hidden" });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      if (!a || !p) return;
      const below = window.innerHeight - a.bottom - EDGE;
      const top = below >= p.height || a.top < p.height + EDGE ? a.bottom + GAP : a.top - p.height - GAP;
      const left = Math.max(EDGE, Math.min(a.left, window.innerWidth - p.width - EDGE));
      setStyle({ top, left, minWidth: matchWidth ? a.width : undefined, visibility: "visible" });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, matchWidth, children]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      anchor.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={panel} role={role} aria-label={label} style={{ position: "fixed", zIndex: 80, ...style }} className={`rounded-lg bg-surface-tertiary shadow-popover ${className}`}>
      {children}
    </div>,
    document.body,
  );
}
