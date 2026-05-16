import type { Route } from "./+types/login";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";

import Button from "../components/Button";
import Input from "../components/Input";
import PasswordField from "../components/PasswordField";
import { PufferblowBrand } from "../components/PufferblowBrand";
import { Notice } from "../components/ui/Notice";
import { normalizeInstance, resolveInstance } from "../services/instance";
import { login, handleAuthentication } from "../services/user";
import { sanitizeAuthError } from "../utils/authErrors";
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
      // Never echo the server's raw error here — it may distinguish
      // "user not found" from "wrong password," which is a username-
      // enumeration vector. sanitizeAuthError collapses both to a
      // single generic message.
      setError(sanitizeAuthError(response.error, "Login failed.").message);
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
    <div className="min-h-full bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-sm items-center px-4 py-6 sm:px-6">
        <section className="w-full rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-5 sm:p-6">
          <PufferblowBrand
            size={40}
            subtitle="Sign in"
            surfaceColor="var(--color-surface)"
            className="mb-5 flex-col items-center gap-2"
            align="center"
            textClassName="items-center"
          />

          {error ? (
            <div className="mb-4">
              <Notice tone="error" message={error} />
            </div>
          ) : null}

          {loginSuccess ? (
            <div className="mb-4">
              <Notice tone="success" message="Signed in. Redirecting…" />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              label="Username"
              disabled={isSubmitting}
              fullWidth
              required
            />

            <PasswordField
              id="password"
              name="password"
              autoComplete="current-password"
              label="Password"
              disabled={isSubmitting}
              fullWidth
              required
            />

            <Input
              id="hostPort"
              name="hostPort"
              label="Home instance"
              placeholder="localhost:7575"
              disabled={isSubmitting}
              fullWidth
              required
            />

            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                disabled={isSubmitting}
                className="h-4 w-4 rounded border border-[var(--color-border)] bg-[var(--color-background)]"
              />
              Remember me
            </label>

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={loginSuccess}
            >
              {loginSuccess ? "Redirecting…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
            New here?{" "}
            <Link
              to={buildSiblingAuthLink(
                "/signup",
                new URLSearchParams(location.search).get("redirect"),
              )}
              className="text-[var(--color-text)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)]"
            >
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
