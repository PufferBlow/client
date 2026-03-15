import type { Route } from "./+types/login";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";

import Button from "../components/Button";
import Input from "../components/Input";
import { PufferblowBrand } from "../components/PufferblowBrand";
import { normalizeInstance, resolveInstance } from "../services/instance";
import { login, handleAuthentication } from "../services/user";
import { buildSiblingAuthLink, resolvePostAuthRedirect } from "../utils/authRedirect";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Login - Pufferblow" },
    { name: "description", content: "Sign in to your Pufferblow account" },
  ];
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const redirectTarget = resolvePostAuthRedirect(
    new URLSearchParams(location.search).get("redirect"),
  );
  const isSubmitting = isLoading || loginSuccess;

  useEffect(() => {
    if (loginSuccess) {
      navigate(redirectTarget, { replace: true });
    }
  }, [loginSuccess, navigate, redirectTarget]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const hostPort = formData.get("hostPort") as string;
    const rememberMe = formData.get("remember-me") === "on";

    if (!username || !password || !hostPort) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }

    let normalizedInstance = "";
    try {
      normalizedInstance = normalizeInstance(hostPort);
      resolveInstance(hostPort);
    } catch {
      setError(
        "Invalid instance address. Use values like 'localhost:7575', 'https://pufferblow.example', or 'chat.example.com'.",
      );
      setIsLoading(false);
      return;
    }

    const response = await login(normalizedInstance, { username, password });

    if (!response.success) {
      setError(response.error || "Login failed.");
      setIsLoading(false);
      return;
    }

    const data = response.data as any;
    const token = data?.auth_token;
    const refreshToken = data?.refresh_token;
    const tokenType = data?.token_type;
    const expireTime = data?.auth_token_expire_time;
    const refreshTokenExpireTime = data?.refresh_token_expire_time;

    if (token) {
      await handleAuthentication(
        token,
        normalizedInstance,
        rememberMe,
        expireTime,
        refreshToken,
        refreshTokenExpireTime,
        tokenType,
      );
      setLoginSuccess(true);
    } else {
      setError("Invalid response from server.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,440px)]">
          <section className="hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8 lg:flex lg:flex-col lg:justify-between">
            <div>
              <PufferblowBrand
                size={72}
                subtitle="Sign in to your home instance"
                surfaceColor="var(--color-surface)"
                className="flex-col items-start gap-5"
                titleClassName="text-5xl"
                subtitleClassName="text-[11px]"
              />
              <div className="mt-10 max-w-xl space-y-5">
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--color-text)]">
                  A focused login flow for a decentralized client.
                </h1>
                <p className="text-lg leading-8 text-[var(--color-text-secondary)]">
                  Connect to your configured instance, keep your layout clean, and return
                  directly to the page you were trying to reach.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Home-instance aware
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Session refresh support
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Dual monochrome themes
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8">
            <div className="mb-8 lg:hidden">
              <PufferblowBrand
                size={56}
                subtitle="Sign in to your home instance"
                surfaceColor="var(--color-surface)"
                className="flex-col items-center gap-4"
                align="center"
                textClassName="items-center"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                Sign in with your instance address, then we’ll return you to your destination.
              </p>
            </div>

            {error ? (
              <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text)]">
                {error}
              </div>
            ) : null}

            {loginSuccess ? (
              <div className="mb-5 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text)]">
                Signed in. Redirecting now.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="username"
                name="username"
                autoComplete="username"
                label="Username"
                placeholder="Enter your username"
                disabled={isSubmitting}
                fullWidth
                required
              />

              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                label="Password"
                placeholder="Enter your password"
                disabled={isSubmitting}
                fullWidth
                required
              />

              <Input
                id="hostPort"
                name="hostPort"
                label="Home Instance"
                placeholder="localhost:7575, https://pb.example, or chat.example.com"
                disabled={isSubmitting}
                fullWidth
                required
              />

              <label className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border border-[var(--color-border)] bg-[var(--color-background)]"
                />
                Remember me on this device
              </label>

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                disabled={loginSuccess}
              >
                {loginSuccess ? "Redirecting..." : "Sign in"}
              </Button>

              <p className="text-center text-xs text-[var(--color-text-muted)]">
                {loginSuccess
                  ? "Your home instance accepted the session."
                  : "We preserve the page you were heading to after authentication."}
              </p>
            </form>

            <div className="mt-8 border-t border-[var(--color-border-secondary)] pt-6 text-center text-sm text-[var(--color-text-secondary)]">
              <p>
                Don&apos;t have an account?{" "}
                <Link
                  to={buildSiblingAuthLink(
                    "/signup",
                    new URLSearchParams(location.search).get("redirect"),
                  )}
                  className="text-[var(--color-text)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)]"
                >
                  Create one
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
