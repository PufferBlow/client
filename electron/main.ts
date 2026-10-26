import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, safeStorage, shell, Tray } from "electron";
import { autoUpdater } from "electron-updater";
import { readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { DesktopSettingsStore } from "./desktopSettings";
import { SessionVault } from "./sessionVault";
import { UpdateManager, type UpdateState, type Updater } from "./updates";

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: DesktopSettingsStore;
let updates: UpdateManager;
/** True once the app is really going away (Quit in the tray menu, Cmd+Q, an update restart), so the close button stops hiding. */
let quitting = false;

// A second launch (the desktop shortcut, a link) shows the window that is already running instead of starting another.
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();
app.on("second-instance", () => showWindow());
app.on("before-quit", () => {
  quitting = true;
});

function showWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** What Windows groups the taskbar button and its menu under. The installed app has the same (`build.appId`). */
const APP_ID = "space.pufferblow.client";
app.setAppUserModelId(APP_ID);

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

  // A run from the source tree is electron.exe, so Windows would head the taskbar menu with "Electron" and its icon.
  // Saying what this window is fixes that; an installed build is already named and iconed by the installer.
  if (process.platform === "win32" && !app.isPackaged) {
    mainWindow.setAppDetails({
      appId: APP_ID,
      appIconPath: join(__dirname, "../build/icon.ico"),
      appIconIndex: 0,
      relaunchCommand: `"${process.execPath}" "${app.getAppPath()}"`,
      relaunchDisplayName: "Pufferblow",
    });
  }

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // The close button hides the window and leaves the app in the tray, like Discord; Quit in the tray menu ends it.
  mainWindow.on("close", (event) => {
    if (quitting || !settings.get().closeToTray) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-state-changed", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-state-changed", false);
  });

  // Links to other sites open in the default browser, never inside the app window.
  const openInBrowser = (url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  };
  mainWindow.webContents.setWindowOpenHandler((details) => {
    openInBrowser(details.url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? "";
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url).origin === new URL(current).origin;
    } catch {
      // An unparsable address is not the app's own.
    }
    if (sameOrigin || url === current) return;
    event.preventDefault();
    openInBrowser(url);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

function trayMenu(): Electron.Menu {
  const state = updates.current();
  return Menu.buildFromTemplate([
    { label: "Open Pufferblow", click: showWindow },
    { type: "separator" },
    state.status === "ready"
      ? { label: `Restart to update to ${state.version}`, click: () => updates.install() }
      : { label: "Check for updates", enabled: state.status !== "unsupported" && state.status !== "checking", click: () => void updates.check() },
    {
      label: "Close button hides to the tray",
      type: "checkbox",
      checked: settings.get().closeToTray,
      click: (item) => {
        settings.set({ closeToTray: item.checked });
        mainWindow?.webContents.send("desktop:settings", settings.get());
      },
    },
    { type: "separator" },
    { label: "Quit Pufferblow", click: () => app.quit() },
  ]);
}

function createTray() {
  // 16px on Windows, 22px on most Linux panels, 18px in the macOS menu bar.
  const size = process.platform === "win32" ? 16 : process.platform === "darwin" ? 18 : 22;
  tray = new Tray(nativeImage.createFromPath(windowIcon).resize({ width: size, height: size }));
  tray.setToolTip("Pufferblow");
  tray.setContextMenu(trayMenu());
  // Windows and Linux: a click brings the window back. (macOS opens the menu.)
  tray.on("click", showWindow);
}

function createUpdates() {
  const packaged = app.isPackaged;
  updates = new UpdateManager({
    updater: autoUpdater as unknown as Updater,
    enabled: packaged,
    disabledReason: "Updates are off when running from the source tree.",
    onState: (state: UpdateState) => {
      mainWindow?.webContents.send("updates:state", state);
      tray?.setContextMenu(trayMenu());
    },
  });
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
  if (!firstInstance) return;
  const settingsFile = join(app.getPath("userData"), "desktop.json");
  settings = new DesktopSettingsStore({
    read: () => {
      try {
        return readFileSync(settingsFile, "utf8");
      } catch {
        return null;
      }
    },
    write: (text) => writeFileSync(settingsFile, text),
  });
  createUpdates();
  createWindow();
  createTray();
  updates.start();

  const vault = createSessionVault();
  ipcMain.handle("session:available", () => vault.available());
  ipcMain.handle("session:store", (_event, apiUrl: unknown, refreshToken: unknown, remember: unknown, account: unknown) =>
    vault.store(apiUrl, refreshToken, remember, account ?? undefined),
  );
  ipcMain.handle("session:activate", (_event, account: unknown) => vault.activate(account));
  ipcMain.handle("session:rename", (_event, from: unknown, to: unknown) => vault.rename(from, to));
  ipcMain.handle("session:forget", (_event, account: unknown) => vault.forget(account));
  ipcMain.handle("session:refresh", () => vault.refresh());
  ipcMain.handle("session:revoke", () => vault.revoke());
  ipcMain.handle("session:clear", () => vault.clear());

  ipcMain.handle("desktop:get", () => ({ ...settings.get(), version: app.getVersion() }));
  ipcMain.handle("desktop:set", (_event, patch: unknown) => {
    const next = settings.set(patch);
    tray?.setContextMenu(trayMenu());
    return next;
  });
  ipcMain.handle("updates:state", () => updates.current());
  ipcMain.handle("updates:check", () => updates.check());
  ipcMain.handle("updates:install", () => updates.install());

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
    showWindow();
  });
});

// The tray keeps the app running with every window hidden, so closing the last window does not end it.
// When the close button is set to quit, the window closing is what ends the app.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !settings.get().closeToTray) app.quit();
});
