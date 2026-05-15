import { app, BrowserWindow, ipcMain, protocol, net, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { createTray } from './tray';

const isDev = !app.isPackaged;
const PROD_INDEX = path.join(__dirname, '..', 'build', 'client', 'index.html');

// Stable AppUserModelID is required on Windows so that OS notifications and
// taskbar pins group under "Pufferblow" instead of under the auto-generated
// `electron.app.Pufferblow`. macOS / Linux ignore this call.
app.setAppUserModelId('social.pufferblow.client');

// Single-instance lock. If a second copy of Pufferblow launches while the
// first is running, we hand control back to the original instance (focus
// + restore from tray) and immediately exit the new one. Without this,
// duplicate processes would fight over the secureStorage / localStorage
// state and silently corrupt session data.
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  app.exit(0);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;
// Set on app.quit so the close handler stops trapping the close event and
// actually lets the window die. Without this the user can never fully quit
// from the OS shell (Cmd-Q / Alt-F4 just re-hide the window).
let quittingForReal = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    resizable: true,
    center: true,
    title: 'Pufferblow',
    icon: path.join(__dirname, '..', 'resources', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://pufferblow/');
  }

  mainWindow.on('close', (event) => {
    if (quittingForReal) {
      return; // let the window actually close
    }
    event.preventDefault();
    mainWindow?.hide();
  });

  // Push maximize state changes to the renderer so the title bar can swap
  // the restore/maximize icon without polling.
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-maximize-changed', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-maximize-changed', false));
}

/**
 * Bring the main window to the foreground from whatever state it's in:
 * - destroyed → reconstruct it (closing via Cmd-Q et al)
 * - minimized → restore
 * - hidden (tray) → show + focus
 */
function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

// Second-instance handler — called when the user launches Pufferblow again
// while a copy is already running. Foreground the existing window so
// double-clicking the desktop icon feels like "open the app" instead of
// silently doing nothing.
app.on('second-instance', () => {
  focusMainWindow();
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const filePath = path.join(
      __dirname,
      '..',
      'build',
      'client',
      url.pathname === '/' ? 'index.html' : url.pathname,
    );
    const resolved =
      fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()
        ? filePath
        : PROD_INDEX;
    return net.fetch('file://' + resolved);
  });

  // Spoof Origin so the local API's CORS policy accepts renderer requests.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Origin: 'http://localhost:5173',
      },
    });
  });

  createWindow();
  createTray(mainWindow!);

  // Renderer asks main to bring the window forward. Triggered by the
  // desktop-notifications service when the user clicks a system toast and
  // we need to restore the app from the tray / minimized state. We can't
  // do this reliably from the renderer on macOS or some Linux WMs.
  ipcMain.on('focus-window', () => {
    focusMainWindow();
  });

  // Custom title bar window controls.
  ipcMain.handle('window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  // Close fires the existing 'close' handler which hides to tray unless quitting.
  ipcMain.handle('window-close', () => mainWindow?.close());
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

  // macOS: clicking the dock icon when the app has no visible windows
  // should re-show the existing window (or create one if it was fully
  // closed). This is the canonical Electron pattern.
  app.on('activate', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// App lives in tray — keep running when all windows are closed.
app.on('window-all-closed', () => {});

// When the user issues a real Quit (Cmd-Q on macOS, the tray's Quit menu
// fires app.exit which bypasses this), let the close handler drop the
// `event.preventDefault()` so the window actually closes.
app.on('before-quit', () => {
  quittingForReal = true;
});

if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}
