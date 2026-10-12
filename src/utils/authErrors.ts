import { ApiError } from "../services/api";

export type AuthErrorField = "username" | "password" | "instance";

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

export interface AuthErrorInfo {
  message: string;
  field?: AuthErrorField;
  kind: AuthErrorKind;
  retryAfterSeconds?: number;
}

const UNREACHABLE = "Couldn't reach that instance. Check the address and try again.";

function toField(value: unknown): AuthErrorField | undefined {
  if (value === "username" || value === "new_username") return "username";
  if (value === "password") return "password";
  return undefined;
}

/**
 * Map a failed auth request to banner-safe copy. Unknown-user and wrong-password
 * both collapse to the same message to avoid username enumeration.
 */
export function classifyAuthError(error: unknown, fallback: string): AuthErrorInfo {
  if (!(error instanceof ApiError)) {
    return { message: error instanceof Error ? error.message : fallback, kind: "unknown" };
  }

  const retryAfterSeconds = error.retryAfterSeconds ?? undefined;
  const field = toField(error.details.field);

  switch (error.code) {
    case "auth.invalid_credentials":
      return { message: "Invalid username or password.", kind: "credentials" };
    case "auth.username_taken":
      return { message: "That username is taken.", field: "username", kind: "username_taken" };
    case "auth.username_invalid":
      return { message: error.message, field: field ?? "username", kind: "username_invalid" };
    case "auth.password_too_weak":
      return { message: error.message, field: field ?? "password", kind: "password_weak" };
    case "auth.account_locked":
      return { message: error.message, kind: "account_locked", retryAfterSeconds };
    case "auth.user_banned":
      return { message: error.message, kind: "account_banned" };
    case "auth.instance_mismatch":
      return { message: error.message, kind: "instance_mismatch" };
    case "auth.signup_disabled":
      return { message: error.message, kind: "signup_disabled" };
    case "rate_limit.exceeded":
    case "rate_limit.ip_blocked":
      return {
        message: retryAfterSeconds
          ? `Too many attempts. Try again in ${retryAfterSeconds}s.`
          : "Too many attempts. Try again in a moment.",
        kind: "rate_limited",
        retryAfterSeconds,
      };
    case "network":
    case "timeout":
      return { message: UNREACHABLE, field: "instance", kind: "unreachable" };
    default:
      if (error.status >= 500) {
        return { message: "The instance returned an error. Try again shortly.", kind: "server_error" };
      }
      return { message: error.message || fallback, kind: "unknown" };
  }
}

export interface Handle {
  username: string;
  /** Instance part of `user@instance`, if one was typed. */
  instance: string | null;
}

/** Split a handle like `lonelyfrog@switchyard.works` (or a bare `lonelyfrog`). */
export function parseHandle(input: string): Handle {
  const value = input.trim().replace(/^@/, "");
  const at = value.indexOf("@");
  if (at === -1) return { username: value, instance: null };
  return { username: value.slice(0, at), instance: value.slice(at + 1) || null };
}

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
export const USERNAME_RULE = "3–32 characters: letters, numbers, dots, hyphens and underscores.";
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 256;
