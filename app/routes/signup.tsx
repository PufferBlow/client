import type { Route } from "./+types/signup";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";

import Button from "../components/Button";
import Input from "../components/Input";
import PasswordField from "../components/PasswordField";
import { PufferblowBrand } from "../components/PufferblowBrand";
import { Notice } from "../components/ui/Notice";
import { normalizeInstance, resolveInstance } from "../services/instance";
import { signup, handleAuthentication } from "../services/user";
import {
  classifyAuthError,
  type AuthErrorClassification,
} from "../utils/authErrors";
import { buildSiblingAuthLink, resolvePostAuthRedirect } from "../utils/authRedirect";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign Up - Pufferblow" },
    { name: "description", content: "Create your Pufferblow account" },
  ];
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  // Banner-level error for non-field cases (instance unreachable,
  // signup disabled, server outage). Field-specific errors live in
  // ``fieldErrors`` below.
  const [error, setError] = useState<string | null>(null);
  // Inline field errors for the three text inputs the user can
  // actually fix. ``confirmPassword`` is a client-only check (no
  // server signal carries it).
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const redirectTarget = resolvePostAuthRedirect(
    new URLSearchParams(location.search).get("redirect"),
  );
  const isSubmitting = isLoading || signupSuccess;

  useEffect(() => {
    if (signupSuccess) {
      navigate(redirectTarget, { replace: true });
    }
  }, [signupSuccess, navigate, redirectTarget]);

  /**
   * Dispatch an AuthErrorClassification into form state — field
   * errors for inline highlighting, banner for everything else.
   */
  const applyClassification = (cls: AuthErrorClassification) => {
    if (cls.field === "username" || cls.field === "new_username") {
      setFieldErrors({ username: cls.message });
      setError(null);
    } else if (cls.field === "password") {
      setFieldErrors({ password: cls.message });
      setError(null);
    } else {
      setFieldErrors({});
      setError(cls.message);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const hostPort = formData.get("hostPort") as string;
    const rememberMe = formData.get("remember-me") === "on";

    // Client-side gates BEFORE we send anything. The server now
    // enforces the same password/username rules — these checks
    // exist for instant feedback (no round-trip) and to catch the
    // pre-send mistakes (password mismatch) the server never sees.
    if (!username || !password || !confirmPassword || !hostPort) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords don't match." });
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setFieldErrors({ password: "Password must be at least 8 characters long." });
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

    const response = await signup(normalizedInstance, { username, password });

    if (!response.success) {
      // classifyAuthError reads the typed envelope when present,
      // pulls field hints onto inline inputs (username taken,
      // password rejected by server-side rules), and falls back to
      // the banner for non-field cases (signup disabled, server
      // outage, network).
      applyClassification(classifyAuthError(response, "Signup failed."));
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
      setSignupSuccess(true);
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
            subtitle="Create an account"
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

          {signupSuccess ? (
            <div className="mb-4">
              <Notice tone="success" message="Account created. Redirecting…" />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              label="Username"
              disabled={isSubmitting}
              error={fieldErrors.username}
              fullWidth
              required
            />

            <PasswordField
              id="password"
              name="password"
              autoComplete="new-password"
              label="Password"
              disabled={isSubmitting}
              minLength={8}
              error={fieldErrors.password}
              fullWidth
              required
            />

            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              label="Confirm password"
              disabled={isSubmitting}
              error={fieldErrors.confirmPassword}
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
              disabled={signupSuccess}
            >
              {signupSuccess ? "Redirecting…" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
            Have an account?{" "}
            <Link
              to={buildSiblingAuthLink(
                "/login",
                new URLSearchParams(location.search).get("redirect"),
              )}
              className="text-[var(--color-text)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)]"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
