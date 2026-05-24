/**
 * Typed error decoder for the PufferBlow API error contract.
 *
 * The server emits one envelope shape for every error (see
 * `pufferblow/docs/ERROR_CODES.md`):
 *
 *     {
 *       "status_code": 409,
 *       "error_code": "stickers.alias_taken",
 *       "message": "...",
 *       "user_message": "...",
 *       "details": {...},
 *       "request_id": "...",
 *       "retry_after_seconds": null
 *     }
 *
 * The client decodes that into an `AppError` — a tagged value that
 * call sites can switch on by `code` to make UI decisions
 * (force-logout on auth.invalid_token, show a retry button on
 * rate_limit.exceeded, highlight the offending field on
 * validation.field_required, …).
 *
 * Backward compatibility: when the envelope is absent (older
 * server build, network error, browser-side JSON parse failure)
 * `decodeApiError` synthesises a sensible default — the user
 * still gets a meaningful `userMessage`, just from a smaller
 * pool. Call sites don't need to special-case "did we get the
 * envelope?" — they just consume the AppError.
 */

/** Stable error codes the server emits. Mirror of
 *  `pufferblow/api/errors/codes.py::ErrorCode`. Kept in sync by
 *  hand for now; a future codegen step could derive it from the
 *  docs page or the Python module. */
