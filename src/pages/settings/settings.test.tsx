import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { getAuthToken, isSessionRemembered, persistSession } from "../../services/auth";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { SettingsPage } from "./SettingsPage";

const me = {
  user_id: "me",
  username: "ada",
  about: "hello",
  status: "online",
  accent_color: "#ffffff",
  avatar_url: null,
  origin_server: "localhost:7575",
};

beforeEach(() => signIn("tok"));

const backend = (extra: Record<string, unknown> = {}) =>
  routeFetch({ "POST /api/v1/users/profile": { user_data: me }, ...extra });

const renderSettings = (section = "account") =>
  renderWithProviders(<SettingsPage />, { route: `/settings/${section}`, path: "/settings/:section?" });

/** JSON bodies sent with the given method + path. */
const bodies = (fetchMock: ReturnType<typeof routeFetch>, method: string, path: string) =>
  fetchMock.mock.calls
    .filter(([input, init]) => (init?.method ?? "GET") === method && new URL(String(input)).pathname === path)
    .map(([, init]) => JSON.parse(String(init!.body)) as Record<string, unknown>);

describe("SettingsPage", () => {
  it("loads the profile and shows the handle", async () => {
    backend();
    renderSettings();
    expect(await screen.findByRole("heading", { name: "My account" })).toBeInTheDocument();
    expect(await screen.findByText("@localhost:7575")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("ada");
  });

  it("shows the banner image the server hosts, and the accent colour when there is none", async () => {
    backend({
      "POST /api/v1/users/profile": {
        user_data: { ...me, avatar_url: "/assets/avatars/pb-avatar-happy-brass.svg", banner_url: "/assets/banners/pb-banner-happy-brass.svg" },
      },
    });
    const { container } = renderSettings();
    await screen.findByLabelText("Username");
    const avatar = container.querySelector('img[src$="/assets/avatars/pb-avatar-happy-brass.svg"]');
    expect(avatar).toHaveAttribute("src", "http://localhost:7575/assets/avatars/pb-avatar-happy-brass.svg"); // joined to the instance
    const banner = [...container.querySelectorAll<HTMLElement>("div.h-24")].find((el) => el.style.background.includes("pb-banner-happy-brass"));
    expect(banner).toBeDefined();
  });

  it("falls back to the accent colour for a solid banner", async () => {
    backend({ "POST /api/v1/users/profile": { user_data: { ...me, banner_url: "", banner_kind: "solid" } } });
    const { container } = renderSettings();
    await screen.findByLabelText("Username");
    const banner = container.querySelector<HTMLElement>("div.h-24");
    expect(banner?.style.background ?? "").not.toContain("url("); // no image: the accent gradient (jsdom cannot parse it)
  });

  it("sends the auth token in the body, the way the backend expects", async () => {
    const fetchMock = backend();
    renderSettings();
    await screen.findByLabelText("Username");
    expect(bodies(fetchMock, "POST", "/api/v1/users/profile")[0]).toEqual({ auth_token: "tok" });
  });

  it("marks the default section as current in the navigation even without a section in the URL", async () => {
    backend();
    renderWithProviders(<SettingsPage />, { route: "/settings", path: "/settings/:section?" });

    const nav = await screen.findByRole("navigation", { name: "Settings sections" });
    expect(within(nav).getByRole("link", { name: /My account/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Profile/ })).not.toHaveAttribute("aria-current");
  });

  it("opens the account section for an unknown section", async () => {
    backend();
    renderSettings("bogus");
    expect(await screen.findByRole("heading", { name: "My account" })).toBeInTheDocument();
  });

  it("shows an error with retry when the profile can't be loaded", async () => {
    routeFetch({ "POST /api/v1/users/profile": jsonResponse({ error_code: "auth.invalid_token", user_message: "Your session has expired." }, 401) });
    renderSettings();
    expect(await screen.findByText("Couldn't load your profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  describe("account", () => {
    it("keeps 'save' disabled until the username changes", async () => {
      backend();
      const { user } = renderSettings();
      const save = await screen.findByRole("button", { name: "Save username" });
      expect(save).toBeDisabled();

      await user.type(screen.getByLabelText("Username"), "x");
      expect(save).toBeEnabled();
    });

    it("rejects an invalid username without calling the server", async () => {
      const fetchMock = backend();
      const { user } = renderSettings();
      await user.clear(await screen.findByLabelText("Username"));
      await user.type(screen.getByLabelText("Username"), "no spaces!");
      await user.click(screen.getByRole("button", { name: "Save username" }));

      expect(await screen.findByText(/3–32 characters/)).toBeInTheDocument();
      expect(requestLog(fetchMock).filter((r) => r.startsWith("PUT"))).toHaveLength(0);
    });

    it("changes the username with a single-field PUT and refreshes the profile", async () => {
      let currentName = "ada";
      const fetchMock = backend({
        "POST /api/v1/users/profile": () => jsonResponse({ user_data: { ...me, username: currentName } }),
        "PUT /api/v1/users/profile": () => {
          currentName = "ada2";
          return jsonResponse({ status_code: 200 });
        },
      });
      const { user } = renderSettings();
      await user.clear(await screen.findByLabelText("Username"));
      await user.type(screen.getByLabelText("Username"), "ada2");
      await user.click(screen.getByRole("button", { name: "Save username" }));

      expect(await screen.findByText("Username updated.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile")).toEqual([{ new_username: "ada2", auth_token: "tok" }]);
      await waitFor(() => expect(screen.getByLabelText("Username")).toHaveValue("ada2"));
    });

    it("explains a taken username", async () => {
      backend({ "PUT /api/v1/users/profile": jsonResponse({ error_code: "auth.username_taken", message: "taken", details: { field: "new_username" } }, 409) });
      const { user } = renderSettings();
      await user.type(await screen.findByLabelText("Username"), "2");
      await user.click(screen.getByRole("button", { name: "Save username" }));

      expect(await screen.findByText("That username is taken.")).toBeInTheDocument();
    });

    it("validates the new password before calling the server", async () => {
      const fetchMock = backend();
      const { user } = renderSettings();
      await user.type(await screen.findByLabelText("Current password"), "old");
      await user.type(screen.getByLabelText("New password"), "short");
      await user.type(screen.getByLabelText("Confirm new password"), "other");
      await user.click(screen.getByRole("button", { name: "Change password" }));

      expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
      expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
      expect(requestLog(fetchMock).filter((r) => r.startsWith("PUT"))).toHaveLength(0);
    });

    it("requires the current password", async () => {
      backend();
      const { user } = renderSettings();
      await user.type(await screen.findByLabelText("New password"), "longenough1");
      await user.type(screen.getByLabelText("Confirm new password"), "longenough1");
      await user.click(screen.getByRole("button", { name: "Change password" }));
      expect(await screen.findByText("Enter your current password.")).toBeInTheDocument();
    });

    it("changes the password and clears the form", async () => {
      const fetchMock = backend({ "PUT /api/v1/users/profile": { status_code: 200 } });
      const { user } = renderSettings();
      await user.type(await screen.findByLabelText("Current password"), "old-password");
      await user.type(screen.getByLabelText("New password"), "brand-new-pass");
      await user.type(screen.getByLabelText("Confirm new password"), "brand-new-pass");
      await user.click(screen.getByRole("button", { name: "Change password" }));

      expect(await screen.findByText("Password updated.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile")).toEqual([
        { old_password: "old-password", new_password: "brand-new-pass", auth_token: "tok" },
      ]);
      expect(screen.getByLabelText("Current password")).toHaveValue("");
    });
  });

  describe("profile", () => {
    it("saves the about text from the card editor as its own request", async () => {
      const fetchMock = backend({ "PUT /api/v1/users/profile": { status_code: 200 } });
      const { user } = renderSettings("profile");
      const about = await screen.findByLabelText(/^About/);
      expect(about).toHaveValue("hello");

      await user.type(about, " world");
      await user.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile")).toEqual([{ about: "hello world", auth_token: "tok" }]);
    });

    it("limits the about text to 190 characters, as the instance does", async () => {
      backend();
      renderSettings("profile");
      expect(await screen.findByLabelText(/^About/)).toHaveAttribute("maxlength", "190");
    });

    it("marks the current status and saves a change with the profile", async () => {
      const fetchMock = backend({ "PUT /api/v1/users/profile": { status_code: 200, status: "dnd" } });
      const { user } = renderSettings("profile");

      expect(await screen.findByRole("button", { name: "Online" })).toHaveAttribute("aria-pressed", "true");
      await user.click(screen.getByRole("button", { name: "Do not disturb" }));
      await user.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile")).toEqual([{ status: "dnd", auth_token: "tok" }]);
    });

    it("applies an accent swatch", async () => {
      const fetchMock = backend({ "PUT /api/v1/users/profile/appearance": { status_code: 200 } });
      const { user } = renderSettings("profile");

      await user.click(await screen.findByRole("button", { name: "Use accent #c9a3f0" }));

      expect(await screen.findByText("Accent colour updated.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile/appearance")[0]).toMatchObject({ accent_color: "#c9a3f0", shuffle_avatar_seed: false });
    });

    it("rejects a malformed custom colour", async () => {
      const fetchMock = backend();
      const { user } = renderSettings("profile");

      await user.type(await screen.findByLabelText("Custom accent colour"), "purple{Enter}");

      expect(await screen.findByText("Use a hex colour like #ffffff.")).toBeInTheDocument();
      expect(requestLog(fetchMock).filter((r) => r.includes("appearance"))).toHaveLength(0);
    });

    it("shuffles the default avatar and banner", async () => {
      const fetchMock = backend({ "PUT /api/v1/users/profile/appearance": { status_code: 200 } });
      const { user } = renderSettings("profile");

      await user.click(await screen.findByRole("button", { name: /shuffle default avatar and banner/i }));

      expect(await screen.findByText("Avatar updated.")).toBeInTheDocument();
      expect(bodies(fetchMock, "PUT", "/api/v1/users/profile/appearance")[0]).toMatchObject({ avatar_kind: "identicon", shuffle_avatar_seed: true });
    });
  });

  describe("security", () => {
    it("requires the password to reset tokens", async () => {
      const fetchMock = backend();
      const { user } = renderSettings("security");
      await user.click(await screen.findByRole("button", { name: "Reset tokens" }));

      expect(await screen.findByText("Enter your password to confirm.")).toBeInTheDocument();
      expect(requestLog(fetchMock).some((r) => r.includes("reset-auth-token"))).toBe(false);
    });

    it("replaces this device's session with the new tokens, keeping its remember choice", async () => {
      persistSession({ auth_token: "old", refresh_token: "old-r" }, false);
      const fetchMock = backend({
        "POST /api/v1/users/profile/reset-auth-token": { auth_token: "new-access", refresh_token: "new-refresh", auth_token_expire_time: "2099-01-01T00:00:00Z" },
      });
      const { user } = renderSettings("security");

      await user.type(await screen.findByLabelText("Confirm with your password"), "my-password");
      await user.click(screen.getByRole("button", { name: "Reset tokens" }));

      expect(await screen.findByText(/other devices were signed out/i)).toBeInTheDocument();
      expect(bodies(fetchMock, "POST", "/api/v1/users/profile/reset-auth-token")).toEqual([{ auth_token: "old", password: "my-password" }]);
      expect(getAuthToken()).toBe("new-access");
      expect(isSessionRemembered()).toBe(false);
    });

    it("shows the server's reason when the password is wrong", async () => {
      backend({
        "POST /api/v1/users/profile/reset-auth-token": jsonResponse({ error_code: "auth.reset_password_wrong", message: "Wrong password", user_message: "That password is incorrect." }, 401),
      });
      const { user } = renderSettings("security");

      await user.type(await screen.findByLabelText("Confirm with your password"), "nope");
      await user.click(screen.getByRole("button", { name: "Reset tokens" }));

      expect(await screen.findByText("That password is incorrect.")).toBeInTheDocument();
      expect(getAuthToken()).toBe("tok"); // unchanged
    });

    it("signs out: revokes the token, clears the session, and goes to the login page", async () => {
      persistSession({ auth_token: "tok", refresh_token: "refresh-1" }, true);
      const fetchMock = backend({ "POST /api/v1/auth/revoke": { status_code: 200 } });
      const { user } = renderSettings("security");

      await user.click(await screen.findByRole("button", { name: "Sign out" }));

      expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/login");
      expect(bodies(fetchMock, "POST", "/api/v1/auth/revoke")).toEqual([{ refresh_token: "refresh-1" }]);
      expect(getAuthToken()).toBeNull();
    });
  });
});
