import { api, ApiError, type RequestOptions } from "./api";
import { getAuthToken } from "./auth";
import { createLogger } from "../lib/logger";
import { getApiUrl, getStoredInstance } from "./instance";

const log = createLogger("session");

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type QueryOptions = Omit<RequestOptions, "json"> & { json?: unknown };

export interface Session {
  origin: string;
  token: string;
}

/** The signed-in instance and token, or an `auth.token_required` error. */
export function requireSession(): Session {
  const instance = getStoredInstance();
  const token = getAuthToken();
  if (!instance || !token) {
    log.warn("authenticated call without a session", { instance: instance?.origin ?? null, hasToken: token !== null });
  }
  if (!instance || !token) throw new ApiError(401, "auth.token_required", "You are signed out.");
  return { origin: getApiUrl(instance), token };
}

/** Instances that predate header auth, found by a route refusing a request with no `auth_token` parameter. */
const queryTokenOrigins = new Set<string>();

/** The server's answer to a request that carried the token only in a header it does not read. */
function isMissingTokenParameter(error: unknown): boolean {
  if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 422)) return false;
  const fields = error.details.fields;
  return Array.isArray(fields) && fields.some((f) => (f as { field?: string } | null)?.field === "auth_token");
}

/**
 * Credentials go where they stay out of access logs: routes that read the token from the query
 * string get it in an `Authorization: Bearer` header, and the server turns it back into the
 * parameter. Routes that read it from a JSON body or form field (`authed.body`) keep it there; a
 * body is not logged. An older instance that ignores the header answers that the parameter is
 * missing; the call is then repeated with the token in the URL and that instance is remembered.
 */
export const authed = {
  /** Routes that read `auth_token` from the query string (most GET/DELETE routes and many POSTs). */
  async query<T>(method: Method, path: string, options: QueryOptions = {}): Promise<T> {
    const { origin, token } = requireSession();
    const withQueryToken = () => api.request<T>(method, `${origin}${path}`, { ...options, query: { ...options.query, auth_token: token } });
    if (queryTokenOrigins.has(origin)) return withQueryToken();
    try {
      return await api.request<T>(method, `${origin}${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (!isMissingTokenParameter(error)) throw error;
      log.warn("this instance does not read the Authorization header; update it to keep tokens out of its logs");
      queryTokenOrigins.add(origin);
      return withQueryToken();
    }
  },

  /** Routes that read `auth_token` from the JSON body. */
  body<T>(method: Method, path: string, json: Record<string, unknown> = {}): Promise<T> {
    const { origin, token } = requireSession();
    return api.request<T>(method, `${origin}${path}`, { json: { ...json, auth_token: token } });
  },
};

/** Absolute URL for a backend asset (`/storage/<hash>`); passes absolute URLs through. */
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  // Absolute, or on this device (a file still being sent): use as is.
  if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
  const instance = getStoredInstance();
  return instance ? `${getApiUrl(instance)}${path.startsWith("/") ? "" : "/"}${path}` : undefined;
}
