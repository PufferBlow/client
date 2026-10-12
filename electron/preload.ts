import { contextBridge, ipcRenderer } from "electron";

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
};

contextBridge.exposeInMainWorld("electron", api);

export type ElectronApi = typeof api;
