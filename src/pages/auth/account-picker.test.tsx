import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { listAccounts, rememberActiveAccount, saveActiveAccount } from "../../services/accounts";
import { clearAuthToken, getAuthToken, persistSession, setActiveAccountId } from "../../services/auth";
import { resolveInstance, setStoredInstance } from "../../services/instance";
import { jsonResponse, mockFetch } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { AccountPickerPage } from "./AccountPickerPage";

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
});
afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
});

/** Every saved account is signed out: no live session, and no saved session to open. */
function signEveryoneOut() {
  clearAuthToken();
  const signedOut = listAccounts().map((a) => ({ ...a, snapshot: null }));
  localStorage.setItem("pb_accounts", JSON.stringify(signedOut));
  sessionStorage.removeItem("pb_accounts");
}

const render = () => renderWithProviders(<AccountPickerPage />, { route: "/accounts" });

describe("the account picker", () => {
  it("shows every saved account with its instance, and a way to add another", () => {
    render();
    expect(screen.getByRole("heading", { name: "Who's playing?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ada on one.example" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bo on two.example" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add account/ })).toHaveAttribute("href", "/login?add=1");
  });

  it("opens an account whose session is still good with one click", async () => {
    const { user } = render();
    await user.click(screen.getByRole("button", { name: "ada on one.example" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(getAuthToken()).toBe("a1");
  });

  it("asks for the password of an account that has signed out, then signs in on its own instance", async () => {
    signEveryoneOut();
    expect(listAccounts().every((a) => a.snapshot === null)).toBe(true);
    const fetchMock = mockFetch(jsonResponse({ auth_token: "fresh", refresh_token: "r-fresh", auth_token_expire_time: "2099-01-01T00:00:00Z" }));
    const { user } = render();

    await user.click(screen.getByRole("button", { name: "ada on one.example, signed out" }));
    expect(assign).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Password for one.example"), "hunter22");
    await user.click(screen.getByRole("button", { name: /Enter/ }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(new URL(String(fetchMock.mock.calls[0]![0])).origin).toBe("https://one.example");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ username: "ada", password: "hunter22" });
    expect(getAuthToken()).toBe("fresh");
  });

  it("says why when the password is wrong and stays put", async () => {
    signEveryoneOut();
    mockFetch(jsonResponse({ error_code: "auth.invalid_credentials", message: "no" }, 401));
    const { user } = render();

    await user.click(screen.getByRole("button", { name: "ada on one.example, signed out" }));
    await user.type(screen.getByLabelText("Password for one.example"), "wrong");
    await user.click(screen.getByRole("button", { name: /Enter/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("wants a password before it asks the instance anything", async () => {
    signEveryoneOut();
    const fetchMock = mockFetch();
    const { user } = render();

    await user.click(screen.getByRole("button", { name: "bo on two.example, signed out" }));
    await user.click(screen.getByRole("button", { name: /Enter/ }));

    expect(await screen.findByText("Enter your password.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes an account from this device in manage mode, and selecting does nothing there", async () => {
    signEveryoneOut();
    const { user } = render();

    await user.click(screen.getByRole("button", { name: "Manage accounts" }));
    await user.click(screen.getByRole("button", { name: "ada on one.example, signed out" })); // not an action in this mode
    expect(screen.queryByLabelText("Password for one.example")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove ada from this device" }));

    expect(screen.queryByRole("button", { name: /^ada on/ })).not.toBeInTheDocument();
    expect(listAccounts().map((a) => a.username)).toEqual(["bo"]);
  });
});
