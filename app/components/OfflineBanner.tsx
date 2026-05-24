/**
 * Top-of-app banner that surfaces device-offline + home-instance
 * offline states.
 *
 * Three states it cares about, in priority order:
 *
 *   1. Device offline (`navigator.onLine === false`) — most
 *      severe. Show "You're offline" + how to recover.
 *   2. Home instance unreachable — device is fine but the user's
 *      authoritative server isn't responding. Show the instance
 *      hostname so the user knows which one to look at.
 *   3. Otherwise — render nothing. The banner is a zero-height
 *      passthrough in the healthy case; it does NOT reserve
 *      layout space.
 *
 * Important: remote-instance failures (a federation peer being
 * down, a joined remote server hiccupping) do NOT trigger this
 * banner. Those are routine in a federated network and surface as
 * per-instance badges on the server rail. Conflating them with
 * "you're offline" would be a constant false alarm.
 *
 * Visual: slim 32px-ish strip with a small left-aligned icon and
 * a short message. Stays inline with the page — no fixed
 * positioning. The dashboard's flex column reflows around it.
 */

import { useHomeInstanceHealth } from "../services/instanceHealth";
import { useNetworkStatus } from "../services/networkStatus";

export interface OfflineBannerProps {
  /** Optional override class for layout tweaks. */
  className?: string;
}

export function OfflineBanner({ className = "" }: OfflineBannerProps) {
  const isOnline = useNetworkStatus();
  const homeHealth = useHomeInstanceHealth();

  // ── State 1: device offline ──────────────────────────────────
  // Trumps all other signals. While the device has no internet
  // there's nothing useful to say about instances — they're ALL
  // unreachable.
  if (!isOnline) {
    return (
      <Banner
        tone="danger"
        className={className}
        icon={<OfflineGlyph />}
        title="You're offline"
        body="Check your connection. New messages won't send until you're back online."
      />
    );
  }

  // ── State 2: home instance offline ───────────────────────────
  // Device is fine, but the home instance hasn't been responding.
  // We surface the hostname so the user can verify they typed it
  // right when they signed in.
  const homeOffline = homeHealth && homeHealth.kind === "unreachable";
  if (homeOffline) {
    const host = homeHealth.hostPort || "your home instance";
    return (
      <Banner
        tone="warning"
        className={className}
        icon={<OfflineGlyph />}
        title={`${host} is offline`}
        body="Some features won't work until it's back. Reconnections happen automatically."
      />
    );
  }

  // Healthy — render nothing. Returning `null` (not an empty <div />)
  // means the banner has zero presence in the flex column; the
  // dashboard layout is unaffected by mounting / unmounting this
  // component as conditions change.
  return null;
}

// ── Internal building blocks ────────────────────────────────────

interface BannerProps {
  tone: "danger" | "warning";
  icon: React.ReactNode;
  title: string;
  body: string;
  className?: string;
}

function Banner({ tone, icon, title, body, className }: BannerProps) {
  // Two tones; danger reserved for device-offline (most severe),
  // warning for home-instance issues. Both use the established
  // brand error / warning color tokens so theming carries over.
  const toneClass =
    tone === "danger"
      ? "bg-[var(--color-error)]/12 text-[var(--color-error)] border-b border-[var(--color-error)]/30"
      : "bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-b border-[var(--color-warning)]/30";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2 text-xs ${toneClass} ${className}`}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{title}</span>
        <span className="ml-2 text-[var(--color-text-secondary)]">{body}</span>
      </div>
    </div>
  );
}

function OfflineGlyph() {
  // Cloud-with-slash glyph — universally read as "no connection."
  // Sized 14px to sit in line with the banner text without
  // dominating it.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.7-9" />
      <path d="M22 19h-4" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
