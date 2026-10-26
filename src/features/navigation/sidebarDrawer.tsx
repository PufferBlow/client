import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Menu } from "lucide-react";
import { DrawerContext, useSidebarDrawer } from "./sidebarDrawerContext";

/**
 * Below 768px the channel and home sidebars have no room beside the page, so they open over it instead. One toggle in
 * each page's header opens the sidebar; choosing something, or pressing outside, closes it. Wider than that this does
 * nothing: the sidebars are simply there.
 */
export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Going somewhere closes it, and so does Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

/** Tapping outside the open sidebar closes it. Narrow windows only. */
export function SidebarBackdrop() {
  const { open, close } = useSidebarDrawer();
  if (!open) return null;
  return <div aria-hidden="true" onClick={close} className="fixed inset-0 z-20 bg-background/60 md:hidden" />;
}

/** The header button that opens the sidebar. Only narrow windows show it. */
export function SidebarToggle({ label = "Channels" }: { label?: string }) {
  const { open, toggle } = useSidebarDrawer();
  return (
    <button
      type="button"
      aria-label={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      aria-expanded={open}
      onClick={toggle}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors duration-(--motion-fast) hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-focus md:hidden"
    >
      <Menu size={18} aria-hidden="true" />
    </button>
  );
}
