import { Tray, Menu, MenuItem, BrowserWindow, app, ipcMain, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';

let tray: Tray | null = null;
let notificationsMuted = false;
let unreadCount = 0;
let muteStatePath: string | null = null;
let currentWindow: BrowserWindow | null = null;

/**
 * Single source of truth for tray-related callbacks the renderer can
 * subscribe to / push to.
 */
export interface TrayBridge {
  /** Renderer → main: latest unread badge count. */
  setUnreadCount: (count: number) => void;
  /** Main → renderer: notifications-muted state changed (user toggled). */
  notifyMutedChanged: (muted: boolean) => void;
  /** Latest known muted state, e.g. for the renderer to read at boot. */
  getMuted: () => boolean;
}

const resolveMuteStatePath = (): string => {
  if (muteStatePath) return muteStatePath;
  muteStatePath = path.join(app.getPath('userData'), 'tray-state.json');
  return muteStatePath;
};

/**
 * Persist `notificationsMuted` so a tray menu toggle survives across app
 * restarts. Failures are swallowed — losing this state is annoying, not
 * critical, so we don't surface IO errors to the user.
 */
const persistMuteState = (): void => {
  try {
    fs.writeFileSync(
      resolveMuteStatePath(),
      JSON.stringify({ notificationsMuted }),
      'utf8',
    );
  } catch {
    // Ignore — the tray menu will still reflect the in-memory state for
    // this session; we just won't remember across launches.
  }
};

const loadMuteState = (): void => {
  try {
    const raw = fs.readFileSync(resolveMuteStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as { notificationsMuted?: boolean };
    notificationsMuted = Boolean(parsed.notificationsMuted);
  } catch {
    notificationsMuted = false;
  }
};

/**
 * Format the tray tooltip. Includes the unread badge so users can hover
 * the tray icon to see at a glance whether they have unread mentions.
 */
const buildTooltip = (): string => {
  const base = 'Pufferblow';
  if (unreadCount > 0) {
    return `${base} — ${unreadCount} unread`;
  }
  return notificationsMuted ? `${base} — notifications muted` : base;
};

/**
 * Push the unread count into the OS-native badge surface. Each platform
 * exposes a different mechanism:
 *
 * - macOS: `app.dock.setBadge('N')` (also covers Linux Unity / KDE
 *   variants that honor the Dock API)
 * - Windows: `BrowserWindow.setOverlayIcon` with a small numeric overlay.
 *   Windows doesn't have a real dock-badge concept, so we settle for the
 *   taskbar overlay icon, which is the closest equivalent.
 * - Linux (no Unity): tooltip update only.
 *
 * Errors from the OS surface are non-fatal; we always update the tooltip.
 */
const applyBadgeToOS = (window: BrowserWindow | null): void => {
  const platform = process.platform;
  try {
    if (platform === 'darwin' && app.dock) {
      app.dock.setBadge(unreadCount > 0 ? String(unreadCount) : '');
    }
  } catch {
    // Some macOS sandbox configs reject setBadge; non-fatal.
  }

  try {
    if (platform === 'win32' && window && !window.isDestroyed()) {
      if (unreadCount > 0) {
        // Build a tiny 16x16 overlay with the count rendered as text. We
        // do this via a data URL SVG so we don't need to ship a per-count
        // PNG set.
        const text = unreadCount > 99 ? '99+' : String(unreadCount);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
  <circle cx="8" cy="8" r="8" fill="#ef4444"/>
  <text x="8" y="11" font-size="9" font-family="Segoe UI, Arial" font-weight="700"
    text-anchor="middle" fill="white">${text}</text>
</svg>`;
        const overlay = nativeImage.createFromDataURL(
          `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        );
        window.setOverlayIcon(overlay, `${unreadCount} unread notifications`);
      } else {
        window.setOverlayIcon(null, '');
      }
    }
  } catch {
    // setOverlayIcon can throw on minimized windows in rare cases; ignore.
  }

  if (tray) {
    tray.setToolTip(buildTooltip());
  }
};

/**
 * Build the dynamic context menu. Rebuilt on every state change so labels
 * (e.g. "Mute notifications" → "Unmute notifications") and the unread
 * counter row stay accurate.
 */
const rebuildContextMenu = (window: BrowserWindow): void => {
  if (!tray) return;

  const items: (MenuItem | Electron.MenuItemConstructorOptions)[] = [
    {
      label: window.isVisible() ? 'Hide Pufferblow' : 'Open Pufferblow',
      click: () => {
        if (window.isVisible()) {
          window.hide();
        } else {
          window.show();
          window.focus();
        }
      },
    },
  ];

  if (unreadCount > 0) {
    items.push({
      label: `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`,
      enabled: false,
    });
  }

  items.push({ type: 'separator' });
  items.push({
    label: notificationsMuted ? 'Unmute notifications' : 'Mute notifications',
    type: 'normal',
    click: () => {
      notificationsMuted = !notificationsMuted;
      persistMuteState();
      rebuildContextMenu(window);
      applyBadgeToOS(window);
      window.webContents.send('notifications-muted-changed', notificationsMuted);
    },
  });
  items.push({ type: 'separator' });
  items.push({ label: 'Quit', click: () => app.exit(0) });

  tray.setContextMenu(Menu.buildFromTemplate(items));
};

export function createTray(mainWindow: BrowserWindow) {
  currentWindow = mainWindow;
  loadMuteState();

  const iconPath = path.join(__dirname, '..', 'resources', 'icons', 'icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));

  tray.setToolTip(buildTooltip());
  rebuildContextMenu(mainWindow);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    rebuildContextMenu(mainWindow);
  });

  mainWindow.on('show', () => rebuildContextMenu(mainWindow));
  mainWindow.on('hide', () => rebuildContextMenu(mainWindow));

  // Renderer pushes its current unread count after every WS event /
  // notification load. Clamp at 0; negative would be a bug worth ignoring.
  ipcMain.on('set-unread-count', (_event, raw: unknown) => {
    const next = Math.max(0, Math.floor(Number(raw) || 0));
    if (next === unreadCount) return;
    unreadCount = next;
    applyBadgeToOS(mainWindow);
    rebuildContextMenu(mainWindow);
  });

  // Renderer asks for the current muted state (called on app boot so the
  // dashboard knows whether to suppress the desktopNotifications dispatch
  // path even before the user touches the tray menu).
  ipcMain.handle('get-notifications-muted', () => notificationsMuted);

  // Renderer-triggered mute toggle. Mirrors the tray menu item so a
  // future in-app setting can use the same path.
  ipcMain.on('set-notifications-muted', (_event, muted: unknown) => {
    const next = Boolean(muted);
    if (next === notificationsMuted) return;
    notificationsMuted = next;
    persistMuteState();
    rebuildContextMenu(mainWindow);
    applyBadgeToOS(mainWindow);
    mainWindow.webContents.send('notifications-muted-changed', notificationsMuted);
  });

  applyBadgeToOS(mainWindow);
}

export function setTrayBadge(count: number) {
  unreadCount = Math.max(0, Math.floor(count));
  applyBadgeToOS(currentWindow);
}
