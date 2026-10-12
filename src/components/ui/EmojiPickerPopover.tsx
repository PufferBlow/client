import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clampToViewport } from "./menuPosition";

const EmojiPicker = lazy(() => import("./EmojiPicker"));

// emoji-mart's default picker is about this big; used to keep it on screen before it has rendered.
const PICKER_SIZE = { width: 352, height: 435 };

interface Props {
  x: number;
  y: number;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

/** The emoji picker floating at a point, dismissed like a menu (outside click, Escape, resize). */
export function EmojiPickerPopover({ x, y, onSelect, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    clampToViewport({ x, y }, PICKER_SIZE, { width: window.innerWidth, height: window.innerHeight }),
  );
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    setPosition(clampToViewport({ x, y }, PICKER_SIZE, { width: window.innerWidth, height: window.innerHeight }));
  }, [x, y]);

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

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label="Choose an emoji"
      style={{ left: position.left, top: position.top, width: PICKER_SIZE.width, minHeight: 120 }}
      className="fixed z-[70] overflow-hidden rounded-xl border border-border-secondary bg-surface-secondary shadow-popover"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Suspense fallback={<p className="m-0 p-6 text-center text-sm text-text-muted">Loading emoji…</p>}>
        <EmojiPicker onSelect={(emoji) => onSelect(emoji.native)} />
      </Suspense>
    </div>,
    document.body,
  );
}
