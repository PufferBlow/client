import { Link } from "react-router";
import { useEffect, useState } from "react";

import { PufferblowBrand } from "../components/PufferblowBrand";
import {
  fetchReleases,
  categorizeAssets,
  formatBytes,
  formatDate,
  type GithubRelease,
  type PlatformAssets,
  type ReleaseAsset,
} from "../services/githubReleases";

type DetectedPlatform = "windows" | "linux" | "macos" | "unknown";

const GITHUB_RELEASES_URL = "https://github.com/PufferBlow/client/releases";

function detectPlatform(): DetectedPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("macintosh") || ua.includes("mac os x")) return "macos";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "unknown";
}

function isAuthenticatedFromCookies(): boolean {
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith("auth_token=") && c.trim().length > "auth_token=".length);
}

// ── sub-components ────────────────────────────────────────────────────────────

function AssetButton({
  asset,
  label,
  primary = false,
}: {
  asset: ReleaseAsset;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={asset.browser_download_url}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
          : "inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
      }
    >
      {label}
      <span className="text-xs opacity-60">{formatBytes(asset.size)}</span>
    </a>
  );
}

function PlatformSection({
  title,
  note,
  assets,
}: {
  title: string;
  note: string;
  assets: ReleaseAsset[];
}) {
  if (assets.length === 0) return null;
  return (
    <article className="rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{note}</p>
      <h3 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-[var(--color-text)]">
        {title}
      </h3>
      <div className="mt-5 flex flex-wrap gap-2">
        {assets.map((asset) => (
          <AssetButton key={asset.name} asset={asset} label={labelForAsset(asset.name)} />
        ))}
      </div>
    </article>
  );
}

function labelForAsset(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".msi")) return "MSI installer";
  if (n.endsWith(".exe")) return "Setup (.exe)";
  if (n.endsWith(".appimage")) return "AppImage";
  if (n.endsWith(".deb")) return ".deb package";
  if (n.endsWith(".rpm")) return ".rpm package";
  if (n.endsWith(".dmg")) return "DMG";
  if (n.endsWith(".zip")) return "ZIP archive";
  return name;
}

function platformAssetList(
  pa: PlatformAssets,
  platform: "windows" | "linux" | "macos",
): ReleaseAsset[] {
  const p = pa[platform];
  return Object.values(p).filter(Boolean) as ReleaseAsset[];
}

function recommendedAsset(
  pa: PlatformAssets,
  platform: DetectedPlatform,
): ReleaseAsset | null {
  if (platform === "windows") return pa.windows.exe ?? pa.windows.msi ?? null;
  if (platform === "linux") return pa.linux.appimage ?? null;
  if (platform === "macos") return pa.macos.dmg ?? null;
  return null;
}

// ── page ──────────────────────────────────────────────────────────────────────

export function meta() {
  return [
    { title: "Download Pufferblow" },
    {
      name: "description",
      content:
        "Download the Pufferblow desktop client for Windows, Linux, or macOS. Always up-to-date from the latest GitHub release.",
    },
  ];
}

