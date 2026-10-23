import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 450;
const GAP = 8;
const EDGE = 8;

interface Shown {
  text: string;
  rect: DOMRect;
}

/**
 * Draws every `title` hint in the app's own tooltip (the inverted white label) instead of the
 * browser's grey native one, so no component has to change. On first hover or focus an element's
 * `title` moves to `data-tip` (the native hint would otherwise show too), and the name it gave a
 * control with no label of its own becomes its `aria-label`. Mount once, near the root.
 */
export function TitleTooltips() {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      current.current = null;
      setShown(null);
    };

    const adopt = (target: EventTarget | null): Element | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest("[title], [data-tip]");
      if (!el || el instanceof SVGElement) return null;
      const title = el.getAttribute("title");
      if (title !== null) {
        el.removeAttribute("title");
        if (title.trim()) {
          el.setAttribute("data-tip", title);
          if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby") && !el.textContent?.trim()) el.setAttribute("aria-label", title);
        }
      }
      return el.getAttribute("data-tip") ? el : null;
    };

    const show = (el: Element, delay: number) => {
      if (current.current === el) return;
      clear();
      current.current = el;
      const open = () => setShown({ text: el.getAttribute("data-tip") ?? "", rect: el.getBoundingClientRect() });
      if (delay) timer.current = setTimeout(open, delay);
      else open();
    };

    const onOver = (e: PointerEvent) => {
      const el = adopt(e.target);
      if (!el) return clear();
      if (e.pointerType === "touch") return;
      show(el, SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (current.current && !(e.relatedTarget instanceof Node && current.current.contains(e.relatedTarget))) clear();
    };
    const onFocus = (e: FocusEvent) => {
      const el = adopt(e.target);
      // Only a keyboard user needs the hint on focus; a click already shows it on hover.
      if (el && (e.target as Element).matches(":focus-visible")) show(el, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", clear, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", clear);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", clear, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", clear);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return shown ? <Tip {...shown} /> : null;
}

function Tip({ text, rect }: Shown) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Above the element, or below when there is no room; kept inside the window sideways.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const above = rect.top - height - GAP >= EDGE;
    const top = above ? rect.top - height - GAP : rect.bottom + GAP;
    const left = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - EDGE));
    setPlace({ left, top });
  }, [rect, text]);

  return createPortal(
    <div
      ref={box}
      role="tooltip"
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? "visible" : "hidden" }}
      className="pointer-events-none fixed z-[80] max-w-[280px] rounded-sm bg-primary px-2.5 py-[7px] text-[12.5px] font-semibold leading-snug text-on-primary"
    >
      {text}
    </div>,
    document.body,
  );
}
