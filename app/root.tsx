import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Navigate,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/Toast";
import { CustomTitleBar } from "./components/CustomTitleBar";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

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
  { rel: "icon", type: "image/png", href: "/pufferblow-art-pixel-32x32.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
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
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              {/* Custom title bar for Electron desktop app */}
              <CustomTitleBar />
              <div className="flex-1 flex flex-col overflow-hidden">
                {children}
              </div>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Check if we're in Electron desktop app environment
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  // In Electron, redirect root to login for first time users,
  // but allow routing to work normally for all authenticated routes
  if (isElectron && typeof window !== 'undefined') {
    // Allow normal routing in Electron - authentication checks happen in individual components
    return <Outlet />;
  }

  return <Outlet />;
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
      <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl p-8 border border-[var(--color-border)]">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.966-5.5-2.5M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
                </svg>
              </div>
              <h1 className="text-6xl font-bold text-[var(--color-text)] mb-2">{message}</h1>
              <p className="text-xl text-[var(--color-text-secondary)]">{details}</p>
            </div>

            <div className="space-y-4">
              <Link
                to="/"
                className="inline-block w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Go Home
              </Link>
              <Link
                to="/dashboard"
                className="inline-block w-full border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>

            {stack && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-medium mb-2">
                  Error Details (Development)
                </summary>
                <pre className="w-full p-4 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] overflow-x-auto text-sm font-mono">
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
