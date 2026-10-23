import { describe, expect, it } from "vitest";
import { ApiError } from "../services/api";
import { signIn } from "../test/helpers";
import { classifyAuthError, parseHandle, PASSWORD_MAX, PASSWORD_MIN, USERNAME_PATTERN } from "./authErrors";
import { resolveHandle } from "./authForm";
import { buildAuthRedirectPath, buildSiblingAuthLink, resolvePostAuthRedirect } from "./authRedirect";

describe("resolvePostAuthRedirect, hostile targets", () => {
  const backslash = String.fromCharCode(92);
  const tab = String.fromCharCode(9);
  it.each([
    ["a protocol-relative URL", "//evil.test"],
    ["a backslash that browsers read as a slash", `/${backslash}evil.test`],
    ["a tab the URL parser strips", `/${tab}/evil.test`],
    ["an absolute URL", "https://evil.test"],
    ["a script URL", "javascript:alert(1)"],
  ])("never leaves the app for %s", (_name, input) => {
    expect(resolvePostAuthRedirect(input)).toBe("/dashboard");
  });
});

describe("resolvePostAuthRedirect", () => {
  it.each([
    ["/dashboard/channels/abc", "/dashboard/channels/abc"],
    ["/settings/profile?tab=1#x", "/settings/profile?tab=1#x"],
    ["  /settings  ", "/settings"],
  ])("accepts the same-origin path %j", (input, expected) => {
    expect(resolvePostAuthRedirect(input)).toBe(expected);
  });

  it.each([
    ["https://evil.example/steal"],
    ["//evil.example"],
    ["javascript:alert(1)"],
    ["dashboard"],
    [""],
    [null],
    [undefined],
  ])("falls back for an unsafe or empty target (%j)", (input) => {
    expect(resolvePostAuthRedirect(input)).toBe("/dashboard");
  });

  it("never redirects back to an auth screen", () => {
    expect(resolvePostAuthRedirect("/login")).toBe("/dashboard");
    expect(resolvePostAuthRedirect("/signup?redirect=/x")).toBe("/dashboard");
  });

  it("supports a custom fallback", () => {
    expect(resolvePostAuthRedirect("//x", "/home")).toBe("/home");
  });
});

describe("auth redirect links", () => {
  it("builds a login link carrying the current location", () => {
    expect(buildAuthRedirectPath("/settings/profile", "?a=1", "#h")).toBe("/login?redirect=%2Fsettings%2Fprofile%3Fa%3D1%23h");
  });

  it("does not loop back to the login screen", () => {
    expect(buildAuthRedirectPath("/login")).toBe("/login?redirect=%2Fdashboard");
  });

  it("keeps a valid redirect between login and signup", () => {
    expect(buildSiblingAuthLink("/signup", "/settings")).toBe("/signup?redirect=%2Fsettings");
  });

  it("drops an invalid redirect", () => {
    expect(buildSiblingAuthLink("/signup", "https://evil.example")).toBe("/signup");
    expect(buildSiblingAuthLink("/login", null)).toBe("/login");
  });
});

describe("parseHandle", () => {
  it.each([
    ["ada", { username: "ada", instance: null }],
    ["ada@chat.example.com", { username: "ada", instance: "chat.example.com" }],
    ["@ada@localhost:7575", { username: "ada", instance: "localhost:7575" }],
    ["  ada@host  ", { username: "ada", instance: "host" }],
    ["ada@", { username: "ada", instance: null }],
    ["", { username: "", instance: null }],
  ])("parses %j", (input, expected) => {
    expect(parseHandle(input)).toEqual(expected);
  });
});

