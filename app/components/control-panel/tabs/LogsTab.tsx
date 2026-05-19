/**
 * LogsTab — live server log viewer with search, level filter, ANSI colour
 * decoding, auto-scroll, and download.
 *
 * Live updates: we don't have a server-side WebSocket endpoint for logs yet
 * (only /api/v1/system/logs over POST), so the "stream" here is a short-
 * interval poll (2s) that diffs against the last snapshot and appends new
 * lines. The polling lives in a dedicated effect that the user can pause
 * via the "Live" toggle — kept lightweight so it's safe to leave running.
 *
 * Colouring policy: the panel lives inside the regular control-panel
 * card (same surface tokens as the other tabs — no terminal-chrome
 * decoration). What we DO keep is per-level coloring: lines with INFO
 * render in the info accent, WARNING in the warning accent, ERROR in
 * the error accent, etc. ANSI escape codes that the backend emits get
 * decoded onto the same palette so a coloured logger import keeps its
 * intent (red == error) without us pretending the panel is a real
 * terminal emulator.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { getServerLogs } from "../../../services/system";
import type { ShowToast } from "../../Toast";
import {
  cx,
  controlPanelSectionClass,
  controlPanelButtonClass,
  controlPanelInputClass,
} from "../shared";

// Options for the level dropdown. Centralised so the trigger label
// and the menu rows can share a single source of truth.
const LOG_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

// Design-token palette for log severities. Logs adopt the same
// accent colours used elsewhere in the control panel so an operator
// reads "red == error" the same way in the logs viewer that they do
// on the moderation dashboard.
const LEVEL_COLORS = {
  error: "var(--color-error)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  debug: "var(--color-text-muted)",
  success: "var(--color-success)",
  text: "var(--color-text)",
  muted: "var(--color-text-muted)",
} as const;

// ANSI SGR codes the backend's loguru config tends to emit, mapped
// onto the same design tokens so coloured output keeps its semantic
// meaning instead of clashing with the rest of the UI.
const ANSI_COLORS: Record<string, string> = {
  "30": "var(--color-text-muted)", // black -> muted
  "31": LEVEL_COLORS.error,        // red
  "32": LEVEL_COLORS.success,      // green
  "33": LEVEL_COLORS.warning,      // yellow
  "34": LEVEL_COLORS.info,         // blue
  "35": "var(--color-accent)",     // magenta
  "36": LEVEL_COLORS.info,         // cyan -> info too
  "37": LEVEL_COLORS.text,         // white -> default text
  "90": LEVEL_COLORS.muted,
  "91": LEVEL_COLORS.error,
  "92": LEVEL_COLORS.success,
  "93": LEVEL_COLORS.warning,
  "94": LEVEL_COLORS.info,
  "95": "var(--color-accent)",
  "96": LEVEL_COLORS.info,
  "97": LEVEL_COLORS.text,
};

const POLL_INTERVAL_MS = 2000;

// Pick a colour for a log line based on the level token it contains.
// This is the fallback when the line has no ANSI codes — most plain-
// text loggers still emit `[INFO]` / `WARNING:` markers that the
// operator wants to see at a glance.
const levelColorForLine = (line: string): string | undefined => {
  const upper = line.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes("ERROR")) return LEVEL_COLORS.error;
  if (upper.includes("WARN")) return LEVEL_COLORS.warning;
  if (upper.includes("INFO")) return LEVEL_COLORS.info;
  if (upper.includes("DEBUG") || upper.includes("TRACE")) return LEVEL_COLORS.debug;
  return undefined;
};

export function LogsTab({
  showToast: _showToast,
}: {
  showToast: ShowToast;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const levelMenuRef = useRef<HTMLDivElement>(null);

  // Close the level dropdown on any click outside its wrapper. Cheap
  // global listener; only active while the menu is open.
  useEffect(() => {
    if (!levelMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!levelMenuRef.current) return;
      if (!levelMenuRef.current.contains(event.target as Node)) {
        setLevelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [levelMenuOpen]);
  // We keep the latest log snapshot in a ref so the polling effect can
  // diff without re-subscribing on every state change.
  const latestLogsRef = useRef<string[]>([]);

  const scrollToBottom = (smooth = true) => {
    if (!autoScroll) return;
    const node = logsEndRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const fetchLogs = async (silent = false): Promise<void> => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        if (!silent) setError('Authentication token not found');
        return;
      }

      const request: any = {};
      if (searchTerm.trim()) {
        request.lines = 1000;
      }
      if (logLevel !== 'all') {
        request.level = logLevel.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
      }

      const response = await getServerLogs(authToken, request);
      if (response.success && response.data) {
        let logLines: string[] = [];
        const logsData = response.data.logs;
        if (logsData) {
          if (Array.isArray(logsData)) {
            logLines = (logsData as any[]).map((log: any) => {
              const raw = log.raw || log.content || log;
              return typeof raw === 'string' ? raw : String(raw);
            });
          } else if (typeof logsData === 'string') {
            logLines = (logsData as string).split('\n').filter((line: string) => line.trim() !== '');
          }
        }

        // On silent refresh, only update if something actually changed —
        // avoids unnecessary re-renders when the file is idle.
        const previous = latestLogsRef.current;
        const changed =
          previous.length !== logLines.length ||
          (logLines.length > 0 && previous[previous.length - 1] !== logLines[logLines.length - 1]);

        if (changed) {
          latestLogsRef.current = logLines;
          setLogs(logLines);
        }
      } else if (!silent) {
        setError(response.error || 'Failed to load logs');
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to load logs');
      }
      console.error('Failed to load logs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadLogs = () => fetchLogs(false);

  const applyFilters = (logList: string[], search: string, level: string) => {
    let filtered = logList;
    if (level !== 'all') {
      filtered = filtered.filter(line => {
        const upperLine = line.toUpperCase();
        switch (level) {
          case 'error':
            return upperLine.includes('ERROR') || upperLine.includes('[ERROR]');
          case 'warning':
            return upperLine.includes('WARN') || upperLine.includes('[WARN]') ||
                   upperLine.includes('WARNING') || upperLine.includes('[WARNING]');
          case 'info':
            return upperLine.includes('INFO') || upperLine.includes('[INFO]');
          case 'debug':
            return upperLine.includes('DEBUG') || upperLine.includes('[DEBUG]');
          default:
            return true;
        }
      });
    }
    if (search.trim()) {
      filtered = filtered.filter(line =>
        line.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFilteredLogs(filtered);
  };

  // Initial load + re-fetch whenever filters change (because the
  // server-side `level` filter has to be re-applied).
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logLevel]);

  useEffect(() => {
    applyFilters(logs, searchTerm, logLevel);
  }, [logs, searchTerm, logLevel]);

  // "Live stream" via polling. Real WS would replace this whole effect.
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => {
      void fetchLogs(true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, logLevel, searchTerm]);

  const ansiToHtml = (text: any): string => {
    if (typeof text !== 'string') {
      text = String(text);
    }

    // Escape HTML first so log content can't inject markup.
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight the bare level tokens with semantic colours even when
    // the line lacks ANSI codes. We do this BEFORE the ANSI pass so
    // explicit ANSI takes precedence over the heuristic span.
    safe = safe.replace(
      /\b(CRITICAL|ERROR|WARNING|WARN|INFO|DEBUG|TRACE)\b/g,
      (match: string) => {
        const upper = match.toUpperCase();
        const colour =
          upper === 'CRITICAL' || upper === 'ERROR'
            ? LEVEL_COLORS.error
            : upper === 'WARNING' || upper === 'WARN'
              ? LEVEL_COLORS.warning
              : upper === 'INFO'
                ? LEVEL_COLORS.info
                : LEVEL_COLORS.debug;
        return `<span style="color:${colour};font-weight:600">${match}</span>`;
      },
    );

    // Walk ANSI escape sequences and emit spans for SGR colour + bold
    // + underline + reset. Anything we don't understand is dropped.
    let out = '';
    let openSpans = 0;
    const ansiRe = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ansiRe.exec(safe)) !== null) {
      out += safe.slice(lastIndex, match.index);
      const codes = match[1].split(';').filter(Boolean);
      if (codes.length === 0 || codes.includes('0')) {
        out += '</span>'.repeat(openSpans);
        openSpans = 0;
      } else {
        const styles: string[] = [];
        for (const code of codes) {
          if (ANSI_COLORS[code]) {
            styles.push(`color:${ANSI_COLORS[code]}`);
          } else if (code === '1') {
            styles.push('font-weight:bold');
          } else if (code === '4') {
            styles.push('text-decoration:underline');
          } else if (code === '2') {
            styles.push('opacity:0.7');
          }
        }
        if (styles.length > 0) {
          out += `<span style="${styles.join(';')}">`;
          openSpans += 1;
        }
      }
      lastIndex = ansiRe.lastIndex;
    }
    out += safe.slice(lastIndex);
    if (openSpans > 0) {
      out += '</span>'.repeat(openSpans);
    }
    return out;
  };

  const downloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = async () => {
    setLogs([]);
    setFilteredLogs([]);
    latestLogsRef.current = [];
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6">
      <div className={cx(controlPanelSectionClass, "flex h-full min-h-0 flex-1 flex-col")}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Server Logs</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Live server logs with filtering and per-level coloring (INFO / WARNING / ERROR / DEBUG).
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setIsLive((v) => !v)}
              className={cx(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                isLive
                  ? "border-[var(--color-success)] bg-[var(--color-success)]/15 text-[var(--color-success)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
              )}
              title={isLive ? "Pause live updates" : "Resume live updates"}
            >
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  isLive ? "bg-[var(--color-success)] animate-pulse" : "bg-[var(--color-text-muted)]"
                )}
              />
              {isLive ? "Live" : "Paused"}
            </button>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {filteredLogs.length} / {logs.length} entries
            </div>
            {/* Header "Refresh" button removed: the Live-stream poll
                covers continuous updates, the error branch still has
                its own Retry button for one-shot recovery, and the
                top-of-card refresh was effectively redundant. */}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={controlPanelInputClass}
            />
          </div>
          {/* Custom level dropdown — replaces the native <select>. A
              button + popover lets us keep the rounded chrome and
              hover/focus tokens consistent with the rest of the
              control panel; the native select inherits OS theming we
              can't reach with Tailwind tokens. */}
          <div className="flex items-center space-x-2">
            <label className="font-medium text-[var(--color-text)]">Level:</label>
            <div ref={levelMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setLevelMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={levelMenuOpen}
                className={cx(
                  "inline-flex w-40 items-center justify-between gap-2 rounded-xl border bg-[var(--color-surface-secondary)] px-3 py-2.5 text-sm transition-colors",
                  levelMenuOpen
                    ? "border-[var(--color-primary)] text-[var(--color-text)] ring-2 ring-[var(--color-focus)]"
                    : "border-[var(--color-border-secondary)] text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                )}
              >
                <span className="truncate">
                  {LOG_LEVEL_OPTIONS.find((opt) => opt.value === logLevel)?.label ?? "All"}
                </span>
                <ChevronDown
                  className={cx(
                    "h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform",
                    levelMenuOpen && "rotate-180"
                  )}
                />
              </button>
              {levelMenuOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] py-1 shadow-lg"
                >
                  {LOG_LEVEL_OPTIONS.map((option) => {
                    const isSelected = logLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setLogLevel(option.value);
                          setLevelMenuOpen(false);
                        }}
                        className={cx(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                            : "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                        )}
                      >
                        <span>{option.label}</span>
                        {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Auto-scroll — square checkbox button to match the
              enable/disable pattern used in Tasks and Security. */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setAutoScroll((v) => !v)}
              className="flex items-center space-x-2 group"
              aria-pressed={autoScroll}
            >
              <span
                className={cx(
                  "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                  autoScroll
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent group-hover:bg-[var(--color-hover)]"
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="text-sm text-[var(--color-text)]">Auto-scroll</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            <button onClick={downloadLogs} className={controlPanelButtonClass('secondary')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Logs</span>
            </button>
            <button onClick={clearLogs} className={controlPanelButtonClass('danger')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Log viewport. Same surface tokens as the rest of the
            control panel — no terminal-chrome decoration. Per-level
            coloring lives inside the rows themselves. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)]">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-[var(--color-text-secondary)]">
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 animate-spin mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="font-mono text-sm">Loading server logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-[var(--color-error)]">
              <div>
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-mono text-lg font-semibold mb-2">Error loading logs</h3>
                <p className="font-mono text-sm mb-4">{error}</p>
                <button
                  onClick={loadLogs}
                  className={controlPanelButtonClass('primary')}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--color-text)]"
            >
              {filteredLogs.length === 0 ? (
                <div className="py-8 text-center text-[var(--color-text-muted)]">
                  {logs.length === 0 ? (
                    <p>No logs available yet — waiting for output…</p>
                  ) : (
                    <p className="font-mono text-sm">No logs match your search criteria</p>
                  )}
                </div>
              ) : (
                <>
                  {filteredLogs.map((line, index) => {
                    const tint = levelColorForLine(line);
                    return (
                      <div
                        key={index}
                        className="whitespace-pre-wrap break-words px-1 py-0.5 rounded hover:bg-[var(--color-hover)]"
                        style={tint ? { color: tint } : undefined}
                        dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                      />
                    );
                  })}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
