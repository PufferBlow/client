import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker from "./EmojiPicker";
import { clampToViewport } from "./menuPosition";

// The picker is 8 columns of 38px plus padding and scrollbar (332px) and 392px tall, inside a 1px border;
// the popover is exactly this size from the first frame, with the emoji loading inside it.
const PICKER_SIZE = { width: 334, height: 394 };

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
      style={{ left: position.left, top: position.top, width: PICKER_SIZE.width, height: PICKER_SIZE.height }}
      className="fixed z-[70] overflow-hidden rounded-2xl border border-border bg-surface-secondary shadow-modal"
      onContextMenu={(e) => e.preventDefault()}
    >
      <EmojiPicker onSelect={(emoji) => onSelect(emoji.native)} />
    </div>,
    document.body,
  );
}
