import { useState, type RefObject } from "react";
import { Link } from "react-router";
import type { ShowToast } from "../Toast";
import type { ServerInfo } from "../../services/system";

interface ChannelSidebarHeaderProps {
  serverInfo: ServerInfo | null;
  serverDropdownOpen: boolean;
  setServerDropdownOpen: (open: boolean) => void;
  serverDropdownRef: RefObject<HTMLDivElement | null>;
  canCreateInvite: boolean;
  canAccessControlPanel: boolean;
  canDeleteServer: boolean;
  /** Show "Create Channel" -- gated on the `create_channels` privilege. */
  canCreateChannels: boolean;
  /** Show "Leave Server" -- only true for federated viewers whose
   *  account origin isn't this server. Home-instance users get the
   *  "Delete Server" path instead (if they have that privilege). */
  canLeaveServer: boolean;
  onInviteActionUnavailable: () => void;
  onCreateChannel: () => void;
  onMarkAllChannelsRead: () => void;
  onMuteServer: () => void;
  onLeaveServer: () => void;
  showToast: ShowToast;
  /** True when every accessible channel is muted — flips the dropdown
   *  label between "Mute Server" and "Unmute Server" so the user
   *  always knows what the action will do. Computed in DashboardPage
   *  from `mutedChannelIds` × `channels`. */
  serverIsMuted: boolean;
}

/**
 * Derive a stable hue from the server name so a server without a banner
 * still has a recognisable color stripe. Same djb2-style folding hash used
 * before the header was extracted; lifted here verbatim so the only
 * consumer of the helper is the component that needs it.
 */
