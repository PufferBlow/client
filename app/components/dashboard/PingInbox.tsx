/**
 * PingInbox — floating notification bell button + dropdown panel.
 *
 * Shows a badge count, lists pending pings, and lets the user ack or dismiss
 * each one inline. Receives live updates via the usePing hook.
 *
 * Usage: place in the dashboard sidebar or top-bar.
 *
 * @example
 * const ping = usePing();
 * <PingInbox pingHook={ping} showToast={showToast} />
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Clock, X } from 'lucide-react';
import type { UsePingReturn } from '../../hooks/usePing';
import type { PingNotification } from '../../models/Ping';
import type { ShowToast } from '../Toast';

const formatRelativeTime = (isoString: string): string => {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const formatTimeLeft = (expiresAt: string): string => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m left`;
};

interface PingNotificationItemProps {
  notification: PingNotification;
  onAck: (pingId: string) => Promise<void>;
  onDismiss: (pingId: string) => Promise<void>;
  isAcking: boolean;
}

function PingNotificationItem({
  notification,
  onAck,
  onDismiss,
  isAcking,
}: PingNotificationItemProps) {
  return (
    <div className="group flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-border-secondary)]">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bell size={12} className="shrink-0 text-[var(--color-info)]" />
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {notification.senderLabel}
          </span>
          {notification.pingType !== 'local' && (
            <span className="shrink-0 rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
              {notification.pingType}
            </span>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => onDismiss(notification.receiverPingId)}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>

      {/* Optional message */}
      {notification.message && (
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
          {notification.message}
        </p>
      )}

      {/* Footer: timestamps + ack button */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
          <span>{formatRelativeTime(notification.sentAt)}</span>
          <span className="flex items-center gap-0.5">
            <Clock size={10} />
            {formatTimeLeft(notification.expiresAt)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAck(notification.receiverPingId)}
          disabled={isAcking}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/20 disabled:opacity-50"
        >
          <Check size={11} />
          Ack
        </button>
      </div>
    </div>
  );
}

export interface PingInboxProps {
  pingHook: UsePingReturn;
  showToast: ShowToast;
}

export function PingInbox({ pingHook, showToast }: PingInboxProps) {
  const { notifications, unreadCount, ack, dismiss, isLoadingPending } = pingHook;
  const [isOpen, setIsOpen] = useState(false);
  const [ackingIds, setAckingIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAck = async (pingId: string) => {
    setAckingIds((prev) => new Set(prev).add(pingId));
    const result = await ack(pingId);
    setAckingIds((prev) => {
      const next = new Set(prev);
      next.delete(pingId);
      return next;
    });

    if (result.ok) {
      showToast({
        message:
          result.latencyMs != null
            ? `Acknowledged — ${result.latencyMs}ms round-trip.`
            : 'Ping acknowledged.',
        tone: 'success',
        category: 'system',
      });
    } else {
      showToast({ message: result.error || 'Failed to ack ping.', tone: 'error', category: 'system' });
    }
  };

  const handleDismiss = async (pingId: string) => {
    await dismiss(pingId);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title="Ping inbox"
        className={[
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          'border border-[var(--color-border)] bg-[var(--color-surface)]',
          'hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)]',
          'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          isOpen ? 'border-[var(--color-border-secondary)] bg-[var(--color-hover)]' : '',
        ].join(' ')}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-80 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[var(--color-info)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">Ping Inbox</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--color-error)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto p-3">
            {isLoadingPending ? (
              <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-muted)]">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Bell size={24} className="text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">No pending pings</p>
              </div>
            ) : (
              notifications.map((n) => (
                <PingNotificationItem
                  key={n.receiverPingId}
                  notification={n}
                  onAck={handleAck}
                  onDismiss={handleDismiss}
                  isAcking={ackingIds.has(n.receiverPingId)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
