import { contextBridge, ipcRenderer } from "electron";
import type { DesktopSettings } from "./desktopSettings";
import type { RefreshResult } from "./sessionVault";
import type { UpdateState } from "./updates";

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
  /** Settings of the desktop app itself (the tray), and the version that is running. */
  desktop: {
    get: (): Promise<DesktopSettings & { version: string }> => ipcRenderer.invoke("desktop:get"),
    set: (patch: Partial<DesktopSettings>): Promise<DesktopSettings> => ipcRenderer.invoke("desktop:set", patch),
    onChange: (callback: (settings: DesktopSettings) => void): (() => void) => {
      const listener = (_event: unknown, settings: DesktopSettings) => callback(settings);
      ipcRenderer.on("desktop:settings", listener);
      return () => ipcRenderer.removeListener("desktop:settings", listener);
    },
  },
  /** Updates download in the background; `install` restarts into a downloaded one. */
  updates: {
    state: (): Promise<UpdateState> => ipcRenderer.invoke("updates:state"),
    check: (): Promise<void> => ipcRenderer.invoke("updates:check"),
    install: (): Promise<boolean> => ipcRenderer.invoke("updates:install"),
    onState: (callback: (state: UpdateState) => void): (() => void) => {
      const listener = (_event: unknown, state: UpdateState) => callback(state);
      ipcRenderer.on("updates:state", listener);
      return () => ipcRenderer.removeListener("updates:state", listener);
    },
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
