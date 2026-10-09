import { useState, useEffect } from 'react';
import { useTitleBar } from '../context/TitleBarContext';
import { LogsViewer } from './LogsViewer';
import { logStore } from '../services/logStore';

interface ElectronWindowBridge {
  platform?: string;
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<void>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  onWindowMaximizeChanged?: (cb: (isMaximized: boolean) => void) => () => void;
  onWindowFullscreenChanged?: (cb: (isFullscreen: boolean) => void) => () => void;

  // Update affordances surfaced inline in the title bar when
  // auto-update is OFF. When ON, the same events still fire but the
  // bar leaves them to the UpdateBanner instead.
  getAutoUpdateEnabled?: () => Promise<boolean>;
  onAutoUpdateEnabledChanged?: (cb: (enabled: boolean) => void) => () => void;
  onUpdateAvailable?: (cb: (info: { version: string }) => void) => () => void;
  onUpdateDownloadProgress?: (cb: (progress: { percent: number }) => void) => () => void;
  onUpdateDownloaded?: (cb: (info: { version: string }) => void) => () => void;
  downloadUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  installUpdate?: () => void;
}

const getElectron = (): ElectronWindowBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: ElectronWindowBridge }).electron;
};

const isElectron = () => typeof window !== 'undefined' && 'electron' in window;

// ── macOS traffic-light cluster ──────────────────────────────────────────────

function MacControls() {
  const el = getElectron();
  return (
    <div
      className="flex items-center gap-[6px] group"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      <button
        onClick={() => el?.windowClose?.()}
        className="w-3 h-3 rounded-full bg-[#FF5F57] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Close"
        aria-label="Close window"
      >
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          <line x1="1" y1="1" x2="5" y2="5" stroke="#4c0002" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="5" y1="1" x2="1" y2="5" stroke="#4c0002" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      <button
        onClick={() => el?.windowMinimize?.()}
        className="w-3 h-3 rounded-full bg-[#FEBC2E] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Minimize"
        aria-label="Minimize window"
      >
        <svg width="6" height="2" viewBox="0 0 6 2" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          <line x1="0.5" y1="1" x2="5.5" y2="1" stroke="#6a4100" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      <button
        onClick={() => el?.windowMaximize?.()}
        className="w-3 h-3 rounded-full bg-[#28C840] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Maximize"
        aria-label="Maximize window"
      >
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          <path d="M1 5L5 1M3 1H5V3" stroke="#003b00" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Windows / Linux controls ─────────────────────────────────────────────────

function WinControls({ isMaximized }: { isMaximized: boolean }) {
  const el = getElectron();
  return (
    <div
      className="flex items-stretch h-full"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      <button
        onClick={() => el?.windowMinimize?.()}
        className="h-full w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus:outline-none transition-colors"
        title="Minimize" aria-label="Minimize window"
      >
        <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor" aria-hidden>
          <rect width="11" height="1" rx="0.5"/>
        </svg>
      </button>

      <button
        onClick={() => el?.windowMaximize?.()}
        className="h-full w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus:outline-none transition-colors"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMaximized ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="3" y="0" width="8" height="8" rx="0.5"/>
            <rect x="0" y="3" width="8" height="8" rx="0.5" fill="var(--color-background)"/>
            <rect x="0" y="3" width="8" height="8" rx="0.5"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="0.5" y="0.5" width="10" height="10" rx="0.5"/>
          </svg>
        )}
      </button>

      <button
        onClick={() => el?.windowClose?.()}
        className="h-full w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[#c42b1c] hover:text-white focus:outline-none transition-colors"
        title="Close" aria-label="Close window"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" aria-hidden>
          <line x1="1" y1="1" x2="10" y2="10"/>
          <line x1="10" y1="1" x2="1" y2="10"/>
        </svg>
      </button>
    </div>
  );
}

// ── Title bar ────────────────────────────────────────────────────────────────

// Small state machine for the inline title-bar update button.
//   - 'idle'        — auto-update is ON, or no release detected yet.
//                     Nothing renders.
//   - 'available'   — auto-update is OFF and a release exists; the
//                     user has to click to start the download.
//   - 'downloading' — download in flight; the button shows percent
//                     and is non-interactive.
//   - 'ready'       — bundle on disk; clicking restarts to install.
type UpdateButtonState = "idle" | "available" | "downloading" | "ready";

