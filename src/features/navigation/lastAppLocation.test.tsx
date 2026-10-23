import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { lastAppLocation, useRememberAppLocation } from "./lastAppLocation";

const at = (path: string) => ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;

describe("lastAppLocation", () => {
  beforeEach(() => sessionStorage.clear());

  it("falls back to the hub before anything was visited", () => {
    expect(lastAppLocation()).toBe("/dashboard");
  });

  it("remembers the channel, DM or list you were on", () => {
    renderHook(() => useRememberAppLocation(), { wrapper: at("/dashboard/channels/c9?x=1") });
    expect(lastAppLocation()).toBe("/dashboard/channels/c9?x=1");
  });

  it("is not overwritten by settings or the control panel", () => {
    renderHook(() => useRememberAppLocation(), { wrapper: at("/dashboard/dms/d1") });
    renderHook(() => useRememberAppLocation(), { wrapper: at("/control-panel/roles") });
    renderHook(() => useRememberAppLocation(), { wrapper: at("/settings/profile") });
    expect(lastAppLocation()).toBe("/dashboard/dms/d1");
  });

  it("ignores a stored value that is not an app screen", () => {
    sessionStorage.setItem("pb_last_app_location", "https://evil.test/");
    expect(lastAppLocation()).toBe("/dashboard");
  });
});
