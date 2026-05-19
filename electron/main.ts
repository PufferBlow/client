import { app, BrowserWindow, ipcMain, protocol, net, session, shell } from 'electron';
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
  /**
   * `true` (default) -> the auto-updater downloads new releases in
   * the background as soon as they appear in the release feed. The
   * splash shows the download progress at boot and the UpdateBanner
   * surfaces "restart now" when the bundle is ready.
   *
   * `false` -> we keep CHECKING (the feed needs to surface "an
   * update exists" to the renderer) but we do NOT call
   * `autoUpdater.downloadUpdate()` automatically. The renderer's
   * title bar exposes a download button so the user opts in
   * explicitly per release.
   */
  autoUpdateEnabled?: boolean;
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

// ── Chromium startup switches ───────────────────────────────────────
//
// Disable Chromium's Private Network Access (PNA) preflight requirement.
//
// Why this is necessary:
//   In packaged builds the renderer loads from `app://pufferblow/`,
//   registered as a secure scheme below. From Chromium's point of view
//   that origin is "secure non-local", so any fetch the renderer makes
//   to a private-network address (localhost, 127.0.0.1, 10/8, 172.16/12,
//   192.168/16) first triggers a CORS-preflight `OPTIONS` request with
//   the header `Access-Control-Request-Private-Network: true`. The
//   target server has to acknowledge with
//   `Access-Control-Allow-Private-Network: true` or Chromium silently
//   drops the actual request — the renderer just sees "Failed to fetch"
//   with no further detail.
//
//   The Pufferblow server's CORS middleware does not emit that header.
//   In dev this never bites because the renderer itself is loaded from
//   `http://localhost:5173`, which Chromium classifies as private — and
//   PNA only fires when the *initiator* is non-private. So the bug only
//   appears in packaged builds and only when reaching a local-network
//   instance.
//
//   Disabling the feature here lets the request go straight through.
//   This affects every site the renderer can reach, but the renderer is
//   only ever loaded from `app://pufferblow/`, which has no third-party
//   content — there is no scenario in which a malicious page could
//   exploit the relaxed PNA policy to talk to a local service that
//   wasn't meant for it.
//
//   Long-term, server-side support for the PNA preflight is the right
//   fix; this switch can go away when every Pufferblow release in the
//   wild answers the preflight.
//
// Must be called before `app.whenReady()`.
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
);

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
let splashWindow: BrowserWindow | null = null;
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

