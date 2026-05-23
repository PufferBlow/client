import { logStore, type LogEntry } from './logStore';

// Background flusher: drains the in-memory log buffer to the Electron main
// process every few seconds (and once more on window unload). Main writes the
// lines to a daily-rotating file in <userData>/logs/ and prunes anything past
// the retention cap. No-ops when no Electron bridge is available — the
// browser dev server keeps the in-memory ring buffer only.
//
// We track `lastFlushedId` rather than holding entry references so that the
// flusher survives ring-buffer eviction: once an entry's id is below the
// store's oldest, we just resume from whatever's left.

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_MAX_FILES = 7;

interface ElectronLogBridge {
  appendClientLogs?: (
    lines: string[],
    maxFiles?: number,
  ) => Promise<{ written: boolean; file: string }>;
}

const getBridge = (): ElectronLogBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: ElectronLogBridge }).electron;
};

const formatEntry = (entry: LogEntry): string => {
  const iso = new Date(entry.ts).toISOString();
  const argsStr =
    entry.args && entry.args.length
      ? ' ' +
        entry.args
          .map((arg) => {
            if (arg === null || arg === undefined) return String(arg);
            if (typeof arg === 'string') return arg;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ')
      : '';
  return `[${iso}] [${entry.level.toUpperCase()}] [${entry.context.toUpperCase()}] ${entry.message}${argsStr}`;
};

interface StartOptions {
  intervalMs?: number;
  maxFiles?: number;
}

let started = false;
let lastFlushedId = 0;
let timerHandle: ReturnType<typeof setInterval> | null = null;
let unloadHandler: (() => void) | null = null;
let inFlight = false;
let maxFiles = DEFAULT_MAX_FILES;

const flush = async (sync = false): Promise<void> => {
  if (inFlight && !sync) return;
  const bridge = getBridge();
  if (!bridge?.appendClientLogs) return;

  const pending = logStore.getAll().filter((entry) => entry.id > lastFlushedId);
  if (pending.length === 0) return;

  const lines = pending.map(formatEntry);
  const highestId = pending[pending.length - 1].id;

  inFlight = true;
  try {
    await bridge.appendClientLogs(lines, maxFiles);
    lastFlushedId = highestId;
  } catch (err) {
    // Best-effort: a failed flush leaves lastFlushedId alone so the next tick
    // retries the same range. Don't recurse into the logger — would feedback-
    // loop into another flush attempt.
    console.error('[logDiskSync] flush failed', err);
  } finally {
    inFlight = false;
  }
};

export const startLogDiskSync = (options: StartOptions = {}): (() => void) => {
  if (started) return stopLogDiskSync;
  const bridge = getBridge();
  if (!bridge?.appendClientLogs) {
    // No Electron — nothing to do. Browser/dev keeps the in-memory ring only.
    return () => undefined;
  }

  started = true;
  maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  timerHandle = setInterval(() => {
    void flush();
  }, intervalMs);

  // Best-effort final drain before the window goes away. `beforeunload` runs
  // synchronously enough that the IPC call's promise generally resolves
  // before the process exits; we don't await it because we can't.
  unloadHandler = () => {
    void flush(true);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', unloadHandler);
  }

  // Drain anything already in the buffer (startup events that landed before
  // we wired up).
  void flush();

  return stopLogDiskSync;
};

export const stopLogDiskSync = (): void => {
  if (!started) return;
  started = false;
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  if (unloadHandler && typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', unloadHandler);
    unloadHandler = null;
  }
};

export const flushLogDiskSyncNow = (): Promise<void> => flush(true);

export const setLogDiskSyncMaxFiles = (next: number): void => {
  if (Number.isFinite(next) && next > 0) {
    maxFiles = Math.floor(next);
  }
};
