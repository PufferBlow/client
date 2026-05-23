// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { logStore, redactString, redactValue } from './logStore';

describe('logStore', () => {
  beforeEach(() => {
    logStore.clear();
    logStore.setCapacity(2000);
  });

  it('records entries with monotonically increasing ids', () => {
    logStore.push('info', 'system', 'first', []);
    logStore.push('info', 'system', 'second', []);
    const all = logStore.getAll();
    expect(all).toHaveLength(2);
    expect(all[1].id).toBeGreaterThan(all[0].id);
    expect(all[0].message).toBe('first');
    expect(all[1].message).toBe('second');
  });

  it('evicts oldest entries past capacity', () => {
    logStore.setCapacity(3);
    logStore.push('info', 'system', 'a', []);
    logStore.push('info', 'system', 'b', []);
    logStore.push('info', 'system', 'c', []);
    logStore.push('info', 'system', 'd', []);
    const all = logStore.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((e) => e.message)).toEqual(['b', 'c', 'd']);
  });

  it('redacts sensitive fields from the message', () => {
    logStore.push('info', 'auth', 'sending auth-token: abc123', []);
    const [entry] = logStore.getAll();
    expect(entry.message).toContain('[REDACTED]');
    expect(entry.message).not.toContain('abc123');
  });

  it('redacts auth_token query params in URLs', () => {
    logStore.push(
      'debug',
      'api',
      'GET /api/v1/users/me?auth_token=eyJhbGciOiJIUzI1NiJ9.sekrit → start',
      [],
    );
    const [entry] = logStore.getAll();
    expect(entry.message).not.toContain('sekrit');
    expect(entry.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(entry.message).toContain('auth_token=[REDACTED]');
  });

  it('redacts Authorization Bearer header strings', () => {
    logStore.push('debug', 'api', 'Authorization: Bearer abc.def.ghi-xyz', []);
    const [entry] = logStore.getAll();
    expect(entry.message).not.toContain('abc.def.ghi-xyz');
    expect(entry.message).toContain('[REDACTED]');
  });

  it('redacts sensitive keys inside object args (recursively)', () => {
    logStore.push('info', 'api', 'sign in body', [
      {
        username: 'alice',
        auth_token: 'should-be-hidden',
        nested: { refresh_token: 'also-hidden', other: 'fine' },
      },
    ]);
    const [entry] = logStore.getAll();
    const args = entry.args as Array<Record<string, unknown>>;
    expect(args[0].auth_token).toBe('[REDACTED]');
    expect((args[0].nested as Record<string, unknown>).refresh_token).toBe('[REDACTED]');
    expect((args[0].nested as Record<string, unknown>).other).toBe('fine');
    expect(args[0].username).toBe('alice');
  });

  it('redacts auth_token in string args containing URLs', () => {
    logStore.push('debug', 'api', 'fetching', [
      'http://localhost:7575/api/v1/users/me?auth_token=secret-token-value&other=keep',
    ]);
    const [entry] = logStore.getAll();
    const arg = entry.args?.[0] as string;
    expect(arg).not.toContain('secret-token-value');
    expect(arg).toContain('auth_token=[REDACTED]');
    expect(arg).toContain('other=keep');
  });

  it('redactString idempotently masks JSON-stringified credentials', () => {
    const input = '{"username":"alice","auth_token":"abc123","password":"hunter2"}';
    const out = redactString(input);
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('hunter2');
    // Idempotency — running twice should not double-mangle.
    expect(redactString(out)).toBe(out);
  });

  it('redactValue leaves primitives and shape intact while masking sensitive keys', () => {
    const out = redactValue({
      id: 7,
      enabled: true,
      auth_token: 'leak',
      headers: { authorization: 'Bearer xyz', 'X-Pufferblow-Node-Session': 'node-tok' },
    }) as Record<string, unknown>;
    expect(out.id).toBe(7);
    expect(out.enabled).toBe(true);
    expect(out.auth_token).toBe('[REDACTED]');
    expect((out.headers as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect((out.headers as Record<string, unknown>)['X-Pufferblow-Node-Session']).toBe(
      '[REDACTED]',
    );
  });

  it('tracks unread error count and clears it on markRead', () => {
    logStore.push('info', 'api', 'hi', []);
    expect(logStore.getErrorCountSinceMark()).toBe(0);
    logStore.push('error', 'api', 'boom', []);
    logStore.push('error', 'api', 'bang', []);
    expect(logStore.getErrorCountSinceMark()).toBe(2);
    logStore.markRead();
    expect(logStore.getErrorCountSinceMark()).toBe(0);
  });

  it('notifies subscribers and lets them unsubscribe', () => {
    const calls: number[] = [];
    const unsubscribe = logStore.subscribe((snapshot) => {
      calls.push(snapshot.entries.length);
    });
    logStore.push('info', 'system', 'one', []);
    logStore.push('info', 'system', 'two', []);
    unsubscribe();
    logStore.push('info', 'system', 'three', []);
    expect(calls).toEqual([1, 2]);
  });

  it('exportPlainText emits one line per entry with iso timestamp and level', () => {
    logStore.push('warn', 'network', 'ws reconnecting', []);
    const out = logStore.exportPlainText();
    expect(out).toMatch(/\[\d{4}-\d{2}-\d{2}T.*\] \[WARN\] \[NETWORK\] ws reconnecting/);
  });

  it('exportJson returns parseable JSON containing entries', () => {
    logStore.push('error', 'api', 'oops', [{ status: 500 }]);
    const parsed = JSON.parse(logStore.exportJson());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('oops');
    expect(parsed[0].args[0]).toEqual({ status: 500 });
    expect(parsed[0].ts_iso).toMatch(/T/);
  });

  it('serializes Error instances into plain objects', () => {
    const err = new Error('kaboom');
    logStore.push('error', 'api', 'failed', [err]);
    const [entry] = logStore.getAll();
    expect(entry.args?.[0]).toMatchObject({ name: 'Error', message: 'kaboom' });
  });
});
