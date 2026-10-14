import { app, BrowserWindow, ipcMain, net, safeStorage, shell } from "electron";
import { readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { SessionVault } from "./sessionVault";

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;

/** The Pufferblow mark, for the window and taskbar. Dev runs from `public/`; a build has it in `dist/`. */
const windowIcon = join(__dirname, process.env.VITE_DEV_SERVER_URL ? "../public/icon.png" : "../dist/icon.png");

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: windowIcon,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Pufferblow",
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-state-changed", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-state-changed", false);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

/** The refresh token lives here, encrypted with the OS keychain; see `sessionVault.ts`. */
function createSessionVault(): SessionVault {
  const file = join(app.getPath("userData"), "session.bin");
  return new SessionVault({
    encryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (sealed) => safeStorage.decryptString(Buffer.from(sealed)),
    read: () => {
      try {
        return readFileSync(file);
      } catch {
        return null;
      }
    },
    write: (sealed) => writeFileSync(file, sealed, { mode: 0o600 }),
    remove: () => rmSync(file, { force: true }),
    // Chromium's network stack: honours the system proxy and certificate store, like the page does.
    fetch: (url, init) => net.fetch(url, init),
  });
}

app.whenReady().then(() => {
  createWindow();

  const vault = createSessionVault();
  ipcMain.handle("session:available", () => vault.available());
  ipcMain.handle("session:store", (_event, apiUrl: unknown, refreshToken: unknown, remember: unknown) =>
    vault.store(apiUrl, refreshToken, remember),
  );
  ipcMain.handle("session:refresh", () => vault.refresh());
  ipcMain.handle("session:revoke", () => vault.revoke());
  ipcMain.handle("session:clear", () => vault.clear());

  ipcMain.on("minimize", () => mainWindow?.minimize());
  ipcMain.on("maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("close", () => mainWindow?.close());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
