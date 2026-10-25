import { Link, isRouteErrorResponse, useLocation, useRouteError } from "react-router";
import { Home, LogIn } from "lucide-react";
import { Button, PufferblowBrand } from "@pufferblow/spines";
import { getAuthToken } from "../services/auth";

interface ErrorViewProps {
  code: string;
  title: string;
  message: string;
  /** Shown as a monospace hint, e.g. the path that wasn't found. */
  detail?: string;
}

function ErrorView({ code, title, message, detail }: ErrorViewProps) {
  const signedIn = getAuthToken() !== null;

  return (
    <main className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(154,91,42,0.35)_0%,transparent_70%)]"
      />
      <div className="relative flex max-w-md flex-col items-center">
        <PufferblowBrand size={72} />

        <p className="m-0 mt-6 bg-linear-to-b from-text to-text-muted bg-clip-text font-display text-[88px] leading-none text-transparent">
          {code}
        </p>
        <h1 className="m-0 mt-3 font-display text-3xl font-normal tracking-normal">{title}</h1>
        <p className="mb-0 mt-2 text-[15px] text-text-tertiary">{message}</p>
        {detail && (
          <code className="mt-4 max-w-full truncate rounded-lg bg-surface-secondary px-3 py-1.5 font-mono text-xs text-text-muted">{detail}</code>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {signedIn ? (
            <Link to="/dashboard">
              <Button size="lg">
                <Home size={16} aria-hidden="true" />
                Back to dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button size="lg">
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </Button>
            </Link>
          )}
          <Link to="/">
            <Button size="lg" variant="secondary">
              Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Rendered by the catch-all route for any URL that doesn't match. */
export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <ErrorView
      code="404"
      title="This page has drifted off"
      message="We couldn't find anything at that address. It may have moved, or the link might be mistyped."
      detail={pathname}
    />
  );
}

/** Route-level error boundary: loader/render failures and any 404 that reaches it. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorView code="404" title="This page has drifted off" message="We couldn't find anything at that address." />;
  }

  const message = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : undefined;
  return (
    <ErrorView
      code="Oops"
      title="Something went wrong"
      message="An unexpected error stopped this page from loading. Try again, or head back."
      detail={message}
    />
  );
}
