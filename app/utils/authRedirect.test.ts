// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildAuthRedirectPath,
  buildSiblingAuthLink,
  resolvePostAuthRedirect,
} from "./authRedirect";

describe("auth redirect helpers", () => {
  it("falls back to dashboard when redirect is missing or auth-only", () => {
    expect(resolvePostAuthRedirect(null)).toBe("/dashboard");
    expect(resolvePostAuthRedirect("/login")).toBe("/dashboard");
    expect(resolvePostAuthRedirect("/signup")).toBe("/dashboard");
  });

  it("accepts local app routes and preserves query/hash", () => {
    expect(resolvePostAuthRedirect("/settings?tab=audio#voice")).toBe(
      "/settings?tab=audio#voice",
    );
  });

  it("rejects external or malformed redirect targets", () => {
    expect(resolvePostAuthRedirect("https://evil.example")).toBe("/dashboard");
    expect(resolvePostAuthRedirect("//evil.example")).toBe("/dashboard");
    expect(resolvePostAuthRedirect("dashboard")).toBe("/dashboard");
  });

  it("builds a login redirect path from the current location", () => {
    expect(buildAuthRedirectPath("/settings", "?tab=audio", "#voice")).toBe(
      "/login?redirect=%2Fsettings%3Ftab%3Daudio%23voice",
    );
  });

  it("preserves redirect intent when switching between login and signup", () => {
    expect(buildSiblingAuthLink("/signup", "/control-panel")).toBe(
      "/signup?redirect=%2Fcontrol-panel",
    );
    expect(buildSiblingAuthLink("/login", null)).toBe("/login");
  });
});
