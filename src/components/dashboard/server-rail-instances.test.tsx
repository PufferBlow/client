import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { rememberActiveAccount, saveActiveAccount } from "../../services/accounts";
import { getActiveAccountId, getAuthToken, persistSession, setActiveAccountId } from "../../services/auth";
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
  it("shows the instance you are in, and each other instance you hold an account on", async () => {
    renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });

    expect(await screen.findByRole("link", { name: /Two Place/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to ada on one.example" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Switch to bo/ })).not.toBeInTheDocument(); // you are already there
    expect(screen.getByRole("button", { name: "Add an instance" })).toBeInTheDocument();
  });

  it("switching to another instance signs in as that account and starts the app over", async () => {
    const { user } = renderWithProviders(<ServerRail />, { route: "/dashboard/channels", path: "*" });

    await user.click(await screen.findByRole("button", { name: "Switch to ada on one.example" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(getAuthToken()).toBe("a1");
    expect(getActiveAccountId()).toBe(`ada@${one.raw}`);
  });

  it("goes to the picker instead when that account has to sign in again", async () => {
    localStorage.setItem("pb_accounts", JSON.stringify(JSON.parse(localStorage.getItem("pb_accounts")!).map((a: { id: string }) => (a.id.startsWith("ada") ? { ...a, snapshot: null } : a))));
    const { user } = renderWithProviders(<ServerRail />, { route: "/dashboard/channels" });

    await user.click(await screen.findByRole("button", { name: "Switch to ada on one.example" }));

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/accounts");
    expect(assign).not.toHaveBeenCalled();
  });

  it("adds an instance through the login page", async () => {
    const { user } = renderWithProviders(<ServerRail />, { route: "/dashboard/channels" });
    await user.click(await screen.findByRole("button", { name: "Add an instance" }));
    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/login?add=1");
  });
});
