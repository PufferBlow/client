/**
 * `showApiError` — the single function call sites use to surface an
 * API error to the user.
 *
 * Why this exists: roughly 20 places across the dashboard, control
 * panel, and admin tabs all do the same pattern:
 *
 *     showToast({
 *       message: `Failed to do X: ${response.error || 'Unknown error'}`,
 *       tone: 'error',
 *       category: 'system',
 *     });
 *
 * The "Unknown error" fallback is exactly what the user reported as
 * the problem — when the server says nothing useful, we say nothing
 * useful, and the toast is meaningless. With the envelope contract
 * in place, the apiClient now ALWAYS attaches an `AppError` with a
 * pre-formatted `userMessage`. This helper consumes that, picks the
 * right tone + category based on the error code, and fires one
 * tidy toast.
 *
 * Call sites become:
 *
 *     if (!response.success) {
 *       showApiError(showToast, response, { action: "rename channel" });
 *       return;
 *     }
 *
 * The `action` is optional — when provided we prefix the toast with
 * "Couldn't <action>:". Otherwise we use the AppError's own message
 * verbatim (which is already pre-formatted for users).
 */

import type { ApiResponse } from "./apiClient";
import {
  decodeApiError,
  ErrorCode,
  isAuthError,
  isRetryableError,
  isValidationError,
  type AppError,
} from "./apiError";
import type {
  ShowToast,
  ToastCategory,
  ToastTone,
} from "../components/Toast";

interface ShowApiErrorOptions {
  /** Optional verb to prefix the toast — e.g. "save the channel"
   *  becomes "Couldn't save the channel: <userMessage>". When the
   *  user message already reads as a complete sentence, skip this. */
  action?: string;
  /** Override the auto-detected tone. Almost never needed — the
   *  default heuristic is right for >95% of cases. */
  tone?: ToastTone;
  /** Override the auto-detected category. */
  category?: ToastCategory;
  /** Fallback userMessage if the decoder somehow returned an empty
   *  string. Defaults to a generic "Something went wrong." */
  fallback?: string;
  /** Dedupe key passed through to the toast. Useful when an action
   *  can fire the same error rapidly (autocomplete on every
   *  keystroke). */
  dedupeKey?: string;
}

/**
 * Fire a toast for an API error.
 *
 * Accepts any of:
 *   - An `ApiResponse` (the common case — `response.errorDetails`
 *     is read directly)
 *   - An `AppError` (already-decoded)
 *   - Anything else (passed through `decodeApiError`)
 *
 * Returns the AppError so call sites can run additional logic
 * (force-logout, switch tabs, highlight a field) without
 * re-decoding.
 */
export function showApiError(
  showToast: ShowToast,
  input: ApiResponse<unknown> | AppError | unknown,
  options: ShowApiErrorOptions = {},
): AppError {
  const error = resolveAppError(input);

  // Validation errors carry per-field details. We surface the
  // headline in the toast; UIs that want to highlight specific
  // inputs read `errorDetails.details.fields` directly.
  const tone: ToastTone =
    options.tone ?? (isAuthError(error) ? "error" : "error");
  const category: ToastCategory =
    options.category ??
    (isValidationError(error)
      ? "validation"
      : isAuthError(error)
        ? "system"
        : error.code === ErrorCode.RATE_LIMIT_EXCEEDED
          ? "info"
          : "system");

  const baseMessage = error.userMessage || options.fallback || "Something went wrong.";
  const message = options.action ? `Couldn't ${options.action}: ${baseMessage}` : baseMessage;

  showToast({
    message,
    tone,
    category,
    dedupeKey: options.dedupeKey,
  });

  return error;
}

/**
 * Resolve any of the accepted input types to an AppError. Exported
 * for call sites that want the AppError without firing a toast
 * (e.g. they want to log + take action without a UI message).
 */
export function resolveAppError(
  input: ApiResponse<unknown> | AppError | unknown,
): AppError {
  if (input && typeof input === "object" && "errorDetails" in input) {
    const r = input as ApiResponse<unknown>;
    if (r.errorDetails) return r.errorDetails;
    // ApiResponse came back with .success === false but no
    // errorDetails — older apiClient code path or in-flight
    // mock. Fall back to decoding the string.
    return decodeApiError(r.error);
  }
  return decodeApiError(input);
}

// Re-export the helpers most call sites need so they can import
// one module instead of three.
export { isAuthError, isRetryableError, isValidationError, ErrorCode };
export type { AppError };
