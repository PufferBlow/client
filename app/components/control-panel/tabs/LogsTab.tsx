/**
 * LogsTab — live server log viewer with search, level filter, ANSI
 * colour decoding, auto-scroll, and download.
 *
 * Visual design intentionally mirrors the in-app client-logs viewer
 * (`components/LogsViewer.tsx`): compact developer-console chrome
 * with small filter pills, tight controls row, monospaced 11px
 * list, and a footer action strip. The server-logs page used to
 * wear the heavier control-panel-tab chrome (large `controlPanelInputClass`
 * search, big `controlPanelButtonClass` action buttons), which
 * looked out of place when an operator is scanning thousands of
 * loguru lines for a stack trace. Sharing the design with client
 * logs also means the same muscle memory works in both surfaces.
 *
 * Live updates: we don't have a server-side WebSocket endpoint for
 * logs yet (only /api/v1/system/logs over POST), so the "stream"
 * here is a short-interval poll (2s) that diffs against the last
 * snapshot and appends new lines. The polling lives in a dedicated
 * effect that the user can pause via the "Live" toggle — kept
 * lightweight so it's safe to leave running.
 *
 * Colouring policy: the panel lives inside the regular control-panel
 * card (same surface tokens as the other tabs — no terminal-chrome
 * decoration). What we DO keep is per-level coloring: lines with
 * INFO render in the info accent, WARNING in the warning accent,
 * ERROR in the error accent, etc. ANSI escape codes that the
 * backend emits get decoded onto the same palette so a coloured
 * logger import keeps its intent (red == error) without us
 * pretending the panel is a real terminal emulator.
 */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { getServerLogs } from "../../../services/system";
import type { ShowToast } from "../../Toast";
import { cx, controlPanelSectionClass } from "../shared";

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

/**
 * Parsed structure of a server log line.
 *
 * The server's file sink (see `pufferblow/cli/common.py::file_log_format`)
 * emits a positional pipe-delimited format:
 *
 *   2024-05-24 12:34:56.789 | INFO     | name:function:line | message
 *
 * Request-context lines insert an extras chunk between the level and
 * the source so the layout is:
 *
 *   {ts} | {level} | method={m} path={p} status={s} duration_ms={d}
 *         client_ip={ip} request_id={rid} | {name}:{fn}:{line} | {message}
 *
 * Parsing into this typed shape lets the row renderer compose the
 * same visual columns as the client-logs viewer — timestamp ·
 * LEVEL · context-chip · message — so the two surfaces share a
 * design language. Lines that don't match (multi-line tracebacks,
 * stdout dumps from third-party libraries) fall back to a
 * rawText-only render.
 */
interface ParsedLogLine {
  /** Wall-clock timestamp portion (the `HH:mm:ss.SSS` suffix). The
   *  date is dropped because rows are dense and the date repeats —
   *  if someone needs the full date they can hover the row or
   *  download the file. */
  time: string;
  /** Severity name, upper-case, no padding. */
  level: string;
  /** Short source attribution shown as a chip — derived from
   *  `name:function:line` but trimmed to keep the chip compact.
   *  Falls back to the module's last segment. */
  context: string;
  /** The actual message body (everything after the last pipe). */
  message: string;
  /** Original raw line — kept so the row can fall through to the
   *  raw renderer if the user clicks expand, and so search /
   *  copy-line operations still see the full content. */
  rawText: string;
  /** Optional request-id (8-char prefix) when this is a request
   *  log line. Renders as a small monochrome chip next to the
   *  context. */
  requestIdShort?: string;
  /** Optional HTTP status code for request lines — used to colour
   *  the request-id chip (2xx green, 4xx warning, 5xx red). */
  requestStatus?: number;
}

// Regexes pinned to the server's file_log_format. Kept here as
// module-level constants so the parser doesn't recompile them per
// call (a busy server can emit hundreds of lines per refresh).
const LOG_LINE_HEAD_RE =
  /^(\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2}\.\d{3})) \| (\w+)\s*\|\s*(.*)$/;
const REQUEST_EXTRAS_RE =
  /^(?:method=(\S+) )?(?:path=(\S+) )?(?:status=(\S+) )?(?:duration_ms=(\S+) )?(?:client_ip=(\S+) )?(?:request_id=(\S+))?\s*$/;

