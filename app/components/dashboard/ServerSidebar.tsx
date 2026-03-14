import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { AddServerButton } from './AddServerButton';

/**
 * Server information structure
 */
export interface ServerInfo {
  server_name: string;
  server_description?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
}

/**
 * Props for the ServerSidebar component
 */
export interface ServerSidebarProps {
  /**
   * Server information to display
   */
  serverInfo?: ServerInfo | null;

  /**
   * Whether the server dropdown is open
   */
  serverDropdownOpen: boolean;

  /**
   * Callback to toggle server dropdown
   */
  onToggleServerDropdown: () => void;

  /**
   * Callback when server dropdown item is clicked
   */
  onServerDropdownAction: (action: string) => void;

  /**
   * Current user information for permissions
   */
  currentUser?: {
    is_owner?: boolean;
    is_admin?: boolean;
    roles?: string[];
    resolved_privileges?: string[];
  } | null;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ServerSidebar component - displays server information and navigation.
 *
 * This component shows the current server details, provides access to server
 * management features, and includes navigation back to the dashboard.
 *
 * @example
 * ```tsx
 * <ServerSidebar
 *   serverInfo={serverInfo}
 *   serverDropdownOpen={dropdownOpen}
 *   onToggleServerDropdown={toggleDropdown}
 *   onServerDropdownAction={handleAction}
 *   currentUser={currentUser}
 * />
 * ```
 */
export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  serverInfo,
  serverDropdownOpen,
  onToggleServerDropdown,
  onServerDropdownAction,
  currentUser,
  className = '',
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userCanCreateInvite =
    currentUser?.is_admin ||
    currentUser?.is_owner ||
    currentUser?.resolved_privileges?.includes("manage_channel_users");
  const canAccessControlPanel =
    currentUser?.is_owner ||
    currentUser?.is_admin ||
    currentUser?.resolved_privileges?.includes("manage_server_settings");
  const userCanDeleteServer =
    currentUser?.is_owner ||
    currentUser?.resolved_privileges?.includes("manage_server_settings");
  const inviteManagementAvailable = false;
  const serverDeletionAvailable = false;
  const multiServerManagementAvailable = false;
  const canCreateInvite = userCanCreateInvite && inviteManagementAvailable;
  const canDeleteServer = userCanDeleteServer && serverDeletionAvailable;

  useEffect(() => {
    if (!serverDropdownOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggleServerDropdown();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggleServerDropdown();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [serverDropdownOpen, onToggleServerDropdown]);

  return (
    <div className={`w-16 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent backdrop-blur-sm ${className}`}>
      {/* Server Branding Header */}
      <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 bg-[var(--color-background-tertiary)] w-full">
        <div className="flex items-center space-x-2">
          {serverInfo?.avatar_url ? (
            <img
              src={serverInfo.avatar_url}
              alt={`${serverInfo.server_name} avatar`}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] font-bold text-[var(--color-on-primary)]">
              {(serverInfo?.server_name || 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[var(--color-text)] font-semibold text-xs truncate max-w-20" title={serverInfo?.server_name}>
            {serverInfo?.server_name || 'Server'}
          </span>
        </div>
      </div>

      {/* Server Actions Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={onToggleServerDropdown}
          className={`pb-focus-ring inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors ${
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
            className={`h-4 w-4 transition-transform ${serverDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {serverDropdownOpen && (
          <div className="pb-menu absolute left-full top-0 z-50 ml-2 mt-2 w-64 rounded-lg p-2">
            <div className="mb-2 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                {serverInfo?.server_name || "Server"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">Home instance actions</p>
            </div>

            <div>
              <button
                onClick={() => {
                  onServerDropdownAction('server-info');
                  onToggleServerDropdown();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                title="View home instance information"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Instance Info</span>
              </button>

              <button
                onClick={() => {
                  if (!canCreateInvite) {
                    return;
                  }
                  onServerDropdownAction('invite');
                  onToggleServerDropdown();
                }}
                disabled={!canCreateInvite}
                className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  canCreateInvite
                    ? 'text-[var(--color-text)] hover:bg-[var(--color-hover)]'
                    : 'cursor-not-allowed text-[var(--color-text-muted)] opacity-60'
                }`}
                title={
                  canCreateInvite
                    ? 'Create invite code'
                    : userCanCreateInvite
                      ? 'Invite creation is not available on this single-instance server build'
                      : 'Only admins, moderators, and owners can create invite codes'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Invites Unavailable</span>
              </button>

              <Link
                to="/control-panel"
                onClick={(event) => {
                  if (!canAccessControlPanel) {
                    event.preventDefault();
                    return;
                  }
                  onToggleServerDropdown();
                }}
                aria-disabled={!canAccessControlPanel}
                className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  canAccessControlPanel
                    ? 'text-[var(--color-text)] hover:bg-[var(--color-hover)]'
                    : 'pointer-events-none cursor-not-allowed text-[var(--color-text-muted)] opacity-60'
                }`}
                title={
                  canAccessControlPanel
                    ? 'Access server control panel'
                    : 'Only server admins and owners can access control panel'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Control Panel</span>
              </Link>

              <div className="my-2 border-t border-[var(--color-border-secondary)]" />

              <button
                onClick={() => {
                  if (!canDeleteServer) {
                    return;
                  }
                  const confirmed = window.confirm('Are you sure you want to delete this server? This action cannot be undone.');
                  if (confirmed) {
                    onServerDropdownAction('delete-server');
                  }
                  onToggleServerDropdown();
                }}
                disabled={!canDeleteServer}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  canDeleteServer
                    ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/12'
                    : 'cursor-not-allowed text-[var(--color-text-muted)] opacity-60'
                }`}
                title={
                  canDeleteServer
                    ? 'Delete this server'
                    : userCanDeleteServer
                      ? 'Home instance deletion is not available on this single-instance build'
                      : 'Only server owner can delete the server'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm font-medium">Delete Unavailable</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Server Button */}
      <AddServerButton
        onClick={() => onServerDropdownAction('add-server')}
        disabled={!multiServerManagementAvailable}
        title="Additional home instances are not available in this build"
        ariaLabel="Additional home instances are not available in this build"
      />
    </div>
  );
};

export default ServerSidebar;
