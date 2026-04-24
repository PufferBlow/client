import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  const iconPath = path.join(__dirname, '..', 'resources', 'icons', 'icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Pufferblow', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.exit(0) },
  ]);

  tray.setToolTip('Pufferblow');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

export function setTrayBadge(_count: number) {
  // macOS: app.setBadgeCount(); Windows/Linux: overlay icon
  // Wire up when notification UI is added.
}
