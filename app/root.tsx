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
import { TitleBar } from "./components/TitleBar";
import { TitleBarProvider } from "./context/TitleBarContext";
import { DeepLinkRouter } from "./components/DeepLinkRouter";
import { UpdateBanner } from "./components/UpdateBanner";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { getAuthTokenFromCookies } from "./services/user";
import { startBackgroundAuthRefresh } from "./services/authSession";
import { buildAuthRedirectPath, resolvePostAuthRedirect } from "./utils/authRedirect";

const CACHE_KEY = 'PUFFERBLOW_QUERY_CACHE';
const CACHE_BUSTER = 'pb-v1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 min: data is fresh, no background refetch
      gcTime: 1000 * 60 * 60 * 24,     // 24h: keep unused data in memory/storage
      retry: 1,
    },
  },
});

// Persist the React Query cache to localStorage so channels, server info, and
// user data survive page reloads and app restarts — the same pattern Discord
// uses (they run SQLite; localStorage is sufficient for our data volumes).
// On startup the cache hydrates instantly, then refetches stale data in the
// background so the user never sees a blank loading screen on re-open.
if (typeof window !== 'undefined') {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: CACHE_KEY,
    throttleTime: 1000,
  });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24,
    buster: CACHE_BUSTER,
  });
}

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
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Nunito:wght@400;500;600&display=swap",
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
      <body className="h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-text)] antialiased">
        <TitleBar />
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
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
      // Clear both in-memory and persisted cache on auth expiry so stale
      // user data doesn't leak into the next session.
      queryClient.clear();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CACHE_KEY);
      }

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

  const authToken = getAuthTokenFromCookies();
  const isAuthenticated = !!authToken;

  // The Electron desktop client does not ship the marketing home page or the
  // download page — those only make sense on the web. Redirect them immediately.
  const isElectronClient = typeof window !== 'undefined' && 'electron' in window;
  const electronOnlyRedirectPaths = new Set(['/', '/download']);

  const publicRoutes = ['/login', '/signup', '/', '/download'];
  const homeRoutes = ['/'];
  const authRoutes = ['/login', '/signup'];

  const currentPath = location.pathname;
  const isHomeRoute = homeRoutes.includes(currentPath);
  const isAuthRoute = authRoutes.includes(currentPath);
  const isPublicRoute = publicRoutes.includes(currentPath);
  const isProtectedRoute = !isPublicRoute && !isHomeRoute;
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = resolvePostAuthRedirect(searchParams.get("redirect"));

  let content: React.ReactNode = <Outlet />;

  // Electron: home/download → login or dashboard immediately.
  if (isElectronClient && electronOnlyRedirectPaths.has(currentPath)) {
    content = isAuthenticated
      ? <Navigate to="/dashboard" replace />
      : <Navigate to="/login" replace />;
  } else if (isAuthRoute && isAuthenticated) {
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



  return (
    <TitleBarProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            {/* Electron-only: navigate on pufferblow:// activations. No-op in browser. */}
            <DeepLinkRouter />
            {content}
            {/* Electron-only: surface auto-updater progress. No-op in browser. */}
            <UpdateBanner />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </TitleBarProvider>
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
