import { app, BrowserWindow, ipcMain, protocol, net, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { createTray } from './tray';

const isDev = !app.isPackaged;
const PROD_INDEX = path.join(__dirname, '..', 'build', 'client', 'index.html');

/**
 * Custom URL scheme registered with the OS so external clients can deep-link
 * into the app (e.g. clicking `pufferblow://m/<message_id>` in a browser or
 * chat opens the desktop client and navigates there).
 *
 * On macOS the URL is delivered via `app.on('open-url')`. On Windows / Linux
 * the OS launches a new copy of the executable with the URL appended to
 * argv; the single-instance lock catches it and we surface the URL to the
 * already-running window in the `second-instance` handler.
 */
const PROTOCOL = 'pufferblow';

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

/**
 * URL queued before the renderer has finished mounting. The first `pufferblow://`
 * activation often arrives before our React tree has subscribed to the
 * `deep-link` IPC event — store it here so the renderer can pull it via
 * `get-pending-deep-link` on mount.
 */
let pendingDeepLink: string | null = null;

/** Find the first `pufferblow://...` URL anywhere in an argv array. */
const extractDeepLink = (argv: readonly string[]): string | null =>
  argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${PROTOCOL}://`)) ?? null;

/**
 * Hand a deep link to the renderer. If the window isn't ready yet, queue it
 * so a fresh mount can drain it via the `get-pending-deep-link` IPC. We
 * never queue more than one URL — the latest activation wins, which matches
 * how OS protocol activations behave when the user clicks twice quickly.
 */
const dispatchDeepLink = (url: string | null): void => {
  if (!url) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deep-link', url);
  } else {
    pendingDeepLink = url;
  }
};

// Register `pufferblow://` with the OS as a default protocol handler. In
// dev on Windows we have to point the registration at electron.exe + our
// compiled main.js so the second-instance argv is well-formed; in
// packaged builds Electron does the right thing on its own.
if (isDev && process.platform === 'win32') {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? '')]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// First-launch URL on Windows/Linux (the OS appends the activation URL to argv
// when it launches us). Queue it now so the eventual renderer mount drains it.
pendingDeepLink = extractDeepLink(process.argv);

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

  // Push fullscreen transitions so the title bar can hide itself in fullscreen.
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('window-fullscreen-changed', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('window-fullscreen-changed', false));
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
// while a copy is already running, including when the OS spawns a new copy
// to deliver a `pufferblow://` activation on Windows / Linux. Foreground the
// existing window and forward any deep-link URL into the renderer.
app.on('second-instance', (_event, argv) => {
  focusMainWindow();
  dispatchDeepLink(extractDeepLink(argv));
});

// macOS deep-link path. Unlike Windows / Linux the URL never appears in
// argv — the OS delivers it through this event instead, both at cold start
// (queued for the renderer) and to a running instance (dispatched live).
app.on('open-url', (event, url) => {
  if (!url.startsWith(`${PROTOCOL}://`)) return;
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    dispatchDeepLink(url);
  } else {
    pendingDeepLink = url;
  }
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

  // Renderer pulls any queued deep link on mount. We can't reliably push the
  // URL via `webContents.send` for cold-start activations because the renderer
  // hasn't subscribed to the event listener yet — the renderer asks once it's
  // ready, then we hand the queued URL over (and clear it; one-shot).
  ipcMain.handle('get-pending-deep-link', () => {
    const url = pendingDeepLink;
    pendingDeepLink = null;
    return url;
  });

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

// ── Auto-updater ────────────────────────────────────────────────────────────
//
// electron-updater fires lifecycle events that we forward into the renderer
// via IPC so a React component can surface "an update is available" and
// later "ready to install — restart now". The renderer answers with
// `install-update` once the user clicks the restart button, at which point
// we call `quitAndInstall` from the main process (the renderer can't trigger
// the squirrel restart directly).
//
// Errors are logged but never fatal; a failed update check should not crash
// the app. Updates only run in packaged builds — `app.isPackaged` guards
// against pulling a release manifest while developing.
if (!isDev) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    // Non-fatal. Use console rather than a logger import so we don't pull
    // renderer deps into the main bundle.
    console.error('[autoUpdater] error', err);
  });

  ipcMain.on('install-update', () => {
    // `quitAndInstall` bypasses our `close → hide to tray` trap because it
    // calls `app.exit` internally; the `before-quit` handler still runs
    // first so `quittingForReal` flips on. Belt and suspenders: set it
    // here too in case Electron skips the lifecycle event.
    quittingForReal = true;
    autoUpdater.quitAndInstall();
  });

  // Initial check happens once the app is ready. We use `checkForUpdates`
  // (not `checkForUpdatesAndNotify`) because the renderer now owns the UI;
  // the built-in OS toast that `…AndNotify` shows would be a duplicate.
  app.whenReady().then(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[autoUpdater] initial check failed', err);
    });
  });
}
