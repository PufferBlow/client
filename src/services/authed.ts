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

/**
 * The backend never reads an `Authorization` header: each route takes `auth_token`
 * either in the query string or inside the JSON body. `authed.query` and `authed.body`
 * cover the two cases so feature code only states which one a route uses.
 */
export const authed = {
  /** Routes that read `auth_token` from the query string (most GET/DELETE routes and many POSTs). */
  query<T>(method: Method, path: string, options: QueryOptions = {}): Promise<T> {
    const { origin, token } = requireSession();
    return api.request<T>(method, `${origin}${path}`, {
      ...options,
      query: { ...options.query, auth_token: token },
    });
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
