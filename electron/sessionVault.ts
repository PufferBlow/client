/**
 * Keeps the refresh token out of the renderer.
 *
 * The page hands the refresh token over once, at sign-in, and never sees it again: this process
 * stores it (encrypted with the OS keychain when "stay signed in" is on, in memory only when it
 * is off) and does the refresh and revoke calls itself, against the instance URL given at sign-in.
 * Script injected into the page can still use the current session, but it cannot read the
 * long-lived credential or send it anywhere.
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
  apiUrl: string;
  refreshToken: string;
  remember: boolean;
}

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export class SessionVault {
  private entry: Entry | null = null;
  private loaded = false;
  private inFlight: Promise<RefreshResult> | null = null;

  constructor(private readonly deps: VaultDeps) {}

  /** Whether sessions can be kept here at all; the page falls back to its own storage when not. */
  available(): boolean {
    return this.deps.encryptionAvailable();
  }

  /** Take over a session's refresh token. Returns false if it was not stored (no keychain, bad input). */
  store(apiUrl: unknown, refreshToken: unknown, remember: unknown): boolean {
    if (!this.available() || !isHttpUrl(apiUrl) || typeof refreshToken !== "string" || !refreshToken) return false;
    this.save({ apiUrl: apiUrl.replace(/\/+$/, ""), refreshToken, remember: remember === true });
    return true;
  }

  /** Swap the stored refresh token for a new pair. Concurrent calls share one request (tokens rotate). */
  refresh(): Promise<RefreshResult> {
    this.inFlight ??= this.doRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Forget the session here at once, then revoke it on the instance as a best effort. */
  async revoke(): Promise<void> {
    const entry = this.load();
    this.clear();
    if (!entry) return;
    try {
      await this.post(entry.apiUrl, "/api/v1/auth/revoke", entry.refreshToken);
    } catch {
      // Signing out never depends on the instance answering.
    }
  }

  clear(): void {
    this.entry = null;
    this.loaded = true;
    try {
      this.deps.remove();
    } catch {
      // Nothing stored, or already gone.
    }
  }

  private async doRefresh(): Promise<RefreshResult> {
    const entry = this.load();
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
    if (this.load() !== entry) return { outcome: "rejected" };
    if (typeof body.refresh_token === "string" && body.refresh_token) this.save({ ...entry, refreshToken: body.refresh_token });

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

  private save(entry: Entry): void {
    this.entry = entry;
    this.loaded = true;
    if (entry.remember) this.deps.write(this.deps.encrypt(JSON.stringify(entry)));
    else this.deps.remove(); // "this session only": nothing on disk
  }

  private load(): Entry | null {
    if (this.loaded) return this.entry;
    this.loaded = true;
    try {
      const sealed = this.deps.read();
      if (!sealed || !this.available()) return null;
      const parsed = JSON.parse(this.deps.decrypt(sealed)) as Partial<Entry>;
      if (isHttpUrl(parsed.apiUrl) && typeof parsed.refreshToken === "string") {
        this.entry = { apiUrl: parsed.apiUrl, refreshToken: parsed.refreshToken, remember: true };
      }
    } catch {
      this.entry = null; // unreadable (another user's keychain, corruption): start signed out
    }
    return this.entry;
  }
}
