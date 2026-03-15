import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Navigate,
  useLocation,
} from "react-router";
import { useEffect } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import { PufferblowMark } from "./components/PufferblowBrand";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/Toast";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { getAuthTokenFromCookies } from "./services/user";
import { startBackgroundAuthRefresh } from "./services/authSession";
import { buildAuthRedirectPath, resolvePostAuthRedirect } from "./utils/authRedirect";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
    },
  },
});

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/png", href: "/favicon.png" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Noto+Color+Emoji&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased">
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    return startBackgroundAuthRefresh(() => {
      queryClient.clear();
      if (typeof window === 'undefined') return;

      const currentPath = window.location.pathname;
      const publicPaths = new Set(['/login', '/signup', '/', '/download']);
      if (!publicPaths.has(currentPath)) {
        window.location.href = buildAuthRedirectPath(
          window.location.pathname,
          window.location.search,
          window.location.hash,
        );
      }
    });
  }, []);

  // Check authentication status
  const authToken = getAuthTokenFromCookies();
  const isAuthenticated = !!authToken;

  // Define route categories
  const publicRoutes = ['/login', '/signup', '/', '/download'];
  const homeRoutes = ['/']; // Home/marketing page at root
  const authRoutes = ['/login', '/signup'];

  // Check if current route requires authentication
  const currentPath = location.pathname;
  const isHomeRoute = homeRoutes.includes(currentPath);
  const isAuthRoute = authRoutes.includes(currentPath);
  const isPublicRoute = publicRoutes.includes(currentPath);
  const isProtectedRoute = !isPublicRoute && !isHomeRoute;
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = resolvePostAuthRedirect(searchParams.get("redirect"));

  // Universal authentication logic for both web and desktop:

  // 1. If authenticated user tries to access auth pages, redirect to dashboard
  let content: React.ReactNode = <Outlet />;

  if (isAuthRoute && isAuthenticated) {
    content = <Navigate to={redirectTarget} replace />;
  } else if (isHomeRoute && isAuthenticated) {
    content = <Navigate to="/dashboard" replace />;
  } else if (isProtectedRoute && !isAuthenticated) {
    content = (
      <Navigate
        to={buildAuthRedirectPath(location.pathname, location.search, location.hash)}
        replace
      />
    );
  }

  // 4. Debug authentication state for settings page access
  if (currentPath === '/settings' && !isAuthenticated) {
    console.log('Settings page access blocked: Not authenticated');
  }

  

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{content}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <ThemeProvider>
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background)]">
                <PufferblowMark
                  size={44}
                  surfaceColor="var(--color-background)"
                />
              </div>
              <h1 className="text-6xl font-bold text-[var(--color-text)] mb-2">{message}</h1>
              <p className="text-xl text-[var(--color-text-secondary)]">{details}</p>
            </div>

            <div className="space-y-4">
              <Link
                to="/"
                className="inline-block w-full rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Go Home
              </Link>
              <Link
                to="/dashboard"
                className="inline-block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-6 py-3 font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              >
                Go to Dashboard
              </Link>
            </div>

            {stack && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-medium mb-2">
                  Error Details (Development)
                </summary>
                <pre className="w-full overflow-x-auto rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] p-4 text-sm text-[var(--color-text)] font-mono">
                  <code>{stack}</code>
                </pre>
              </details>
            )}
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
