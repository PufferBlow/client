import { useCallback, useEffect, useRef, useState } from "react";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

const VISIBLE_MS = 5000;

/** One transient notice at a time; a new one replaces the old. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((text: string, tone: Toast["tone"] = "info") => {
    clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, text, tone });
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show, dismiss };
}
