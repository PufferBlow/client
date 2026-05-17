import type { RefObject } from "react";
import { NotificationMenu, type NotificationItem } from "../NotificationMenu";
import { SearchModal, type SearchHandlerReturn } from "../SearchModal";
import type { Channel } from "../../models";

interface UnreadMarker {
  channelId: string;
  messageId: string;
}

interface ChatHeaderProps {
  selectedChannel: Channel | null;
  notifications: NotificationItem[];
  notificationMenuOpen: boolean;
  setNotificationMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  notificationMenuRef: RefObject<HTMLDivElement | null>;
  onNotificationSelect: (notification: NotificationItem) => void;
  onMarkAllNotificationsRead: () => void;
  browserNotificationPermission: NotificationPermission | "unsupported";
  onEnableBrowserNotifications: () => void;
  unreadMarker: UnreadMarker | null;
  onJumpToFirstUnread: () => void;
  membersListVisible: boolean;
  onToggleMembersList: () => void;
  /**
   * Whether the channel-search panel is open. Wired to the magnifier
   * icon in the header. The panel is a floating dropdown anchored to
   * the icon (like the notifications menu), not a centered modal.
   */
  isSearchOpen: boolean;
  /** Open/close the search panel. */
  setSearchOpen: (open: boolean) => void;
  /** Channel-scoped search handler. Runs against the active channel only. */
  onSearch?: (query: string) => Promise<SearchHandlerReturn>;
  /** Called when the user picks a result from the panel. */
  onSelectSearchResult?: (result: {
    id: string;
    type: "message" | "user" | "channel";
    channel_id?: string;
  }) => void;
}

/**
 * Top bar of the active chat pane: channel name + type label, notifications
 * bell with unread count, jump-to-unread button (only when the current
 * channel has a stored unread marker), and the right-rail member-toggle.
 *
 * The 'User details' and 'More options' icons are still placeholders;
 * the 'Search in channel' icon is wired to `onOpenSearch` and hidden
 * when the active channel is a voice channel (voice channels have no
 * messages to search).
 */
export function ChatHeader({
  selectedChannel,
  notifications,
  notificationMenuOpen,
  setNotificationMenuOpen,
  notificationMenuRef,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  browserNotificationPermission,
  onEnableBrowserNotifications,
  unreadMarker,
  onJumpToFirstUnread,
  membersListVisible,
  onToggleMembersList,
  isSearchOpen,
  setSearchOpen,
  onSearch,
  onSelectSearchResult,
}: ChatHeaderProps) {
  // Voice channels have no message history -- the search button (and any
  // future channel-search affordances) don't apply. Hide accordingly.
  const isVoiceChannel = selectedChannel?.channel_type === 'voice';
  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/70">
      <div className="flex items-center">
        <span className="text-[var(--color-text-secondary)] mr-2">#</span>
        <h2 className="text-[var(--color-text)] font-semibold tracking-tight">
          {selectedChannel?.channel_name || "general"}
        </h2>
        <div className="ml-2 text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
          channel
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className="relative" ref={notificationMenuRef}>
          <button
            onClick={() => setNotificationMenuOpen((prev) => !prev)}
            className="pb-icon-btn relative"
            title="Notifications"
            aria-label="Notifications"
          >
            <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-on-primary)]">
                {notifications.length > 99 ? "99+" : notifications.length}
              </span>
            )}
          </button>
          <NotificationMenu
            notifications={notifications}
            isOpen={notificationMenuOpen}
            onClose={() => setNotificationMenuOpen(false)}
            onSelect={onNotificationSelect}
            onMarkAllRead={onMarkAllNotificationsRead}
            browserNotificationPermission={browserNotificationPermission}
            onEnableBrowserNotifications={onEnableBrowserNotifications}
          />
        </div>
        {unreadMarker?.channelId === selectedChannel?.channel_id && (
          <button
            onClick={onJumpToFirstUnread}
            className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/18"
            title="Jump to first unread message"
          >
            Jump to unread
          </button>
        )}
        {/* User-details and More-options buttons were removed -- they
            had no onClick and the design's gone. The remaining icons
            (notifications bell, search, members toggle) are all wired
            and functional. */}
        {!isVoiceChannel && (
          // `relative` wrapper so the floating SearchModal (absolute
          // right:0 top:12) anchors to the search button, matching the
          // notifications dropdown pattern above.
          <div className="relative">
            <button
              onClick={() => setSearchOpen(!isSearchOpen)}
              className="pb-icon-btn"
              title="Search this channel"
              aria-label="Search this channel"
              aria-expanded={isSearchOpen}
            >
              <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            {onSearch && onSelectSearchResult && (
              <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setSearchOpen(false)}
                onSearch={onSearch}
                onSelectResult={onSelectSearchResult}
                channelName={selectedChannel?.channel_name}
              />
            )}
          </div>
        )}
        <button
          onClick={onToggleMembersList}
          className="pb-icon-btn hidden lg:inline-flex"
          title="Toggle member list"
          aria-label="Toggle member list"
          aria-pressed={membersListVisible}
        >
          <svg className="pb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
