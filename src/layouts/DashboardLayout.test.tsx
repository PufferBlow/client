import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { routeFetch, signIn } from "../test/helpers";
import { renderWithProviders } from "../test/render";
import { DashboardLayout } from "./DashboardLayout";

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
