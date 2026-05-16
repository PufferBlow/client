import { describe, it, expect } from 'vitest';
import { parseDeepLink } from './deepLink';

describe('parseDeepLink', () => {
  describe('message permalinks', () => {
    it('maps pufferblow://m/<id> → /m/<id>', () => {
      expect(parseDeepLink('pufferblow://m/abc123')).toBe('/m/abc123');
    });

    it('ignores extra path segments past the id', () => {
      // /m/:messageId takes exactly one segment — extra segments would
      // produce a 404, so we drop them at parse time.
      expect(parseDeepLink('pufferblow://m/abc/extra')).toBe('/m/abc');
    });

    it('returns null when message id is missing', () => {
      expect(parseDeepLink('pufferblow://m')).toBeNull();
      expect(parseDeepLink('pufferblow://m/')).toBeNull();
    });
  });

  describe('dashboard', () => {
    it('maps bare dashboard host', () => {
      expect(parseDeepLink('pufferblow://dashboard')).toBe('/dashboard');
    });

    it('preserves trailing path', () => {
      expect(parseDeepLink('pufferblow://dashboard/server-x')).toBe('/dashboard/server-x');
    });

    it('preserves query string', () => {
      expect(parseDeepLink('pufferblow://dashboard?server=42')).toBe('/dashboard?server=42');
    });
  });

  describe('static routes', () => {
    it('maps settings, control-panel, and login', () => {
      expect(parseDeepLink('pufferblow://settings')).toBe('/settings');
      expect(parseDeepLink('pufferblow://control-panel')).toBe('/control-panel');
      expect(parseDeepLink('pufferblow://login')).toBe('/login');
    });
  });

  describe('rejection', () => {
    it('returns null for unknown hosts (allow-list, not deny)', () => {
      expect(parseDeepLink('pufferblow://admin/secret')).toBeNull();
      expect(parseDeepLink('pufferblow://api/users')).toBeNull();
    });

    it('returns null for wrong scheme', () => {
      expect(parseDeepLink('https://m/abc')).toBeNull();
      expect(parseDeepLink('javascript:alert(1)')).toBeNull();
    });

    it('returns null for malformed input', () => {
      expect(parseDeepLink('')).toBeNull();
      expect(parseDeepLink('pufferblow:')).toBeNull();
      expect(parseDeepLink('pufferblow://')).toBeNull();
      expect(parseDeepLink('not a url')).toBeNull();
    });

    it('returns null for non-string input', () => {
      // @ts-expect-error — testing runtime safety
      expect(parseDeepLink(null)).toBeNull();
      // @ts-expect-error — testing runtime safety
      expect(parseDeepLink(undefined)).toBeNull();
      // @ts-expect-error — testing runtime safety
      expect(parseDeepLink(123)).toBeNull();
    });
  });

  describe('safety', () => {
    it('encodes segments so traversal attempts cannot escape the route', () => {
      // `..` segments and odd chars get re-encoded; the parser doesn't
      // produce a path that React Router could interpret as a parent.
      const result = parseDeepLink('pufferblow://m/..%2Fadmin');
      // The result should still start with /m/ and treat the input as a single id.
      expect(result?.startsWith('/m/')).toBe(true);
      expect(result).not.toContain('/admin');
    });

    it('is case-insensitive on scheme and host', () => {
      expect(parseDeepLink('PUFFERBLOW://Dashboard')).toBe('/dashboard');
    });
  });
});
