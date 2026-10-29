import { createBrowserRouter, Navigate, redirect } from "react-router";
import { listPeople } from "./services/accounts";
import { getAuthToken } from "./services/auth";
import { buildAuthRedirectPath } from "./utils/authRedirect";
import { RootLayout } from "./layouts/RootLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { AccountPickerPage } from "./pages/auth/AccountPickerPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage, RouteErrorPage } from "./pages/NotFoundPage";
import { ServerView } from "./pages/dashboard/ServerView";
import { FriendsView } from "./pages/dashboard/FriendsView";
import { DirectMessageView } from "./pages/dashboard/DirectMessageView";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { ControlPanelPage } from "./pages/control-panel/ControlPanelPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        loader: rootLoader,
        element: <HomePage />,
      },
      { path: "accounts", element: <AccountPickerPage /> },
      {
        path: "login",
        element: <AuthLayout />,
        children: [{ index: true, element: <LoginPage /> }],
      },
      {
        path: "signup",
        element: <AuthLayout />,
        children: [{ index: true, element: <SignupPage /> }],
      },
      {
        path: "dashboard",
        loader: requireAuth,
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard/friends" replace /> },
          { path: "channels/:channelId?", element: <ServerView /> },
          { path: "friends", element: <FriendsView /> },
          { path: "dms/:conversationId", element: <DirectMessageView /> },
        ],
      },
      {
        path: "settings",
        loader: requireAuth,
        element: <DashboardLayout />,
        children: [{ path: ":section?", element: <SettingsPage /> }],
      },
      {
        path: "control-panel",
        loader: requireAuth,
        element: <DashboardLayout />,
        children: [{ path: ":section?", element: <ControlPanelPage /> }],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function requireAuth({ request }: { request: Request }) {
  if (getAuthToken()) return null;
  const { pathname, search, hash } = new URL(request.url);
  return redirect(buildAuthRedirectPath(pathname, search, hash));
}

function rootLoader() {
  if (getAuthToken()) {
    const lastRoute = localStorage.getItem("pb_last_route");
    if (lastRoute && ["/dashboard", "/settings", "/control-panel"].includes(lastRoute)) {
      return redirect(lastRoute);
    }
    return redirect("/dashboard");
  }
  // Nobody is signed in, but accounts are saved on this device: choose one.
  if (listPeople().length > 0) return redirect("/accounts");
  return null;
}
