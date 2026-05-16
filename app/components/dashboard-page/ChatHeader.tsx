import type { RefObject } from "react";
import { NotificationMenu, type NotificationItem } from "../NotificationMenu";
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
}

/**
 * Top bar of the active chat pane: channel name + type label, notifications
 * bell with unread count, jump-to-unread button (only when the current
 * channel has a stored unread marker), and the right-rail member-toggle.
 *
 * The 'User details', 'Search in channel', and 'More options' icons are
 * deliberately non-functional today — they're placeholders for future
 * features the design committed to. Left as-is so this extraction is
 * purely structural; wiring them up is a separate concern.
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
}: ChatHeaderProps) {
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
        <button className="pb-icon-btn" title="User details" aria-label="User details">
          <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>
        <button className="pb-icon-btn" title="Search in channel" aria-label="Search in channel">
          <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
        <button
          onClick={onToggleMembersList}
          className="pb-icon-btn hidden xl:inline-flex"
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
        <button
          className="pb-icon-btn"
          title="More channel options"
          aria-label="More channel options"
        >
          <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
