import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  onUpdateAvailable: (cb: () => void) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update-downloaded', cb),
  installUpdate: () => ipcRenderer.send('install-update'),
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
});
