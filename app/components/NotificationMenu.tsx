import React from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channelId: string;
  channelName: string;
  createdAt: string;
  unread: boolean;
  kind: 'message' | 'mention';
}

interface NotificationMenuProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (notification: NotificationItem) => void;
  onMarkAllRead: () => void;
  browserNotificationPermission?: NotificationPermission | 'unsupported';
  onEnableBrowserNotifications?: () => void;
}

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export function NotificationMenu({
  notifications,
  isOpen,
  onClose,
  onSelect,
  onMarkAllRead,
  browserNotificationPermission = 'unsupported',
  onEnableBrowserNotifications,
}: NotificationMenuProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute right-0 top-12 z-40 w-[22rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">Notifications</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {notifications.length === 0
              ? 'You are all caught up.'
              : `${notifications.length} recent update${notifications.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            aria-label="Close notifications"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto">
        {browserNotificationPermission !== 'unsupported' && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/50 px-4 py-3">
            {browserNotificationPermission === 'default' ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    Enable desktop notifications
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Get alerts for new messages in other channels when this tab is in the background.
                  </div>
                </div>
                <button
                  onClick={onEnableBrowserNotifications}
                  className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                >
                  Enable
                </button>
              </div>
            ) : browserNotificationPermission === 'denied' ? (
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  Browser notifications blocked
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Notifications are disabled in your browser settings for this instance.
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  Desktop notifications enabled
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  You will receive browser alerts for background notifications.
                </div>
              </div>
            )}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="text-sm font-medium text-[var(--color-text)]">No new notifications</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              New messages from other channels will show up here in real time.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => onSelect(notification)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-hover)]"
              >
                <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${notification.unread ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]/40'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text)]">
                      {notification.title}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${notification.kind === 'mention' ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}>
                      {notification.kind === 'mention' ? 'Mention' : 'Message'}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                    {notification.body}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span>#{notification.channelName}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(notification.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
