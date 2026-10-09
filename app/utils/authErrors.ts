/**
 * Auth error classifier.
 *
 * Two functions:
 *
 *   1. ``classifyAuthError`` — the new path. Reads the typed
 *      ``AppError`` from an ``ApiResponse.errorDetails`` (or accepts
 *      a bare AppError) and returns a structured classification:
 *      banner-safe message, the field to highlight (for inline
 *      error UI), and the failure ``kind`` (so the form can pick
 *      tone / send the user to a recovery flow).
 *
 *   2. ``sanitizeAuthError`` — the legacy path. Substring-matches
 *      raw error strings. Kept for backward compatibility with
 *      call sites that haven't been migrated to the envelope yet.
 *
 * Both functions preserve username-enumeration resistance: a
 * "user not found" raw string and a "wrong password" raw string
 * collapse to the same `Invalid username or password.` regardless
 * of which path produced them.
 */

import type { ApiResponse } from "../services/apiClient";
import { ErrorCode, type AppError } from "../services/apiError";

const GENERIC_INVALID = "Invalid username or password.";
const GENERIC_RATE_LIMITED = "Too many attempts. Try again in a moment.";
const GENERIC_UNREACHABLE =
  "Couldn't reach that instance. Check the address and try again.";
const GENERIC_TAKEN = "That username is taken.";
const GENERIC_SERVER_DOWN = "The instance returned an error. Try again shortly.";

/** Field name a form should highlight inline, when applicable. */
export type AuthErrorField =
  | "username"
  | "new_username"
  | "password"
  | "refresh_token";

/**
 * What kind of failure occurred. The form uses this to decide
 * tone, copy, and recovery flow (e.g. ``banned`` should offer a
 * contact-support link; ``unreachable`` should keep the form
 * editable and show a retry).
 */
export type AuthErrorKind =
  | "credentials"
  | "username_taken"
  | "username_invalid"
  | "password_weak"
  | "rate_limited"
  | "account_locked"
  | "account_banned"
  | "instance_mismatch"
  | "signup_disabled"
  | "unreachable"
  | "server_error"
  | "unknown";

export interface AuthErrorClassification {
  /** Banner-safe message — pre-formatted, can be shown verbatim. */
  message: string;
  /** Field to highlight inline, when the error is field-specific. */
  field?: AuthErrorField;
  /** What kind of failure this is. */
  kind: AuthErrorKind;
  /** Whether this is a credential failure (legacy field, still
   *  consumed by some forms — kept for back-compat). */
  isCredentialFailure: boolean;
  /** When ``rate_limited`` / ``account_locked``, the wait hint. */
  retryAfterSeconds?: number;
}

/**
 * Code-based classifier. Reads the typed envelope when present,
 * falls back to the legacy string sanitiser when the server
 * didn't ship one (older builds, network errors).
 *
 * Input shapes:
 *   - ``ApiResponse`` — pulls ``errorDetails`` directly.
 *   - ``AppError`` — used as-is.
 *   - raw ``string`` / ``null`` — falls through to substring matching.
 */
export function classifyAuthError(
  input: ApiResponse<unknown> | AppError | string | null | undefined,
  fallback: string,
): AuthErrorClassification {
  const appError = resolveAppError(input);

  // New path: typed envelope available.
  if (appError && !appError.isFallback) {
    return fromAppError(appError, fallback);
  }

  // Legacy path: substring match on the raw string.
  const rawMessage =
    typeof input === "string"
      ? input
      : appError?.userMessage || appError?.message || null;
  return sanitizeAuthError(rawMessage, fallback);
}

function resolveAppError(
  input: ApiResponse<unknown> | AppError | string | null | undefined,
): AppError | null {
  if (!input) return null;
  if (typeof input === "string") return null;
  if ("errorDetails" in input && input.errorDetails) return input.errorDetails;
  if ("code" in input && "userMessage" in input) return input as AppError;
  return null;
}

/**
 * Convert a typed AppError to an auth classification. Pure
 * mapping by code — no string sniffing required.
 */
