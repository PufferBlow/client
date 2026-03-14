const DEFAULT_POST_AUTH_REDIRECT = "/dashboard";
const AUTH_ROUTE_SET = new Set(["/login", "/signup"]);

const normalizeRedirectPath = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://pufferblow.local");
    if (parsed.origin !== "https://pufferblow.local") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const resolvePostAuthRedirect = (
  redirectTarget: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_REDIRECT,
): string => {
  const normalized = normalizeRedirectPath(redirectTarget);
  if (!normalized) {
    return fallback;
  }

  if (AUTH_ROUTE_SET.has(normalized)) {
    return fallback;
  }

  return normalized;
};

export const buildAuthRedirectPath = (
  pathname: string,
  search: string = "",
  hash: string = "",
): string => {
  const target = resolvePostAuthRedirect(`${pathname}${search}${hash}`, pathname || DEFAULT_POST_AUTH_REDIRECT);
  const params = new URLSearchParams({ redirect: target });
  return `/login?${params.toString()}`;
};

export const buildSiblingAuthLink = (
  authPath: "/login" | "/signup",
  redirectTarget: string | null | undefined,
): string => {
  const normalized = normalizeRedirectPath(redirectTarget);
  if (!normalized) {
    return authPath;
  }

  const params = new URLSearchParams({ redirect: normalized });
  return `${authPath}?${params.toString()}`;
};
