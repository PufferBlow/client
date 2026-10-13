import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";

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

app.whenReady().then(() => {
  createWindow();

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