function fromAppError(
  error: AppError,
  fallback: string,
): AuthErrorClassification {
  const detailField = (error.details?.field as string | undefined) ?? undefined;
  const field = isAuthField(detailField) ? detailField : undefined;
  const retryAfterSeconds = error.retryAfterSeconds ?? undefined;

  switch (error.code) {
    case ErrorCode.AUTH_INVALID_CREDENTIALS:
      return {
        message: GENERIC_INVALID,
        kind: "credentials",
        isCredentialFailure: true,
      };

    case ErrorCode.AUTH_USERNAME_TAKEN:
      return {
        message: error.userMessage || GENERIC_TAKEN,
        field: field ?? "username",
        kind: "username_taken",
        isCredentialFailure: true,
      };

    case ErrorCode.AUTH_USERNAME_INVALID:
      return {
        message: error.userMessage,
        field: field ?? "username",
        kind: "username_invalid",
        isCredentialFailure: false,
      };

    case ErrorCode.AUTH_PASSWORD_TOO_WEAK:
      return {
        message: error.userMessage,
        field: field ?? "password",
        kind: "password_weak",
        isCredentialFailure: false,
      };

    case ErrorCode.AUTH_ACCOUNT_LOCKED:
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return {
        message: error.userMessage || GENERIC_RATE_LIMITED,
        kind: error.code === ErrorCode.AUTH_ACCOUNT_LOCKED ? "account_locked" : "rate_limited",
        isCredentialFailure: false,
        retryAfterSeconds,
      };

    case ErrorCode.AUTH_USER_BANNED:
      return {
        message: error.userMessage,
        kind: "account_banned",
        isCredentialFailure: false,
      };

    case ErrorCode.AUTH_INSTANCE_MISMATCH:
      return {
        message: error.userMessage,
        kind: "instance_mismatch",
        isCredentialFailure: false,
      };

    case ErrorCode.AUTH_SIGNUP_DISABLED:
      return {
        message: error.userMessage,
        kind: "signup_disabled",
        isCredentialFailure: false,
      };

    case ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED:
    case ErrorCode.AUTH_REFRESH_TOKEN_INVALID:
      return {
        message: error.userMessage,
        field: "refresh_token",
        kind: "credentials",
        isCredentialFailure: true,
      };

    case ErrorCode.CLIENT_NETWORK_OFFLINE:
    case ErrorCode.CLIENT_NETWORK_TIMEOUT:
    case ErrorCode.CLIENT_CORS_BLOCKED:
      return {
        message: error.userMessage || GENERIC_UNREACHABLE,
        kind: "unreachable",
        isCredentialFailure: false,
      };

    case ErrorCode.SERVER_INTERNAL_ERROR:
    case ErrorCode.SERVER_UNAVAILABLE:
      return {
        message: error.userMessage || GENERIC_SERVER_DOWN,
        kind: "server_error",
        isCredentialFailure: false,
      };

    default:
      // Unmapped code — show the server's user_message if it
      // exists, otherwise the form-supplied fallback.
      return {
        message: error.userMessage || fallback,
        kind: "unknown",
        isCredentialFailure: false,
      };
  }
}

function isAuthField(field: string | undefined): field is AuthErrorField {
  return (
    field === "username" ||
    field === "new_username" ||
    field === "password" ||
    field === "refresh_token"
  );
}

// ── Legacy substring-matching path ────────────────────────────────
//
// Kept verbatim so existing callers keep working. New code should
// prefer ``classifyAuthError`` which is code-aware.

const CREDENTIAL_FAILURE_KEYWORDS = [
  "invalid credentials",
  "invalid password",
  "incorrect password",
  "wrong password",
  "wrong credentials",
  "user not found",
  "username not found",
  "user does not exist",
  "no such user",
  "account not found",
  "auth_token",
];

const RATE_LIMITED_KEYWORDS = [
  "rate limit",
  "rate-limit",
  "too many",
  "retry after",
  "cooldown",
];

const UNREACHABLE_KEYWORDS = [
  "fetch failed",
  "network error",
  "failed to fetch",
  "connection refused",
  "econnrefused",
  "timeout",
  "etimedout",
  "name resolution",
  "dns",
];

const TAKEN_KEYWORDS = [
  "already exists",
  "already taken",
  "username already",
  "duplicate",
];

const includesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

/**
 * Sanitize a raw server error string by substring match. Used as
 * the fallback when no typed envelope is available.
 *
 * The return shape is the legacy ``SanitizedAuthError`` extended
 * with the new fields from ``AuthErrorClassification`` so call
 * sites can switch over without breaking.
 *
 * @deprecated Prefer ``classifyAuthError`` which reads the typed
 *   envelope when present.
 */
export function sanitizeAuthError(
  raw: string | null | undefined,
  fallback: string,
): AuthErrorClassification {
  if (!raw || !raw.trim()) {
    return { message: fallback, isCredentialFailure: false, kind: "unknown" };
  }
  const lower = raw.toLowerCase();

  if (includesAny(lower, RATE_LIMITED_KEYWORDS)) {
    return {
      message: GENERIC_RATE_LIMITED,
      isCredentialFailure: false,
      kind: "rate_limited",
    };
  }
  if (includesAny(lower, UNREACHABLE_KEYWORDS)) {
    return {
      message: GENERIC_UNREACHABLE,
      isCredentialFailure: false,
      kind: "unreachable",
    };
  }
  if (includesAny(lower, TAKEN_KEYWORDS)) {
    return {
      message: GENERIC_TAKEN,
      field: "username",
      isCredentialFailure: true,
      kind: "username_taken",
    };
  }
  if (includesAny(lower, CREDENTIAL_FAILURE_KEYWORDS)) {
    return {
      message: GENERIC_INVALID,
      isCredentialFailure: true,
      kind: "credentials",
    };
  }
  if (/\b5\d{2}\b/.test(raw)) {
    return {
      message: GENERIC_SERVER_DOWN,
      isCredentialFailure: false,
      kind: "server_error",
    };
  }
  return { message: fallback, isCredentialFailure: false, kind: "unknown" };
}
