/**
 * Secure Storage Service
 *
 * Provides secure storage for sensitive data in Electron apps and
 * falls back to browser storage for web apps.
 *
 * - Auth tokens: Encrypted using Electron safeStorage in desktop apps
 * - Config data: Encrypted config files in desktop apps
 * - Fallbacks: Cookies and localStorage for web apps
 */

interface SecureStorage {
  set(key: string, value: string): Promise<boolean>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<boolean>;
}

// Check if running in Electron
const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

// Electron secure storage implementation
class ElectronSecureStorage implements SecureStorage {
  async set(key: string, value: string): Promise<boolean> {
    try {
      if (!(window as any).electronAPI?.secureStorage) {
        console.warn('Electron secure storage not available');
        return false;
      }
      return await (window as any).electronAPI.secureStorage.set(key, value);
    } catch (error) {
      console.error('Failed to set secure storage value:', error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!(window as any).electronAPI?.secureStorage) {
        console.warn('Electron secure storage not available');
        return null;
      }
      return await (window as any).electronAPI.secureStorage.get(key);
    } catch (error) {
      console.error('Failed to get secure storage value:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (!(window as any).electronAPI?.secureStorage) {
        console.warn('Electron secure storage not available');
        return false;
      }
      return await (window as any).electronAPI.secureStorage.delete(key);
    } catch (error) {
      console.error('Failed to delete secure storage value:', error);
      return false;
    }
  }
}

// Web fallback storage using cookies for sensitive data and localStorage for config
class WebSecureStorage implements SecureStorage {
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);
    return cookies[name] || null;
  }

  private setCookie(name: string, value: string, expires?: Date): void {
    if (typeof document === 'undefined') return;
    let cookie = `${name}=${encodeURIComponent(value)}`;
    if (expires) {
      cookie += `; expires=${expires.toUTCString()}`;
    }
    cookie += '; path=/; SameSite=Strict';
    document.cookie = cookie;
  }

  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }

  async set(key: string, value: string): Promise<boolean> {
    try {
      if (key === 'auth_token') {
        // Use cookies for auth tokens with expiration
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
        this.setCookie(key, value, expires);
      } else if (key === 'host_port') {
        // Use localStorage for host/port (less sensitive)
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } else {
        // Use localStorage for other config
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to set web storage value:', error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (key === 'auth_token') {
        return this.getCookie(key);
      } else {
        // Try localStorage first, then sessionStorage
        if (typeof window !== 'undefined') {
          const value = localStorage.getItem(key) || sessionStorage.getItem(key);
          return value;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get web storage value:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (key === 'auth_token') {
        this.deleteCookie(key);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to delete web storage value:', error);
      return false;
    }
  }
}

// Factory function to get appropriate storage implementation
const getSecureStorage = (): SecureStorage => {
  return isElectron() ? new ElectronSecureStorage() : new WebSecureStorage();
};

// Export singleton instance
export const secureStorage = getSecureStorage();

// Export individual functions for backward compatibility
export const setSecureItem = (key: string, value: string): Promise<boolean> => {
  return secureStorage.set(key, value);
};

export const getSecureItem = (key: string): Promise<string | null> => {
  return secureStorage.get(key);
};

export const deleteSecureItem = (key: string): Promise<boolean> => {
  return secureStorage.delete(key);
};

// Migration helper - moves data from insecure to secure storage
export const migrateToSecureStorage = async (): Promise<void> => {
  if (!isElectron()) return; // Only migrate in desktop apps

  const secure = new ElectronSecureStorage();
  const web = new WebSecureStorage();

  // Migrate auth token
  const oldAuthToken = await web.get('auth_token');
  if (oldAuthToken) {
    const success = await secure.set('auth_token', oldAuthToken);
    if (success) {
      await web.delete('auth_token'); // Remove from cookies after successful migration
    }
  }

  // Migrate host_port
  const oldHostPort = await web.get('host_port');
  if (oldHostPort) {
    const success = await secure.set('host_port', oldHostPort);
    if (success) {
      await web.delete('host_port'); // Remove from localStorage
    }
  }
};
