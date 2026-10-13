import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calledUrl, jsonResponse, mockFetch, signIn } from "../test/helpers";
import {
  clearAuthToken,
  getAuthToken,
  isSessionRemembered,
  login,
  logout,
  msUntilAuthExpiry,
  persistSession,
  refreshSession,
  renewSession,
  signup,
  type AuthTokens,
} from "./auth";
import { resolveInstance } from "./instance";

const instance = resolveInstance("localhost:7575");

const tokens = (overrides: Partial<AuthTokens> = {}): AuthTokens => ({
  auth_token: "access-1",
  refresh_token: "refresh-1",
  auth_token_expire_time: "2099-01-01T00:00:00Z",
  refresh_token_expire_time: "2099-02-01T00:00:00Z",
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("session persistence", () => {
  it("stores the access token as a cookie and the refresh token in localStorage when remembered", () => {
    persistSession(tokens(), true);

    expect(getAuthToken()).toBe("access-1");
    expect(JSON.parse(localStorage.getItem("pb_session")!)).toMatchObject({ refreshToken: "refresh-1", remember: true });
    expect(sessionStorage.getItem("pb_session")).toBeNull();
  });

  it("keeps the session out of localStorage when not remembered", () => {
    persistSession(tokens(), false);

    expect(localStorage.getItem("pb_session")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem("pb_session")!)).toMatchObject({ remember: false });
    expect(isSessionRemembered()).toBe(false);
  });

  it("moves a session between stores instead of duplicating it", () => {
    persistSession(tokens(), true);
    persistSession(tokens({ refresh_token: "refresh-2" }), false);

    expect(localStorage.getItem("pb_session")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem("pb_session")!).refreshToken).toBe("refresh-2");
  });

  it("round-trips tokens containing cookie-unsafe characters", () => {
    persistSession(tokens({ auth_token: "a;b=c d" }), true);
    expect(getAuthToken()).toBe("a;b=c d");
  });

  it("treats a session with no stored info as remembered", () => {
    expect(isSessionRemembered()).toBe(true);
  });

  it("clears the cookie and both stores", () => {
    persistSession(tokens(), true);
    clearAuthToken();

    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("pb_session")).toBeNull();
  });
});

describe("msUntilAuthExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  });

  it("returns the time left on the access token", () => {
    persistSession(tokens({ auth_token_expire_time: "2030-01-01T00:10:00Z" }), true);
    expect(msUntilAuthExpiry()).toBe(10 * 60_000);
  });

  it("goes negative once expired", () => {
    persistSession(tokens({ auth_token_expire_time: "2029-12-31T23:59:00Z" }), true);
    expect(msUntilAuthExpiry()).toBe(-60_000);
  });

  it("is null when there is no session or no expiry", () => {
    expect(msUntilAuthExpiry()).toBeNull();
    persistSession(tokens({ auth_token_expire_time: undefined }), true);
    expect(msUntilAuthExpiry()).toBeNull();
  });
});

describe("login and signup", () => {
  it("signs in with a GET and query credentials, then persists the session", async () => {
    const fetchMock = mockFetch(jsonResponse(tokens()));
    await login({ username: "ada", password: "p&ss word", instance, remember: true });

    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/users/signin");
    expect(url.searchParams.get("username")).toBe("ada");
    expect(url.searchParams.get("password")).toBe("p&ss word");
    expect(fetchMock.mock.calls[0]![1]!.method).toBe("GET");
    expect(getAuthToken()).toBe("access-1");
  });

  it("signs up with a JSON POST", async () => {
    const fetchMock = mockFetch(jsonResponse(tokens(), 201));
    await signup({ username: "ada", password: "hunter2hunter2", instance, remember: false });

    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/users/signup");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ username: "ada", password: "hunter2hunter2" });
    expect(isSessionRemembered()).toBe(false);
  });

  it("rejects a success response with no token and stores nothing", async () => {
    mockFetch(jsonResponse({ status_code: 200 }));
    await expect(login({ username: "a", password: "b", instance, remember: true })).rejects.toThrow("unexpected response");
    expect(getAuthToken()).toBeNull();
  });

  it("propagates API errors without persisting a session", async () => {
    mockFetch(jsonResponse({ error_code: "auth.invalid_credentials", user_message: "no" }, 401));
    await expect(login({ username: "a", password: "b", instance, remember: true })).rejects.toMatchObject({
      code: "auth.invalid_credentials",
    });
    expect(getAuthToken()).toBeNull();
  });
});

