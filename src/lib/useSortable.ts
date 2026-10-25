import { useCallback, useState, type DragEvent, type KeyboardEvent } from "react";

function read(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Moves `id` to where `target` is, shifting the ones between. */
export function moved(order: string[], id: string, target: string): string[] {
  const from = order.indexOf(id);
  const to = order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return order;
  const next = order.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * A list the person can put in their own order, by dragging or from the keyboard (Alt with the arrow keys),
 * remembered on this device under `storageKey`. Ids that appear later join at the end; ids that went away
 * are forgotten. Spread `itemProps(id)` on each item.
 */
export function useSortable(ids: string[], storageKey: string) {
  const [saved, setSaved] = useState(() => read(storageKey));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const ordered = [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))];

  const commit = useCallback(
    (next: string[]) => {
      setSaved(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // No room to remember it: it holds for this visit.
      }
    },
    [storageKey],
  );

  const itemProps = (id: string) => ({
    draggable: ordered.length > 1,
    "data-dragging": dragging === id ? "true" : undefined,
    "data-drop-target": over === id && dragging !== id ? "true" : undefined,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDragging(id);
    },
    onDragOver: (e: DragEvent) => {
      if (!dragging || dragging === id) return;
      e.preventDefault();
      setOver(id);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragging && dragging !== id) commit(moved(ordered, dragging, id));
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const at = ordered.indexOf(id);
      const target = ordered[at + (e.key === "ArrowUp" ? -1 : 1)];
      if (target === undefined) return;
      e.preventDefault();
      commit(moved(ordered, id, target));
    },
  });

  return { ordered, itemProps };
}
