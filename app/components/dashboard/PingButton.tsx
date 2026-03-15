/**
 * PingButton — compact action button that sends a ping to a specific user.
 *
 * Usage: embed inside a user profile card, context menu, or member list item.
 *
 * @example
 * <PingButton targetUserId={user.user_id} targetLabel={user.username} onPingSent={cb} />
 */
import React, { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { sendPing } from '../../services/ping';
import type { ShowToast } from '../Toast';

export interface PingButtonProps {
  /** Local user_id, local username, remote handle, or actor URI. */
  targetUserId: string;
  /** Human-readable name shown in confirmation toasts. */
  targetLabel?: string;
  /** Optional short message body. */
  message?: string;
  /** Toast handler — if not provided the button shows an inline status. */
  showToast?: ShowToast;
  /** Called after a successful send with the resulting ping_id. */
  onPingSent?: (pingId: string) => void;
  /** If true renders as an icon-only button (no label). */
  iconOnly?: boolean;
  className?: string;
}

export function PingButton({
  targetUserId,
  targetLabel,
  message,
  showToast,
  onPingSent,
  iconOnly = false,
  className = '',
}: PingButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handlePing = async () => {
    if (isSending || sent) return;
    setIsSending(true);

    const response = await sendPing({ target: targetUserId, message });

    setIsSending(false);

    if (!response.success) {
      showToast?.({
        message: response.error || 'Failed to send ping.',
        tone: 'error',
        category: 'system',
      });
      return;
    }

    setSent(true);
    const pingId = response.data?.ping?.ping_id ?? '';
    onPingSent?.(pingId);

    showToast?.({
      message: `Pinged ${targetLabel || targetUserId}.`,
      tone: 'success',
      category: 'system',
    });

    // Reset "sent" indicator after 3 s so the button is usable again
    setTimeout(() => setSent(false), 3000);
  };

  const icon = isSending
    ? <Loader2 size={14} className="animate-spin" />
    : sent
    ? <BellRing size={14} className="text-[var(--color-success)]" />
    : <Bell size={14} />;

  const label = isSending ? 'Pinging…' : sent ? 'Pinged!' : 'Ping';

  return (
    <button
      type="button"
      onClick={handlePing}
      disabled={isSending}
      title={`Ping ${targetLabel || targetUserId}`}
      className={[
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
        'text-xs font-medium transition-colors',
        'border-[var(--color-border)] bg-[var(--color-surface)]',
        'hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)]',
        'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sent ? 'border-[var(--color-success)]/30 text-[var(--color-success)]' : '',
        className,
      ].join(' ')}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
