import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberActiveAccount, saveActiveAccount } from "../../services/accounts";
import { getActiveAccountId, getAuthToken, persistSession, setActiveAccountId } from "../../services/auth";
import { resolveInstance, setStoredInstance } from "../../services/instance";
import { renderWithProviders } from "../../test/render";
import { AccountSwitcher } from "./AccountSwitcher";

const one = resolveInstance("one.example");
const two = resolveInstance("two.example");

async function signInAs(name: string, instance: ReturnType<typeof resolveInstance>, token: string) {
  setStoredInstance(instance);
  setActiveAccountId(`${name}@${instance.raw}`);
  await persistSession({ auth_token: token, refresh_token: `r-${token}`, auth_token_expire_time: "2099-01-01T00:00:00Z" }, true);
  await rememberActiveAccount({ username: name });
}

const assign = vi.fn();

beforeEach(async () => {
  localStorage.clear();
  document.cookie = "auth_token=; Max-Age=0; Path=/";
  vi.stubGlobal("location", { ...window.location, assign });
  await signInAs("ada", one, "a1");
  saveActiveAccount();
  await signInAs("bo", two, "b1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
});

describe("the account switcher", () => {
  it("lists every account on this device with the live one checked", async () => {
    const { user } = renderWithProviders(<AccountSwitcher>bo</AccountSwitcher>);
    await user.click(screen.getByRole("button", { name: "Switch account" }));

    const rows = screen.getAllByRole("menuitemradio");
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining("ada"), expect.stringContaining("bo")]);
    expect(screen.getByRole("menuitemradio", { name: /bo/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: /ada/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitem", { name: /Add account on another instance/ })).toBeInTheDocument();
  });

  it("switches account and reloads into a clean app", async () => {
    const { user } = renderWithProviders(<AccountSwitcher>bo</AccountSwitcher>);
    await user.click(screen.getByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("menuitemradio", { name: /ada/ }));

    expect(getAuthToken()).toBe("a1");
    expect(getActiveAccountId()).toBe(`ada@${one.raw}`);
    expect(assign).toHaveBeenCalledWith("/dashboard");
  });

  it("choosing the account you are already in just closes the menu", async () => {
    const { user } = renderWithProviders(<AccountSwitcher>bo</AccountSwitcher>);
    await user.click(screen.getByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("menuitemradio", { name: /bo/ }));

    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("adding an account saves this one first and opens the login page", async () => {
    const { user } = renderWithProviders(<AccountSwitcher>bo</AccountSwitcher>);
    await user.click(screen.getByRole("button", { name: "Switch account" }));
    await user.click(screen.getByRole("menuitem", { name: /Add account/ }));

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/login?add=1");
  });

  it("closes on Escape", async () => {
    const { user } = renderWithProviders(<AccountSwitcher>bo</AccountSwitcher>);
    await user.click(screen.getByRole("button", { name: "Switch account" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
