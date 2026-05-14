/**
 * Sanitize server-supplied auth error strings so the UI never echoes
 * an exact message that distinguishes "username does not exist" from
 * "wrong password for that user." That distinction is a classic
 * username-enumeration vector.
 *
 * The matcher is conservative: anything that looks like a credential
 * failure collapses to one generic message. Operational errors
 * (rate-limited, instance unreachable, server 5xx) are kept so the
 * user can tell their account isn't the problem.
 */

export interface SanitizedAuthError {
  /** The string safe to show in the UI. */
  message: string;
  /**
   * Whether the underlying server error was a credential / account
   * failure (true) vs. a non-account problem like rate-limit or
   * connectivity (false). The form can use this to decide what
   * client-side fields to highlight without ever rendering the
   * original server text.
   */
  isCredentialFailure: boolean;
}

const GENERIC_INVALID = "Invalid username or password.";
const GENERIC_RATE_LIMITED = "Too many attempts. Try again in a moment.";
const GENERIC_UNREACHABLE =
  "Couldn't reach that instance. Check the address and try again.";
const GENERIC_TAKEN = "That username is taken.";
const GENERIC_SERVER_DOWN = "The instance returned an error. Try again shortly.";

/** Lowercase keywords that indicate a credential / account-existence failure.
 * Anything matching one of these collapses to GENERIC_INVALID. */
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
 * Map a server-supplied error string into a safe UI message.
 *
 * @param raw  The server's error string (may be undefined / null).
 * @param fallback  Used when `raw` is empty or doesn't match any known
 *   class. Should itself be a generic, non-account-distinguishing
 *   string — e.g. `"Login failed."` or `"Signup failed."`.
 */
export const sanitizeAuthError = (
  raw: string | null | undefined,
  fallback: string,
): SanitizedAuthError => {
  if (!raw || !raw.trim()) {
    return { message: fallback, isCredentialFailure: false };
  }
  const lower = raw.toLowerCase();

  if (includesAny(lower, RATE_LIMITED_KEYWORDS)) {
    return { message: GENERIC_RATE_LIMITED, isCredentialFailure: false };
  }
  if (includesAny(lower, UNREACHABLE_KEYWORDS)) {
    return { message: GENERIC_UNREACHABLE, isCredentialFailure: false };
  }
  if (includesAny(lower, TAKEN_KEYWORDS)) {
    return { message: GENERIC_TAKEN, isCredentialFailure: true };
  }
  if (includesAny(lower, CREDENTIAL_FAILURE_KEYWORDS)) {
    return { message: GENERIC_INVALID, isCredentialFailure: true };
  }
  // 5xx-ish server complaints we don't recognize: surface as generic
  // server error rather than fallback (which may say "login failed" and
  // imply credentials were wrong).
  if (lower.includes("server error") || lower.includes("5")) {
    if (/\b5\d{2}\b/.test(raw)) {
      return { message: GENERIC_SERVER_DOWN, isCredentialFailure: false };
    }
  }
  return { message: fallback, isCredentialFailure: false };
};
