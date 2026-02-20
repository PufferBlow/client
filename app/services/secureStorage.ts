/**
 * Secure Storage Service (Web/Tauri-friendly)
 *
 * Uses cookies for auth token and web storage for non-sensitive config.
 */

interface SecureStorage {
  set(key: string, value: string): Promise<boolean>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<boolean>;
}

class BrowserSecureStorage implements SecureStorage {
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
    if (expires) cookie += `; expires=${expires.toUTCString()}`;
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
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        this.setCookie(key, value, expires);
      } else if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return true;
    } catch (error) {
      console.error('Failed to set storage value:', error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (key === 'auth_token') return this.getCookie(key);
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (error) {
      console.error('Failed to get storage value:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (key === 'auth_token') {
        this.deleteCookie(key);
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error('Failed to delete storage value:', error);
      return false;
    }
  }
}

export const secureStorage: SecureStorage = new BrowserSecureStorage();

export const setSecureItem = (key: string, value: string): Promise<boolean> =>
  secureStorage.set(key, value);

export const getSecureItem = (key: string): Promise<string | null> =>
  secureStorage.get(key);

export const deleteSecureItem = (key: string): Promise<boolean> =>
  secureStorage.delete(key);

export const migrateToSecureStorage = async (): Promise<void> => {
  // No-op: legacy Electron migration removed.
};