function getServerHue(name?: string | null): number {
  if (!name) return 220;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

/**
 * Top-of-the-channel-sidebar slab: banner image (or generated gradient),
 * server avatar overlapping the banner, server-actions dropdown, and the
 * server name + description.
 *
 * Privileged dropdown items (Create Invite, Control Panel, Delete Server)
 * are hidden — not just disabled — when the viewer lacks the privilege.
 * Hiding rather than greying-out avoids exposing the privilege catalog
 * to non-privileged users, which is a small information-disclosure
 * concern but worth getting right.
 *
 * All state (`serverDropdownOpen`, the ref, privilege booleans) is owned
 * by the parent so the outside-click handler and the rest of the page
 * can react to changes; this component is intentionally render-only.
 */
export function ChannelSidebarHeader({
  serverInfo,
  serverDropdownOpen,
  setServerDropdownOpen,
  serverDropdownRef,
  canCreateInvite,
  canAccessControlPanel,
  canDeleteServer,
  canCreateChannels,
  canLeaveServer,
  onInviteActionUnavailable,
  onCreateChannel,
  onMarkAllChannelsRead,
  onMuteServer,
  onLeaveServer,
  showToast,
  serverIsMuted,
}: ChannelSidebarHeaderProps) {
  // ── Animated server banner: hover-to-play ──────────────────────────
  //
  // GIFs and other animated formats (animated WebP/AVIF/APNG) play
  // unconditionally inside an <img> -- the browser doesn't expose
  // pause controls. To get "play on hover" we render the first frame
  // as a static snapshot at rest and swap in the live URL when the
  // banner is hovered. Same canvas-snapshot pattern used by the
  // VoiceCallUI participant tiles.
  //
  // CORS caveat: drawImage() on a cross-origin image taints the canvas
  // and toDataURL() throws SecurityError. We swallow it -- in that
  // case the banner just animates as before instead of blanking. This
  // matters when the banner is served from a federated instance that
  // doesn't send Access-Control-Allow-Origin.
  const [bannerHover, setBannerHover] = useState(false);
  const [frozenBannerSrc, setFrozenBannerSrc] = useState<string | null>(null);
  const bannerUrl = serverInfo?.banner_url ?? null;
  const couldBeAnimated = !!bannerUrl && /\.(gif|webp|apng|avif)(\?|#|$)/i.test(bannerUrl);

  const handleBannerLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!couldBeAnimated || frozenBannerSrc) return;
    const img = e.currentTarget;
    try {
      // Cap dimensions so the base64 data URL doesn't blow up in memory.
      // 800px wide is plenty for a header banner; the source GIF can be
      // much larger but the snapshot doesn't need to be 1:1.
      const maxW = 800;
      const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
      const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setFrozenBannerSrc(canvas.toDataURL('image/png'));
    } catch {
      // CORS taint or canvas failure -- leave the banner animating.
    }
  };

  // Effective src: hovered (or non-animated) -> live URL; otherwise
  // the frozen snapshot once captured, falling back to the live URL
  // until the first onLoad fires.
  const effectiveBannerSrc = bannerUrl
    ? !couldBeAnimated || bannerHover
      ? bannerUrl
      : frozenBannerSrc ?? bannerUrl
    : null;

  return (
    <div className="relative">
      {/* Banner */}
      {serverInfo?.banner_url ? (
        <div
          className="h-28 w-full overflow-hidden rounded-t-2xl"
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
        >
          <img
            src={effectiveBannerSrc ?? serverInfo.banner_url}
            alt={`${serverInfo.server_name} banner`}
            onLoad={handleBannerLoad}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        // Solid-color (gradient) banner fallback. No animation to play
        // on hover, but a subtle brightness + saturation lift mirrors
        // the "comes alive on hover" affordance of the animated-image
        // branch above, so the two states feel consistent. Filter-only
        // transition keeps the radius and layout untouched.
        <div
          className="h-14 rounded-t-2xl transition-[filter] duration-300 hover:brightness-110 hover:saturate-125"
          style={{
            background: `linear-gradient(135deg, hsl(${getServerHue(serverInfo?.server_name)}, 52%, 26%) 0%, hsl(${(getServerHue(serverInfo?.server_name) + 35) % 360}, 38%, 16%) 100%)`,
          }}
        />
      )}

      {/* Avatar + Dropdown Row */}
      <div className="px-3 pb-2">
        <div className="flex items-end justify-between">
          {/* Server avatar — rectangular with a rounded-lg radius. The
              previous hover state morphed the radius to rounded-2xl
              (squircle) which both fought the rest of the design
              language (every other surface keeps a stable shape on
              hover) and visually deformed the avatar's own pixels
              during the transition. Shape is now stable; the rail's
              left pill is the affordance for "this server is
              active/hovered." */}
          <div className="-mt-6 flex-shrink-0">
            {serverInfo?.avatar_url ? (
              <img
                src={serverInfo.avatar_url}
                alt={serverInfo?.server_name || "Server"}
                className="h-12 w-12 rounded-lg border-2 border-[var(--color-background)] object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[var(--color-background)] bg-[var(--color-primary)] shadow-lg">
                <span className="text-lg font-bold text-[var(--color-on-primary)]">
                  {serverInfo?.server_name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}
          </div>

          {/* Server Dropdown */}
          <div className="relative mb-1" ref={serverDropdownRef}>
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              className={`pb-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                serverDropdownOpen
                  ? "border-[var(--color-border)] bg-[var(--color-active)] text-[var(--color-text)]"
                  : "border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              }`}
              title="Home instance options"
              aria-label="Home instance options"
              aria-expanded={serverDropdownOpen}
              aria-haspopup="menu"
            >
              <svg
                className={`pb-icon transition-transform ${serverDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {serverDropdownOpen && (
              // Dropdown reworked:
              //  - "Instance Info" item and the "Home instance actions"
              //    server-name header card were dropped (Instance info
              //    is reachable from the control panel; the header card
              //    duplicated the server name already shown above).
              //  - Added: Create Channel, Mark All As Read, Mute Server,
              //    Leave Server.
              //  - Kept: Create Invite, Control Panel, Delete Server
              //    (privilege-gated; hidden when the viewer lacks them).
              <div className="pb-menu absolute right-0 top-full z-50 mt-2 w-64 rounded-lg p-2">
                {/* Group 1: actions on this server's content. */}
                {canCreateChannels && (
                  <button
                    onClick={() => {
                      onCreateChannel();
                      setServerDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                    title="Create a new channel"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Create Channel</span>
                  </button>
                )}

                {canCreateInvite && (
                  <button
                    onClick={() => {
                      onInviteActionUnavailable();
                      setServerDropdownOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                    title="Create invite code"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">Create Invite</span>
                  </button>
                )}

                {canAccessControlPanel && (
                  <Link
                    to="/control-panel"
                    prefetch="intent"
                    onClick={() => setServerDropdownOpen(false)}
                    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                    title="Access server control panel"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">Control Panel</span>
                  </Link>
                )}

                {/* Group 2: notifications. */}
                <div className="my-2 border-t border-[var(--color-border-secondary)]" />

                <button
                  onClick={() => {
                    onMarkAllChannelsRead();
                    setServerDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                  title="Clear unread state across every channel"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Mark All As Read</span>
                </button>

                <button
                  onClick={() => {
                    onMuteServer();
                    setServerDropdownOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                  title={
                    serverIsMuted
                      ? "Re-enable notifications for every channel"
                      : "Silence notifications for every channel on this server"
                  }
                >
                  {serverIsMuted ? (
                    // Speaker-on glyph — flips back when the server
                    // is fully muted so the action verb matches.
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9M3 3l18 18" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {serverIsMuted ? "Unmute Server" : "Mute Server"}
                  </span>
                </button>

                {/* Group 3: destructive. Leave Server only for federated
                    viewers (whose account origin is a different
                    instance); Delete Server only for privileged users. */}
                {(canLeaveServer || canDeleteServer) && (
                  <div className="my-2 border-t border-[var(--color-border-secondary)]" />
                )}

                {canLeaveServer && (
                  <button
                    onClick={() => {
                      onLeaveServer();
                      setServerDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/12"
                    title="Leave this server"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="font-medium">Leave Server</span>
                  </button>
                )}

                {canDeleteServer && (
                  <button
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Are you sure you want to delete this server? This action cannot be undone.",
                      );
                      if (confirmed) {
                        showToast({
                          message:
                            "Home instance deletion is unavailable. This client is connected to one home instance, and deleting it is not supported here.",
                          tone: "warning",
                          category: "system",
                        });
                      }
                      setServerDropdownOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/12"
                    title="Delete this server"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-medium">Delete Server</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Server Name. Description intentionally dropped to keep this
            slab compact -- the server description is still surfaced in
            the Instance Info modal accessible from the dropdown menu. */}
        <div className="mt-2">
          <h1
            className="truncate font-bold text-base text-[var(--color-text)]"
            title={serverInfo?.server_name || "Loading..."}
          >
            {serverInfo?.server_name || "Loading..."}
          </h1>
        </div>
      </div>
      <div className="border-b border-[var(--color-border)]" />
    </div>
  );
}
