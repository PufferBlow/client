import { contextBridge, ipcRenderer } from "electron";
import type { RefreshResult } from "./sessionVault";

const api = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  minimize: () => ipcRenderer.send("minimize"),
  maximize: () => ipcRenderer.send("maximize"),
  close: () => ipcRenderer.send("close"),
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("window-state-changed", (_event, isMaximized: boolean) => {
      callback(isMaximized);
    });
  },
  /**
   * The refresh token, held by the main process. `store` hands it over at sign-in (false when this
   * system has no keychain, and the page keeps it itself); after that only access tokens come back.
   */
  session: {
    available: (): Promise<boolean> => ipcRenderer.invoke("session:available"),
    store: (apiUrl: string, refreshToken: string, remember: boolean, account?: string): Promise<boolean> =>
      ipcRenderer.invoke("session:store", apiUrl, refreshToken, remember, account),
    /** Make a stored account the one refresh, revoke and clear act on. */
    activate: (account: string): Promise<boolean> => ipcRenderer.invoke("session:activate", account),
    /** Give an account stored before accounts had names its real name. */
    rename: (from: string, to: string): Promise<boolean> => ipcRenderer.invoke("session:rename", from, to),
    /** Forget one account's refresh token, whichever is active. */
    forget: (account: string): Promise<void> => ipcRenderer.invoke("session:forget", account),
    refresh: (): Promise<RefreshResult> => ipcRenderer.invoke("session:refresh"),
    revoke: (): Promise<void> => ipcRenderer.invoke("session:revoke"),
    clear: (): Promise<void> => ipcRenderer.invoke("session:clear"),
  },
};

contextBridge.exposeInMainWorld("electron", api);

export type ElectronApi = typeof api;
