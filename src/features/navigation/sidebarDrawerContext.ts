import { createContext, useContext } from "react";

export interface Drawer {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

export const DrawerContext = createContext<Drawer>({ open: false, toggle: () => undefined, close: () => undefined });

export const useSidebarDrawer = () => useContext(DrawerContext);

/** What a sidebar's `<aside>` adds so that it is a normal column from 768px up and an overlay on top of the page below. */
export function drawerClasses(open: boolean): string {
  return open
    ? "max-md:fixed max-md:bottom-[calc(var(--dock-h,56px)+16px)] max-md:left-[80px] max-md:top-2 max-md:z-30 max-md:!mb-0 max-md:shadow-modal"
    : "max-md:hidden";
}
