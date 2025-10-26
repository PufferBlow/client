import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes for enhanced CLI-style logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright text colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',

  // Special effects
  underline: '\x1b[4m',
  blink: '\x1b[5m'
};

// Level to color mapping for CLI-style output
const levelStyles = {
  info: {
    label: colors.bgBlue + colors.white,
    icon: 'ℹ',
    text: colors.blue
  },
  debug: {
    label: colors.bgCyan + colors.black,
    icon: '🔍',
    text: colors.cyan
  },
  warn: {
    label: colors.bgYellow + colors.black,
    icon: '⚠',
    text: colors.yellow
  },
  error: {
    label: colors.bgRed + colors.white,
    icon: '❌',
    text: colors.red
  }
};

// Enhanced logging for desktop version with CLI-style colors
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const style = levelStyles[level] || levelStyles.info;
  const levelUpper = level.toUpperCase();

  // Format: [Timestamp] [LEVEL] Message
  const formattedMessage = [
    colors.dim + '[' + timestamp + ']' + colors.reset,
    ' ' + style.label + ' ' + style.icon + ' ' + levelUpper + ' ' + colors.reset,
    style.text + message + colors.reset
  ].join('');

  console.log(formattedMessage, ...args);

  // In production, you might want to write to file instead
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement file logging for production
  }
};

log('info', 'Electron main process starting...');
log('info', 'Platform:', process.platform);
log('info', 'Electron version:', process.versions.electron);
log('info', 'Node version:', process.versions.node);
log('info', 'Architecture:', process.arch);
log('info', 'Process ID:', process.pid);

// Check for D-Bus and portal services (Linux-specific)
if (process.platform === 'linux') {
  log('debug', 'Checking D-Bus and portal services...');

  // Check environment variables for Wayland/X11
  log('debug', 'XDG_SESSION_TYPE:', process.env.XDG_SESSION_TYPE || 'not set');
  log('debug', 'XDG_CURRENT_DESKTOP:', process.env.XDG_CURRENT_DESKTOP || 'not set');
  log('debug', 'GDMSESSION:', process.env.GDMSESSION || 'not set');
  log('debug', 'DESKTOP_SESSION:', process.env.DESKTOP_SESSION || 'not set');

  // Check for portal availability
  try {
    log('debug', 'D-Bus portal availability check - wrote log to track this');
    // Note: We can't actually test D-Bus here from Node.js
    // but we can log that the error will be reported by Electron
  } catch (error) {
    log('warn', 'Portal availability check failed:', error.message);
  }
}

// App initialization functions will be called after app is ready

// Secure config file path
const getConfigFilePath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'secure-config.json');
};

// Encrypt/decrypt helper functions
const encryptData = (data) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  return safeStorage.encryptString(data);
};

const decryptData = (encryptedData) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  return safeStorage.decryptString(encryptedData);
};

// Secure config operations
const saveSecureConfig = (key, value) => {
  try {
    const configPath = getConfigFilePath();
    let config = {};

    // Load existing config
    if (fs.existsSync(configPath)) {
      try {
        const encryptedConfig = fs.readFileSync(configPath);
        const decryptedConfig = decryptData(encryptedConfig).toString();
        config = JSON.parse(decryptedConfig);
      } catch (error) {
        // If we can't decrypt, start with empty config
        console.warn('Could not decrypt existing config, starting fresh:', error.message);
        config = {};
      }
    }

    // Update config
    config[key] = value;

    // Save encrypted config
    const configJson = JSON.stringify(config);
    const encryptedConfig = encryptData(configJson);
    fs.writeFileSync(configPath, encryptedConfig);

    return true;
  } catch (error) {
    console.error('Failed to save secure config:', error);
    return false;
  }
};

const loadSecureConfig = (key) => {
  try {
    const configPath = getConfigFilePath();

    if (!fs.existsSync(configPath)) {
      return null;
    }

    const encryptedConfig = fs.readFileSync(configPath);
    const decryptedConfig = decryptData(encryptedConfig).toString();
    const config = JSON.parse(decryptedConfig);

    return config[key] || null;
  } catch (error) {
    console.error('Failed to load secure config:', error);
    return null;
  }
};

let mainWindow;