export const ErrorCode = {
  // Auth
  AUTH_TOKEN_REQUIRED: "auth.token_required",
  AUTH_INVALID_TOKEN: "auth.invalid_token",
  AUTH_USER_BANNED: "auth.user_banned",
  AUTH_PRIVILEGE_DENIED: "auth.privilege_denied",
  AUTH_INVALID_CREDENTIALS: "auth.invalid_credentials",
  AUTH_INSTANCE_MISMATCH: "auth.instance_mismatch",
  AUTH_ACCOUNT_LOCKED: "auth.account_locked",
  AUTH_USERNAME_TAKEN: "auth.username_taken",
  AUTH_USERNAME_INVALID: "auth.username_invalid",
  AUTH_PASSWORD_TOO_WEAK: "auth.password_too_weak",
  AUTH_SIGNUP_DISABLED: "auth.signup_disabled",
  AUTH_REFRESH_TOKEN_EXPIRED: "auth.refresh_token_expired",
  AUTH_REFRESH_TOKEN_INVALID: "auth.refresh_token_invalid",
  AUTH_RESET_COOLDOWN: "auth.reset_cooldown",
  AUTH_RESET_PASSWORD_WRONG: "auth.reset_password_wrong",
  // Validation
  VALIDATION_FIELD_REQUIRED: "validation.field_required",
  VALIDATION_FIELD_TYPE: "validation.field_type",
  VALIDATION_FIELD_RANGE: "validation.field_range",
  VALIDATION_PAYLOAD_MALFORMED: "validation.payload_malformed",
  VALIDATION_PAYLOAD_TOO_LARGE: "validation.payload_too_large",
  // Resource
  RESOURCE_NOT_FOUND: "resource.not_found",
  RESOURCE_CONFLICT: "resource.conflict",
  RESOURCE_ALREADY_EXISTS: "resource.already_exists",
  // Rate limit
  RATE_LIMIT_EXCEEDED: "rate_limit.exceeded",
  RATE_LIMIT_IP_BLOCKED: "rate_limit.ip_blocked",
  // Channels
  CHANNELS_NOT_FOUND: "channels.not_found",
  CHANNELS_ACCESS_DENIED: "channels.access_denied",
  CHANNELS_VOICE_ONLY_NO_TEXT: "channels.voice_only_no_text",
  // Messages
  MESSAGES_NOT_FOUND: "messages.not_found",
  MESSAGES_TOO_LONG: "messages.too_long",
  MESSAGES_EMPTY: "messages.empty",
  MESSAGES_ATTACHMENT_TOO_LARGE: "messages.attachment_too_large",
  MESSAGES_TIMED_OUT: "messages.timed_out",
  // Stickers
  STICKERS_NOT_FOUND: "stickers.not_found",
  STICKERS_NOT_AVAILABLE: "stickers.not_available",
  STICKERS_ALIAS_TAKEN: "stickers.alias_taken",
  STICKERS_INVALID_ALIAS: "stickers.invalid_alias",
  STICKERS_INVALID_DISPLAY_NAME: "stickers.invalid_display_name",
  STICKERS_UNSUPPORTED_TYPE: "stickers.unsupported_type",
  STICKERS_TOO_LARGE: "stickers.too_large",
  // Friends
  FRIENDS_SELF_RELATION: "friends.self_relation",
  FRIENDS_DUPLICATE_REQUEST: "friends.duplicate_request",
  FRIENDS_NOT_FOUND: "friends.not_found",
  FRIENDS_NOT_RECIPIENT: "friends.not_recipient",
  FRIENDS_BLOCKED: "friends.blocked",
  // Storage
  STORAGE_QUOTA_EXCEEDED: "storage.quota_exceeded",
  STORAGE_UNSUPPORTED_TYPE: "storage.unsupported_type",
  STORAGE_UPLOAD_FAILED: "storage.upload_failed",
  // Federation
  FEDERATION_WEBFINGER_FAILED: "federation.webfinger_failed",
  FEDERATION_REMOTE_UNREACHABLE: "federation.remote_unreachable",
  FEDERATION_INVALID_HANDLE: "federation.invalid_handle",
  // Server
  SERVER_INTERNAL_ERROR: "server.internal_error",
  SERVER_UNAVAILABLE: "server.unavailable",
  SERVER_FEATURE_DISABLED: "server.feature_disabled",
  // Client-only fallbacks (not emitted by the server). Used when
  // we couldn't reach the server, or when the response didn't
  // carry the envelope.
  CLIENT_NETWORK_OFFLINE: "client.network_offline",
  CLIENT_NETWORK_TIMEOUT: "client.network_timeout",
  CLIENT_CORS_BLOCKED: "client.cors_blocked",
  CLIENT_UNKNOWN: "client.unknown",
  // Instance reachability — these are emitted by the client, but
  // they live under the ``instance.*`` namespace because they're
  // about a specific instance rather than the device's network as
  // a whole. ``instance.unreachable`` is a remote instance the
  // user has joined that isn't responding; ``instance.home_unreachable``
  // is the user's HOME instance. The two get different UX
  // treatment (per-instance badge vs. top-of-app banner) so they
  // need to be distinguishable codes.
  INSTANCE_UNREACHABLE: "instance.unreachable",
  INSTANCE_HOME_UNREACHABLE: "instance.home_unreachable",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Wire shape of the server's error envelope. Mirrors the contract
 * in `docs/ERROR_CODES.md`. Optional fields are typed as nullable
 * because the server emits them as `null` (not omitted) for
 * consistency.
 */
export interface ApiErrorEnvelope {
  status_code: number;
  error_code: string;
  message: string;
  user_message: string;
  details: Record<string, unknown>;
  request_id: string | null;
  retry_after_seconds: number | null;
}

/**
 * Decoded error shape consumed by client UI. Call sites typically
 * read `code`, `userMessage`, and occasionally `details`; the
 * other fields are there for advanced use (logging, support
 * correlation, custom retry logic).
 */
export interface AppError {
  /** Stable machine identifier. Compare against `ErrorCode.*`. */
  code: ErrorCodeValue | string;
  /** Pre-formatted, safe-to-display message for end users. */
  userMessage: string;
  /** Developer / log-oriented message. May contain technical context. */
  message: string;
  /** Optional structured context (field names, alias, limits, …). */
  details: Record<string, unknown>;
  /** HTTP status. 0 when no response (network error / offline). */
  httpStatus: number;
  /** Correlation id (matches `X-Request-ID` header). Null on
   *  client-only errors (offline, parse failures). */
  requestId: string | null;
  /** Backoff hint for retryable errors. Null when not applicable. */
  retryAfterSeconds: number | null;
  /** Was this synthesised because the envelope was missing /
   *  malformed? Useful for logging "we hit a non-conforming
   *  server / proxy" without surfacing it to the user. */
  isFallback: boolean;
}

const FALLBACK_USER_MESSAGES: Record<string, string> = {
  [ErrorCode.CLIENT_NETWORK_OFFLINE]:
    "You're offline. Reconnect to keep chatting.",
  [ErrorCode.CLIENT_NETWORK_TIMEOUT]:
    "The server took too long to respond. Try again in a moment.",
  [ErrorCode.CLIENT_CORS_BLOCKED]:
    "Your browser blocked this request. The server may be misconfigured.",
  [ErrorCode.CLIENT_UNKNOWN]:
    "Something went wrong. If this keeps happening, try refreshing.",
  [ErrorCode.INSTANCE_UNREACHABLE]:
    "Couldn't reach that instance. It may be offline.",
  [ErrorCode.INSTANCE_HOME_UNREACHABLE]:
    "Your home instance is offline. Some features won't work until it's back.",
};

/**
 * Build an AppError from the raw payload of an error response.
 *
 * Three input shapes are handled:
 *
 *   1. The canonical envelope (`error_code`, `user_message`, …) —
 *      passed through with minimal massaging.
 *   2. Legacy FastAPI `{ detail: "..." }` — the long-tail of routes
 *      that haven't migrated to `ApiError` yet. We synthesise the
 *      envelope fields from the status + detail string.
 *   3. Anything else (HTML page, plain text, parse failure) —
 *      collapsed into a `CLIENT_UNKNOWN` AppError.
 *
 * The `httpStatus` arg is required because some shapes don't
 * include it in the body and the apiClient has it from the
 * response object.
 */
export function fromEnvelope(
  payload: unknown,
  httpStatus: number,
  requestIdHeader?: string | null,
): AppError {
  // Shape 1: full envelope.
  if (
    payload &&
    typeof payload === "object" &&
    "error_code" in payload &&
    "user_message" in payload
  ) {
    const env = payload as ApiErrorEnvelope;
    return {
      code: env.error_code,
      userMessage: env.user_message || env.message,
      message: env.message || env.user_message,
      details: env.details || {},
      httpStatus: env.status_code || httpStatus,
      requestId: env.request_id || requestIdHeader || null,
      retryAfterSeconds: env.retry_after_seconds ?? null,
      isFallback: false,
    };
  }

  // Shape 2: legacy { detail: "..." } from un-migrated routes.
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    const userMessage =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? flattenPydanticErrors(detail)
          : typeof detail === "object" && detail !== null && "message" in detail
            ? String((detail as { message: unknown }).message)
            : "The server returned an error.";
    return {
      code: codeFromStatus(httpStatus),
      userMessage,
      message: userMessage,
      details: {},
      httpStatus,
      requestId: requestIdHeader || null,
      retryAfterSeconds: null,
      isFallback: true,
    };
  }

  // Shape 3: completely unknown body. Use the status as the
  // best-available signal.
  return {
    code: codeFromStatus(httpStatus),
    userMessage:
      typeof payload === "string"
        ? payload
        : FALLBACK_USER_MESSAGES[ErrorCode.CLIENT_UNKNOWN]!,
    message: typeof payload === "string" ? payload : "Unknown error",
    details: {},
    httpStatus,
    requestId: requestIdHeader || null,
    retryAfterSeconds: null,
    isFallback: true,
  };
}

