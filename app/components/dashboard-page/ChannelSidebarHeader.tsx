import type { RefObject } from "react";
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
  onInviteActionUnavailable: () => void;
  showToast: ShowToast;
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
  onInviteActionUnavailable,
  showToast,
}: ChannelSidebarHeaderProps) {
  return (
    <div className="relative">
      {/* Banner */}
      {serverInfo?.banner_url ? (
        <div className="h-28 w-full overflow-hidden rounded-t-2xl">
          <img
            src={serverInfo.banner_url}
            alt={`${serverInfo.server_name} banner`}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="h-14 rounded-t-2xl"
          style={{
            background: `linear-gradient(135deg, hsl(${getServerHue(serverInfo?.server_name)}, 52%, 26%) 0%, hsl(${(getServerHue(serverInfo?.server_name) + 35) % 360}, 38%, 16%) 100%)`,
          }}
        />
      )}

      {/* Avatar + Dropdown Row */}
      <div className="px-3 pb-2">
        <div className="flex items-end justify-between">
          {/* Server Avatar */}
          <div className="-mt-6 flex-shrink-0">
            {serverInfo?.avatar_url ? (
              <img
                src={serverInfo.avatar_url}
                alt={serverInfo?.server_name || "Server"}
                className="h-12 w-12 rounded-2xl border-2 border-[var(--color-background)] object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[var(--color-background)] bg-[var(--color-primary)] shadow-lg">
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
              <div className="pb-menu absolute right-0 top-full z-50 mt-2 w-64 rounded-lg p-2">
                <div className="mb-2 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {serverInfo?.server_name || "Server"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Home instance actions</p>
                </div>

                <button
                  onClick={() => {
                    showToast({
                      message:
                        "Home instance details live in the control panel and settings.",
                      tone: "warning",
                      category: "info",
                    });
                    setServerDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                  title="View home instance information"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Instance Info</span>
                </button>

                {/* Privileged actions: only rendered when the viewer actually
                    has the privilege. Hidden (not disabled) so non-privileged
                    users don't learn what they can't do from this menu. */}
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

                {canDeleteServer && (
                  <>
                    <div className="my-2 border-t border-[var(--color-border-secondary)]" />
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
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/12"
                      title="Delete this server"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="font-medium">Delete Server</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Server Name + Description */}
        <div className="mt-2">
          <h1
            className="truncate font-bold text-base text-[var(--color-text)]"
            title={serverInfo?.server_name || "Loading..."}
          >
            {serverInfo?.server_name || "Loading..."}
          </h1>
          {serverInfo?.server_description && (
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
              {serverInfo.server_description}
            </p>
          )}
        </div>
      </div>
      <div className="border-b border-[var(--color-border)]" />
    </div>
  );
}
