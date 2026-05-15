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
import { sanitizeAuthError } from "../utils/authErrors";
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
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const hostPort = formData.get("hostPort") as string;
    const rememberMe = formData.get("remember-me") === "on";

    if (!username || !password || !confirmPassword || !hostPort) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
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
      // Sanitize so the form never echoes a server message that, for
      // example, distinguishes "username taken" from "username invalid"
      // in a way that aids enumeration. Known cases map to friendly
      // generic strings; everything else falls back.
      setError(sanitizeAuthError(response.error, "Signup failed.").message);
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
      <div className="mx-auto flex min-h-full w-full max-w-md items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8">
          <div className="mb-8">
            <PufferblowBrand
              size={56}
              subtitle="Create an account on your instance"
              surfaceColor="var(--color-surface)"
              className="flex-col items-center gap-4"
              align="center"
              textClassName="items-center"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
              Create account
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Sign up on your home instance and we’ll sign you in immediately after setup.
            </p>
          </div>

          {error ? (
            <div className="mb-5">
              <Notice tone="error" message={error} />
            </div>
          ) : null}

          {signupSuccess ? (
            <div className="mb-5">
              <Notice tone="success" message="Account created. Redirecting now." />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              label="Username"
              placeholder="Choose a username"
              disabled={isSubmitting}
              fullWidth
              required
            />

            <PasswordField
              id="password"
              name="password"
              autoComplete="new-password"
              label="Password"
              helperText="Use at least 8 characters."
              placeholder="Create a password"
              disabled={isSubmitting}
              fullWidth
              required
            />

            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              label="Confirm password"
              placeholder="Repeat your password"
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
              Remember this session on this device
            </label>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              disabled={signupSuccess}
            >
              {signupSuccess ? "Redirecting..." : "Create account"}
            </Button>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              {signupSuccess
                ? "Your account is ready on this home instance."
                : "You’ll be signed in automatically once the account is created."}
            </p>
          </form>

          <div className="mt-8 border-t border-[var(--color-border-secondary)] pt-6 text-center text-sm text-[var(--color-text-secondary)]">
            <p>
              Already have an account?{" "}
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
          </div>
        </section>
      </div>
    </div>
  );
}
