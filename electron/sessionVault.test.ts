import { describe, expect, it, vi } from "vitest";
import { SessionVault, type VaultDeps } from "./sessionVault";

/** A fake keychain ("sealed" = reversed) and disk, and a scripted instance. */
function setup({ keychain = true, disk = null as string | null } = {}) {
  let file: Uint8Array | null = disk === null ? null : new TextEncoder().encode([...disk].reverse().join(""));
  const fetch = vi.fn<VaultDeps["fetch"]>();
  const deps: VaultDeps = {
    encryptionAvailable: () => keychain,
    encrypt: (plain) => new TextEncoder().encode([...plain].reverse().join("")),
    decrypt: (sealed) => [...new TextDecoder().decode(sealed)].reverse().join(""),
    read: () => file,
    write: (sealed) => {
      file = sealed;
    },
    remove: () => {
      file = null;
    },
    fetch,
  };
  const onDisk = () => (file === null ? null : JSON.parse(deps.decrypt(file)));
  return { vault: new SessionVault(deps), fetch, onDisk };
}

const answer = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body });

describe("SessionVault", () => {
  it("keeps a remembered session on disk, sealed, and a this-session-only one in memory", () => {
    const { vault, onDisk } = setup();
    expect(vault.store("https://chat.example/", "r1", true)).toBe(true);
    expect(onDisk()).toEqual({ apiUrl: "https://chat.example", refreshToken: "r1", remember: true });

    expect(vault.store("https://chat.example", "r2", false)).toBe(true);
    expect(onDisk()).toBeNull();
  });

  it("refuses without a keychain or with a URL that is not http(s)", () => {
    expect(setup({ keychain: false }).vault.store("https://chat.example", "r1", true)).toBe(false);
    const { vault } = setup();
    expect(vault.store("file:///etc/passwd", "r1", true)).toBe(false);
    expect(vault.store("https://chat.example", "", true)).toBe(false);
  });

  it("refreshes against the stored instance, keeps the rotated token and returns only access tokens", async () => {
    const { vault, fetch, onDisk } = setup();
    vault.store("https://chat.example", "r1", true);
    fetch.mockResolvedValue(answer(200, { auth_token: "a2", refresh_token: "r2", auth_token_expire_time: "2099-01-01" }));

    await expect(vault.refresh()).resolves.toEqual({ outcome: "renewed", tokens: { auth_token: "a2", auth_token_expire_time: "2099-01-01" } });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://chat.example/api/v1/auth/refresh");
    expect(JSON.parse(init.body)).toEqual({ refresh_token: "r1" });
    expect(onDisk().refreshToken).toBe("r2");
  });

  it("shares one request between concurrent refreshes, since tokens rotate", async () => {
    const { vault, fetch } = setup();
    vault.store("https://chat.example", "r1", true);
    fetch.mockResolvedValue(answer(200, { auth_token: "a2", refresh_token: "r2" }));

    await Promise.all([vault.refresh(), vault.refresh()]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("tells a refused token from an instance that did not answer", async () => {
    const { vault, fetch } = setup();
    vault.store("https://chat.example", "r1", true);

    fetch.mockResolvedValueOnce(answer(401));
    await expect(vault.refresh()).resolves.toEqual({ outcome: "rejected" });
    fetch.mockResolvedValueOnce(answer(503));
    await expect(vault.refresh()).resolves.toEqual({ outcome: "unreachable" });
    fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(vault.refresh()).resolves.toEqual({ outcome: "unreachable" });
  });

  it("says rejected when there is no session", async () => {
    const { vault, fetch } = setup();
    await expect(vault.refresh()).resolves.toEqual({ outcome: "rejected" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not bring a session back when sign-out happens during a refresh", async () => {
    const { vault, fetch, onDisk } = setup();
    vault.store("https://chat.example", "r1", true);
    let finish!: (value: ReturnType<typeof answer>) => void;
    fetch.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const pending = vault.refresh();
    vault.clear();
    finish(answer(200, { auth_token: "a2", refresh_token: "r2" }));

    await expect(pending).resolves.toEqual({ outcome: "rejected" });
    expect(onDisk()).toBeNull();
  });

  it("picks up a remembered session after a restart", async () => {
    const disk = JSON.stringify({ apiUrl: "https://chat.example", refreshToken: "r1", remember: true });
    const { vault, fetch } = setup({ disk });
    fetch.mockResolvedValue(answer(200, { auth_token: "a2" }));

    await expect(vault.refresh()).resolves.toMatchObject({ outcome: "renewed" });
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ refresh_token: "r1" });
  });

  it("forgets the session before revoking it, and revoking never throws", async () => {
    const { vault, fetch, onDisk } = setup();
    vault.store("https://chat.example", "r1", true);
    fetch.mockRejectedValue(new Error("offline"));

    await expect(vault.revoke()).resolves.toBeUndefined();
    expect(onDisk()).toBeNull();
    expect(fetch.mock.calls[0]![0]).toBe("https://chat.example/api/v1/auth/revoke");
    await expect(vault.refresh()).resolves.toEqual({ outcome: "rejected" });
  });
});
