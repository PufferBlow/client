import type { ElectronApi } from "../../electron/preload";

declare global {
  interface Window {
    /** The desktop app's bridge (`electron/preload.ts`); absent in a browser. */
    electron?: ElectronApi;
  }
}

export {};