/**
 * Tiny splash window that fronts the app while:
 *   1. the renderer bundle parses + the React tree mounts, and
 *   2. the auto-updater performs its first GitHub release check.
 *
 * Frameless, transparent, always-on-top, no taskbar entry. The
 * window stays alive until the main window emits `ready-to-show`
 * (or, as a safety net, until a 6s timeout fires — we never want
 * a stuck splash to keep the user from reaching the app).
 *
 * Status copy is updated via `executeJavaScript` so we don't have
 * to set up a preload for a 1-second window. The HTML exposes a
 * tiny `__pbSetSplashStatus` shim for that purpose.
 */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    show: true,
    backgroundColor: '#00000000',
    title: 'Pufferblow',
    icon: path.join(__dirname, '..', 'resources', 'icons', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.setMenuBarVisibility(false);
  splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch((err) => {
    // Splash failing to load shouldn't gate the actual app boot;
    // log and let `createWindow` proceed as if no splash existed.
    console.error('[splash] failed to load splash.html', err);
    splashWindow?.destroy();
    splashWindow = null;
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

/**
 * Push a status line into the splash window. Safe to call before
 * the page has finished loading — `executeJavaScript` queues until
 * `did-finish-load`. Best-effort; we silently swallow errors so a
 * crashed splash can't block the main flow.
 */
function setSplashStatus(text: string): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const safe = text.replace(/[\\'"]/g, ' ');
  splashWindow.webContents
    .executeJavaScript(`window.__pbSetSplashStatus && window.__pbSetSplashStatus('${safe}')`)
    .catch(() => {
      // Swallow — splash may have already been destroyed.
    });
}

/**
 * Push a progress percent into the splash window's progress bar.
 *
 * Pass `null` to revert to the indeterminate animation (the comet
 * sliding across the track). Pass 0..100 for a determinate fill.
 * Safe to call on every download-progress tick — the splash's CSS
 * transition keeps the bar from jittering.
 */
function setSplashProgress(percent: number | null): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const arg = percent === null || percent === undefined ? 'null' : Number(percent);
  splashWindow.webContents
    .executeJavaScript(`window.__pbSetSplashProgress && window.__pbSetSplashProgress(${arg})`)
    .catch(() => {
      // Swallow — splash may have already been destroyed.
    });
}

/**
 * Hide + destroy the splash window. Done with a brief fade-out by
 * dropping the opacity before destroying, so the transition into
 * the main window doesn't snap. Safe to call multiple times.
 */
function dismissSplashWindow(): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const target = splashWindow;
  splashWindow = null;
  try {
    target.setOpacity(0);
  } catch {
    // Some platforms (older Linux WMs) don't support setOpacity on
    // transparent windows -- not fatal, just skip the fade.
  }
  setTimeout(() => {
    if (!target.isDestroyed()) target.destroy();
  }, 180);
}

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
    // Defer the first paint until the renderer is ready. Without
    // this, Electron flashes a blank white (or black-themed) window
    // for ~500-1500ms while the React tree mounts. With `show:
    // false` + the `ready-to-show` handler below, the user only
    // ever sees the splash followed by the fully-rendered app.
    show: false,
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

  // External-link policy:
  //
  // Anything that isn't part of the app — a link to a docs page,
  // someone's profile, a YouTube embed — should open in the user's
  // default browser rather than swallowing it inside an Electron
  // BrowserWindow. Two surfaces leak otherwise:
  //
  //   1. `<a target="_blank">` and `window.open(...)` ask Electron to
  //      pop a new BrowserWindow. We intercept those with
  //      `setWindowOpenHandler` and hand the URL to the OS shell.
  //
  //   2. A regular `<a href="https://…">` click without a target tries
  //      to navigate the renderer itself away from app:// to the
  //      external origin. The `will-navigate` listener cancels that
  //      and routes the URL externally instead, so the renderer stays
  //      on the Pufferblow app.
  //
  // The whitelist treats `app://`, `http://localhost`, and
  // `http://127.0.0.1` as "in-app" so the dev server reload and
  // future in-app navigations still work. Everything else goes to
  // the OS browser. `pufferblow://` deep links are skipped — they're
  // handled by the protocol registration further up and shouldn't
  // round-trip through the OS.
  const isInternalUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('app://')) return true;
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return true;
    }
    if (url.startsWith(`${PROTOCOL}://`)) return true;
    return false;
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('[external-link] failed to open', url, err);
      });
    }
    // Never let Electron create a child BrowserWindow for popups —
    // we either delegated to the OS or silently dropped a scheme we
    // don't recognize (file://, javascript:, etc.) rather than
    // popping a hostile window.
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url).catch((err) => {
        console.error('[external-link] failed to open', url, err);
      });
    }
  });

  // `ready-to-show` fires after the renderer has painted at least
  // one frame -- the canonical Electron signal that it's safe to
  // reveal the window without flashing blank chrome.
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    dismissSplashWindow();
  });

  // Safety net: if the renderer never reaches ready-to-show (a
  // crash early in mount, a long-running blocking call), we still
  // promote the main window after 6s so the user isn't trapped
  // looking at the splash forever.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    dismissSplashWindow();
  }, 6000);

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

  // Splash first, then main window. The splash paints inside
  // ~50ms; the main window's renderer takes longer to mount, so
  // we get the user-perceived-fast launch even when the React
  // bundle parse is slow.
  createSplashWindow();
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

  // Auto-update preference. Default is ON (autoUpdate enabled) so an
  // unmodified install keeps itself current. The Settings page can
  // flip it OFF, after which the user has to click the title-bar
  // download button per release. The handler also flips
  // `autoUpdater.autoDownload` live so a toggle during the same
  // session takes effect without requiring a restart.
  ipcMain.handle('get-auto-update-enabled', () => {
    return readMainSettings().autoUpdateEnabled ?? true;
  });
  ipcMain.handle('set-auto-update-enabled', (_event, enabled: boolean) => {
    const settings = readMainSettings();
    settings.autoUpdateEnabled = !!enabled;
    writeMainSettings(settings);
    autoUpdater.autoDownload = !!enabled;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-update-enabled-changed', !!enabled);
    }
  });

  // Renderer-driven manual download. Only meaningful when
  // autoUpdate is OFF — when it's ON, autoUpdater.downloadUpdate
  // has already kicked off in the background. The handler is
  // tolerant about being called either way (the second
  // downloadUpdate is a no-op when one is in flight).
  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[autoUpdater] manual downloadUpdate failed', message);
      return { ok: false, error: message };
    }
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
  // Auto-download tracks the user's preference. ON by default (a
  // fresh install keeps itself current); the renderer can flip it
  // OFF via `set-auto-update-enabled`, at which point new releases
  // arrive as a title-bar "download" button instead of a silent
  // background fetch.
  autoUpdater.autoDownload = readMainSettings().autoUpdateEnabled ?? true;
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
    // Surface the boot-time check on the splash status line so the
    // user knows what's happening during the launch wait.
    setSplashStatus('Checking for updates');
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent('update-available', info);
    setSplashStatus(`Update ${info?.version ?? ''} available`);
    // When auto-update is OFF the user has to click the title-bar
    // download button. Until they do, the splash shouldn't try to
    // show a download percent (there is no download), so reset to
    // indeterminate so the bar's comet animation keeps rolling.
    if (!autoUpdater.autoDownload) {
      setSplashProgress(null);
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    // Useful for a "you're up to date" toast after a manual check.
    // Auto-checks shouldn't surface this — the renderer decides.
    sendUpdateEvent('update-not-available', info);
    setSplashStatus('Up to date');
  });
  autoUpdater.on('download-progress', (progress) => {
    // `progress` shape (from electron-updater):
    //   { percent, transferred, total, bytesPerSecond, delta }
    sendUpdateEvent('update-download-progress', progress);
    if (progress && typeof progress.percent === 'number') {
      setSplashStatus(`Downloading update  ${Math.round(progress.percent)}%`);
      setSplashProgress(progress.percent);
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('update-downloaded', info);
    setSplashStatus('Update ready');
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
    // Don't surface the error on the splash — it's small and the
    // banner inside the app will show it once the main window is up.
    // Reset the status so we don't leave "Checking for updates"
    // stuck on screen.
    setSplashStatus('Loading');
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
