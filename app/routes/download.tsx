import { Link } from "react-router";
import { useEffect, useState } from "react";

import { PufferblowBrand } from "../components/PufferblowBrand";

type SupportedDesktopPlatform = "windows" | "linux" | "macos";
type DesktopPlatform = SupportedDesktopPlatform | "unknown";

const RELEASE_BASE_URL =
  "https://github.com/pufferblow/pufferblow-client/releases/latest/download";
const FALLBACK_RELEASES_URL =
  "https://github.com/pufferblow/pufferblow-client/releases/latest";

const downloadLinks: Record<SupportedDesktopPlatform, string> = {
  windows: `${RELEASE_BASE_URL}/pufferblow-client-windows-x64.msi`,
  linux: `${RELEASE_BASE_URL}/pufferblow-client-linux-x86_64.AppImage`,
  macos: `${RELEASE_BASE_URL}/pufferblow-client-macos-universal.dmg`,
};

const platformCards: Array<{
  key: SupportedDesktopPlatform;
  title: string;
  summary: string;
  detail: string;
}> = [
  {
    key: "windows",
    title: "Windows",
    summary: "MSI installer",
    detail: "Native packaging for Windows 10 and 11 with system integration and desktop notifications.",
  },
  {
    key: "linux",
    title: "Linux",
    summary: "Portable AppImage",
    detail: "Single-file distribution for mainstream Linux setups without requiring a package repository.",
  },
  {
    key: "macos",
    title: "macOS",
    summary: "Universal DMG",
    detail: "A desktop build for both Apple Silicon and Intel Macs with the same monochrome client experience.",
  },
];

function isAuthenticatedFromCookies(): boolean {
  const cookies = document.cookie.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key) {
        acc[key.trim()] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  return Boolean(cookies.auth_token && cookies.auth_token.trim() !== "");
}

function detectPlatformFromUserAgent(userAgent: string): DesktopPlatform {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("win")) {
    return "windows";
  }
  if (normalized.includes("macintosh") || normalized.includes("mac os x")) {
    return "macos";
  }
  if (normalized.includes("linux") && !normalized.includes("android")) {
    return "linux";
  }
  return "unknown";
}

export function meta() {
  return [
    { title: "Download Pufferblow Client" },
    {
      name: "description",
      content:
        "Download the Pufferblow desktop client for Windows, Linux, or macOS in the new minimal monochrome design.",
    },
  ];
}

export default function Download() {
  const [detectedPlatform, setDetectedPlatform] =
    useState<DesktopPlatform>("unknown");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(isAuthenticatedFromCookies());
  }, []);

  useEffect(() => {
    setDetectedPlatform(detectPlatformFromUserAgent(navigator.userAgent));
    setIsLoading(false);
  }, []);

  const recommendedHref =
    detectedPlatform === "unknown"
      ? FALLBACK_RELEASES_URL
      : downloadLinks[detectedPlatform];

  const recommendedLabel =
    detectedPlatform === "unknown"
      ? "Browse all downloads"
      : `Download for ${detectedPlatform === "macos" ? "macOS" : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}`;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-border-secondary)] border-t-[var(--color-text)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <nav className="sticky top-0 z-40 border-b border-[var(--color-border-secondary)] bg-[color:color-mix(in_srgb,var(--color-background)_94%,transparent)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="pb-focus-ring rounded-xl">
            <PufferblowBrand
              size={44}
              subtitle="Desktop Client"
              surfaceColor="var(--color-background)"
              titleClassName="text-2xl md:text-3xl"
              subtitleClassName="text-[10px] md:text-[11px]"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="rounded-xl border border-transparent px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              Overview
            </Link>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Open Dashboard
              </Link>
            ) : (
              <Link
                to="/signup"
                className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Create Account
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="border-b border-[var(--color-border-secondary)]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-24">
            <div className="space-y-8">
              <div className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
                Desktop builds, same calmer interface
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                  Take the monochrome client to your desktop.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-secondary)] sm:text-xl">
                  The desktop app keeps the same grayscale design system while adding
                  native packaging, system notifications, and a focused space for daily use.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
                <span className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-2">
                  Windows 10/11
                </span>
                <span className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-2">
                  Linux AppImage
                </span>
                <span className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-2">
                  macOS universal build
                </span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Recommended download
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {detectedPlatform === "unknown"
                  ? "Choose your platform"
                  : `${detectedPlatform === "macos" ? "macOS" : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)} detected`}
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
                {detectedPlatform === "unknown"
                  ? "Automatic detection could not pick a platform, so we’ll take you to the latest release page."
                  : "We detected your platform and linked the current stable desktop build directly."}
              </p>

              <a
                href={recommendedHref}
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                {recommendedLabel}
              </a>

              <div className="mt-6 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Release source
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                  Downloads come from the latest GitHub release so web and desktop builds stay aligned.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                Platform builds
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
                One design language, three native packages.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {platformCards.map((platform) => (
                <article
                  key={platform.key}
                  className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    {platform.summary}
                  </p>
                  <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-[var(--color-text)]">
                    {platform.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-[var(--color-text-secondary)]">
                    {platform.detail}
                  </p>
                  <a
                    href={downloadLinks[platform.key]}
                    className="mt-6 inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
                  >
                    Download {platform.title}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    Need the server first?
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
                    Pair the desktop app with your own instance or join one that already exists.
                  </h2>
                  <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
                    The client is only half of the experience. If you are self-hosting, use the docs to set up your home instance, then come back here for the desktop app.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <a
                    href="https://pufferblow.github.io/pufferblow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-3 text-center text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                  >
                    Open setup docs
                  </a>
                  <Link
                    to="/"
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-3 text-center text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
                  >
                    Back to overview
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
