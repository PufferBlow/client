import { useState, useEffect } from 'react';
import { useTitleBar } from '../context/TitleBarContext';

// Typed subset of the Electron bridge exposed by preload.ts.
interface ElectronWindowBridge {
  platform?: string;
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<void>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  onWindowMaximizeChanged?: (cb: (isMaximized: boolean) => void) => () => void;
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
      className="flex items-center gap-[6px] pl-[14px] group"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      {/* Close */}
      <button
        onClick={() => el?.windowClose?.()}
        className="w-3 h-3 rounded-full bg-[#FF5F57] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Close"
        aria-label="Close window"
      >
        <svg
          width="6" height="6" viewBox="0 0 6 6" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
          <line x1="1" y1="1" x2="5" y2="5" stroke="#4c0002" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="5" y1="1" x2="1" y2="5" stroke="#4c0002" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Minimize */}
      <button
        onClick={() => el?.windowMinimize?.()}
        className="w-3 h-3 rounded-full bg-[#FEBC2E] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Minimize"
        aria-label="Minimize window"
      >
        <svg
          width="6" height="2" viewBox="0 0 6 2" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
          <line x1="0.5" y1="1" x2="5.5" y2="1" stroke="#6a4100" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Maximize / restore */}
      <button
        onClick={() => el?.windowMaximize?.()}
        className="w-3 h-3 rounded-full bg-[#28C840] flex items-center justify-center focus:outline-none hover:brightness-90 transition-[filter] active:brightness-75"
        title="Maximize"
        aria-label="Maximize window"
      >
        <svg
          width="6" height="6" viewBox="0 0 6 6" fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
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
        title="Minimize"
        aria-label="Minimize window"
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
          // Restore icon — two overlapping squares
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="3" y="0" width="8" height="8" rx="0.5"/>
            <rect x="0" y="3" width="8" height="8" rx="0.5"
              fill="var(--color-background)"
            />
            <rect x="0" y="3" width="8" height="8" rx="0.5"/>
          </svg>
        ) : (
          // Maximize icon — single square
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="0.5" y="0.5" width="10" height="10" rx="0.5"/>
          </svg>
        )}
      </button>

      <button
        onClick={() => el?.windowClose?.()}
        className="h-full w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[#c42b1c] hover:text-white focus:outline-none transition-colors"
        title="Close"
        aria-label="Close window"
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

export function TitleBar() {
  const { serverName } = useTitleBar();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const el = getElectron();
    if (!el) return;
    el.windowIsMaximized?.().then(setIsMaximized);
    return el.onWindowMaximizeChanged?.(setIsMaximized);
  }, []);

  if (!isElectron()) return null;

  const el = getElectron();
  const isMac = el?.platform === 'darwin';
  const title = serverName ?? 'Pufferblow';

  return (
    <div
      className="flex items-center h-9 shrink-0 w-full bg-[var(--color-background)] border-b border-[var(--color-border-secondary)] select-none"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left zone — traffic lights on macOS, spacer on Win/Linux */}
      <div className="w-[88px] flex items-center shrink-0">
        {isMac && <MacControls />}
      </div>

      {/* Center — server / instance name */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-2 min-w-0">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] tracking-wide truncate max-w-[70%]">
          {title}
        </span>
      </div>

      {/* Right zone — window controls on Win/Linux, spacer on macOS */}
      <div className="w-[88px] flex items-center justify-end shrink-0 h-full">
        {!isMac && <WinControls isMaximized={isMaximized} />}
      </div>
    </div>
  );
}
