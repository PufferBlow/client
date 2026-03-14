import type { Route } from "./+types/signup";
import { Link, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { signup, handleAuthentication } from "../services/user";
import Button from "../components/Button";
import { PufferblowBrand } from "../components/PufferblowBrand";
import { normalizeInstance, resolveInstance } from "../services/instance";
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
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    let normalizedInstance = "";
    try {
      normalizedInstance = normalizeInstance(hostPort);
      resolveInstance(hostPort);
    } catch {
      setError("Invalid instance address. Use values like 'localhost:7575', 'https://pufferblow.example', or 'chat.example.com'.");
      setIsLoading(false);
      return;
    }

    const response = await signup(normalizedInstance, { username, password });

    if (!response.success) {
      setError(response.error || "Signup failed");
      setIsLoading(false);
      return;
    }

    // Handle server response format
    const data = response.data as any;
    const token = data?.auth_token;
    const refreshToken = data?.refresh_token;
    const tokenType = data?.token_type;
    const expireTime = data?.auth_token_expire_time;
    const refreshTokenExpireTime = data?.refresh_token_expire_time;

    if (token) {
      // Use centralized authentication handler
      await handleAuthentication(
        token,
        normalizedInstance,
        rememberMe,
        expireTime,
        refreshToken,
        refreshTokenExpireTime,
        tokenType
      );
      setSignupSuccess(true);
    } else {
      setError("Invalid response from server");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,245,220,0.08),transparent_35%),linear-gradient(180deg,var(--color-background),var(--color-background-secondary))] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center">
          <PufferblowBrand
            size={72}
            align="center"
            subtitle="Fediversed Messaging"
            surfaceColor="var(--color-background)"
            className="flex-col gap-4"
            textClassName="items-center"
            titleClassName="text-4xl"
            subtitleClassName="text-[11px] tracking-[0.32em] text-[var(--color-text-muted)]"
          />
        </div>
        <div className="bg-[var(--color-surface)] backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-[var(--color-border)]">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[var(--color-text)]">
              Create account
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Join Pufferblow today
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-[var(--color-error)] bg-[color:color-mix(in_srgb,var(--color-error)_12%,transparent)] p-3 text-[var(--color-error)]">
              {error}
            </div>
          )}

          {signupSuccess && (
            <div className="mb-4 rounded-lg border border-[var(--color-success)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,transparent)] p-3 text-[var(--color-success)]">
              Account created. Redirecting to your home instance...
            </div>
          )}

      {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="Create a password"
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="Confirm your password"
              />
            </div>

            <div>
              <label htmlFor="hostPort" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Home Instance
              </label>
              <input
                id="hostPort"
                name="hostPort"
                type="text"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="localhost:7575, https://pb.example, or chat.example.com"
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                disabled={isSubmitting}
                className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)] rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--color-text-secondary)]">
                Remember me
              </label>
            </div>

            <div>
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                disabled={signupSuccess}
              >
                {signupSuccess ? "Redirecting..." : "Create account"}
              </Button>
              <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                {signupSuccess
                  ? "Your account is ready on this home instance."
                  : "We'll sign you in immediately after the account is created."}
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Already have an account?{' '}
                <Link
                  to={buildSiblingAuthLink("/login", new URLSearchParams(location.search).get("redirect"))}
                  className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