/**
 * Build an AppError for a network-level failure (fetch rejected
 * before getting a response).
 *
 * Distinguishes four cases the apiClient can produce by raw fetch
 * failures. Federation makes this matter — "I can't reach this
 * specific instance" is normal and should NOT be presented as
 * "you're offline."
 *
 *   * Device offline (`navigator.onLine === false`) →
 *     ``client.network_offline``. ALL instances will fail until
 *     the device reconnects; UIs should react globally.
 *   * Device online, request hit a timeout →
 *     ``client.network_timeout``. Specific to the call site.
 *   * Device online, CORS rejected → ``client.cors_blocked``.
 *     Operator-side misconfig; nothing the user can do.
 *   * Device online, fetch otherwise failed → the instance is
 *     down. When the failed host is the viewer's HOME instance
 *     we emit ``instance.home_unreachable`` (banner-worthy);
 *     otherwise ``instance.unreachable`` (per-instance badge).
 *
 * The ``hostPort`` arg lets the function pick between home- and
 * remote-instance codes. When omitted (e.g. errors generated
 * before the client has a configured home), we fall back to the
 * generic ``instance.unreachable``.
 */
export function fromNetworkError(error: unknown, hostPort?: string): AppError {
  const message = error instanceof Error ? error.message : String(error);

  // Order matters: explicit timeout / CORS signals come from the
  // thrown error itself and should be checked before we look at
  // `navigator.onLine` — a CORS failure on an online device is
  // still a CORS failure, not "offline."
  let code: ErrorCodeValue = ErrorCode.INSTANCE_UNREACHABLE;
  if (/timeout/i.test(message)) {
    code = ErrorCode.CLIENT_NETWORK_TIMEOUT;
  } else if (/cors/i.test(message)) {
    code = ErrorCode.CLIENT_CORS_BLOCKED;
  } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Device offline trumps everything else: every instance is
    // unreachable, the right copy is "you're offline."
    code = ErrorCode.CLIENT_NETWORK_OFFLINE;
  } else {
    // Device is online (or we can't tell), but the request failed.
    // The instance itself is the most likely culprit. Promote to
    // ``home_unreachable`` when the affected host is the home
    // instance — clients then surface the banner instead of a
    // per-instance badge.
    if (hostPort && isHomeHostPort(hostPort)) {
      code = ErrorCode.INSTANCE_HOME_UNREACHABLE;
    } else {
      code = ErrorCode.INSTANCE_UNREACHABLE;
    }
  }

  return {
    code,
    userMessage: FALLBACK_USER_MESSAGES[code]!,
    message,
    details: hostPort ? { host_port: hostPort } : {},
    httpStatus: 0,
    requestId: null,
    retryAfterSeconds: null,
    isFallback: true,
  };
}