describe("resolveHandle", () => {
  it("resolves a full handle", () => {
    const result = resolveHandle("ada@chat.example.com");
    expect(result).toMatchObject({ ok: true, username: "ada" });
    expect(result.ok && result.instance.origin).toBe("https://chat.example.com");
  });

  it("reuses the last instance when none is typed", () => {
    signIn("t", "http://localhost:7575");
    const result = resolveHandle("ada");
    expect(result.ok && result.instance.origin).toBe("http://localhost:7575");
  });

  it("asks for an instance when there is none to fall back on", () => {
    expect(resolveHandle("ada")).toMatchObject({ ok: false, error: expect.stringContaining("instance") });
  });

  it("asks for a handle when empty", () => {
    expect(resolveHandle("   ")).toMatchObject({ ok: false, error: expect.stringContaining("handle") });
  });

  it("rejects an invalid instance address", () => {
    expect(resolveHandle("ada@http://")).toMatchObject({ ok: false, error: expect.stringContaining("Invalid instance") });
  });
});

describe("credential rules", () => {
  it.each(["abc", "a.b-c_d", "x".repeat(32)])("accepts the username %j", (name) => {
    expect(USERNAME_PATTERN.test(name)).toBe(true);
  });

  it.each(["ab", "x".repeat(33), "has space", "emoji😀", "a@b"])("rejects the username %j", (name) => {
    expect(USERNAME_PATTERN.test(name)).toBe(false);
  });

  it("exposes the server password bounds", () => {
    expect([PASSWORD_MIN, PASSWORD_MAX]).toEqual([8, 256]);
  });
});

describe("classifyAuthError", () => {
  const apiError = (code: string, message = "server message", extra: Partial<ApiError> = {}) =>
    Object.assign(new ApiError(400, code, message), extra);

  it("uses one generic message for bad credentials (no username enumeration)", () => {
    expect(classifyAuthError(apiError("auth.invalid_credentials", "No such user"), "x")).toEqual({
      message: "Invalid username or password.",
      kind: "credentials",
    });
  });

  it("flags a taken username on the username field", () => {
    expect(classifyAuthError(apiError("auth.username_taken"), "x")).toMatchObject({
      field: "username",
      kind: "username_taken",
      message: "That username is taken.",
    });
  });

  it("maps a server-side field name onto the form field", () => {
    const error = apiError("auth.password_too_weak", "Too weak", { details: { field: "password" } });
    expect(classifyAuthError(error, "x")).toMatchObject({ field: "password", kind: "password_weak", message: "Too weak" });
  });

  it("maps new_username to the username field", () => {
    const error = apiError("auth.username_invalid", "Bad name", { details: { field: "new_username" } });
    expect(classifyAuthError(error, "x").field).toBe("username");
  });

  it("includes the retry delay for rate limits", () => {
    const info = classifyAuthError(apiError("rate_limit.exceeded", "slow down", { retryAfterSeconds: 12 }), "x");
    expect(info).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 12 });
    expect(info.message).toContain("12s");
  });

  it("gives a generic rate-limit message without a delay", () => {
    expect(classifyAuthError(apiError("rate_limit.exceeded"), "x").message).toBe("Too many attempts. Try again in a moment.");
  });

  it.each(["network", "timeout"])("treats %s failures as an unreachable instance", (code) => {
    expect(classifyAuthError(apiError(code), "x")).toMatchObject({ kind: "unreachable", field: "instance" });
  });

  it.each([
    ["auth.user_banned", "account_banned"],
    ["auth.instance_mismatch", "instance_mismatch"],
    ["auth.signup_disabled", "signup_disabled"],
    ["auth.account_locked", "account_locked"],
  ])("classifies %s", (code, kind) => {
    expect(classifyAuthError(apiError(code, "msg"), "x")).toMatchObject({ kind, message: "msg" });
  });

  it("reports server errors generically", () => {
    expect(classifyAuthError(new ApiError(503, "server.unavailable", "boom"), "x")).toMatchObject({ kind: "server_error" });
  });

  it("falls back to the server message, then to the supplied fallback", () => {
    expect(classifyAuthError(new ApiError(400, "weird.code", "From server"), "fallback").message).toBe("From server");
    expect(classifyAuthError(new ApiError(400, "weird.code", ""), "fallback").message).toBe("fallback");
  });

  it("handles non-API errors", () => {
    expect(classifyAuthError(new Error("boom"), "fallback")).toEqual({ message: "boom", kind: "unknown" });
    expect(classifyAuthError("nope", "fallback")).toEqual({ message: "fallback", kind: "unknown" });
  });
});
