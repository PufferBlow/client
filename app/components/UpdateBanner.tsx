import { useEffect, useState } from 'react';

interface UpdateInfo {
  version: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string;
}

interface ElectronUpdateBridge {
  onUpdateAvailable?: (cb: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloaded?: (cb: (info: UpdateInfo) => void) => () => void;
  installUpdate?: () => void;
}

const getBridge = (): ElectronUpdateBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: ElectronUpdateBridge }).electron;
};

type UpdateStatus = 'idle' | 'available' | 'downloaded';

/**
 * Bottom-right banner that surfaces electron-updater lifecycle events to the
 * user. Two distinct states:
 *
 *   1. `available`  — an update has been detected and is downloading in the
 *      background. We tell the user it's coming so a sudden "restart now"
 *      prompt doesn't feel out of nowhere.
 *   2. `downloaded` — the bundle is on disk and ready to install. We offer
 *      a "Restart now" action; clicking it calls `installUpdate` which
 *      triggers `autoUpdater.quitAndInstall` in the main process.
 *
 * Both states are dismissable. Dismissing the "downloaded" banner does
 * NOT cancel the install — `autoInstallOnAppQuit` is enabled in main.ts,
 * so the update applies on next launch even if the user ignores us.
 *
 * Renders nothing outside Electron (`window.electron` absent) and nothing
 * before any update event has fired.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge?.onUpdateAvailable || !bridge?.onUpdateDownloaded) return;

    const disposeAvailable = bridge.onUpdateAvailable((info) => {
      setVersion(info.version);
      setStatus((current) => (current === 'downloaded' ? current : 'available'));
      setDismissed(false);
    });
    const disposeDownloaded = bridge.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setStatus('downloaded');
      // Re-show the banner even if the user dismissed "available"; the
      // downloaded state is more important and earns a fresh impression.
      setDismissed(false);
    });

    return () => {
      disposeAvailable();
      disposeDownloaded();
    };
  }, []);

  if (status === 'idle' || dismissed) return null;

  const isReady = status === 'downloaded';
  const title = isReady ? 'Update ready' : 'Update available';
  const body = isReady
    ? `Pufferblow ${version ?? ''} is ready. Restart to apply.`
    : `Downloading Pufferblow ${version ?? ''} in the background…`;

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
      {isReady && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => getBridge()?.installUpdate?.()}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Restart now
          </button>
        </div>
      )}
    </div>
  );
}
