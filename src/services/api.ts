import { createLogger, redactText } from "../lib/logger";

const log = createLogger("net");

const DEFAULT_TIMEOUT = 15_000;
let nextRequestId = 1;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Query;
  /** JSON request body. */
  json?: unknown;
  /** Multipart request body (uploads, `send_message`). */
  form?: FormData;
  /** Extra request headers (e.g. `Authorization`). */
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  /**
   * Called as a multipart body goes up, with the bytes sent so far and the total. `fetch` cannot
   * report this, so a request that asks for it is made with `XMLHttpRequest` instead.
   */
  onUploadProgress?: (loaded: number, total: number) => void;
}

interface ErrorEnvelope {
  error_code?: string;
  user_message?: string;
  message?: string;
  detail?: unknown;
  details?: Record<string, unknown>;
  retry_after_seconds?: number | null;
}

function toApiError(status: number, payload: unknown): ApiError {
  const body = (payload && typeof payload === "object" ? payload : {}) as ErrorEnvelope;
  const detail = typeof body.detail === "string" ? body.detail : undefined;
  const message = body.user_message ?? body.message ?? detail ?? `Request failed with status ${status}`;
  return new ApiError(
    status,
    body.error_code ?? (status === 429 ? "rate_limit.exceeded" : "unknown"),
    message,
    body.details ?? {},
    body.retry_after_seconds ?? null,
  );
}

function buildUrl(url: string, query?: Query): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

interface Sent {
  status: number;
  ok: boolean;
  payload: unknown;
}

async function sendWithFetch(method: Method, url: string, headers: Record<string, string>, body: BodyInit | undefined, signal: AbortSignal): Promise<Sent> {
  const response = await fetch(url, { method, headers, body, signal });
  const payload: unknown = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, payload };
}

/** The same request through `XMLHttpRequest`, which is the only way a browser reports how much of an upload has gone. */
function sendWithProgress(
  method: Method,
  url: string,
  headers: Record<string, string>,
  form: FormData,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<Sent> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // not JSON: the error mapping falls back to the status
      }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, payload });
    };
    xhr.onerror = () => reject(new TypeError("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    xhr.send(form);
  });
}

/**
 * Success bodies are the backend's flat JSON; errors are a typed envelope (or legacy `{detail}`).
 * Resolves with the parsed body, throws `ApiError` otherwise.
 */
async function request<T>(method: Method, url: string, options: RequestOptions = {}): Promise<T> {
  const { query, json, form, headers: extraHeaders, timeout = DEFAULT_TIMEOUT, signal, onUploadProgress } = options;
  const id = nextRequestId++;
  const startedAt = performance.now();
  const target = redactText(buildUrl(url, query));
  const elapsed = () => `${Math.round(performance.now() - startedAt)}ms`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  let body: BodyInit | undefined;
  if (form) {
    body = form; // the browser sets the multipart boundary
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const bodyKind = form ? `multipart, ${[...form.keys()].filter((k) => k !== "auth_token").length} fields` : json !== undefined ? "json" : "no body";
  log.debug(`#${id} → ${method} ${target} (${bodyKind})`);

  try {
    const sent =
      form && onUploadProgress
        ? await sendWithProgress(method, buildUrl(url, query), headers, form, controller.signal, onUploadProgress)
        : await sendWithFetch(method, buildUrl(url, query), headers, body, controller.signal);
    const { status, ok, payload } = sent;

    if (!ok) throw toApiError(status, payload);
    log.debug(`#${id} ← ${status} ${method} ${target} in ${elapsed()}`);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      // A 4xx is the server answering "no" (often routine, e.g. a wrong password); a 5xx is its fault.
      const report = error.status >= 500 ? log.error : log.warn;
      report(`#${id} ← ${error.status} ${method} ${target} in ${elapsed()}: ${error.code}`, { message: error.message, details: error.details });
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      const cancelled = signal?.aborted === true;
      (cancelled ? log.debug : log.warn)(`#${id} ✕ ${method} ${target} ${cancelled ? "cancelled" : `timed out after ${timeout}ms`}`);
      throw new ApiError(0, cancelled ? "aborted" : "timeout", cancelled ? "Request cancelled" : "Request timed out");
    }
    log.error(`#${id} ✕ ${method} ${target} failed after ${elapsed()}: network error`, error);
    throw new ApiError(0, "network", error instanceof Error ? error.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  request,
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, options?: RequestOptions) => request<T>("POST", url, options),
  put: <T>(url: string, options?: RequestOptions) => request<T>("PUT", url, options),
  patch: <T>(url: string, options?: RequestOptions) => request<T>("PATCH", url, options),
  delete: <T>(url: string, options?: RequestOptions) => request<T>("DELETE", url, options),
};
