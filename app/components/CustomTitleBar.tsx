import { useState, useEffect } from 'react';

export function CustomTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we're in Electron environment
    const electronCheck = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectron(electronCheck);

    if (electronCheck && (window as any).electronAPI) {
      // Get initial maximized state
      (window as any).electronAPI.isMaximized().then(setIsMaximized);

      // Listen for maximize state changes
      const cleanup = (window as any).electronAPI.onMaximizeChanged((maximized: boolean) => {
        setIsMaximized(maximized);
      });

      return cleanup;
    }
  }, []);

  const handleMinimize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.toggleMaximize();
    }
  };

  const handleClose = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.closeWindow();
    }
  };

  // Only render in Electron desktop app
  if (!isElectron) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between h-8 bg-[var(--color-surface)] border-b border-[var(--color-border)] select-none"
      style={{
        WebkitAppRegion: 'drag', // Make the title bar draggable
        appRegion: 'drag'
      } as any}
    >
      {/* Left side - App title or drag area */}
      <div className="flex-1 px-4">
        <span className="text-sm font-medium text-[var(--color-text)] select-none">
          Pufferblow
        </span>
      </div>

      {/* Right side - Window controls */}
      <div
        className="flex items-center"
        style={{
          WebkitAppRegion: 'no-drag', // Prevent window controls from being draggable
          appRegion: 'no-drag'
        } as any}
      >
        {/* Minimize button */}
        <button
          onClick={handleMinimize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[var(--color-hover)] transition-colors"
          title="Minimize"
        >
          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Maximize/Restore button */}
        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[var(--color-hover)] transition-colors"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? (
            /* Restore down icon */
            <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0 2-2h3M3 16h3a2 2 0 0 0 2 2v3" />
            </svg>
          ) : (
            /* Maximize icon */
            <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M4 8l6 6m10-6h4v4M14 14l6-6" />
            </svg>
          )}
        </button>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="w-12 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
          title="Close"
        >
          <svg className="w-4 h-4 text-[var(--color-text-secondary)] hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