function UpdateTitleBarButton() {
  const el = getElectron();
  const [autoUpdate, setAutoUpdate] = useState<boolean | null>(null);
  const [state, setState] = useState<UpdateButtonState>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!el) return;
    el.getAutoUpdateEnabled?.().then((value) => setAutoUpdate(!!value));
    const offToggle = el.onAutoUpdateEnabledChanged?.((value) => setAutoUpdate(value));

    const offAvail = el.onUpdateAvailable?.((info) => {
      setVersion(info?.version ?? null);
      setState((cur) => (cur === "downloading" || cur === "ready" ? cur : "available"));
    });
    const offProg = el.onUpdateDownloadProgress?.((p) => {
      setPercent(Math.max(0, Math.min(100, p.percent)));
      setState((cur) => (cur === "ready" ? cur : "downloading"));
    });
    const offDone = el.onUpdateDownloaded?.((info) => {
      setVersion(info?.version ?? null);
      setState("ready");
    });

    return () => {
      offToggle?.();
      offAvail?.();
      offProg?.();
      offDone?.();
    };
  }, [el]);

  // Render rule: auto-update OFF surfaces the button on every state
  // EXCEPT idle. When auto-update is ON the UpdateBanner handles the
  // workflow end-to-end and the title bar stays clean.
  if (autoUpdate === null || autoUpdate === true || state === "idle") return null;

  const onClick = () => {
    if (state === "ready") {
      el?.installUpdate?.();
      return;
    }
    if (state === "available") {
      el?.downloadUpdate?.();
    }
  };

  const label =
    state === "ready"
      ? `Restart to install ${version ?? "update"}`
      : state === "downloading"
        ? `Downloading${percent !== null ? ` ${Math.round(percent)}%` : "…"}`
        : `Download ${version ?? "update"}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "downloading"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: "no-drag" } as any}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 self-stretch px-3 text-[11px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {state === "downloading" && percent !== null
        ? `${Math.round(percent)}%`
        : state === "ready"
          ? "Restart"
          : "Update"}
    </button>
  );
}

// Opens the in-app log viewer. Sits in the right cluster of the title bar
// next to the window controls and the update button, with a red unread-error
// dot when new error-level entries have arrived since the viewer was last
// opened.
function LogsTitleBarButton({ onClick }: { onClick: () => void }) {
  const [unreadErrors, setUnreadErrors] = useState(0);

  useEffect(() => {
    setUnreadErrors(logStore.getErrorCountSinceMark());
    return logStore.subscribe((snapshot) => {
      setUnreadErrors(snapshot.errorCountSinceMark);
    });
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'no-drag' } as any}
      title={unreadErrors > 0 ? `Show client logs (${unreadErrors} new error${unreadErrors === 1 ? '' : 's'})` : 'Show client logs'}
      aria-label="Show client logs"
      className="relative inline-flex items-center justify-center self-stretch w-11 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus:outline-none transition-colors"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="8" y1="9" x2="10" y2="9" />
      </svg>
      {unreadErrors > 0 && (
        <span
          aria-hidden
          className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-[var(--color-error)]"
        />
      )}
    </button>
  );
}

export function TitleBar() {
  const { serverName, serverAvatarUrl, channelName } = useTitleBar();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  // `mounted` is the SSR-safety latch. SSR has no `window`, so isElectron()
  // returns false on the server -> server emits null. But on the client's
  // FIRST render (the hydration pass), `window.electron` already exists in
  // the Electron renderer, so isElectron() returns true and we'd emit the
  // <div style={{WebkitAppRegion:'drag'}}>. That mismatch trips React's
  // hydration check and the whole tree gets thrown away and re-rendered.
  //
  // The fix: keep `mounted` false during the first client render (matches
  // SSR's null output exactly), then flip it to true in useEffect, which
  // only runs post-hydration. The second render is no longer a hydration
  // pass, so emitting the title bar then is fine.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const el = getElectron();
    if (!el) return;

    el.windowIsMaximized?.().then(setIsMaximized);
    const unsubMax = el.onWindowMaximizeChanged?.(setIsMaximized);
    const unsubFs = el.onWindowFullscreenChanged?.(setIsFullscreen);

    // Fallback: browser fullscreen API (e.g. triggered by web content)
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      unsubMax?.();
      unsubFs?.();
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  if (!mounted || !isElectron() || isFullscreen) return null;

  const el = getElectron();
  const isMac = el?.platform === 'darwin';

  return (
    <div
      className="relative flex items-center h-9 shrink-0 w-full bg-[var(--color-background)] border-b border-[var(--color-border-secondary)] select-none"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left — traffic lights (macOS) + app name */}
      <div
        className="flex items-center gap-3 pl-3 z-10 shrink-0"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {isMac && <MacControls />}
        <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] tracking-wide">
          Pufferblow
        </span>
      </div>

      {/* Center — current location breadcrumb: server avatar + server
          name + channel name. Absolutely centered in the bar so the
          left/right clusters can grow without pushing it around.

          Layout: [ avatar ] [ server name ] · [ # channel ]
          The avatar uses the same `rounded-lg` rectangle the rail
          uses (just smaller — 18px to fit the 36px-tall bar),
          falling back to a letter chip if the instance hasn't set
          one. The channel half is suppressed when DMs are open or
          when nothing is selected — handled by the dashboard
          clearing `channelName` in those modes.

          pointer-events stay on so the avatar and labels are
          tooltip-able, but the wrapper preserves `WebkitAppRegion:
          drag` from the parent so the bar still acts as a drag
          handle in the gaps between elements. */}
      {serverName && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0 max-w-[60%] px-2">
            {serverAvatarUrl ? (
              <img
                src={serverAvatarUrl}
                alt=""
                className="h-[18px] w-[18px] shrink-0 rounded-md object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-secondary)] text-[9px] font-semibold text-[var(--color-text-secondary)]"
              >
                {(serverName || "S").charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className="text-[11px] font-medium text-[var(--color-text)] tracking-wide truncate"
              title={serverName}
            >
              {serverName}
            </span>
            {channelName && (
              <>
                <span
                  aria-hidden
                  className="text-[11px] text-[var(--color-text-tertiary)] shrink-0"
                >
                  ·
                </span>
                <span
                  className="text-[11px] font-medium text-[var(--color-text-muted)] tracking-wide truncate"
                  title={`#${channelName}`}
                >
                  #{channelName}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right — logs button + update button (only visible when auto-update
          is OFF and a release exists) + window controls (Win/Linux). */}
      <div className="ml-auto flex items-center h-full z-10 shrink-0">
        <LogsTitleBarButton onClick={() => setLogsOpen(true)} />
        <UpdateTitleBarButton />
        {!isMac && <WinControls isMaximized={isMaximized} />}
      </div>
      <LogsViewer isOpen={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
