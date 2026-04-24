import { app, BrowserWindow, protocol, net, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { createTray } from './tray';

const isDev = !app.isPackaged;
const PROD_INDEX = path.join(__dirname, '..', 'build', 'client', 'index.html');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;

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
    event.preventDefault();
    mainWindow?.hide();
  });
}

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

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// App lives in tray — keep running when all windows are closed.
app.on('window-all-closed', () => {});

if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}
