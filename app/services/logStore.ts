// ---------------------------------------------------------------------------
// Sensitive-data redaction
// ---------------------------------------------------------------------------
//
// Auth tokens, session tokens, and bearer credentials must never reach the
// in-app log viewer, the on-disk log file, or the OS console. Malware that
// scrapes those surfaces could otherwise replay the credential against the
// server. Redaction runs once, before the entry leaves this module, and is
// applied to both the formatted message string AND the structured args
// (recursively into objects/arrays).
//
// Two forms of redaction are needed:
//   1. STRING form — auth_token appears inline in URLs (?auth_token=…),
//      JSON-stringified bodies ({"auth_token":"…"}), and Authorization /
//      Bearer headers. Pattern-match these directly.
//   2. STRUCTURED form — when an object is passed as an arg, walk its keys
//      and redact the VALUE of any sensitive key by name. This catches
//      `{ auth_token: 'xyz' }` even when the value would never match the
//      string patterns (e.g. an opaque GUID with no surrounding markers).
//
// New token names: when the codebase grows another credential, add it to
// SENSITIVE_KEY_NAMES below. The regex set is built from this list.

const SENSITIVE_KEY_NAMES = [
  'auth_token',
  'auth-token',
  'authtoken',
  'authorization',
  'bearer',
  'token',
  'access_token',
  'refresh_token',
  'session_token',
  'node_session_token',
  'x-pufferblow-node-session',
  'password',
  'passwd',
  'secret',
  'api_key',
  'api-key',
  'apikey',
  'key',
];

const SENSITIVE_KEY_SET = new Set(SENSITIVE_KEY_NAMES.map((k) => k.toLowerCase()));

const REDACTED = '[REDACTED]';

const KEY_ALT = SENSITIVE_KEY_NAMES.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// URL query / form-encoded: `?auth_token=...`, `&token=...`, `;key=...`.
// We deliberately stop at `&`, `#`, whitespace, or quote so we don't eat the
// next param. `(?<=[?&;])` keeps the separator intact.
const URL_PARAM_RE = new RegExp(`(?<=[?&;])(${KEY_ALT})=([^&#\\s"'<>]+)`, 'gi');

// HTTP headers: `Authorization: Bearer abc.def.ghi`, `X-Auth-Token: xxx`.
const HEADER_RE = new RegExp(`((?:^|[\\s,;])(?:${KEY_ALT}))\\s*[:=]\\s*([^\\s"',;]+)`, 'gi');

// `Bearer <token>` standalone (Authorization header value, often logged on its own).
const BEARER_RE = /\bbearer\s+([A-Za-z0-9._\-+/=]+)/gi;

// JSON-stringified: `"auth_token":"abc"` and `"auth_token": "abc"`.
const JSON_FIELD_RE = new RegExp(`("(?:${KEY_ALT})"\\s*:\\s*)"([^"]*)"`, 'gi');

export const redactString = (input: string): string => {
  if (!input) return input;
  let out = input;
  out = out.replace(URL_PARAM_RE, (_m, key) => `${key}=${REDACTED}`);
  out = out.replace(JSON_FIELD_RE, (_m, prefix) => `${prefix}"${REDACTED}"`);
  out = out.replace(BEARER_RE, `Bearer ${REDACTED}`);
  out = out.replace(HEADER_RE, (_m, prefix) => `${prefix}: ${REDACTED}`);
  return out;
};

const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_KEY_SET.has(key.toLowerCase());

export const redactValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return value; // safety cap against pathological depth
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
};

export type LogLevelName = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type LogContextName =
  | 'auth'
  | 'api'
  | 'ui'
  | 'network'
  | 'database'
  | 'user'
  | 'system';

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevelName;
  context: LogContextName;
  message: string;
  args?: unknown[];
}

export interface LogStoreSnapshot {
  entries: LogEntry[];
  errorCountSinceMark: number;
}

const DEFAULT_CAPACITY = 2000;

type Listener = (snapshot: LogStoreSnapshot) => void;

const serializeArg = (value: unknown): unknown => {
  // Redact first (handles strings, Errors, and recursively into objects/arrays),
  // then JSON-roundtrip to drop functions, symbols, and circular refs so the
  // result is safe for both the in-app viewer and on-disk persistence.
  const redacted = redactValue(value);
  if (
    redacted === null ||
    redacted === undefined ||
    typeof redacted === 'string' ||
    typeof redacted === 'number' ||
    typeof redacted === 'boolean'
  ) {
    return redacted;
  }
  try {
    return JSON.parse(JSON.stringify(redacted));
  } catch {
    return String(redacted);
  }
};

class LogStore {
  private buffer: LogEntry[] = [];
  private capacity = DEFAULT_CAPACITY;
  private nextId = 1;
  private listeners = new Set<Listener>();
  private errorCountSinceMark = 0;

  push(level: LogLevelName, context: LogContextName, rawMessage: string, args: unknown[]): void {
    const message = redactString(rawMessage);
    const entry: LogEntry = {
      id: this.nextId++,
      ts: Date.now(),
      level,
      context,
      message,
      args: args.length ? args.map(serializeArg) : undefined,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }

    if (level === 'error') {
      this.errorCountSinceMark += 1;
    }

    this.emit();
  }

  getAll(): LogEntry[] {
    return this.buffer.slice();
  }

  clear(): void {
    this.buffer = [];
    this.errorCountSinceMark = 0;
    this.emit();
  }

  markRead(): void {
    if (this.errorCountSinceMark === 0) return;
    this.errorCountSinceMark = 0;
    this.emit();
  }

  getErrorCountSinceMark(): number {
    return this.errorCountSinceMark;
  }

  setCapacity(capacity: number): void {
    if (!Number.isFinite(capacity) || capacity <= 0) return;
    this.capacity = Math.floor(capacity);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
      this.emit();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  exportPlainText(): string {
    return this.buffer
      .map((entry) => {
        const iso = new Date(entry.ts).toISOString();
        const argsStr = entry.args && entry.args.length
          ? ' ' + entry.args.map((arg) => {
              try {
                return typeof arg === 'string' ? arg : JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }).join(' ')
          : '';
        return `[${iso}] [${entry.level.toUpperCase()}] [${entry.context.toUpperCase()}] ${entry.message}${argsStr}`;
      })
      .join('\n');
  }

  exportJson(): string {
    return JSON.stringify(
      this.buffer.map((entry) => ({
        ...entry,
        ts_iso: new Date(entry.ts).toISOString(),
      })),
      null,
      2,
    );
  }

  private snapshot(): LogStoreSnapshot {
    return {
      entries: this.buffer.slice(),
      errorCountSinceMark: this.errorCountSinceMark,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not affect logging.
      }
    });
  }
}

export const logStore = new LogStore();
