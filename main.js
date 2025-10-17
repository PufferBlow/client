import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js') // optional preload script
    },
    icon: path.join(__dirname, 'build/client/favicon.ico') // or use one of the png files
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173'); // Load the full app in dev
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build/client/index.html'));
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