export default function Download() {
  const [platform, setPlatform] = useState<DetectedPlatform>("unknown");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsAuthenticated(isAuthenticatedFromCookies());

    fetchReleases()
      .then(setReleases)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load releases"),
      )
      .finally(() => setLoading(false));
  }, []);

  const latest = releases.find((r) => !r.prerelease) ?? releases[0] ?? null;
  const latestAssets = latest ? categorizeAssets(latest.assets) : null;
  const primaryAsset = latestAssets && recommendedAsset(latestAssets, platform);

  const visibleReleases = expandedVersions ? releases : releases.slice(0, 5);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-border-secondary)] border-t-[var(--color-text)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      {/* nav */}
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
        {/* hero + recommended download */}
        <section className="border-b border-[var(--color-border-secondary)]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-24">
            <div className="space-y-8">
              <div className="inline-flex items-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
                Open source · Self-hosted · Federated
              </div>
              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                  Download the Pufferblow desktop client.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-secondary)] sm:text-xl">
                  Native packages for Windows, Linux, and macOS. Always built from the
                  latest GitHub release — no third-party mirrors.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
                {["Windows 10 / 11", "Linux (AppImage · deb · rpm)", "macOS 10.15+"].map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-2"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* recommended download card */}
            <aside className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 sm:p-8">
              {error ? (
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Could not load releases
                  </p>
                  <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{error}</p>
                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                  >
                    Browse releases on GitHub
                  </a>
                </div>
              ) : latest ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                      {latest.prerelease ? "Pre-release" : "Latest stable release"}
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                      {latest.tag_name}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                      Published {formatDate(latest.published_at)}
                    </p>
                  </div>

                  {primaryAsset ? (
                    <AssetButton asset={primaryAsset} label={`Download for ${platform === "macos" ? "macOS" : platform.charAt(0).toUpperCase() + platform.slice(1)}`} primary />
                  ) : (
                    <a
                      href={latest.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-3 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                    >
                      Browse all downloads
                    </a>
                  )}

                  <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] p-5 space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      {platform === "unknown" ? "Platform" : "Detected"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {platform === "unknown"
                        ? "Could not detect your platform. Use the platform list below to pick a build."
                        : `Showing the recommended build for ${platform === "macos" ? "macOS" : platform.charAt(0).toUpperCase() + platform.slice(1)}.`}
                    </p>
                    <a
                      href={latest.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-[var(--color-text-tertiary)] underline underline-offset-2 hover:text-[var(--color-text-secondary)]"
                    >
                      See all assets on GitHub →
                    </a>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        {/* all platform builds for latest release */}
        {latestAssets && (
          <section className="border-b border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-10 max-w-3xl">
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  {latest?.tag_name} — all platforms
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
                  One client, three native packages.
                </h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <PlatformSection
                  title="Windows"
                  note="NSIS setup · MSI installer"
                  assets={platformAssetList(latestAssets, "windows")}
                />
                <PlatformSection
                  title="Linux"
                  note="AppImage · deb · rpm"
                  assets={platformAssetList(latestAssets, "linux")}
                />
                <PlatformSection
                  title="macOS"
                  note="DMG · ZIP archive"
                  assets={platformAssetList(latestAssets, "macos")}
                />
              </div>
            </div>
          </section>
        )}

        {/* version history */}
        {releases.length > 0 && (
          <section className="border-b border-[var(--color-border-secondary)]">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-8 max-w-3xl">
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  Version history
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">
                  All releases
                </h2>
              </div>

              <div className="divide-y divide-[var(--color-border-secondary)] rounded-[1.75rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] overflow-hidden">
                {visibleReleases.map((release) => {
                  const pa = categorizeAssets(release.assets);
                  const wins = platformAssetList(pa, "windows");
                  const lins = platformAssetList(pa, "linux");
                  const macs = platformAssetList(pa, "macos");
                  return (
                    <div key={release.tag_name} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--color-text)]">
                            {release.tag_name}
                          </span>
                          {release.prerelease && (
                            <span className="rounded-full border border-[var(--color-border-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                              pre-release
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">
                          {formatDate(release.published_at)} · {release.assets.length} asset{release.assets.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {wins[0] && <AssetButton asset={wins[0]} label="Windows" />}
                        {lins[0] && <AssetButton asset={lins[0]} label="Linux" />}
                        {macs[0] && <AssetButton asset={macs[0]} label="macOS" />}
                        <a
                          href={release.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
                        >
                          All assets
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {releases.length > 5 && (
                <button
                  onClick={() => setExpandedVersions((v) => !v)}
                  className="mt-4 w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
                >
                  {expandedVersions ? "Show fewer versions" : `Show all ${releases.length} versions`}
                </button>
              )}
            </div>
          </section>
        )}

        {/* server callout */}
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
                    The client connects to any self-hosted Pufferblow instance. If you are starting
                    from scratch, follow the setup docs to get your server running first.
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
