import { app, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

// Daily-rotating client log file written to <userData>/logs/.
//
// One file per calendar day, name format `client-YYYY-MM-DD.log`. The renderer
// flushes batches of buffered entries here every few seconds and on close;
// each launch appends to the day's existing file, so a full day's session
// data lives in one place across restarts. When the count of files in the
// directory exceeds the cap (default 7 — one week of history), the oldest
// files are deleted on the next flush.

const DEFAULT_MAX_FILES = 7;

let cachedDir: string | null = null;

const getLogsDir = (): string => {
  if (cachedDir) return cachedDir;
  const dir = path.join(app.getPath('userData'), 'logs');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('[client-logs] failed to create logs directory', err);
  }
  cachedDir = dir;
  return dir;
};

const dayStamp = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fileNameForDay = (date: Date): string => `client-${dayStamp(date)}.log`;

const pruneOldFiles = (maxFiles: number): void => {
  if (maxFiles <= 0) return;
  const dir = getLogsDir();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  const candidates = entries
    .filter((name) => /^client-\d{4}-\d{2}-\d{2}\.log$/.test(name))
    .map((name) => {
      let mtime = 0;
      try {
        mtime = fs.statSync(path.join(dir, name)).mtimeMs;
      } catch {
        /* ignore — file may have been deleted between readdir and stat */
      }
      return { name, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime); // newest first

  const toDelete = candidates.slice(maxFiles);
  toDelete.forEach((entry) => {
    try {
      fs.unlinkSync(path.join(dir, entry.name));
    } catch (err) {
      console.error('[client-logs] failed to delete old log', entry.name, err);
    }
  });
};

interface AppendOptions {
  maxFiles?: number;
}

const appendLines = (lines: string[], opts: AppendOptions = {}): { written: boolean; file: string } => {
  if (!lines || lines.length === 0) {
    return { written: false, file: '' };
  }
  const dir = getLogsDir();
  const file = path.join(dir, fileNameForDay(new Date()));
  // Ensure each entry occupies a single line; trim trailing newlines so we
  // don't double up when callers already include one.
  const payload = lines
    .map((line) => (typeof line === 'string' ? line.replace(/\r?\n$/, '') : String(line)))
    .join('\n') + '\n';

  try {
    fs.appendFileSync(file, payload, 'utf-8');
  } catch (err) {
    console.error('[client-logs] failed to append log batch', err);
    return { written: false, file };
  }

  pruneOldFiles(opts.maxFiles ?? DEFAULT_MAX_FILES);
  return { written: true, file };
};

export function registerClientLogIpc(): void {
  // Renderer flushes a batch of formatted log lines (already redacted on its
  // side via logStore) to disk. The `maxFiles` cap is forwarded by the
  // renderer so the user can adjust it without a main-process restart.
  ipcMain.handle(
    'client-logs:append',
    (_event, payload: { lines?: string[]; maxFiles?: number }) => {
      const lines = Array.isArray(payload?.lines) ? payload.lines : [];
      const maxFiles =
        typeof payload?.maxFiles === 'number' && payload.maxFiles > 0
          ? Math.floor(payload.maxFiles)
          : DEFAULT_MAX_FILES;
      return appendLines(lines, { maxFiles });
    },
  );

  // Opens the logs directory in the OS file manager. Returns true on success
  // so the renderer can fall back to its own download flow when this fails
  // (e.g. headless build, browser context).
  ipcMain.handle('client-logs:open-folder', async () => {
    const dir = getLogsDir();
    try {
      const err = await shell.openPath(dir);
      // `openPath` resolves with an error string on failure, '' on success.
      return err === '';
    } catch {
      return false;
    }
  });

  // Returns the resolved logs directory so the renderer can show it in the
  // viewer (helpful when bug reports ask the user "where are the files?").
  ipcMain.handle('client-logs:get-dir', () => getLogsDir());
}
