const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),

  // Window state events
  onMaximizeChanged: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window-maximized-changed', handler);
    return () => ipcRenderer.removeListener('window-maximized-changed', handler);
  },

  // Secure storage API
  secureStorage: {
    set: (key, value) => ipcRenderer.invoke('secure-storage-set', key, value),
    get: (key) => ipcRenderer.invoke('secure-storage-get', key),
    delete: (key) => ipcRenderer.invoke('secure-storage-delete', key)
  }
});

// Handle SPA navigation commands from main process

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
const preloadLevelStyles = {
  info: {
    label: colors.bgGreen + colors.black,
    icon: '🌟',
    text: colors.green
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
    icon: '🛑',
    text: colors.red
  }
};

// Enhanced logging for preload script with CLI-style colors
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const style = preloadLevelStyles[level] || preloadLevelStyles.info;
  const levelUpper = level.toUpperCase();

  // Format: [Timestamp][PRELOAD-LEVEL] Message
  const formattedMessage = [
    colors.dim + '[' + timestamp + ']' + colors.reset,
    colors.magenta + '[PRELOAD]' + colors.reset,
    ' ' + style.label + ' ' + style.icon + ' ' + levelUpper + ' ' + colors.reset,
    style.text + message + colors.reset
  ].join('');

  console.log(formattedMessage, ...args);
};

// Suppress harmless DevTools autofill errors in Electron
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out harmless DevTools autofill errors
  const message = typeof args[0] === 'string' ? args[0] : '';

  if (message.includes('Request Autofill.enable failed') ||
      message.includes('Request Autofill.setAddresses failed') ||
      message.includes("Autofill.enable' wasn't found") ||
      message.includes("Autofill.setAddresses' wasn't found")) {
    // Suppress these harmless warnings - they're expected in Electron
    log('debug', 'Suppressed harmless DevTools autofill warning');
    return;
  }

  // Pass through all other errors
  originalConsoleError.apply(console, args);
};

log('info', 'Preload script initialized');

// Log initial setup
log('debug', 'Electron API available:', typeof window !== 'undefined' && !!window.electronAPI);
log('debug', 'Platform:', process.platform);

// Listen for SPA navigation commands
ipcRenderer.on('spa-navigate', (event, navigationData) => {
  log('info', 'Received SPA navigation command:', navigationData);

  try {
    // Trigger SPA navigation using React Router history
    if (navigationData.pathname && window.history) {
      // Use window.history.pushState for programmatic navigation
      const newUrl = navigationData.pathname;
      const oldUrl = window.location.pathname;

      log('debug', `Navigating from ${oldUrl} to ${newUrl}`);

      // Use the browser's history API to trigger React Router navigation
      window.history.pushState(null, '', newUrl);

      // Dispatch a custom event that React Router can listen to
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

      log('info', 'Navigation command executed successfully');
    } else {
      log('warn', 'Invalid navigation data received:', navigationData);
    }
  } catch (error) {
    log('error', 'Failed to execute navigation command:', error);
  }
});

// Log window control IPC operations
const originalInvoke = window.electronAPI?.secureStorage?.set;
if (originalInvoke) {
  const instrumentedStorage = {
    set: async (key, value) => {
      log('debug', `Storage SET: ${key}`);
      try {
        const result = await originalInvoke(key, value);
        log('debug', `Storage SET result for ${key}: ${result}`);
        return result;
      } catch (error) {
        log('error', `Storage SET failed for ${key}:`, error);
        throw error;
      }
    },
    get: async (key) => {
      log('debug', `Storage GET: ${key}`);
      try {
        const result = await window.electronAPI.secureStorage.get(key);
        log('debug', `Storage GET result for ${key}: ${result ? 'found' : 'not found'}`);
        return result;
      } catch (error) {
        log('error', `Storage GET failed for ${key}:`, error);
        throw error;
      }
    },
    delete: async (key) => {
      log('debug', `Storage DELETE: ${key}`);
      try {
        const result = await window.electronAPI.secureStorage.delete(key);
        log('debug', `Storage DELETE result for ${key}: ${result}`);
        return result;
      } catch (error) {
        log('error', `Storage DELETE failed for ${key}:`, error);
        throw error;
      }
    }
  };

  // Replace with instrumented versions
  window.electronAPI.secureStorage = instrumentedStorage;
  log('debug', 'Storage operations instrumented with logging');
}

log('info', 'Preload script setup complete');
