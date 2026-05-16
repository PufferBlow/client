/**
 * Parse a `pufferblow://` deep-link URL into an in-app route path.
 *
 * The OS hands us the raw URL string via the Electron main process; we map
 * it to one of the existing React Router routes. Unknown / malformed URLs
 * return `null` so the caller can no-op or fall back to a safe default.
 *
 * Supported shapes (host = first segment after the `://`):
 *
 *   pufferblow://m/<message_id>         → /m/<message_id>
 *   pufferblow://dashboard              → /dashboard
 *   pufferblow://dashboard/<rest>       → /dashboard/<rest>
 *   pufferblow://settings               → /settings
 *   pufferblow://control-panel          → /control-panel
 *   pufferblow://login                  → /login
 *
 * We deliberately avoid `new URL()` here because non-special schemes have
 * inconsistent parser behavior across Node, browsers, and Electron's main
 * process (some treat the host as opaque, others normalize differently).
 * A regex keeps the contract explicit.
 */

const DEEP_LINK_PATTERN = /^pufferblow:\/\/([^/?#]+)(?:\/([^?#]*))?(\?[^#]*)?(?:#.*)?$/i;

const ALLOWED_HOSTS = new Set([
  'm',
  'dashboard',
  'settings',
  'control-panel',
  'login',
]);

export function parseDeepLink(url: string): string | null {
  if (typeof url !== 'string') return null;
  const match = DEEP_LINK_PATTERN.exec(url.trim());
  if (!match) return null;

  const host = match[1].toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  const rawPath = match[2] ?? '';
  const search = match[3] ?? '';

  // Split + filter empties so trailing slashes don't produce blank segments.
  // Encode each piece individually so a `..` or `?` smuggled by an attacker
  // can't escape the route — we'd rather 404 than navigate somewhere wrong.
  const segments = rawPath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)));

  switch (host) {
    case 'm': {
      // /m/:messageId — exactly one segment, ignore extras.
      if (segments.length === 0) return null;
      return `/m/${segments[0]}${search}`;
    }
    case 'dashboard':
      return segments.length > 0
        ? `/dashboard/${segments.join('/')}${search}`
        : `/dashboard${search}`;
    case 'settings':
      return `/settings${search}`;
    case 'control-panel':
      return `/control-panel${search}`;
    case 'login':
      return `/login${search}`;
    default:
      return null;
  }
}
