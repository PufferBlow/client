/**
 * ClientTab — Settings → Client.
 *
 * Distinct from "Server" (which configures the home instance the
 * user connects to) and from "Appearance" (which is theme state).
 * This is the LOCAL device's app preferences:
 *
 *   * Hardware acceleration — Electron only. Moved here from
 *     Appearance because it has nothing to do with theming; it's a
 *     low-level render-pipeline toggle for the desktop shell.
 *   * Auto-update — Electron only. Toggle to opt out of background
 *     update checks. Useful for users on restricted networks or
 *     who want to pin to a known build.
 *   * Versions — read-only display of the client version (compiled
 *     in from package.json) and the home instance's version
 *     (server-reported via /api/v1/info or the cached serverInfo).
 *     Pair so bug reports can quote both halves precisely.
 *
 * On non-Electron builds (the web client), the two toggles are
 * hidden and only the version readout shows — the underlying
 * Electron IPC bridges (`window.electron.*`) aren't available so
 * the toggles would have nothing to control.
 */
import { useEffect, useState } from "react";
import { ModernToggle } from "../../AudioControls";
import { getServerInfo, type ServerInfo } from "../../../services/system";

type MessageState = { type: "success" | "error"; text: string } | null;

/**
 * Electron preload bridges this tab consumes. Each one is optional
 * — the tab degrades gracefully when a bridge isn't wired (older
 * desktop builds shipped with only hardware acceleration; web
 * builds have none).
 */
type ElectronBridge = {
  getHardwareAcceleration?: () => Promise<boolean>;
  setHardwareAcceleration?: (enabled: boolean) => Promise<void>;
  getAutoUpdate?: () => Promise<boolean>;
  setAutoUpdate?: (enabled: boolean) => Promise<void>;
  /** Optional fast-path for checking right now — UI may surface a
   *  "Check for updates" button later. Not required for the toggle. */
  checkForUpdates?: () => Promise<void>;
};

function getElectronBridge(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { electron?: ElectronBridge }).electron;
}

interface ClientTabProps {
  setMessage: (msg: MessageState) => void;
}

export function ClientTab({ setMessage }: ClientTabProps) {
  // ── Bridge feature detection ─────────────────────────────────
  const bridge = getElectronBridge();
  const hwAccelSupported = !!(
    bridge?.getHardwareAcceleration && bridge?.setHardwareAcceleration
  );
  const autoUpdateSupported = !!(
    bridge?.getAutoUpdate && bridge?.setAutoUpdate
  );
  const isElectron = hwAccelSupported || autoUpdateSupported;

  // ── Hardware acceleration ────────────────────────────────────
  const [hwAccelEnabled, setHwAccelEnabled] = useState<boolean | null>(null);
  const [hwAccelNeedsRestart, setHwAccelNeedsRestart] = useState(false);

  useEffect(() => {
    if (!hwAccelSupported || !bridge?.getHardwareAcceleration) return;
    let cancelled = false;
    void bridge.getHardwareAcceleration().then((value) => {
      if (cancelled) return;
      setHwAccelEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, [hwAccelSupported, bridge]);

  const onToggleHwAccel = async (next: boolean) => {
    if (!bridge?.setHardwareAcceleration) return;
    setHwAccelEnabled(next);
    setHwAccelNeedsRestart(true);
    try {
      await bridge.setHardwareAcceleration(next);
      setMessage({
        type: "success",
        text: `Hardware acceleration ${next ? "enabled" : "disabled"}. Restart Pufferblow for the change to take effect.`,
      });
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save hardware acceleration preference. Please try again.",
      });
      setHwAccelEnabled(!next);
    }
  };

  // ── Auto-update ──────────────────────────────────────────────
  // Defaults to ENABLED — that's the safe default for security
  // patches. The toggle lets users opt out (restricted networks,
  // pinned builds), not vice versa.
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!autoUpdateSupported || !bridge?.getAutoUpdate) return;
    let cancelled = false;
    void bridge.getAutoUpdate().then((value) => {
      if (cancelled) return;
      setAutoUpdateEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, [autoUpdateSupported, bridge]);

  const onToggleAutoUpdate = async (next: boolean) => {
    if (!bridge?.setAutoUpdate) return;
    setAutoUpdateEnabled(next);
    try {
      await bridge.setAutoUpdate(next);
      setMessage({
        type: "success",
        text: next
          ? "Automatic updates enabled."
          : "Automatic updates disabled. You'll need to update manually.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save the auto-update preference. Please try again.",
      });
      setAutoUpdateEnabled(!next);
    }
  };

  // ── Versions ─────────────────────────────────────────────────
  // Client version is compiled in via the Vite `define` block (see
  // vite.config.mts). The fallback `"unknown"` covers the rare
  // case of a build that bypassed the define — shouldn't happen
  // in practice but keeps the row from rendering as blank.
  const clientVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown";

  // Instance version comes from /api/v1/info. Cached per page
  // mount; we don't poll because version changes happen on
  // server restart and the user can re-open Settings if they
  // suspect a drift.
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [serverInfoLoading, setServerInfoLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setServerInfoLoading(true);
      const response = await getServerInfo();
      if (cancelled) return;
      if (response.success && response.data?.server_info) {
        setServerInfo(response.data.server_info);
        setServerInfoError(null);
      } else {
        setServerInfoError(response.error || "Couldn't reach the home instance.");
      }
      setServerInfoLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Versions ────────────────────────────────────────────
          Always shown — it's useful in both Electron and web
          builds for support. Two rows, identical chrome, side by
          side at sm+ and stacked on mobile. */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Versions</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Quote both when filing a bug.
          </p>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <VersionRow label="Client" value={clientVersion} />
          <VersionRow
            label="Home instance"
            value={
              serverInfoLoading
                ? "…"
                : serverInfoError
                  ? "unreachable"
                  : serverInfo?.version || "unknown"
            }
            sub={
              serverInfoError
                ? serverInfoError
                : serverInfo?.server_name
                  ? serverInfo.server_name
                  : undefined
            }
            tone={serverInfoError ? "error" : "default"}
          />
        </div>
      </div>

      {/* ── Electron-only toggles ───────────────────────────────
          Both feature-gated on bridge presence. On the web
          client the whole card is hidden — the toggles would
          have nothing to control. */}
      {isElectron && (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Desktop app</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Options that only apply to the desktop build.
            </p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {hwAccelSupported && (
              <ToggleRow
                label="Hardware acceleration"
                description="Render through the GPU. Smoother animations on most machines, but can cause artifacts with old or flaky drivers."
                checked={hwAccelEnabled ?? false}
                onChange={(v) => void onToggleHwAccel(v)}
                footer={
                  hwAccelNeedsRestart ? (
                    <RestartHint>Restart Pufferblow for this to take effect.</RestartHint>
                  ) : null
                }
              />
            )}
            {autoUpdateSupported && (
              <ToggleRow
                label="Automatic updates"
                description="Check for and install new versions in the background. Disable if you're on a restricted network or want to pin to a specific build."
                checked={autoUpdateEnabled ?? true}
                onChange={(v) => void onToggleAutoUpdate(v)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Internal building blocks
// ─────────────────────────────────────────────────────────────────────

function VersionRow({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "error";
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-sm ${
          tone === "error" ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{sub}</div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  footer,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</div>
        {footer}
      </div>
      <ModernToggle checked={checked} onChange={onChange} size="medium" />
    </div>
  );
}

function RestartHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-1 text-xs text-[var(--color-warning)]">
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {children}
    </div>
  );
}
