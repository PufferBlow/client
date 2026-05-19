import { contextBridge, ipcRenderer } from 'electron';

/**
 * Subset of `electron-updater`'s UpdateInfo we forward to the renderer.
 * Replicated here so the renderer doesn't have to take a dependency on
 * the updater package just to type the IPC payload.
 */
interface UpdateInfo {
  version: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate: string;
}

/**
 * Mirrors the `download-progress` payload electron-updater emits while
 * the bundle is being fetched. Replicated here for the same reason as
 * `UpdateInfo` above — the renderer shouldn't depend on the updater
 * package just to type its own UI.
 */
interface UpdateDownloadProgress {
  /** Fraction 0..100. */
  percent: number;
  /** Bytes downloaded so far. */
  transferred: number;
  /** Total bytes in the update bundle. */
  total: number;
  /** Throughput at the last tick. */
  bytesPerSecond: number;
  /** Bytes since the previous tick. */
  delta?: number;
}

interface ManualCheckResult {
  ok: boolean;
  version?: string | null;
  error?: string;
}

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  /**
   * Fires when the updater begins polling the release feed (initial
   * boot, periodic recheck, manual recheck). Useful for surfacing a
   * "Checking…" spinner in the Settings page.
   */
  onUpdateChecking: (cb: (info: { startedAt: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { startedAt: string }) => cb(info);
    ipcRenderer.on('update-checking', listener);
    return () => ipcRenderer.removeListener('update-checking', listener);
  },
  /**
   * Fires once an update has been detected on the release feed. The info
   * payload includes the version string — useful for "v1.2.3 is available"
   * copy in the banner.
   */
  onUpdateAvailable: (cb: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => cb(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  /**
   * Fires when the feed confirms the app is already on the latest
   * release. The renderer only uses this for manual checks (so a
   * "Check for updates" button can say "you're up to date"); the
   * UpdateBanner ignores it to avoid noise on periodic polls.
   */
  onUpdateNotAvailable: (cb: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => cb(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  /**
   * Fires repeatedly while the update bundle is being downloaded.
   * Use the `percent` field for a progress bar; `bytesPerSecond` is
   * available for an optional throughput readout.
   */
  onUpdateDownloadProgress: (cb: (progress: UpdateDownloadProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: UpdateDownloadProgress) => cb(progress);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  /**
   * Fires once the update bundle has finished downloading in the background.
   * Renderer should now offer the user a "restart to update" action that
   * calls `installUpdate()` below.
   */
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => cb(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  /**
   * Fires when the updater hits a network or signature error. Payload
   * is a plain `{ message }` — full Error objects don't survive the
   * structured-clone hop, and the renderer only needs the human-
   * readable message for its toast.
   */
  onUpdateError: (cb: (err: { message: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, err: { message: string }) => cb(err);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  /**
   * Renderer-initiated update check. Returns the same shape the main
   * handler produces — `{ ok, version? , error? }` — so a Settings-page
   * "Check for updates" button can show a result inline.
   */
  checkForUpdates: (): Promise<ManualCheckResult> =>
    ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),

  // ── Auto-update preference ───────────────────────────────────
  //
  // When the preference is ON (default), the updater downloads new
  // releases in the background and the UpdateBanner surfaces a
  // "restart now" once the bundle is on disk. When OFF, releases
  // are still DETECTED — the renderer's title bar shows a download
  // button so the user opts in per release.
  getAutoUpdateEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('get-auto-update-enabled'),
  setAutoUpdateEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('set-auto-update-enabled', enabled),
  /**
   * Listen for live changes to the preference (e.g. flipped in
   * Settings) so the title bar's download button can appear /
   * disappear without a reload. Returns a disposer.
   */
  onAutoUpdateEnabledChanged: (cb: (enabled: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => cb(enabled);
    ipcRenderer.on('auto-update-enabled-changed', listener);
    return () => ipcRenderer.removeListener('auto-update-enabled-changed', listener);
  },
  /**
   * Renderer-initiated manual download. Use after seeing the
   * "update available" event when auto-update is OFF. Resolves
   * once `autoUpdater.downloadUpdate()` returns (which is when the
   * download has STARTED, not finished — progress arrives via
   * onUpdateDownloadProgress).
   */
  downloadUpdate: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('download-update'),

  /**
   * Subscribe to `pufferblow://` activations forwarded from the main
   * process. The URL is the raw string the OS handed us — the renderer
   * is responsible for parsing it into a route. Returns a disposer.
   */
  onDeepLink: (cb: (url: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => cb(url);
    ipcRenderer.on('deep-link', listener);
    return () => ipcRenderer.removeListener('deep-link', listener);
  },
  /**
   * Drain any deep-link URL that arrived before the renderer had finished
   * mounting (cold start protocol activations from the OS). One-shot —
   * the main process clears its queue once we read it.
   */
  getPendingDeepLink: (): Promise<string | null> =>
    ipcRenderer.invoke('get-pending-deep-link'),
  /**
   * Bring the main window to the foreground and give it focus. Used by the
   * desktop-notifications service when the user clicks an OS notification —
   * `window.focus()` from the renderer is unreliable across platforms once
   * the app is minimized to the tray.
   */
  focusWindow: () => ipcRenderer.send('focus-window'),
  /**
   * Push the renderer's current unread count into the tray / OS badge
   * surface. Clamped to >= 0 on the main side; safe to call on every WS
   * event or notification load.
   */
  setUnreadCount: (count: number) => ipcRenderer.send('set-unread-count', count),
  /**
   * Whether the tray menu has toggled notifications off. The renderer
   * should suppress its desktopNotifications dispatch when this is true.
   * Resolves on every call, so callers can `await` after the user toggles.
   */
  getNotificationsMuted: (): Promise<boolean> =>
    ipcRenderer.invoke('get-notifications-muted'),
  /**
   * Programmatically set the muted state from the renderer (e.g. an
   * in-app settings page). Mirrors the tray menu toggle.
   */
  setNotificationsMuted: (muted: boolean) =>
    ipcRenderer.send('set-notifications-muted', muted),
  /**
   * Subscribe to muted-state changes (tray menu toggle or another renderer
   * call). Returns a disposer so React effects can clean up cleanly.
   */
  onNotificationsMutedChanged: (cb: (muted: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, muted: boolean) => cb(muted);
    ipcRenderer.on('notifications-muted-changed', listener);
    return () => {
      ipcRenderer.removeListener('notifications-muted-changed', listener);
    };
  },

  // ── Custom title bar window controls ────────────────────────────────────
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window-maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window-close'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  /**
   * Subscribe to maximize/restore transitions so the title bar icon updates
   * without polling. Returns a disposer for React effect cleanup.
   */
  onWindowMaximizeChanged: (cb: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => cb(isMaximized);
    ipcRenderer.on('window-maximize-changed', listener);
    return () => ipcRenderer.removeListener('window-maximize-changed', listener);
  },
  onWindowFullscreenChanged: (cb: (isFullscreen: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => cb(isFullscreen);
    ipcRenderer.on('window-fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-changed', listener);
  },

  // ── Hardware acceleration preference ───────────────────────────
  //
  // Reads/writes a flag persisted in the main-process settings file.
  // Default is `false` (disabled): the GPU process isn't used at all
  // and Electron renders through software. Users can opt in via the
  // Settings page; a restart is required for the change to take
  // effect because `app.disableHardwareAcceleration()` only fires at
  // app startup.
  getHardwareAcceleration: (): Promise<boolean> =>
    ipcRenderer.invoke('get-hardware-acceleration'),
  setHardwareAcceleration: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('set-hardware-acceleration', enabled),
});
