/**
 * Keeps the refresh token out of the renderer.
 *
 * The page hands the refresh token over once, at sign-in, and never sees it again: this process
 * stores it (encrypted with the OS keychain when "stay signed in" is on, in memory only when it
 * is off) and does the refresh and revoke calls itself, against the instance URL given at sign-in.
 * Script injected into the page can still use the current session, but it cannot read the
 * long-lived credential or send it anywhere.
 *
 * One entry per account (the page names it), so several accounts can stay signed in and the page
 * switches between them with `activate`; `refresh`, `revoke` and `clear` act on the active one.
 */

export interface VaultDeps {
  /** False when the OS offers no keychain (e.g. Linux without a secret service). */
  encryptionAvailable(): boolean;
  encrypt(plain: string): Uint8Array;
  decrypt(sealed: Uint8Array): string;
  read(): Uint8Array | null;
  write(sealed: Uint8Array): void;
  remove(): void;
  fetch(url: string, init: { method: "POST"; headers: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

/** The access-token half of a refresh answer; the new refresh token stays here. */
export interface AccessTokens {
  auth_token: string;
  token_type?: string;
  auth_token_expire_time?: string;
  refresh_token_expire_time?: string;
}

export type RefreshResult = { outcome: "renewed"; tokens: AccessTokens } | { outcome: "rejected" | "unreachable" };

interface Entry {
  /** The page's name for the account, e.g. "ada@chat.example". */
  account: string;
  apiUrl: string;
  refreshToken: string;
  remember: boolean;
}

/** What a vault with a single, unnamed account used before there could be several. */
export const DEFAULT_ACCOUNT = "default";

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const isAccount = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 320;

export class SessionVault {
  private entries = new Map<string, Entry>();
  private active = DEFAULT_ACCOUNT;
  private loaded = false;
  private readonly inFlight = new Map<string, Promise<RefreshResult>>();

  constructor(private readonly deps: VaultDeps) {}

  /** Whether sessions can be kept here at all; the page falls back to its own storage when not. */
  available(): boolean {
    return this.deps.encryptionAvailable();
  }

  /**
   * Take over a session's refresh token and make that account the active one. Returns false if it
   * was not stored (no keychain, bad input).
   */
  store(apiUrl: unknown, refreshToken: unknown, remember: unknown, account: unknown = DEFAULT_ACCOUNT): boolean {
    if (!this.available() || !isHttpUrl(apiUrl) || typeof refreshToken !== "string" || !refreshToken || !isAccount(account)) return false;
    this.load();
    this.entries.set(account, { account, apiUrl: apiUrl.replace(/\/+$/, ""), refreshToken, remember: remember === true });
    this.active = account;
    this.persist();
    return true;
  }

  /** Make a stored account the one that refresh, revoke and clear act on. False if it is unknown. */
  activate(account: unknown): boolean {
    this.load();
    if (!isAccount(account) || !this.entries.has(account)) return false;
    this.active = account;
    this.persist();
    return true;
  }

  /** Give a stored account its real name once the page knows it (a sign-in from before accounts had names). */
  rename(from: unknown, to: unknown): boolean {
    this.load();
    if (!isAccount(from) || !isAccount(to)) return false;
    const entry = this.entries.get(from);
    if (!entry) return false;
    this.entries.delete(from);
    this.entries.set(to, { ...entry, account: to });
    if (this.active === from) this.active = to;
    this.persist();
    return true;
  }

  /** Swap the active account's refresh token for a new pair. Concurrent calls share one request (tokens rotate). */
  refresh(): Promise<RefreshResult> {
    this.load();
    const account = this.active;
    const pending =
      this.inFlight.get(account) ??
      this.doRefresh(account).finally(() => {
        this.inFlight.delete(account);
      });
    this.inFlight.set(account, pending);
    return pending;
  }

  /** Forget the active session here at once, then revoke it on the instance as a best effort. */
  async revoke(): Promise<void> {
    this.load();
    const entry = this.entries.get(this.active);
    this.clear();
    if (!entry) return;
    try {
      await this.post(entry.apiUrl, "/api/v1/auth/revoke", entry.refreshToken);
    } catch {
      // Signing out never depends on the instance answering.
    }
  }

  /** Forget the active session (without telling the instance). */
  clear(): void {
    this.load();
    this.entries.delete(this.active);
    this.persist();
  }

  /** Forget one account, whichever is active. */
  forget(account: unknown): void {
    this.load();
    if (isAccount(account)) this.entries.delete(account);
    this.persist();
  }

  private async doRefresh(account: string): Promise<RefreshResult> {
    this.load();
    const entry = this.entries.get(account);
    if (!entry) return { outcome: "rejected" };

    let response: Awaited<ReturnType<VaultDeps["fetch"]>>;
    try {
      response = await this.post(entry.apiUrl, "/api/v1/auth/refresh", entry.refreshToken);
    } catch {
      return { outcome: "unreachable" };
    }
    if (response.status >= 500) return { outcome: "unreachable" };
    if (!response.ok) return { outcome: "rejected" };

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.auth_token !== "string" || !body.auth_token) return { outcome: "rejected" };

    // Signed out (or signed in again) while this was in flight: don't bring the old session back.
    if (this.entries.get(account) !== entry) return { outcome: "rejected" };
    if (typeof body.refresh_token === "string" && body.refresh_token) {
      this.entries.set(account, { ...entry, refreshToken: body.refresh_token });
      this.persist();
    }

    const tokens: AccessTokens = { auth_token: body.auth_token };
    for (const key of ["token_type", "auth_token_expire_time", "refresh_token_expire_time"] as const) {
      if (typeof body[key] === "string") tokens[key] = body[key];
    }
    return { outcome: "renewed", tokens };
  }

  private post(apiUrl: string, path: string, refreshToken: string) {
    return this.deps.fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  /** Remembered accounts go to disk, sealed; "this session only" ones stay in memory. */
  private persist(): void {
    this.loaded = true;
    const remembered = [...this.entries.values()].filter((e) => e.remember);
    try {
      if (remembered.length === 0) this.deps.remove();
      else this.deps.write(this.deps.encrypt(JSON.stringify({ version: 2, active: this.active, entries: remembered })));
    } catch {
      // The disk is the page's last resort; an unwritable file only costs "stay signed in".
    }
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const sealed = this.deps.read();
      if (!sealed || !this.available()) return;
      const parsed = JSON.parse(this.deps.decrypt(sealed)) as { entries?: unknown; active?: unknown } & Partial<Entry>;
      // Before accounts there was one bare entry; it becomes the default account.
      const stored: unknown[] = Array.isArray(parsed.entries) ? parsed.entries : [parsed];
      for (const raw of stored) {
        const entry = raw as Partial<Entry>;
        if (!isHttpUrl(entry.apiUrl) || typeof entry.refreshToken !== "string") continue;
        const account = isAccount(entry.account) ? entry.account : DEFAULT_ACCOUNT;
        this.entries.set(account, { account, apiUrl: entry.apiUrl, refreshToken: entry.refreshToken, remember: true });
      }
      if (isAccount(parsed.active) && this.entries.has(parsed.active)) this.active = parsed.active;
      else if (!this.entries.has(this.active)) this.active = this.entries.keys().next().value ?? DEFAULT_ACCOUNT;
    } catch {
      this.entries.clear(); // unreadable (another user's keychain, corruption): start signed out
    }
  }
}