function createWindow() {
  log('info', 'Creating main browser window...');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js') // optional preload script
    },
    frame: false, // Remove system window frame
    titleBarStyle: 'hidden', // macOS title bar style
    icon: path.join(__dirname, 'build/client/favicon.ico'), // or use one of the png files
    show: false, // Don't show until ready-to-show
  });

  // Window control handlers
  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    mainWindow.maximize();
  });

  ipcMain.handle('window-toggle-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow.isMaximized();
  });

  // Secure storage IPC handlers
  ipcMain.handle('secure-storage-set', async (event, key, value) => {
    log('debug', `Secure storage SET request: key=${key}, valueLength=${value?.length || 0}`);
    try {
      const result = key === 'auth_token'
        ? (() => {
            log('info', 'Encrypting and storing auth token...');
            try {
              const encrypted = encryptData(value);
              const result = saveSecureConfig(key, encrypted.toString('base64'));
              log('info', 'Auth token encrypted and stored securely');
              return result;
            } catch (error) {
              log('warn', 'Encryption failed, storing unencrypted:', error.message);
              return saveSecureConfig(key, value);
            }
          })()
        : (() => {
            const result = saveSecureConfig(key, value);
            log('debug', `${key} stored in secure config`);
            return result;
          })();
      return result;
    } catch (error) {
      log('error', `Secure storage SET failed for key=${key}:`, error);
      return false;
    }
  });

  ipcMain.handle('secure-storage-get', async (event, key) => {
    log('debug', `Secure storage GET request: key=${key}`);
    try {
      if (key === 'auth_token') {
        log('debug', 'Decrypting auth token...');
        const encryptedBase64 = loadSecureConfig(key);
        if (encryptedBase64) {
          const encrypted = Buffer.from(encryptedBase64, 'base64');
          const decrypted = decryptData(encrypted);
          log('info', 'Auth token decrypted successfully');
          return decrypted;
        } else {
          log('debug', 'No auth token found in storage');
          return null;
        }
      } else {
        const value = loadSecureConfig(key);
        log('debug', `${key} retrieved from secure config: ${value ? 'present' : 'null'}`);
        return value;
      }
    } catch (error) {
      log('error', `Secure storage GET failed for key=${key}:`, error);
      return null;
    }
  });

  ipcMain.handle('secure-storage-delete', async (event, key) => {
    try {
      const configPath = getConfigFilePath();
      if (!fs.existsSync(configPath)) {
        return true; // Already doesn't exist
      }

      let config = {};
      try {
        const encryptedConfig = fs.readFileSync(configPath);
        const decryptedConfig = decryptData(encryptedConfig).toString();
        config = JSON.parse(decryptedConfig);
      } catch (error) {
        return false;
      }

      // Remove the key
      delete config[key];

      // Save updated config
      const configJson = JSON.stringify(config);
      const encryptedConfig = encryptData(configJson);
      fs.writeFileSync(configPath, encryptedConfig);

      return true;
    } catch (error) {
      console.error('Failed to delete from secure config:', error);
      return false;
    }
  });

  // Send window state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-changed', false);
  });

  // Intercept navigation to web-only routes in desktop app
  mainWindow.webContents.on('will-navigate', async (event, url) => {
    log('debug', `Navigation intercepted: ${url}`);
    try {
      // Only intercept if we're loading the local build (desktop app)
      // This prevents interfering with external links
      if (!url.startsWith('file://')) {
        // For external URLs, check if it's our web-only routes
        const urlObj = new URL(url);
        const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';

        if (!isLocalhost || !urlObj.pathname.startsWith('/')) {
          log('debug', 'External navigation allowed');
          // Allow external navigation
          return;
        }
      }

      // Check pathname for web-only routes
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Web-only routes that should be blocked in desktop
      if (['/home', '/download'].includes(pathname)) {
        log('info', `Intercepted web-only route: ${pathname}, preventing navigation`);
        event.preventDefault();

        // Check authentication status to decide where to navigate
        try {
          log('debug', 'Checking authentication status for route redirection...');
          // Get authentication status from secure storage
          const hasAuthToken = await loadSecureConfig('auth_token');
          const targetRoute = hasAuthToken ? '/dashboard' : '/login';

          log('info', `Redirecting from ${pathname} to ${targetRoute} (${hasAuthToken ? 'authenticated' : 'unauthenticated'})`);

          // Send SPA navigation command to renderer
          mainWindow.webContents.send('spa-navigate', { pathname: targetRoute });

        } catch (error) {
          log('error', 'Failed to check auth status for route interception:', error);
          // Fallback to login page
          mainWindow.webContents.send('spa-navigate', { pathname: '/login' });
        }
      } else {
        log('debug', `Navigation to ${pathname} allowed`);
      }
    } catch (error) {
      log('error', 'Failed to handle will-navigate event:', error);
      // Allow navigation to proceed if there's an error
    }
  });

  // Load the app with initial route based on authentication
  if (process.env.NODE_ENV === 'development') {
    log('info', 'Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173'); // Load the full app in dev
  } else {
    log('info', 'Loading production file:', path.join(__dirname, 'build/client/index.html'));

    // Check authentication to determine initial route
    loadSecureConfig('auth_token').then(hasAuthToken => {
      const initialRoute = hasAuthToken ? '#dashboard' : '#login';

      log('info', `Desktop app will start at: ${initialRoute.replace('#', '/')}`);

      // Load file with hash for initial route
      mainWindow.loadFile(path.join(__dirname, 'build/client/index.html'), {
        search: initialRoute
      });
    }).catch(error => {
      log('warn', 'Failed to check auth for initial route, defaulting to login');
      // Fallback to login if we can't check auth
      mainWindow.loadFile(path.join(__dirname, 'build/client/index.html'), {
        search: '#login'
      });
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    log('info', 'Window ready to show, displaying main window');
    mainWindow.show();
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    log('info', 'Main window closed');
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    log('debug', 'Opening DevTools in development mode');
    mainWindow.webContents.openDevTools();
  }

  log('info', 'Main window created successfully');
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
