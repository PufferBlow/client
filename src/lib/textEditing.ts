import type { KeyboardEvent } from "react";

/** A replacement of `value[from..to)` with `insert`, and where the selection lands afterwards. */
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Ctrl/Cmd + key → the Markdown marker it toggles around the selection. */
export const FORMAT_SHORTCUTS: Record<string, string> = { b: "**", i: "*", u: "__" };

/**
 * Wraps the selection in `marker`, or unwraps it when it is already wrapped (markers just outside
 * the selection, or selected along with it). With nothing selected the caret ends up between the
 * two markers, ready to type.
 */
export function toggleWrap(value: string, start: number, end: number, marker: string): TextEdit {
  const m = marker.length;
  const selected = value.slice(start, end);
  if (start >= m && value.slice(start - m, start) === marker && value.slice(end, end + m) === marker) {
    return { from: start - m, to: end + m, insert: selected, selectionStart: start - m, selectionEnd: end - m };
  }
  if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return { from: start, to: end, insert: inner, selectionStart: start, selectionEnd: start + inner.length };
  }
  return { from: start, to: end, insert: marker + selected + marker, selectionStart: start + m, selectionEnd: end + m };
}

/** True when applying the edit keeps the text within `maxLength`. */
export function fits(value: string, edit: TextEdit, maxLength?: number): boolean {
  return maxLength === undefined || value.length - (edit.to - edit.from) + edit.insert.length <= maxLength;
}

/**
 * Applies an edit to a field. It goes through `insertText` where the browser has it, so Ctrl+Z
 * undoes it like typing; otherwise (jsdom, old engines) it falls back to setting the value.
 */
export function applyEdit(field: HTMLTextAreaElement | HTMLInputElement, edit: TextEdit, setValue: (next: string) => void) {
  field.focus();
  field.setSelectionRange(edit.from, edit.to);
  let native = false;
  try {
    native = typeof document.execCommand === "function" && document.execCommand("insertText", false, edit.insert);
  } catch {
    native = false;
  }
  if (!native || field.value.slice(edit.from, edit.from + edit.insert.length) !== edit.insert) {
    setValue(field.value.slice(0, edit.from) + edit.insert + field.value.slice(edit.to));
  }
  // After React has written the new value, which would otherwise leave the caret at the end.
  requestAnimationFrame(() => field.setSelectionRange(edit.selectionStart, edit.selectionEnd));
}

/**
 * Formatting shortcuts for a Markdown text field: Ctrl/Cmd+B, I and U. Returns true when it
 * handled the key.
 */
export function handleFormatShortcut(
  e: KeyboardEvent<HTMLTextAreaElement>,
  setValue: (next: string) => void,
  maxLength?: number,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return false;
  const marker = FORMAT_SHORTCUTS[e.key.toLowerCase()];
  if (!marker) return false;
  e.preventDefault();
  const field = e.currentTarget;
  const edit = toggleWrap(field.value, field.selectionStart, field.selectionEnd, marker);
  if (fits(field.value, edit, maxLength)) applyEdit(field, edit, setValue);
  return true;
}
