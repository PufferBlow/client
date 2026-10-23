import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { getAuthToken } from "../../services/auth";
import { getStoredInstance } from "../../services/instance";
import { calledUrl, jsonResponse, mockFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";

// The handle probe has its own tests (login-art.test.tsx). Here it would fire a request once typing
// pauses for long enough, which on a slow machine lands in the middle of a test and eats the
// response the test queued for the sign-in.
vi.mock("../../features/instance/useHandleInstance", () => ({ useHandleInstance: () => ({ instance: null, preview: null, probe: "idle" }) }));

const tokens = {
  auth_token: "access-1",
  refresh_token: "refresh-1",
  auth_token_expire_time: "2099-01-01T00:00:00Z",
  refresh_token_expire_time: "2099-02-01T00:00:00Z",
};

const field = (name: RegExp | string) => screen.getByLabelText(name);

describe("LoginPage", () => {
  const renderLogin = (route = "/login") => renderWithProviders(<LoginPage />, { route });

  it("reads as adding an instance, not signing in again, when opened from the add button", () => {
    renderLogin("/login?add=1");
    expect(screen.getByRole("heading", { name: "Join another instance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add instance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?add=1");
  });

  it("requires a handle and a password before calling the server", async () => {
    const fetchMock = mockFetch();
    const { user } = renderLogin();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter your handle/i)).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for an instance when the handle has none and none is remembered", async () => {
    const fetchMock = mockFetch();
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/add your instance/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses the remembered instance when the handle has none", async () => {
    signIn("old-token", "http://localhost:7575");
    const fetchMock = mockFetch(jsonResponse(tokens));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByTestId("elsewhere");
    expect(calledUrl(fetchMock).origin).toBe("http://localhost:7575");
  });

  it("asks for a handle when only whitespace is entered", async () => {
    const { user } = renderLogin();
    await user.type(field("Handle"), "   ");
    await user.type(field("Password"), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/enter your handle/i)).toBeInTheDocument();
  });

  it("signs in against the typed instance, remembers it, and goes to the dashboard", async () => {
    const fetchMock = mockFetch(jsonResponse(tokens));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/dashboard");
    const url = calledUrl(fetchMock);
    expect(url.origin).toBe("http://localhost:7575");
    expect(url.pathname).toBe("/api/v1/users/signin");
    expect(url.search).toBe("");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ username: "ada", password: "correct horse" });
    expect(getStoredInstance()?.origin).toBe("http://localhost:7575");
    expect(getAuthToken()).toBe("access-1");
    expect(localStorage.getItem("pb_session")).not.toBeNull();
  });

  it("goes back to the page the user came from", async () => {
    mockFetch(jsonResponse(tokens));
    const { user } = renderLogin("/login?redirect=%2Fsettings%2Fprofile");

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/settings/profile");
  });

  it("ignores an off-site redirect target", async () => {
    mockFetch(jsonResponse(tokens));
    const { user } = renderLogin("/login?redirect=https%3A%2F%2Fevil.example%2F");

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/dashboard");
  });

  it("keeps the session out of persistent storage when 'stay signed in' is off", async () => {
    mockFetch(jsonResponse(tokens));
    const { user } = renderLogin();

    await user.click(screen.getByRole("switch", { name: /stay signed in/i }));
    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByTestId("elsewhere");
    expect(localStorage.getItem("pb_session")).toBeNull();
    expect(sessionStorage.getItem("pb_session")).not.toBeNull();
  });

  it("shows one generic message for bad credentials and stays on the page", async () => {
    mockFetch(jsonResponse({ error_code: "auth.invalid_credentials", user_message: "No such user ada" }, 401));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(screen.queryByText(/no such user/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("elsewhere")).not.toBeInTheDocument();
    expect(getAuthToken()).toBeNull();
  });

  it("reports an unreachable instance on the handle field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/couldn't reach that instance/i)).toBeInTheDocument();
    expect(field("Handle")).toBeInvalid();
  });

  it("shows rate limiting with the wait time", async () => {
    mockFetch(jsonResponse({ error_code: "rate_limit.exceeded", message: "slow", retry_after_seconds: 30 }, 429));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("30s");
  });

  it("disables the button while the request is in flight", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))));
    const { user } = renderLogin();

    await user.type(field("Handle"), "ada@localhost:7575");
    await user.type(field("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
    finish(jsonResponse(tokens));
    await screen.findByTestId("elsewhere");
  });

  it("reveals and hides the password", async () => {
    const { user } = renderLogin();
    const password = field("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("links to signup and keeps the redirect", () => {
    renderLogin("/login?redirect=%2Fsettings");
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/signup?redirect=%2Fsettings");
  });
});

