import React from 'react';
import { Link } from 'react-router';

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
  const hasServerAccess = currentUser?.is_owner || currentUser?.is_admin ||
    (currentUser?.roles && (currentUser.roles.includes('Admin') || currentUser.roles.includes('Owner')));

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
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center font-bold text-white">
              {(serverInfo?.server_name || 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[var(--color-text)] font-semibold text-xs truncate max-w-20" title={serverInfo?.server_name}>
            {serverInfo?.server_name || 'Server'}
          </span>
        </div>
      </div>

      {/* Server Actions Dropdown */}
      <div className="relative" ref={(el) => {
        // Handle click outside to close dropdown
        if (el && serverDropdownOpen) {
          const handleClickOutside = (event: MouseEvent) => {
            if (!el.contains(event.target as Node)) {
              onToggleServerDropdown();
            }
          };
          document.addEventListener('mousedown', handleClickOutside);
          return () => document.removeEventListener('mousedown', handleClickOutside);
        }
      }}>
        <button
          onClick={onToggleServerDropdown}
          className="pb-icon-btn w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-[var(--color-primary)] group"
          title="Server options"
          aria-label="Server options"
          aria-expanded={serverDropdownOpen}
        >
          <svg
            className={`w-4 h-4 text-gray-400 group-hover:text-white transition-colors ${serverDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {serverDropdownOpen && (
          <div className="absolute left-full top-0 mt-2 ml-2 bg-[var(--color-surface-secondary)]/95 backdrop-blur-md border border-[var(--color-border)] rounded-lg shadow-xl py-2 min-w-56 z-50">
            {/* Server Actions */}
            <div className="px-2 py-1">
              <button
                onClick={() => {
                  onServerDropdownAction('server-info');
                  onToggleServerDropdown();
                }}
                className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer rounded-md"
                title="View server information"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Server Info</span>
              </button>

              {hasServerAccess && (
                <>
                  <button
                    onClick={() => {
                      onServerDropdownAction('invite');
                      onToggleServerDropdown();
                    }}
                    className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer rounded-md"
                    title="Create invite code"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">Create Invite</span>
                  </button>

                  <Link
                    to="/control-panel"
                    onClick={() => onToggleServerDropdown()}
                    className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 text-gray-300 hover:bg-[var(--color-surface-tertiary)] hover:text-white cursor-pointer rounded-md"
                    title="Access server control panel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">Control Panel</span>
                  </Link>
                </>
              )}

              {currentUser?.is_owner && (
                <button
                  onClick={() => {
                    const confirmed = window.confirm('Are you sure you want to delete this server? This action cannot be undone.');
                    if (confirmed) {
                      onServerDropdownAction('delete-server');
                    }
                    onToggleServerDropdown();
                  }}
                  className="w-full px-3 py-2 text-left transition-colors flex items-center space-x-3 text-red-300 hover:bg-red-900/20 hover:text-red-100 cursor-pointer rounded-md"
                  title="Delete this server"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-sm font-medium">Delete Server</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Server Button */}
      <button
        onClick={() => onServerDropdownAction('add-server')}
        className="pb-icon-btn w-12 h-12 bg-[#313338] rounded-2xl hover:rounded-xl hover:bg-[#23a559] cursor-pointer group mt-auto"
        title="Add a server"
        aria-label="Add a server"
      >
        <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
};

export default ServerSidebar;
