import { useEffect, useState } from 'react';

interface UpdateInfo {
  version: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string;
}

interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  delta?: number;
}

interface ElectronUpdateBridge {
  onUpdateAvailable?: (cb: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloadProgress?: (cb: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloaded?: (cb: (info: UpdateInfo) => void) => () => void;
  onUpdateError?: (cb: (err: { message: string }) => void) => () => void;
  installUpdate?: () => void;
}

const getBridge = (): ElectronUpdateBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: ElectronUpdateBridge }).electron;
};

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

/**
 * Bottom-right banner that surfaces electron-updater lifecycle events to the
 * user. State machine:
 *
 *   1. `available`   — an update has been detected; download is about to
 *      start (we keep this brief because `download-progress` typically
 *      arrives within a second or two on a reasonable connection).
 *   2. `downloading` — bundle is being fetched; we show a slim progress bar
 *      with the percentage.
 *   3. `downloaded`  — bundle is on disk and ready to install. We offer a
 *      "Restart now" action that calls `installUpdate()`, which triggers
 *      `autoUpdater.quitAndInstall` in the main process.
 *   4. `error`       — updater hit a network/signature error. We surface
 *      a quiet failure message so the user knows the auto-update isn't
 *      silently broken; an explicit dismiss makes it go away.
 *
 * All states are dismissable. Dismissing "downloaded" does NOT cancel the
 * install — `autoInstallOnAppQuit` is enabled in main.ts, so the update
 * applies on next launch even if the user ignores us.
 *
 * Renders nothing outside Electron (`window.electron` absent) and nothing
 * before any update event has fired.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    // Each subscription returns a disposer. We collect them so the
    // effect cleanup unmounts all listeners in one pass — no risk of
    // leaking an `update-error` subscription on hot reload.
    const disposers: Array<() => void> = [];

    if (bridge.onUpdateAvailable) {
      disposers.push(
        bridge.onUpdateAvailable((info) => {
          setVersion(info.version);
          // Don't downgrade out of `downloaded` if a second
          // `update-available` event fires (it shouldn't, but
          // electron-updater has fired duplicates in past versions).
          setStatus((current) => (current === 'downloaded' ? current : 'available'));
          setErrorMessage(null);
          setDismissed(false);
        }),
      );
    }
    if (bridge.onUpdateDownloadProgress) {
      disposers.push(
        bridge.onUpdateDownloadProgress((p) => {
          setProgress(p);
          setStatus((current) => (current === 'downloaded' ? current : 'downloading'));
        }),
      );
    }
    if (bridge.onUpdateDownloaded) {
      disposers.push(
        bridge.onUpdateDownloaded((info) => {
          setVersion(info.version);
          setStatus('downloaded');
          // Re-show the banner even if the user dismissed an earlier
          // state; "downloaded" is the actionable one and earns a
          // fresh impression.
          setDismissed(false);
        }),
      );
    }
    if (bridge.onUpdateError) {
      disposers.push(
        bridge.onUpdateError((err) => {
          // Don't clobber a successful state with a late error event.
          // If we already have a bundle downloaded, the restart prompt
          // remains more useful than an error toast.
          setStatus((current) => (current === 'downloaded' ? current : 'error'));
          setErrorMessage(err.message || 'Update check failed.');
        }),
      );
    }

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);

  if (status === 'idle' || dismissed) return null;

  const isReady = status === 'downloaded';
  const isDownloading = status === 'downloading';
  const isError = status === 'error';

  const title = isError
    ? 'Update check failed'
    : isReady
      ? 'Update ready'
      : isDownloading
        ? 'Downloading update'
        : 'Update available';

  const body = isError
    ? errorMessage || 'Pufferblow could not reach the release feed. We will retry automatically.'
    : isReady
      ? `Pufferblow ${version ?? ''} is ready. Restart to apply.`
      : isDownloading
        ? `Pufferblow ${version ?? ''} is downloading…`
        : `Pufferblow ${version ?? ''} was found — download starting…`;

  // Clamp + round so a flaky network can't push the bar above 100.
  // electron-updater occasionally reports >100 on the final tick.
  const percent =
    progress && Number.isFinite(progress.percent)
      ? Math.max(0, Math.min(100, progress.percent))
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Progress bar — visible only while the bundle is being fetched.
          We hide it for the "downloaded" and "available" states so the
          banner doesn't show a frozen 100% bar after install is ready. */}
      {isDownloading && percent !== null && (
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-secondary)]"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-text-muted)] tabular-nums">
            <span>{Math.round(percent)}%</span>
            {progress && progress.bytesPerSecond > 0 && (
              <span>{formatBytesPerSecond(progress.bytesPerSecond)}</span>
            )}
          </div>
        </div>
      )}

      {isReady && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => getBridge()?.installUpdate?.()}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
          >
            Restart now
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Format a B/s value as KB/s or MB/s for the progress readout. Kept
 * inline (not a util) because no other surface needs this.
 */
function formatBytesPerSecond(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
  const kb = bytesPerSecond / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
  return `${(kb / 1024).toFixed(2)} MB/s`;
}
