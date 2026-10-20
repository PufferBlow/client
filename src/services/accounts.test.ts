import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listAccounts,
  rememberActiveAccount,
  removeAccount,
  saveActiveAccount,
  signOutActiveAccount,
  switchAccount,
} from "./accounts";
import { clearAuthToken, getActiveAccountId, getAuthToken, login, persistSession, setActiveAccountId, type AuthTokens } from "./auth";
import { getStoredInstance, resolveInstance, setStoredInstance } from "./instance";

const one = resolveInstance("one.example");
const two = resolveInstance("two.example");

const tokens = (token: string): AuthTokens => ({
  auth_token: token,
  refresh_token: `refresh-${token}`,
  auth_token_expire_time: "2099-01-01T00:00:00Z",
  refresh_token_expire_time: "2099-02-01T00:00:00Z",
});

/** Signs in as `name` on `instance` the way login does, without a network. */
async function signInAs(name: string, instance: ReturnType<typeof resolveInstance>, token: string, remember = true) {
  setStoredInstance(instance);
  setActiveAccountId(`${name}@${instance.raw}`);
  await persistSession(tokens(token), remember);
  await rememberActiveAccount({ username: name, avatar_url: `/storage/${name}.png` });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "auth_token=; Max-Age=0; Path=/";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete window.electron;
});

describe("saved accounts", () => {
  it("lists the signed-in account with its instance and a copy of its session", async () => {
    await signInAs("ada", one, "a1");
    const [account] = listAccounts();
    expect(account).toMatchObject({ id: `ada@${one.raw}`, username: "ada", avatarUrl: "/storage/ada.png" });
    expect(account!.snapshot!.authToken).toBe("a1");
  });

  it("names a session from before accounts existed the first time its profile is known", async () => {
    setStoredInstance(one);
    await persistSession(tokens("old"), true);
    expect(getActiveAccountId()).toBeNull();

    await rememberActiveAccount({ username: "Ada" });

    expect(getActiveAccountId()).toBe(`ada@${one.raw}`);
    expect(listAccounts()).toHaveLength(1);
  });

  it("switches to another account: its instance, its session, and back again", async () => {
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    await signInAs("bo", two, "b1"); // adding a second account makes it live

    expect(getAuthToken()).toBe("b1");
    expect(listAccounts().map((a) => a.id).sort()).toEqual([`ada@${one.raw}`, `bo@${two.raw}`]);

    await expect(switchAccount(`ada@${one.raw}`)).resolves.toBe(true);
    expect(getAuthToken()).toBe("a1");
    expect(getStoredInstance()?.raw).toBe(one.raw);
    expect(getActiveAccountId()).toBe(`ada@${one.raw}`);

    await expect(switchAccount(`bo@${two.raw}`)).resolves.toBe(true);
    expect(getAuthToken()).toBe("b1");
    expect(getStoredInstance()?.raw).toBe(two.raw);
  });

  it("changes nothing when the account is unknown", async () => {
    await signInAs("ada", one, "a1");
    await expect(switchAccount("ghost@nowhere")).resolves.toBe(false);
    expect(getAuthToken()).toBe("a1");
  });

  it("asks the desktop vault to activate the account it keeps a token for", async () => {
    const activate = vi.fn().mockResolvedValue(true);
    window.electron = { session: { activate, rename: vi.fn(), forget: vi.fn(), store: vi.fn().mockResolvedValue(true) } } as never;
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    await signInAs("bo", two, "b1");

    await switchAccount(`ada@${one.raw}`);

    expect(activate).toHaveBeenCalledWith(`ada@${one.raw}`);
  });

  it("refuses to switch to a desktop account the vault no longer has", async () => {
    window.electron = {
      session: { activate: vi.fn().mockResolvedValue(false), rename: vi.fn(), forget: vi.fn(), store: vi.fn().mockResolvedValue(true) },
    } as never;
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    await signInAs("bo", two, "b1");

    await expect(switchAccount(`ada@${one.raw}`)).resolves.toBe(false);
    expect(getAuthToken()).toBe("b1");
  });

  it("removes a saved account but never the live one", async () => {
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    await signInAs("bo", two, "b1");

    await removeAccount(`bo@${two.raw}`); // the live one
    expect(listAccounts()).toHaveLength(2);
    await removeAccount(`ada@${one.raw}`);
    expect(listAccounts().map((a) => a.username)).toEqual(["bo"]);
  });

  it("signing out moves on to the next saved account, or to the login page when there is none", async () => {
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    await signInAs("bo", two, "b1");

    await expect(signOutActiveAccount()).resolves.toBe("switched");
    expect(getAuthToken()).toBe("a1");
    expect(listAccounts().map((a) => a.username)).toEqual(["ada"]);

    await expect(signOutActiveAccount()).resolves.toBe("signed-out");
    expect(getAuthToken()).toBeNull();
    expect(listAccounts()).toEqual([]);
  });

  it("keeps a session that was not to be remembered out of device storage", async () => {
    await signInAs("ada", one, "a1", false);
    expect(localStorage.getItem("pb_accounts") ?? "[]").not.toContain("refresh-a1");
    expect(sessionStorage.getItem("pb_accounts")).toContain("refresh-a1");
    expect(listAccounts()).toHaveLength(1);
  });

  it("drops the saved copy of a session that is cleared, but keeps the account listed", async () => {
    await signInAs("ada", one, "a1");
    expect(listAccounts()[0]!.snapshot).not.toBeNull();

    clearAuthToken(); // e.g. the instance refused the session

    expect(listAccounts()[0]).toMatchObject({ username: "ada", snapshot: null });
    expect(localStorage.getItem("pb_accounts")).not.toContain("refresh-a1");
    await expect(switchAccount(`ada@${one.raw}`)).resolves.toBe(false); // has to sign in again
  });

  it("leaves the live session on its own instance when a sign-in fails", async () => {
    await signInAs("ada", one, "a1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_code: "auth.invalid_credentials" }), { status: 401, headers: { "content-type": "application/json" } })));

    await expect(login({ username: "bo", password: "wrong", instance: two, remember: true })).rejects.toBeDefined();

    expect(getStoredInstance()?.raw).toBe(one.raw); // not two: ada's token must never be sent there
    expect(getAuthToken()).toBe("a1");
  });

  it("moves to the new instance together with the new session when a sign-in succeeds", async () => {
    await signInAs("ada", one, "a1");
    saveActiveAccount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(tokens("b1")), { status: 200, headers: { "content-type": "application/json" } })));

    await login({ username: "bo", password: "pw", instance: two, remember: true });

    expect(getStoredInstance()?.raw).toBe(two.raw);
    expect(getAuthToken()).toBe("b1");
    expect(getActiveAccountId()).toBe(`bo@${two.raw}`);
  });
});
