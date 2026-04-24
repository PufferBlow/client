const GITHUB_REPO = "PufferBlow/client";
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
};

export type GithubRelease = {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  body: string;
  assets: ReleaseAsset[];
};

export type PlatformAssets = {
  windows: { msi?: ReleaseAsset; exe?: ReleaseAsset };
  linux: { appimage?: ReleaseAsset; deb?: ReleaseAsset; rpm?: ReleaseAsset };
  macos: { dmg?: ReleaseAsset; zip?: ReleaseAsset };
};

export async function fetchReleases(): Promise<GithubRelease[]> {
  const res = await fetch(RELEASES_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const all: GithubRelease[] = await res.json();
  return all.filter((r) => !r.draft);
}

export function categorizeAssets(assets: ReleaseAsset[]): PlatformAssets {
  const result: PlatformAssets = { windows: {}, linux: {}, macos: {} };
  for (const asset of assets) {
    const n = asset.name.toLowerCase();
    if (n.endsWith(".msi")) result.windows.msi = asset;
    else if (n.endsWith(".exe")) result.windows.exe = asset;
    else if (n.endsWith(".appimage")) result.linux.appimage = asset;
    else if (n.endsWith(".deb")) result.linux.deb = asset;
    else if (n.endsWith(".rpm")) result.linux.rpm = asset;
    else if (n.endsWith(".dmg")) result.macos.dmg = asset;
    else if (n.endsWith(".zip") && !n.includes("source")) result.macos.zip = asset;
  }
  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
