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

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
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
   * Fires once the update bundle has finished downloading in the background.
   * Renderer should now offer the user a "restart to update" action that
   * calls `installUpdate()` below.
   */
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => cb(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  installUpdate: () => ipcRenderer.send('install-update'),

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
});
