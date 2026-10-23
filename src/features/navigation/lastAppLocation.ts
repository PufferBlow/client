import { useEffect } from "react";
import { useLocation } from "react-router";

const KEY = "pb_last_app_location";
const HOME = "/dashboard";

const isApp = (pathname: string) => pathname === HOME || pathname.startsWith(`${HOME}/`);

/** Where in the app (a channel, a DM, the friends list) the person was before a full-page screen. */
export function lastAppLocation(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved && isApp(saved.split(/[?#]/)[0] ?? "") ? saved : HOME;
  } catch {
    return HOME;
  }
}

/** Remembers each app screen as it is visited, so "Back to app" returns to it. */
export function useRememberAppLocation(): void {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (!isApp(pathname)) return;
    try {
      sessionStorage.setItem(KEY, `${pathname}${search}${hash}`);
    } catch {
      // Private mode: back to app falls back to the hub.
    }
  }, [pathname, search, hash]);
}
