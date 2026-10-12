const DEFAULT_POST_AUTH_REDIRECT = "/dashboard";
const AUTH_ROUTES = new Set(["/login", "/signup"]);
const BASE = "https://pufferblow.local";

/** Only same-origin absolute paths are allowed; anything else is rejected. */
function normalizeRedirectPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const parsed = new URL(trimmed, BASE);
    if (parsed.origin !== BASE) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostAuthRedirect(
  target: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_REDIRECT,
): string {
  const normalized = normalizeRedirectPath(target);
  if (!normalized || AUTH_ROUTES.has(new URL(normalized, BASE).pathname)) return fallback;
  return normalized;
}

/** `/login?redirect=<current location>` — used by route guards. */
export function buildAuthRedirectPath(pathname: string, search = "", hash = ""): string {
  const target = resolvePostAuthRedirect(`${pathname}${search}${hash}`, DEFAULT_POST_AUTH_REDIRECT);
  return `/login?${new URLSearchParams({ redirect: target })}`;
}

/** Link between /login and /signup that keeps the pending redirect. */
export function buildSiblingAuthLink(authPath: "/login" | "/signup", target: string | null | undefined): string {
  const normalized = normalizeRedirectPath(target);
  return normalized ? `${authPath}?${new URLSearchParams({ redirect: normalized })}` : authPath;
}