/**
 * Compare a host against the viewer's home instance — used by
 * `fromNetworkError` to pick between `instance.home_unreachable`
 * and the generic `instance.unreachable`. Lives in a separate
 * helper so we can mock it in tests, and so it stays a one-line
 * change if the home-host source ever moves.
 *
 * Lazy import via dynamic require keeps `instanceHealth` outside
 * the apiError module graph at load time — the two depend on
 * each other indirectly and we'd otherwise risk a cycle.
 */
function isHomeHostPort(hostPort: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./instanceHealth") as {
      instanceHealth?: { getHomeHostPort(): string | null };
    };
    const home = mod.instanceHealth?.getHomeHostPort();
    if (!home) return false;
    return normaliseHostPortForCompare(home) === normaliseHostPortForCompare(hostPort);
  } catch {
    return false;
  }
}

function normaliseHostPortForCompare(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * Build an AppError from any unknown thrown / rejected value.
 * Used as the universal "I got something and want an AppError"
 * helper at call sites — pass a raw `error.message` string, a
 * plain Error, an ApiResponse `.error`, anything; you get back
 * a normalized AppError.
 */
export function decodeApiError(input: unknown): AppError {
  if (input && typeof input === "object" && "code" in input && "userMessage" in input) {
    return input as AppError; // already-decoded; pass through
  }
  if (input instanceof Error) {
    return {
      code: ErrorCode.CLIENT_UNKNOWN,
      userMessage: input.message || FALLBACK_USER_MESSAGES[ErrorCode.CLIENT_UNKNOWN]!,
      message: input.message,
      details: {},
      httpStatus: 0,
      requestId: null,
      retryAfterSeconds: null,
      isFallback: true,
    };
  }
  if (typeof input === "string") {
    return {
      code: ErrorCode.CLIENT_UNKNOWN,
      userMessage: input,
      message: input,
      details: {},
      httpStatus: 0,
      requestId: null,
      retryAfterSeconds: null,
      isFallback: true,
    };
  }
  return {
    code: ErrorCode.CLIENT_UNKNOWN,
    userMessage: FALLBACK_USER_MESSAGES[ErrorCode.CLIENT_UNKNOWN]!,
    message: "Unknown error",
    details: {},
    httpStatus: 0,
    requestId: null,
    retryAfterSeconds: null,
    isFallback: true,
  };
}

/**
 * Predicate: does this error mean the user needs to re-authenticate?
 * Call sites use this to bounce to the login screen and clear tokens
 * instead of showing a toast that the user can't act on.
 */
export function isAuthError(error: AppError): boolean {
  return (
    error.code === ErrorCode.AUTH_TOKEN_REQUIRED ||
    error.code === ErrorCode.AUTH_INVALID_TOKEN ||
    (error.httpStatus === 401 && error.isFallback)
  );
}

/**
 * Predicate: is this error worth a retry? Used by background-fetch
 * loops to back off intelligently — they retry rate limits and
 * server errors, NOT validation / permission errors (those would
 * just bounce again).
 */
export function isRetryableError(error: AppError): boolean {
  const explicitlyRetryable = new Set<string>([
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCode.STORAGE_UPLOAD_FAILED,
    ErrorCode.FEDERATION_REMOTE_UNREACHABLE,
    ErrorCode.SERVER_INTERNAL_ERROR,
    ErrorCode.SERVER_UNAVAILABLE,
    ErrorCode.CLIENT_NETWORK_OFFLINE,
    ErrorCode.CLIENT_NETWORK_TIMEOUT,
  ]);
  return (
    explicitlyRetryable.has(error.code) ||
    (error.httpStatus >= 500 && error.httpStatus < 600)
  );
}

/**
 * Predicate: is this a validation error the UI should attribute to
 * a specific input? Call sites pair this with `getFieldErrors` to
 * show inline field-level feedback instead of a toast.
 */
export function isValidationError(error: AppError): boolean {
  return (
    error.code === ErrorCode.VALIDATION_FIELD_REQUIRED ||
    error.code === ErrorCode.VALIDATION_FIELD_TYPE ||
    error.code === ErrorCode.VALIDATION_FIELD_RANGE ||
    error.code === ErrorCode.VALIDATION_PAYLOAD_MALFORMED ||
    (error.httpStatus === 400 || error.httpStatus === 422)
  );
}

/**
 * Extract field-level validation entries when present, for UIs that
 * want to highlight specific inputs. Returns an empty array when
 * the error didn't carry field details.
 */
export function getFieldErrors(error: AppError): Array<{ field: string; message: string }> {
  const fields = error.details?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f): f is { field: string; message: string } =>
      typeof f === "object" && f !== null && "field" in f && "message" in f,
    )
    .map((f) => ({ field: String(f.field), message: String(f.message) }));
}

