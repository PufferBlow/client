import type { Route } from "./+types/signup";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";

import Button from "../components/Button";
import Input from "../components/Input";
import { PufferblowBrand } from "../components/PufferblowBrand";
import { normalizeInstance, resolveInstance } from "../services/instance";
import { signup, handleAuthentication } from "../services/user";
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
      setError(response.error || "Signup failed.");
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
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,460px)]">
          <section className="hidden rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-8 lg:flex lg:flex-col lg:justify-between">
            <div>
              <PufferblowBrand
                size={72}
                subtitle="Create an account on your instance"
                surfaceColor="var(--color-surface)"
                className="flex-col items-start gap-5"
                titleClassName="text-5xl"
                subtitleClassName="text-[11px]"
              />
              <div className="mt-10 max-w-xl space-y-5">
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--color-text)]">
                  Start with a quieter interface and your own home instance.
                </h1>
                <p className="text-lg leading-8 text-[var(--color-text-secondary)]">
                  Create your account, save your instance address once, and move straight into
                  channels, members, and settings that stay visually calm.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Immediate sign-in after signup
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Shared theme presets
              </div>
              <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-4">
                Instance-aware account flow
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8">
            <div className="mb-8 lg:hidden">
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
              <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text)]">
                {error}
              </div>
            ) : null}

            {signupSuccess ? (
              <div className="mb-5 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text)]">
                Account created. Redirecting now.
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

              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                label="Password"
                helperText="Use at least 8 characters."
                placeholder="Create a password"
                disabled={isSubmitting}
                fullWidth
                required
              />

              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
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
    </div>
  );
}
