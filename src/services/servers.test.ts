import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dropMembership, listAccounts, listMemberships, listPeople, rememberActiveAccount, removeAccount, signOutActiveAccount, switchAccount } from "./accounts";
import { getActiveAccountId, persistSession, setActiveAccountId } from "./auth";
import { resolveInstance, setStoredInstance } from "./instance";
import { checkRequest, HomeSessionExpired, joinServer, leaveServer, resolveHome } from "./servers";
import { jsonResponse, requestLog, routeFetch } from "../test/helpers";

const home = resolveInstance("home.example");
const away = resolveInstance("away.example");
const info = { server_id: "away.example:7575", server_name: "Away Place" };

const tokens = (token: string) => ({
  auth_token: token,
  refresh_token: `r-${token}`,
  auth_token_expire_time: "2099-01-01T00:00:00Z",
  refresh_token_expire_time: "2099-02-01T00:00:00Z",
});

async function signInAsAda() {
  setStoredInstance(home);
  setActiveAccountId(`ada@${home.raw}`);
  await persistSession(tokens("home-token"), true);
  await rememberActiveAccount({ username: "ada" });
}

const joined = { status: "joined", user: { user_id: "u1", username: "fedi_ada_ab12cd" }, ...tokens("away-token") };

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "auth_token=; Max-Age=0; Path=/";
  await signInAsAda();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete window.electron;
});

describe("joining a server with the account you have", () => {
  it("asks your own server to vouch, presents that to the other, and keeps the session it gets", async () => {
    const fetchMock = routeFetch({
      "POST /api/v1/federation/assertions": (_url: URL, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        expect(body).toEqual({ auth_token: "home-token", audience: "away.example:7575" });
        return jsonResponse({ assertion: "signed.statement" });
      },
      "POST /api/v1/federation/join": (_url: URL, init: RequestInit) => {
        expect(JSON.parse(String(init.body))).toEqual({ assertion: "signed.statement", invite_code: "ABCD" });
        return jsonResponse(joined);
      },
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });

    const result = await joinServer(away, info, { inviteCode: " ABCD " });

    expect(result.kind).toBe("joined");
    const [server] = listMemberships();
    expect(server).toMatchObject({ username: "fedi_ada_ab12cd", instance: { raw: "away.example" }, membership: { homeId: `ada@${home.raw}`, handle: `ada@${home.raw}`, status: "joined" } });
    expect(server!.snapshot?.authToken).toBe("away-token");
    expect(requestLog(fetchMock)).toEqual(["POST /api/v1/federation/assertions", "POST /api/v1/federation/join", "POST /api/v1/users/joined-servers"]);
    // It is a server, not another account of ada's.
    expect(listPeople().map((a) => a.username)).toEqual(["ada"]);
  });

  it("keeps a request that is waiting, marked as such, with no session", async () => {
    routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": jsonResponse({ status: "pending", request_id: "r1" }, 202),
    });
    const result = await joinServer(away, info, { message: "hi" });
    expect(result.kind).toBe("pending");
    expect(listMemberships()[0]).toMatchObject({ snapshot: null, membership: { status: "pending", requestId: "r1" } });
  });

  it("says plainly when your own server's sign-in has run out", async () => {
    routeFetch({ "POST /api/v1/federation/assertions": jsonResponse({ error_code: "auth.invalid_token", message: "no" }, 401) });
    await expect(joinServer(away, info)).rejects.toBeInstanceOf(HomeSessionExpired);
    expect(listMemberships()).toEqual([]);
  });

  it("will not join your own server", async () => {
    routeFetch({});
    await expect(joinServer(home, undefined)).rejects.toThrow("your own server");
  });

  it("from a joined server, still joins with the account it was joined with", async () => {
    routeFetch({
      "POST /api/v1/federation/assertions": (url: URL) => {
        expect(url.host).toBe("home.example");
        return jsonResponse({ assertion: "x.y" });
      },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    await joinServer(away, info);
    const [server] = listMemberships();
    expect(await switchAccount(server!.id)).toBe(true);
    expect(resolveHome()).toMatchObject({ handle: `ada@${home.raw}`, token: "home-token" });
  });

  it("opens a waiting request once it is approved, and drops one that was declined", async () => {
    routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": jsonResponse({ status: "pending", request_id: "r1" }, 202),
      "POST /api/v1/federation/join/status": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    await joinServer(away, info);
    const [waiting] = listMemberships();
    expect((await checkRequest(waiting!, info)).kind).toBe("joined");
    expect(listMemberships().map((a) => a.membership?.status)).toEqual(["joined"]); // the waiting entry became the real one

    routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": jsonResponse({ status: "pending", request_id: "r2" }, 202),
      "POST /api/v1/federation/join/status": jsonResponse({ error_code: "auth.membership_denied", message: "declined" }, 403),
    });
    const other = resolveInstance("other.example");
    await joinServer(other, { server_id: "other.example:7575", server_name: "Other" });
    const entry = listMemberships().find((a) => a.membership?.status === "pending")!;
    await expect(checkRequest(entry, { server_id: "other.example:7575", server_name: "Other" })).rejects.toMatchObject({ code: "auth.membership_denied" });
    expect(listMemberships().some((a) => a.membership?.status === "pending")).toBe(false);
  });

  it("leaving tells the server, tells your own, and forgets it", async () => {
    const fetchMock = routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
      "POST /api/v1/federation/leave": { left: true },
      "POST /api/v1/users/joined-servers/leave": { status_code: 200 },
    });
    await joinServer(away, info);
    await leaveServer(listMemberships()[0]!);
    expect(listMemberships()).toEqual([]);
    expect(requestLog(fetchMock)).toEqual(expect.arrayContaining(["POST /api/v1/federation/leave", "POST /api/v1/users/joined-servers/leave"]));
  });
});

describe("joined servers and the accounts they hang from", () => {
  it("go when their account goes, and signing out of one leaves the account alone", async () => {
    routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    await joinServer(away, info);
    const [server] = listMemberships();

    // Signing out of the joined server returns to ada.
    expect(await switchAccount(server!.id)).toBe(true);
    await expect(signOutActiveAccount()).resolves.toBe("switched");
    expect(getActiveAccountId()).toBe(`ada@${home.raw}`);
    expect(listMemberships()).toEqual([]);

    // Removing ada's account removes whatever was joined with it.
    await joinServer(away, info);
    setActiveAccountId(null);
    await removeAccount(`ada@${home.raw}`);
    expect(listAccounts()).toEqual([]);
  });

  it("dropMembership forgets just that one", async () => {
    routeFetch({
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    await joinServer(away, info);
    await dropMembership(listMemberships()[0]!.id);
    expect(listAccounts().map((a) => a.username)).toEqual(["ada"]);
  });
});