describe("refreshSession", () => {
  it("exchanges the refresh token and keeps the remember choice", async () => {
    signIn();
    persistSession(tokens(), false);
    const fetchMock = mockFetch(jsonResponse(tokens({ auth_token: "access-2", refresh_token: "refresh-2" })));

    await expect(refreshSession()).resolves.toBe(true);

    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/auth/refresh");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ refresh_token: "refresh-1" });
    expect(getAuthToken()).toBe("access-2");
    expect(JSON.parse(sessionStorage.getItem("pb_session")!)).toMatchObject({ refreshToken: "refresh-2", remember: false });
  });

  it("returns false without calling the server when there is no session", async () => {
    signIn();
    const fetchMock = mockFetch();
    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when the server rejects the refresh token", async () => {
    signIn();
    persistSession(tokens(), true);
    mockFetch(jsonResponse({ error_code: "auth.refresh_token_expired" }, 401));
    await expect(refreshSession()).resolves.toBe(false);
  });
});

describe("renewSession", () => {
  beforeEach(() => {
    signIn();
    persistSession(tokens(), true);
  });

  it("says rejected when the instance refuses the refresh token", async () => {
    mockFetch(jsonResponse({ error_code: "auth.refresh_token_expired" }, 401));
    await expect(renewSession()).resolves.toBe("rejected");
  });

  it("says unreachable when the instance doesn't answer or fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(renewSession()).resolves.toBe("unreachable");

    mockFetch(jsonResponse({ detail: "boom" }, 503));
    await expect(renewSession()).resolves.toBe("unreachable");
  });

  it("says renewed on success", async () => {
    mockFetch(jsonResponse(tokens({ auth_token: "access-2" })));
    await expect(renewSession()).resolves.toBe("renewed");
  });
});

describe("logout", () => {
  it("revokes the refresh token and clears the local session", async () => {
    signIn();
    persistSession(tokens(), true);
    const fetchMock = mockFetch(jsonResponse({ status_code: 200 }));

    await logout();

    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/auth/revoke");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ refresh_token: "refresh-1" });
    expect(getAuthToken()).toBeNull();
  });

  it("still clears the local session when revoking fails", async () => {
    signIn();
    persistSession(tokens(), true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(logout()).resolves.toBeUndefined();
    expect(getAuthToken()).toBeNull();
  });
});

describe("signing out for real", () => {
  it("is already signed out locally while the revoke call is still waiting on the instance", async () => {
    signIn();
    persistSession(tokens(), true);
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));

    const done = logout();
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("pb_session")).toBeNull();

    release(jsonResponse({ status_code: 200 }));
    await done;
  });

  it("removes a cookie that was stored as Secure too", () => {
    const writes: string[] = [];
    const real = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => real.get!.call(document),
      set: (value: string) => {
        writes.push(value);
        real.set!.call(document, value);
      },
    });
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, protocol: "https:" } as Location);
    try {
      clearAuthToken();
    } finally {
      delete (document as { cookie?: string }).cookie;
    }

    expect(writes.some((w) => w.includes("Secure") && w.includes("Max-Age=0"))).toBe(true);
    expect(writes.some((w) => !w.includes("Secure") && w.includes("Expires=Thu, 01 Jan 1970"))).toBe(true);
  });

  it("is not undone by a token renewal that was already on its way", async () => {
    signIn();
    persistSession(tokens(), true);
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));

    const renewing = renewSession();
    clearAuthToken();
    release(jsonResponse(tokens({ auth_token: "access-2" })));

    await expect(renewing).resolves.toBe("rejected");
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("pb_session")).toBeNull();
  });
});
