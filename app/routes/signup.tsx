import type { Route } from "./+types/signup";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign Up - Pufferblow" },
    { name: "description", content: "Create your Pufferblow account" },
  ];
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
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

          {/* Signup Form */}
          <form className="space-y-6">
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
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="Confirm your password"
              />
            </div>

            <div>
              <label htmlFor="hostPort" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Server Host:Port
              </label>
              <input
                id="hostPort"
                name="hostPort"
                type="text"
                required
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="localhost:8080"
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors"
              >
                Create account
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
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
