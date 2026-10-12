import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from "react-router";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { useSessionKeeper } from "../hooks/useSessionKeeper";
import { getAuthToken, persistSession } from "../services/auth";
import { jsonResponse, routeFetch, signIn } from "../test/helpers";
import { renderWithProviders } from "../test/render";
import { NotFoundPage, RouteErrorPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("shows the missing path and a sign-in link when signed out", () => {
    renderWithProviders(<NotFoundPage />, { route: "/no/such/page", path: "*" });

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("/no/such/page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("offers the dashboard when signed in", () => {
    signIn();
    renderWithProviders(<NotFoundPage />, { route: "/nope", path: "*" });

    expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("always links home", () => {
    renderWithProviders(<NotFoundPage />, { route: "/nope", path: "*" });
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});

describe("RouteErrorPage", () => {
  const renderWithError = (loader: () => never) => {
    const router = createMemoryRouter([{ path: "/", loader, element: <div />, errorElement: <RouteErrorPage /> }]);
    return render(<RouterProvider router={router} />);
  };

  it("shows the error message for an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithError(() => {
      throw new Error("kaboom");
    });

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("kaboom")).toBeInTheDocument();
  });

  it("treats a thrown 404 response as not found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithError(() => {
      throw new Response("", { status: 404, statusText: "Not Found" });
    });

    expect(await screen.findByText("404")).toBeInTheDocument();
  });

  it("falls back to the status text for other thrown responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithError(() => {
      throw new Response("", { status: 500, statusText: "Server Exploded" });
    });

    expect(await screen.findByText("Server Exploded")).toBeInTheDocument();
  });
});

describe("useSessionKeeper", () => {
  const origin = "http://localhost:7575";

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<>{children}</>} />
        <Route path="/login" element={<div data-testid="login-page" />} />
      </Routes>
    </MemoryRouter>
  );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    signIn("access-1", origin);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const session = (expiresIn: number) => ({
    auth_token: "access-1",
    refresh_token: "refresh-1",
    auth_token_expire_time: new Date(Date.now() + expiresIn).toISOString(),
    refresh_token_expire_time: "2099-01-01T00:00:00Z",
  });

  it("leaves a healthy session alone", async () => {
    persistSession(session(10 * 60_000), true);
    const fetchMock = routeFetch({});

    renderHook(() => useSessionKeeper(), { wrapper });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes shortly before the access token expires", async () => {
    persistSession(session(60_000), true); // under the 2-minute lead time
    const fetchMock = routeFetch({
      "POST /api/v1/auth/refresh": jsonResponse({ auth_token: "access-2", refresh_token: "refresh-2", auth_token_expire_time: "2099-01-01T00:00:00Z" }),
    });

    renderHook(() => useSessionKeeper(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ refresh_token: "refresh-1" });
    await waitFor(() => expect(getAuthToken()).toBe("access-2"));
  });

  it("keeps checking on an interval", async () => {
    persistSession(session(10 * 60_000), true);
    const fetchMock = routeFetch({
      "POST /api/v1/auth/refresh": jsonResponse({ auth_token: "access-2", refresh_token: "refresh-2", auth_token_expire_time: "2099-01-01T00:00:00Z" }),
    });

    renderHook(() => useSessionKeeper(), { wrapper });
    await vi.advanceTimersByTimeAsync(7 * 60_000); // 3 minutes left: outside the 2-minute lead time
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(90_000); // 1.5 minutes left: inside it
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("sends the user to sign-in when the session can't be renewed", async () => {
    persistSession(session(30_000), true);
    routeFetch({ "POST /api/v1/auth/refresh": jsonResponse({ error_code: "auth.refresh_token_expired" }, 401) });
    document.cookie = "auth_token=; Path=/; Max-Age=0"; // the cookie already expired

    renderHook(() => useSessionKeeper(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);

    expect(await screen.findByTestId("login-page")).toBeInTheDocument();
    expect(getAuthToken()).toBeNull();
  });

  it("stops checking when unmounted", async () => {
    persistSession(session(10 * 60_000), true);
    const fetchMock = routeFetch({});

    const { unmount } = renderHook(() => useSessionKeeper(), { wrapper });
    unmount();
    await vi.advanceTimersByTimeAsync(20 * 60_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