// ── Internal helpers ────────────────────────────────────────────

function codeFromStatus(status: number): ErrorCodeValue {
  switch (status) {
    case 0:
      return ErrorCode.CLIENT_NETWORK_OFFLINE;
    case 400:
      return ErrorCode.VALIDATION_PAYLOAD_MALFORMED;
    case 401:
      return ErrorCode.AUTH_INVALID_TOKEN;
    case 403:
      return ErrorCode.AUTH_PRIVILEGE_DENIED;
    case 404:
      return ErrorCode.RESOURCE_NOT_FOUND;
    case 409:
      return ErrorCode.RESOURCE_CONFLICT;
    case 413:
      return ErrorCode.VALIDATION_PAYLOAD_TOO_LARGE;
    case 422:
      return ErrorCode.VALIDATION_FIELD_TYPE;
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 503:
      return ErrorCode.SERVER_UNAVAILABLE;
    default:
      return status >= 500
        ? ErrorCode.SERVER_INTERNAL_ERROR
        : ErrorCode.CLIENT_UNKNOWN;
  }
}

/**
 * Flatten Pydantic's validation array (legacy non-envelope path)
 * into a single readable sentence. The envelope handler does this
 * properly server-side; this helper covers older server builds.
 */
function flattenPydanticErrors(arr: unknown[]): string {
  const parts = arr
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const e = entry as { loc?: unknown; msg?: unknown };
      const field =
        Array.isArray(e.loc) && e.loc.length > 1
          ? String(e.loc.slice(1).join("."))
          : Array.isArray(e.loc) && e.loc.length === 1
            ? String(e.loc[0])
            : null;
      const msg = typeof e.msg === "string" ? e.msg : "invalid";
      return field ? `${field}: ${msg}` : msg;
    })
    .filter((s): s is string => !!s);
  return parts.length === 0
    ? "Validation failed."
    : parts.length === 1
      ? `Validation failed — ${parts[0]}`
      : `Validation failed:\n - ${parts.join("\n - ")}`;
}
