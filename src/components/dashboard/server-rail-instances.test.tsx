import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { rememberActiveAccount, saveActiveAccount } from "../../services/accounts";
import { persistSession, setActiveAccountId } from "../../services/auth";
import { resolveInstance, setStoredInstance } from "../../services/instance";
import { routeFetch } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ServerRail } from "./ServerRail";

const one = resolveInstance("one.example");
const two = resolveInstance("two.example");
const assign = vi.fn();

async function signInAs(name: string, instance: ReturnType<typeof resolveInstance>, token: string) {
  setStoredInstance(instance);
  setActiveAccountId(`${name}@${instance.raw}`);
  await persistSession({ auth_token: token, refresh_token: `r-${token}`, auth_token_expire_time: "2099-01-01T00:00:00Z" }, true);
  await rememberActiveAccount({ username: name });
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "auth_token=; Max-Age=0; Path=/";
  vi.stubGlobal("location", { ...window.location, assign });
  await signInAs("ada", one, "a1");
  saveActiveAccount();
  await signInAs("bo", two, "b1");
  routeFetch({
    "POST /api/v1/users/profile": { user_data: { user_id: "me", username: "bo", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "two.example", roles_ids: [], resolved_privileges: [] } },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "two.example", server_name: "Two Place" } },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    "GET /api/v1/notifications": { notifications: [] },
    "GET /api/v1/dms/conversations": { conversations: [] },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
});

describe("the rail of joined instances", () => {
  it("shows the instance you are in, and leaves other accounts to the account switcher", async () => {
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });

    expect(await screen.findByRole("link", { name: /Two Place/ })).toBeInTheDocument();
    // ada on one.example is saved on this device, but her instance is not a tile here.
    expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/one\.example/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add an instance" })).toBeInTheDocument();
  });

  it("adds an instance through the login page", async () => {
    const { user } = renderWithProviders(<ServerRail />, { route: "/dashboard/channels" });
    await user.click(await screen.findByRole("button", { name: "Add an instance" }));
    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/login?add=1");
  });
});
