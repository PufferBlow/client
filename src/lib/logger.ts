/**
 * The client's logger: one line per event as `time LEVEL [scope] message`, then any structured
 * data as separate console arguments so DevTools can expand it. Secrets never reach the console:
 * tokens and passwords are masked in strings (URLs) and in object fields.
 *
 * The level defaults to `debug` in development, `warn` in a production build and `silent` under
 * tests. Override it from DevTools with `localStorage.pb_log_level = "debug"` (then reload), or
 * call `setLogLevel("debug")` from code.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const LEVEL_KEY = "pb_log_level";

const isLevel = (value: unknown): value is LogLevel => typeof value === "string" && value in ORDER;

function defaultLevel(): LogLevel {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    if (isLevel(stored)) return stored;
  } catch {
    // Storage blocked: fall through to the build default.
  }
  if (import.meta.env.MODE === "test") return "silent";
  return import.meta.env.DEV ? "debug" : "warn";
}

let threshold: LogLevel = defaultLevel();

/** Changes the level now and remembers it for the next load. */
export function setLogLevel(level: LogLevel): void {
  threshold = level;
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // Not remembered; still applies for this session.
  }
}

export const getLogLevel = (): LogLevel => threshold;

const SECRET_FIELD = /token|password|secret|authorization|cookie/i;
const SECRET_PARAM = /([?&;\s"']*(?:auth_token|refresh_token|access_token|token|password)["']?\s*[=:]\s*)[^&\s"',}]+/gi;
const MASK = "***";

/** Masks `token=…`/`password=…` style values inside a string, e.g. a request URL. */
export function redactText(text: string): string {
  return text.replace(SECRET_PARAM, `$1${MASK}`);
}

/** A copy of `value` safe to print: secret-looking fields masked, long strings and deep nesting cut short. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value.length > 500 ? `${value.slice(0, 500)}…` : value);
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (value === null || typeof value !== "object") return value;
  if (value instanceof FormData) return "[FormData]";
  if (depth >= 4) return Array.isArray(value) ? "[Array]" : "[Object]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) out[key] = SECRET_FIELD.test(key) ? MASK : redact(field, depth + 1);
  return out;
}

const STYLE = {
  time: "color:#8a8a8a",
  debug: "color:#8a8a8a;font-weight:bold",
  info: "color:#4ea1ff;font-weight:bold",
  warn: "color:#e0a030;font-weight:bold",
  error: "color:#ff5c5c;font-weight:bold",
  reset: "color:inherit;font-weight:normal",
} as const;

const SCOPE_COLORS = ["#c586c0", "#4ec9b0", "#dcdcaa", "#9cdcfe", "#ce9178", "#b5cea8"];
const scopeColor = (scope: string) => {
  let hash = 0;
  for (const char of scope) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SCOPE_COLORS[hash % SCOPE_COLORS.length];
};

const timestamp = () => {
  const now = new Date();
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
};

export interface Logger {
  debug: (message: string, ...data: unknown[]) => void;
  info: (message: string, ...data: unknown[]) => void;
  warn: (message: string, ...data: unknown[]) => void;
  error: (message: string, ...data: unknown[]) => void;
  /** A logger whose scope is this one's plus `:name`. */
  child: (name: string) => Logger;
}

/** A logger for one area of the app, e.g. `createLogger("net")`. */
export function createLogger(scope: string): Logger {
  const emit = (level: Exclude<LogLevel, "silent">, message: string, data: unknown[]) => {
    if (ORDER[level] < ORDER[threshold]) return;
    const method = level === "debug" ? "debug" : level;
    console[method](
      `%c${timestamp()} %c${level.toUpperCase().padEnd(5)} %c[${scope}]%c ${redactText(message)}`,
      STYLE.time,
      STYLE[level],
      `color:${scopeColor(scope)};font-weight:bold`,
      STYLE.reset,
      ...data.map((item) => redact(item)),
    );
  };

  return {
    debug: (message, ...data) => emit("debug", message, data),
    info: (message, ...data) => emit("info", message, data),
    warn: (message, ...data) => emit("warn", message, data),
    error: (message, ...data) => emit("error", message, data),
    child: (name) => createLogger(`${scope}:${name}`),
  };
}
