import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ServerRail } from "../dashboard/ServerRail";
import { HealthBanner } from "./HealthBanner";

beforeEach(() => signIn("tok"));

const profile = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "localhost:7575", roles_ids: [] };

const backend = (health: unknown) =>
  routeFetch({
    "GET /healthz": health,
    "POST /api/v1/users/profile": { user_data: profile },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server" } },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    "GET /api/v1/notifications": { notifications: [] },
    "GET /api/v1/dms/conversations": { conversations: [] },
  });

describe("trouble on the instance", () => {
  it("says so above the composer, without taking anything away", async () => {
    backend({ status: "degraded" });
    renderWithProviders(<HealthBanner />);
    expect(await screen.findByRole("status")).toHaveTextContent("This instance is having trouble");
  });

  it("shows nothing while the instance is well", async () => {
    backend({ status: "ok" });
    renderWithProviders(<HealthBanner />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows nothing when the check itself fails: no answer is not the same as trouble", async () => {
    backend(jsonResponse({ detail: "no" }, 500));
    renderWithProviders(<HealthBanner />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("puts a dot on the instance's tile in the rail", async () => {
    backend({ status: "degraded" });
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
    expect(await screen.findByRole("img", { name: "This instance is having trouble" })).toBeInTheDocument();
  });

  it("leaves the rail clean while it is well", async () => {
    backend({ status: "ok" });
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });
    await screen.findByRole("link", { name: /Test Server/ });
    expect(screen.queryByRole("img", { name: "This instance is having trouble" })).not.toBeInTheDocument();
  });
});
