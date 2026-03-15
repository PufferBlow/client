/**
 * InstancePingTab — admin tool for probing remote PufferBlow instances.
 *
 * Requires the `view_server_stats` privilege.
 *
 * Features:
 *  - URL input with quick presets / history
 *  - Real-time latency measurement (round-trip to /healthz)
 *  - HTTP status + colour-coded result badge
 *  - History log of recent probe results
 *  - Copy-friendly result display
 */
import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Globe,
  History,
  Loader2,
  PlugZap,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { pingInstance } from '../../../services/ping';
import type { ShowToast } from '../../Toast';

interface ProbeResult {
  id: string;
  targetUrl: string;
  status: 'ok' | 'error' | 'pending';
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  probedAt: string;
}

const StatusIcon = ({ status }: { status: ProbeResult['status'] }) => {
  if (status === 'pending') return <Loader2 size={15} className="animate-spin text-[var(--color-info)]" />;
  if (status === 'ok') return <CheckCircle2 size={15} className="text-[var(--color-success)]" />;
  return <XCircle size={15} className="text-[var(--color-error)]" />;
};

const StatusBadge = ({ result }: { result: ProbeResult }) => {
  if (result.status === 'pending') {
    return (
      <span className="rounded-full border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-info)]">
        Probing…
      </span>
    );
  }
  if (result.status === 'ok') {
    return (
      <span className="rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
        HTTP {result.httpStatus}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-error)]">
      {result.httpStatus ? `HTTP ${result.httpStatus}` : result.error || 'Failed'}
    </span>
  );
};

export interface InstancePingTabProps {
  showToast: ShowToast;
}

export function InstancePingTab({ showToast }: InstancePingTabProps) {
  const [targetUrl, setTargetUrl] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);

  const probe = async () => {
    const url = targetUrl.trim();
    if (!url) return;

    // Normalise — ensure it looks like a URL
    const normalized = url.startsWith('http') ? url : `https://${url}`;

    const probeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pending: ProbeResult = {
      id: probeId,
      targetUrl: normalized,
      status: 'pending',
      httpStatus: null,
      latencyMs: null,
      error: null,
      probedAt: new Date().toISOString(),
    };

    setResults((prev) => [pending, ...prev.slice(0, 19)]);
    setIsProbing(true);

    const response = await pingInstance({ target_instance_url: normalized });

    setIsProbing(false);

    if (!response.success) {
      setResults((prev) =>
        prev.map((r) =>
          r.id === probeId
            ? { ...r, status: 'error', error: response.error || 'Request failed' }
            : r,
        ),
      );
      showToast({ message: response.error || 'Probe failed.', tone: 'error', category: 'system' });
      return;
    }

    const ping = response.data?.ping;
    const isOk = ping?.status === 'acked';

    setResults((prev) =>
      prev.map((r) =>
        r.id === probeId
          ? {
              ...r,
              status: isOk ? 'ok' : 'error',
              httpStatus: ping?.http_status ?? null,
              latencyMs: ping?.latency_ms ?? null,
              error: ping?.error ?? null,
            }
          : r,
      ),
    );

    if (isOk) {
      showToast({
        message: `Instance reachable — ${ping?.latency_ms ?? '?'}ms`,
        tone: 'success',
        category: 'system',
      });
    }
  };

  const clearResults = () => setResults([]);

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <PlugZap size={18} className="text-[var(--color-info)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Instance Ping</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Probe a remote PufferBlow instance by sending an HTTP request to its /healthz endpoint.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="mb-2 block text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          Target Instance URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isProbing && probe()}
              placeholder="https://other.example.com"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={probe}
            disabled={isProbing || !targetUrl.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProbing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Activity size={14} />
            )}
            {isProbing ? 'Probing…' : 'Probe'}
          </button>
        </div>
      </div>

      {/* Results history */}
      {results.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[var(--color-text-muted)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">
                Results <span className="text-[var(--color-text-muted)]">({results.length})</span>
              </span>
            </div>
            <button
              type="button"
              onClick={clearResults}
              className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-hover)] transition-colors"
              >
                <StatusIcon status={result.status} />

                <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
                  {/* URL */}
                  <span
                    className="truncate text-sm text-[var(--color-text)] font-mono"
                    title={result.targetUrl}
                  >
                    {result.targetUrl.replace(/^https?:\/\//, '')}
                  </span>

                  {/* Status badge */}
                  <StatusBadge result={result} />

                  {/* Latency */}
                  {result.latencyMs != null ? (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Zap size={11} />
                      {result.latencyMs}ms
                    </span>
                  ) : (
                    <span />
                  )}

                  {/* Time */}
                  <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(result.probedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