describe("SignupPage", () => {
  const renderSignup = (route = "/signup") => renderWithProviders(<SignupPage />, { route });

  const fillAndSubmit = async (
    user: ReturnType<typeof renderSignup>["user"],
    values: { handle?: string; password?: string; confirm?: string },
  ) => {
    if (values.handle !== undefined) await user.type(field("Handle"), values.handle);
    if (values.password !== undefined) await user.type(field("Password"), values.password);
    if (values.confirm !== undefined) await user.type(field("Confirm password"), values.confirm);
    await user.click(screen.getByRole("button", { name: /create account/i }));
  };

  it("validates the username against the server rules", async () => {
    const fetchMock = mockFetch();
    const { user } = renderSignup();

    await fillAndSubmit(user, { handle: "ab@localhost:7575", password: "longenough1", confirm: "longenough1" });

    expect(await screen.findByText(/3–32 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates password length and confirmation together", async () => {
    const fetchMock = mockFetch();
    const { user } = renderSignup();

    await fillAndSubmit(user, { handle: "ada@localhost:7575", password: "short", confirm: "different" });

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the account with a JSON POST and signs in", async () => {
    const fetchMock = mockFetch(jsonResponse(tokens, 201));
    const { user } = renderSignup("/signup?redirect=%2Fsettings");

    await fillAndSubmit(user, { handle: "ada@localhost:7575", password: "longenough1", confirm: "longenough1" });

    expect(await screen.findByTestId("elsewhere")).toHaveTextContent("/settings");
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/users/signup");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ username: "ada", password: "longenough1" });
    expect(getAuthToken()).toBe("access-1");
  });

  it("puts a taken username on the handle field", async () => {
    mockFetch(jsonResponse({ error_code: "auth.username_taken", message: "taken", details: { field: "username" } }, 409));
    const { user } = renderSignup();

    await fillAndSubmit(user, { handle: "ada@localhost:7575", password: "longenough1", confirm: "longenough1" });

    expect(await screen.findByText("That username is taken.")).toBeInTheDocument();
    expect(field("Handle")).toBeInvalid();
  });

  it("puts a weak-password rejection on the password field", async () => {
    mockFetch(jsonResponse({ error_code: "auth.password_too_weak", message: "Add a digit", details: { field: "password" } }, 400));
    const { user } = renderSignup();

    await fillAndSubmit(user, { handle: "ada@localhost:7575", password: "longenough", confirm: "longenough" });

    expect(await screen.findByText("Add a digit")).toBeInTheDocument();
    expect(field("Password")).toBeInvalid();
  });

  it("explains when signups are disabled", async () => {
    mockFetch(jsonResponse({ error_code: "auth.signup_disabled", message: "Signups are closed", user_message: "Signups are closed" }, 403));
    const { user } = renderSignup();

    await fillAndSubmit(user, { handle: "ada@localhost:7575", password: "longenough1", confirm: "longenough1" });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Signups are closed"));
  });

  it("links back to sign in", () => {
    renderSignup("/signup?redirect=%2Fsettings");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?redirect=%2Fsettings");
  });
});