function parseLogLine(raw: string): ParsedLogLine | null {
  const head = LOG_LINE_HEAD_RE.exec(raw);
  if (!head) return null;
  const time = head[2];
  const level = head[3].toUpperCase();
  // The tail after the level is one of two shapes:
  //   (a) `<name>:<fn>:<line> | <message>`
  //   (b) `<request-extras> | <name>:<fn>:<line> | <message>`
  // We split by the first ` | ` and decide based on whether the
  // first chunk parses as request extras.
  const tail = head[4];
  const parts = tail.split(" | ");
  let source = "";
  let message = "";
  let requestIdShort: string | undefined;
  let requestStatus: number | undefined;
  if (parts.length >= 3) {
    // Shape (b): extras | source | message
    const extras = REQUEST_EXTRAS_RE.exec(parts[0]);
    if (extras) {
      const rid = extras[6];
      if (rid && rid !== "-") requestIdShort = rid.slice(0, 8);
      const status = extras[3];
      if (status && status !== "-") {
        const n = Number.parseInt(status, 10);
        if (!Number.isNaN(n)) requestStatus = n;
      }
    }
    source = parts[1];
    // Re-join the rest in case the message itself contained ` | `
    // (the server message body is free-form text).
    message = parts.slice(2).join(" | ");
  } else if (parts.length === 2) {
    // Shape (a): source | message
    source = parts[0];
    message = parts[1];
  } else {
    // Unknown — treat the whole tail as the message.
    message = tail;
  }

  // Trim the source to its tail segments — full module paths
  // (`pufferblow.api.dependencies.get_current_user:60`) would
  // dominate the row. We keep the last module + function + line so
  // an operator still has the locator info but in compact form.
  const context = compactSource(source);

  return {
    time,
    level,
    context,
    message: message.trim(),
    rawText: raw,
    requestIdShort,
    requestStatus,
  };
}

function compactSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "";
  // Drop the line number for a compact chip — operators can still
  // see it on hover via the row's title attribute.
  const noLine = trimmed.replace(/:(\d+)$/, "");
  // Keep last two dotted segments: `pufferblow.api.dependencies:get_current_user`
  // → `dependencies:get_current_user`. Less noise per row.
  const colonAt = noLine.lastIndexOf(":");
  if (colonAt < 0) {
    // No function part — just a module path. Last segment only.
    const dotAt = noLine.lastIndexOf(".");
    return dotAt >= 0 ? noLine.slice(dotAt + 1) : noLine;
  }
  const mod = noLine.slice(0, colonAt);
  const fn = noLine.slice(colonAt + 1);
  const dotAt = mod.lastIndexOf(".");
  const modTail = dotAt >= 0 ? mod.slice(dotAt + 1) : mod;
  return `${modTail}:${fn}`;
}

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
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
      {/* Outer card stays in the control-panel section chrome so
          this tab visually slots into the same shell as Stats /
          Members / Security. Inside, the layout mirrors the
          client-logs viewer: compact header, filter pills, tight
          controls row, monospaced list, footer action strip. The
          shared design language across the two log surfaces is
          intentional — operators jumping between them shouldn't
          have to relearn the controls. */}
      <div className={cx(controlPanelSectionClass, "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0")}>
        {/* Header — title + Live/Paused indicator. Same vertical
            rhythm as the client-logs modal's header row. */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-secondary)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Server logs
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Live tail of the instance's loguru stream. Search, filter,
              and per-level colouring (INFO / WARNING / ERROR / DEBUG).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLive((v) => !v)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
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
        </div>

        {/* Filter row — pills for the level filter. Mirrors the
            client-logs context-tab row visually (small bordered
            pills, primary fill when active) so the two viewers
            share the same density and rhythm. We deliberately use
            pills here rather than a dropdown because the level
            list is short (5 options) and pills are one-click
            instead of two. */}
        <div className="flex flex-col gap-2 border-b border-[var(--color-border-secondary)] px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {LOG_LEVEL_OPTIONS.map((option) => {
              const active = logLevel === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLogLevel(option.value)}
                  className={cx(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                      : "border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {/* Search + auto-scroll row — same shape as the client
              viewer's controls row. Search expands to fill, the
              auto-scroll checkbox sits to the right. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search log lines…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              aria-label="Search server log lines"
            />
            <button
              type="button"
              onClick={() => setAutoScroll((v) => !v)}
              aria-pressed={autoScroll}
              className="group inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-[var(--color-text)]"
            >
              <span
                className={cx(
                  "flex h-4 w-4 items-center justify-center rounded-md border transition-colors",
                  autoScroll
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent group-hover:bg-[var(--color-hover)]"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>Auto-scroll</span>
            </button>
          </div>
        </div>

        {/* Log viewport — `flex-1` + `min-h-0` so it fills the
            remaining tab height and scrolls internally rather than
            pushing the action footer off-screen. Same monospaced
            density as the client-logs list: text-[11px], px-5,
            py-1.5 per row, border-b separators, hover-bg. */}
        <div
          ref={scrollContainerRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--color-background)] font-mono text-[11px] leading-relaxed"
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-[var(--color-text-secondary)]">
              <div className="flex flex-col items-center">
                <svg className="mb-3 h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-xs">Loading server logs…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-[var(--color-error)]">
              <div>
                <svg className="mx-auto mb-3 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-semibold">Error loading logs</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{error}</p>
                <button
                  onClick={loadLogs}
                  className="mt-3 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12 text-[var(--color-text-muted)]">
              <p className="text-xs">
                {logs.length === 0
                  ? "No logs available yet — waiting for output…"
                  : "No log lines match the current filters."}
              </p>
            </div>
          ) : (
            <div>
              {filteredLogs.map((line, index) => {
                // Try to render the row as STRUCTURED columns
                // (timestamp · LEVEL · context · message) matching
                // the client-logs viewer. Lines that don't match
                // the file_log_format regex (multi-line tracebacks,
                // raw stdout from a misbehaving library) fall
                // through to the legacy raw renderer below — same
                // ANSI decoding + level-tint, just without the
                // structured columns.
                const parsed = parseLogLine(line);
                if (parsed) {
                  const levelColor =
                    parsed.level === "CRITICAL" || parsed.level === "ERROR"
                      ? LEVEL_COLORS.error
                      : parsed.level === "WARNING" || parsed.level === "WARN"
                        ? LEVEL_COLORS.warning
                        : parsed.level === "SUCCESS"
                          ? LEVEL_COLORS.success
                          : parsed.level === "INFO"
                            ? LEVEL_COLORS.info
                            : LEVEL_COLORS.debug;
                  const statusColor =
                    parsed.requestStatus === undefined
                      ? undefined
                      : parsed.requestStatus >= 500
                        ? LEVEL_COLORS.error
                        : parsed.requestStatus >= 400
                          ? LEVEL_COLORS.warning
                          : LEVEL_COLORS.success;
                  return (
                    <div
                      key={index}
                      // `title` carries the original line so an
                      // operator can hover to see the full source
                      // path / extras that the compact row hides.
                      title={parsed.rawText}
                      className="flex flex-wrap items-baseline gap-2 border-b border-[var(--color-border-secondary)] px-5 py-1.5 hover:bg-[var(--color-hover)]"
                    >
                      <span className="text-[var(--color-text-muted)]">
                        {parsed.time}
                      </span>
                      <span
                        className="font-semibold uppercase"
                        style={{ color: levelColor }}
                      >
                        {parsed.level}
                      </span>
                      {parsed.context ? (
                        <span className="rounded bg-[var(--color-surface-secondary)] px-1.5 py-px text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                          {parsed.context}
                        </span>
                      ) : null}
                      {parsed.requestIdShort ? (
                        <span
                          className="rounded px-1.5 py-px text-[10px] uppercase tracking-wide"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--color-surface-secondary) 60%, transparent)",
                            color: statusColor ?? "var(--color-text-secondary)",
                          }}
                        >
                          {parsed.requestStatus !== undefined
                            ? `${parsed.requestStatus} ${parsed.requestIdShort}`
                            : parsed.requestIdShort}
                        </span>
                      ) : null}
                      <span
                        className="break-words text-[var(--color-text)]"
                        // The message portion of the file format
                        // doesn't contain ANSI (file sink runs with
                        // colorize=False), so we render it as plain
                        // text. The console sink DOES emit ANSI, but
                        // /api/v1/system/logs reads from the file —
                        // so this is the safe path.
                      >
                        {parsed.message}
                      </span>
                    </div>
                  );
                }
                // Fallback — raw ANSI-decoded line. Covers
                // multi-line tracebacks, third-party stdout, and
                // any future logger format changes.
                const tint = levelColorForLine(line);
                return (
                  <div
                    key={index}
                    className="whitespace-pre-wrap break-words border-b border-[var(--color-border-secondary)] px-5 py-1.5 hover:bg-[var(--color-hover)]"
                    style={tint ? { color: tint } : undefined}
                    dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                  />
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer action strip — same layout as the client-logs
            modal footer: action buttons on the left, counter +
            destructive Clear on the right. Borders + padding match
            the header so the card feels framed top-and-bottom. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-secondary)] px-5 py-3">
          <button
            type="button"
            onClick={downloadLogs}
            className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
          >
            Download .log
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {filteredLogs.length} / {logs.length}
            </span>
            <button
              type="button"
              onClick={clearLogs}
              className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-hover)]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
