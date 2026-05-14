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
});
