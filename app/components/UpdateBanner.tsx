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
  getAutoUpdateEnabled?: () => Promise<boolean>;
  onAutoUpdateEnabledChanged?: (cb: (enabled: boolean) => void) => () => void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // When auto-update is OFF the title bar owns the update UI — a
  // download button on `available`, a percent readout while
  // `downloading`, a restart prompt on `ready`. The banner would
  // duplicate that surface, so we suppress it entirely until the
  // preference flips back on.
  const [autoUpdate, setAutoUpdate] = useState<boolean | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    bridge.getAutoUpdateEnabled?.().then((value) => setAutoUpdate(!!value));
    const off = bridge.onAutoUpdateEnabledChanged?.((enabled) => setAutoUpdate(enabled));
    return () => off?.();
  }, []);

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
        bridge.onUpdateDownloadProgress(() => {
          // Tick `downloading` state for the brief moment between
          // the first progress event and the `downloaded` event so
          // anything that consults `status` knows a fetch is in
          // flight. The progress payload itself is intentionally
          // ignored — auto-update mode keeps downloads silent and
          // we don't surface a percent in the renderer.
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
  // Hide entirely when auto-update is disabled — the title bar
  // surface takes over. (autoUpdate === null is the bridge-not-ready
  // case; defaulting to showing the banner is the safe choice there.)
  if (autoUpdate === false) return null;
  // Auto-update ON: keep the download silent. The whole point of the
  // 'auto' mode is that releases land in the background without
  // pulling the user out of what they're doing — a bottom-right
  // banner with a live progress bar is exactly the kind of
  // interruption the preference is meant to avoid. We surface only
  // the actionable states: `downloaded` (the user can restart) and
  // `error` (the user might want to know auto-update is broken).
  if (status === 'available' || status === 'downloading') return null;

  const isReady = status === 'downloaded';
  const isError = status === 'error';

  const title = isError ? 'Update check failed' : 'Update ready';

  const body = isError
    ? errorMessage || 'Pufferblow could not reach the release feed. We will retry automatically.'
    : `Pufferblow ${version ?? ''} is ready. Restart to apply.`;

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

      {/* Download progress is intentionally not surfaced anywhere
          in the renderer when auto-update is ON — the banner only
          renders for `downloaded` and `error`. The progress fires
          internally so the splash bar can track it on cold boot,
          but during a live session it stays silent. */}

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

