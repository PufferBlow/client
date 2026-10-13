import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { routeFetch, signIn } from "../test/helpers";
import { renderWithProviders } from "../test/render";
import { DashboardLayout } from "./DashboardLayout";
import { getInstanceStatus, resetInstanceStatus, setInstanceStatus } from "../features/instance/status";

beforeEach(() => {
  signIn("tok");
  routeFetch({
    "POST /api/v1/users/profile": { user_data: { user_id: "me", username: "ada", status: "online", roles_ids: ["owner"] } },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server" } },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
  });
});

describe("DashboardLayout", () => {
  it("shows the server rail on chat views", async () => {
    renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels", path: "*" });
    expect(await screen.findByRole("navigation", { name: "Servers" })).toBeInTheDocument();
  });

  it.each(["/settings", "/settings/account", "/control-panel", "/control-panel/channels"])("hides it on %s", (route) => {
    renderWithProviders(<DashboardLayout />, { route, path: "*" });
    expect(screen.queryByRole("navigation", { name: "Servers" })).not.toBeInTheDocument();
  });
});

describe("DashboardLayout when the instance can't be used", () => {
  afterEach(() => {
    resetInstanceStatus();
    vi.unstubAllGlobals();
  });

  it("covers the app with a reconnecting screen while the instance is unreachable", async () => {
    setInstanceStatus("unreachable");
    renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels", path: "*" });

    const screenDialog = screen.getByRole("alertdialog", { name: "Can't reach your instance" });
    expect(screenDialog).toHaveTextContent("localhost:7575");
    expect(screenDialog).toHaveTextContent(/Trying again in \ds/);
    // The app underneath is kept but out of reach.
    expect(screen.queryByRole("navigation", { name: "Servers" })).not.toBeInTheDocument();
  });

  it("goes back to the app once a retry gets an answer", async () => {
    setInstanceStatus("unreachable");
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels", path: "*" });

    await user.click(screen.getByRole("button", { name: "Retry now" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(getInstanceStatus()).toBe("ok");
    expect(await screen.findByRole("navigation", { name: "Servers" })).toBeInTheDocument();
  });

  it("keeps waiting when a retry still gets no answer", async () => {
    setInstanceStatus("unreachable");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels", path: "*" });

    await user.click(screen.getByRole("button", { name: "Retry now" }));
    // Backed off to the next step (4s, or 3s if a second has already ticked by).
    expect(await screen.findByText(/Trying again in [34]s/, undefined, { timeout: 5_000 })).toBeInTheDocument();
    expect(getInstanceStatus()).toBe("unreachable");
  });

  it("says so when the device is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    setInstanceStatus("unreachable");
    renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels", path: "*" });
    expect(screen.getByRole("alertdialog", { name: "You're offline" })).toBeInTheDocument();
  });

  it("asks to sign in again when the session ended, and comes back to the same place", async () => {
    setInstanceStatus("signed_out");
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/dashboard/channels/c1", path: "/dashboard/*" });

    expect(screen.getByRole("alertdialog", { name: "Your session has ended" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in again" }));

    expect(screen.getByTestId("elsewhere")).toHaveTextContent("/login?redirect=%2Fdashboard%2Fchannels%2Fc1");
    expect(document.cookie).not.toContain("auth_token=tok");
    expect(getInstanceStatus()).toBe("ok");
  });
});
