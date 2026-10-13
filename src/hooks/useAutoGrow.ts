import { useLayoutEffect, type RefObject } from "react";

/** Sizes a textarea to its content as `value` changes; cap it with a CSS max-height. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [ref, value]);
}
