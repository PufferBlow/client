/**
 * PingHistory — full-featured ping history modal.
 *
 * Features:
 *  - Tabs: All / Sent / Received
 *  - Status badges with colour-coding
 *  - Latency display for acked pings
 *  - Pagination
 *  - Dismiss individual records
 *  - Stats summary row (total, acked, avg latency)
 *
 * Usage: render inside a portal / modal, toggled from a toolbar button.
 *
 * @example
 * <PingHistory
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   pingHook={usePing()}
 *   showToast={showToast}
 * />
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  Timer,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import type { Ping, PingHistoryResponse, PingStatsResponse } from '../../models/Ping';
import { pingStatusLabel } from '../../services/ping';
import type { UsePingReturn } from '../../hooks/usePing';
import type { ShowToast } from '../Toast';

type Direction = 'both' | 'sent' | 'received';

const PER_PAGE = 20;

const statusColor: Record<string, string> = {
  sent: 'text-[var(--color-info)] bg-[var(--color-info)]/10 border-[var(--color-info)]/20',
  delivered: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20',
  acked: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
  timeout: 'text-[var(--color-text-muted)] bg-[var(--color-surface-secondary)] border-[var(--color-border)]',
  failed: 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor[status] ?? statusColor.timeout}`}
  >
    {pingStatusLabel(status)}
  </span>
);

const DirectionIcon = ({ isSender }: { isSender: boolean }) =>
  isSender ? (
    <Send size={12} className="shrink-0 text-[var(--color-info)]" title="Sent" />
  ) : (
    <Bell size={12} className="shrink-0 text-[var(--color-warning)]" title="Received" />
  );

function PingRow({
  ping,
  onDismiss,
}: {
  ping: Ping;
  onDismiss: (pingId: string) => void;
}) {
  const target =
    ping.target_actor_uri?.split('/').pop() ||
    ping.target_user_id ||
    ping.target_instance_url ||
    '—';

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors">
      <DirectionIcon isSender={ping.is_sender} />

      <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
        {/* Target */}
        <span className="truncate text-sm text-[var(--color-text)]" title={target}>
          {target}
        </span>

        {/* Status */}
        <StatusBadge status={ping.status} />

        {/* Latency */}
        {ping.latency_ms != null ? (
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Zap size={11} />
            {ping.latency_ms}ms
          </span>
        ) : (
          <span />
        )}

        {/* Sent at */}
        <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
          {new Date(ping.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(ping.ping_id)}
        className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
        title="Dismiss"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function StatsRow({ stats }: { stats: PingStatsResponse }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { icon: <Send size={14} />, label: 'Sent', value: stats.sent_total },
        { icon: <Bell size={14} />, label: 'Received', value: stats.received_total },
        { icon: <CheckCircle2 size={14} />, label: 'Acked', value: stats.acked_count },
        {
          icon: <Zap size={14} />,
          label: 'Avg latency',
          value: stats.avg_latency_ms != null ? `${stats.avg_latency_ms}ms` : '—',
        },
      ].map(({ icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center"
        >
          <div className="flex items-center justify-center text-[var(--color-text-muted)]">{icon}</div>
          <p className="text-lg font-bold text-[var(--color-text)]">{value}</p>
          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}

export interface PingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  pingHook: UsePingReturn;
  showToast: ShowToast;
}

export function PingHistory({ isOpen, onClose, pingHook, showToast }: PingHistoryProps) {
  const { dismiss, fetchHistory, fetchStats } = pingHook;

  const [direction, setDirection] = useState<Direction>('both');
  const [page, setPage] = useState(1);
  const [historyData, setHistoryData] = useState<PingHistoryResponse | null>(null);
  const [stats, setStats] = useState<PingStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchHistory(direction, page, PER_PAGE);
    setHistoryData(data);
    setIsLoading(false);
  }, [direction, page, fetchHistory]);

  const loadStats = useCallback(async () => {
    const data = await fetchStats();
    setStats(data);
  }, [fetchStats]);

  useEffect(() => {
    if (!isOpen) return;
    load();
    loadStats();
  }, [isOpen, load, loadStats]);

  useEffect(() => {
    if (isOpen) { setPage(1); }
  }, [direction, isOpen]);

  const handleDismiss = async (pingId: string) => {
    const ok = await dismiss(pingId);
    if (ok) {
      setHistoryData((prev) =>
        prev ? { ...prev, pings: prev.pings.filter((p) => p.ping_id !== pingId) } : prev,
      );
      loadStats();
    } else {
      showToast({ message: 'Failed to dismiss ping.', tone: 'error', category: 'system' });
    }
  };

  if (!isOpen) return null;

  const pings = historyData?.pings ?? [];
  const totalPages = Math.max(1, Math.ceil((pings.length === PER_PAGE ? page * PER_PAGE + 1 : (page - 1) * PER_PAGE + pings.length) / PER_PAGE));

  return (
    <div
      className="pb-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pb-modal flex w-full max-w-2xl flex-col rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--color-info)]" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">Ping History</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowStats((v) => !v); if (!stats) loadStats(); }}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <BarChart2 size={13} />
              Stats
            </button>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats panel (toggle) */}
        {showStats && stats && (
          <div className="border-b border-[var(--color-border)] p-4">
            <StatsRow stats={stats} />
          </div>
        )}

        {/* Direction tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['both', 'sent', 'received'] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={[
                'flex-1 py-2.5 text-sm font-medium capitalize transition-colors',
                direction === d
                  ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {d === 'both' ? 'All' : d}
            </button>
          ))}
        </div>

        {/* Ping list */}
        <div className="min-h-[200px] flex-1 overflow-y-auto px-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-muted)]">
              Loading…
            </div>
          ) : pings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Timer size={28} className="text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">No pings found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {pings.map((p) => (
                <PingRow key={p.ping_id} ping={p} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            Page {page}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-40"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={pings.length < PER_PAGE}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-40"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
