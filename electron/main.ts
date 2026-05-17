import { app, BrowserWindow, ipcMain, protocol, net, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import { createTray } from './tray';

const isDev = !app.isPackaged;
const PROD_INDEX = path.join(__dirname, '..', 'build', 'client', 'index.html');

// ── Main-process settings file ───────────────────────────────────────
//
// A tiny JSON blob in the userData directory that holds main-process-
// only preferences -- things the renderer can toggle but that must
// take effect BEFORE the renderer mounts (or even before app.ready).
// Hardware acceleration is the only field today; the structure is
// designed to grow as we add more "needs-restart" toggles.
//
// File reads/writes are synchronous on purpose: the startup read
// must complete before `app.disableHardwareAcceleration()` is
// called, which itself must happen before `app.whenReady()`. The
// async API would be impossible to await here.
interface MainSettings {
  /**
   * `false` (default) -> we call `app.disableHardwareAcceleration()`
   * on startup. `true` -> we let Electron's default behaviour stand
   * and the GPU process renders the page. Changes require a full
   * app restart; the renderer surfaces that.
   */
  hardwareAccelerationEnabled?: boolean;
}

const mainSettingsFilePath = path.join(app.getPath('userData'), 'main-settings.json');

function readMainSettings(): MainSettings {
  try {
    const raw = fs.readFileSync(mainSettingsFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MainSettings) : {};
  } catch {
    // File missing / malformed / permission issue -> defaults. Never
    // throw at startup just because settings are corrupt; we'd brick
    // the app in a way the user can't recover from without nuking
    // their profile directory.
    return {};
  }
}

function writeMainSettings(settings: MainSettings): void {
  try {
    fs.mkdirSync(path.dirname(mainSettingsFilePath), { recursive: true });
    fs.writeFileSync(mainSettingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    // Settings write is best-effort. If it fails we log + continue
    // -- the user's setting won't persist across restart but the
    // current session is unaffected.
    console.error('Failed to write main settings', err);
  }
}

// Apply hardware-acceleration preference BEFORE app.whenReady().
// Default is "disabled" -- enabling means the user has explicitly
// opted in via the Settings page.
const startupMainSettings = readMainSettings();
if (!startupMainSettings.hardwareAccelerationEnabled) {
  app.disableHardwareAcceleration();
}

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

  // Hardware-acceleration toggle. The Settings page calls these to
  // read the current preference + persist a change. The actual
  // `app.disableHardwareAcceleration()` call already happened at
  // module load (see top of file); the renderer informs the user
  // that a change requires a restart to take effect.
  ipcMain.handle('get-hardware-acceleration', () => {
    return readMainSettings().hardwareAccelerationEnabled ?? false;
  });
  ipcMain.handle('set-hardware-acceleration', (_event, enabled: boolean) => {
    const settings = readMainSettings();
    settings.hardwareAccelerationEnabled = !!enabled;
    writeMainSettings(settings);
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
// electron-updater pulls release manifests directly from the project's
// GitHub Releases (see `publish:` in electron-builder.yml). We forward
// every lifecycle event into the renderer so a React component (see
// `UpdateBanner.tsx`) can show "an update is available", a progress bar
// while it downloads, and finally a "restart now" prompt. The renderer
// answers with `install-update` to trigger `quitAndInstall` from the
// main process (the renderer can't drive the squirrel restart directly).
//
// All updater failures are non-fatal — a network blip on the GitHub feed
// must not crash the app. Updates only run in packaged builds; in dev we
// short-circuit the whole block so `app.isPackaged` doesn't fight a
// pretend-version like `1.0.0` against the live release feed.
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

if (!isDev) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Re-poll the GitHub feed every 6h while the app is running. The
  // initial check happens immediately on whenReady (below); this
  // covers long-lived sessions where the user never quits.
  let periodicCheckTimer: NodeJS.Timeout | null = null;

  // Small helper so every dispatched event has the same shape: a
  // `type` tag plus an opaque `payload`. Lets the renderer route
  // through a single subscription if it wants, without juggling six
  // channel names.
  const sendUpdateEvent = (channel: string, payload: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent('update-checking', { startedAt: new Date().toISOString() });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent('update-available', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    // Useful for a "you're up to date" toast after a manual check.
    // Auto-checks shouldn't surface this — the renderer decides.
    sendUpdateEvent('update-not-available', info);
  });
  autoUpdater.on('download-progress', (progress) => {
    // `progress` shape (from electron-updater):
    //   { percent, transferred, total, bytesPerSecond, delta }
    sendUpdateEvent('update-download-progress', progress);
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('update-downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    // Non-fatal. Use console rather than a logger import so we don't
    // pull renderer deps into the main bundle. Forward a minimal
    // shape — `Error` objects don't survive structured-clone with
    // their stack intact, and the renderer only needs the message
    // for its toast/banner.
    console.error('[autoUpdater] error', err);
    sendUpdateEvent('update-error', {
      message: err instanceof Error ? err.message : String(err),
    });
  });

  ipcMain.on('install-update', () => {
    // `quitAndInstall` bypasses our `close → hide to tray` trap
    // because it calls `app.exit` internally; the `before-quit`
    // handler still runs first so `quittingForReal` flips on. Belt
    // and suspenders: set it here too in case Electron skips the
    // lifecycle event.
    quittingForReal = true;
    autoUpdater.quitAndInstall();
  });

  // Renderer-initiated check (e.g. a "Check for updates" button in
  // Settings). Wrapped because `checkForUpdates` returns a rejecting
  // promise on transient network errors and we don't want those
  // bubbling into an `unhandledRejection` log.
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, version: result?.updateInfo?.version ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[autoUpdater] manual check failed', message);
      return { ok: false, error: message };
    }
  });

  // Initial check + periodic poll. Using `checkForUpdates` (not
  // `checkForUpdatesAndNotify`) because the renderer now owns the
  // UI; the built-in OS toast that `…AndNotify` shows would be a
  // duplicate.
  app.whenReady().then(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[autoUpdater] initial check failed', err);
    });
    periodicCheckTimer = setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[autoUpdater] periodic check failed', err);
      });
    }, UPDATE_CHECK_INTERVAL_MS);
  });

  app.on('before-quit', () => {
    if (periodicCheckTimer) {
      clearInterval(periodicCheckTimer);
      periodicCheckTimer = null;
    }
  });
}
