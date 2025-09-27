import type { Route } from "./+types/login";
import { Link, redirect, useActionData } from "react-router";
import { login } from "../services/user";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Login - Pufferblow" },
    { name: "description", content: "Sign in to your Pufferblow account" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const hostPort = formData.get("hostPort") as string;
  const rememberMe = formData.get("remember-me") === "on";

  if (!username || !password || !hostPort) {
    return { error: "All fields are required" };
  }

  // Validate host:port format
  const hostPortRegex = /^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\]):(\d+)$/;
  if (!hostPortRegex.test(hostPort)) {
    return { error: "Invalid host:port format. Please use format like '127.0.0.1:7575' or 'localhost:7575'" };
  }

  // Additional validation: try to create a URL to check if it's a valid format
  try {
    const testUrl = new URL(`http://${hostPort}`);
    if (!testUrl.hostname || !testUrl.port) {
      throw new Error('Invalid host or port');
    }
  } catch (error) {
    return { error: "Invalid host:port format. Please ensure the host and port are valid." };
  }

  const response = await login(hostPort, { username, password });

  if (!response.success) {
    // Check for specific error message from server
    const errorData = response.data as any;
    if (errorData?.error) {
      return { error: errorData.error };
    }
    return { error: response.error || "Login failed" };
  }

  // Handle server response format
  const data = response.data as any;
  const token = data?.auth_token;
  const expireTime = data?.auth_token_expire_time;

  if (token) {
    // Always save host:port in localStorage for easy access (only on client)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("serverHostPort", hostPort);
    }

    // Create redirect response with cookie
    const response = redirect("/dashboard");

    if (rememberMe) {
      // Store token in cookie for longer persistence
      const maxAge = expireTime ? Math.floor((new Date(expireTime).getTime() - Date.now()) / 1000) : 86400 * 30;
      response.headers.append("Set-Cookie", `authToken=${token}; path=/; max-age=${maxAge}`);
    } else {
      // Store token in session cookie (expires when browser closes)
      response.headers.append("Set-Cookie", `authToken=${token}; path=/`);
    }

    console.log('Token saved to cookies via response headers:', token);
    return response;
  }

  return { error: "Invalid response from server" };
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-[var(--color-surface)] backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-[var(--color-border)]">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[var(--color-text)]">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Sign in to your account
            </p>
          </div>

          {actionData?.error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {actionData.error}
            </div>
          )}

          {/* Login Form */}
          <form method="post" className="space-y-6">
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
                placeholder="Enter your username"
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
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                placeholder="Enter your password"
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
                placeholder="127.0.0.1:7575"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)] rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--color-text-secondary)]">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors"
              >
                Sign in
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
