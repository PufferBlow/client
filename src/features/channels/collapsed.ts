import { useCallback, useState } from "react";

const KEY = "pb_collapsed_categories";

function read(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Which channel groups are folded up in the sidebar, kept on this device. A folded group still shows the
 * channel you are in and any with something unread, so folding never hides what needs you.
 */
export function useCollapsedCategories() {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        // Private mode or no room: it stays folded for this visit.
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}
