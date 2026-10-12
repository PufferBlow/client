import { useCallback, useEffect, useState } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

declare global {
  interface Window {
    electron?: {
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== "undefined" && !!window.electron;

  useEffect(() => {
    if (!window.electron) return;
    window.electron.onMaximizeChange(setIsMaximized);
  }, []);

  const handleMinimize = useCallback(() => window.electron?.minimize(), []);
  const handleMaximize = useCallback(() => window.electron?.maximize(), []);
  const handleClose = useCallback(() => window.electron?.close(), []);

  return (
    <div
      className="flex h-10 shrink-0 items-center border-b border-border bg-background-secondary select-none"
      style={isElectron ? { WebkitAppRegion: "drag" } as React.CSSProperties : undefined}
    >
      <div className="flex items-center gap-2 px-4 text-sm text-text-secondary">
        <span className="font-medium text-text">Pufferblow</span>
      </div>

      <div className="flex-1" />

      {isElectron && (
        <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button
            onClick={handleMinimize}
            className="flex h-full w-11 items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-full w-11 items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleClose}
            className="flex h-full w-11 items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-error hover:text-on-error"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
