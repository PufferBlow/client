import { Link, useLocation } from "react-router";
import type { Route } from "../+types/root";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Not Found | PufferBlow" },
    { name: "description", content: "Page not found." },
  ];
}

export default function NotFound() {
  const location = useLocation();

  // Check if this is an asset request (source maps, CSS, etc.)
  const isAssetLike = location.pathname?.match(/\.(map|css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i);

  // Log helpful information in development
  if (import.meta.env.DEV) {
    console.info(
      `${isAssetLike ? 'Asset' : 'Route'} not found: ${location.pathname}`,
      'Consider: React DevTools or browser extensions may be requesting development assets.'
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
      <div className="max-w-md w-full text-center">
        <div className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background)]">
              {isAssetLike ? (
                <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.966-5.5-2.5M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
                </svg>
              )}
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
              {isAssetLike ? 'Asset Not Found' : 'Page Not Found'}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] opacity-75 mb-4">
              {location.pathname}
            </p>
            <p className="text-lg text-[var(--color-text-secondary)] mb-4">
              {isAssetLike
                ? 'The requested asset could not be found. This may be due to browser extensions or development tools requesting missing development resources.'
                : 'The page you are looking for does not exist.'
              }
            </p>
            <div className="space-y-3">
              <Link
                to="/"
                className="inline-block w-full rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Go Home
              </Link>
              {!isAssetLike && (
                <Link
                  to="/dashboard"
                  className="inline-block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-6 py-3 font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>

            {isAssetLike && import.meta.env.DEV && (
              <div className="mt-4 text-xs text-[var(--color-text-secondary)]">
                <strong>Development note:</strong> Asset requests like this are common from browser extensions like React DevTools.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
