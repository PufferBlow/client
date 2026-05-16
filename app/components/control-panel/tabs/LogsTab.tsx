/**
 * LogsTab — live server log viewer with search, level filter, ANSI colour
 * decoding, auto-scroll, and download. Pulls from the /system/logs endpoint
 * on demand.
 */
import { useEffect, useRef, useState } from "react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { getServerLogs } from "../../../services/system";
import type { ShowToast } from "../../Toast";
import {
  cx,
  controlPanelSectionClass,
  controlPanelInsetClass,
  controlPanelButtonClass,
  controlPanelInputClass,
  controlPanelSelectClass,
} from "../shared";

export function LogsTab({
  showToast
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const request: any = {};
      // Add search and level filters if provided
      if (searchTerm.trim()) {
        request.lines = 1000; // Fetch more lines when searching to ensure results
        // Note: server-side filtering would be better, but implementing client-side for now
      }
      // Add level filter
      if (logLevel !== 'all') {
        request.level = logLevel.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
      }

      const response = await getServerLogs(authToken, request);
      if (response.success && response.data) {
        // Extract the actual log lines from the content field if available
        let logLines: string[] = [];
        const logsData = response.data.logs;

        if (logsData) {
          if (Array.isArray(logsData)) {
            // If logs is an array of objects with content/raw fields
            logLines = (logsData as any[]).map((log: any) => {
              // Ensure we always return a string, even if the field contains other types
              const raw = log.raw || log.content || log;
              return typeof raw === 'string' ? raw : String(raw);
            });
          } else if (typeof logsData === 'string') {
            // If logs is a string, split by newlines
            logLines = (logsData as string).split('\n').filter((line: string) => line.trim() !== '');
          } else {
            logLines = [];
          }
        } else {
          logLines = [];
        }

        setLogs(logLines);
        applyFilters(logLines, searchTerm, logLevel);
      } else {
        setError(response.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (logList: string[], search: string, level: string) => {
    let filtered = logList;

    // Filter by log level
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

    // Filter by search term
    if (search.trim()) {
      filtered = filtered.filter(line =>
        line.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters(logs, searchTerm, logLevel);
  }, [logs, searchTerm, logLevel]);

  const ansiToHtml = (text: any): string => {
    // Ensure text is a string
    if (typeof text !== 'string') {
      text = String(text);
    }

    // Basic ANSI color parsing - converts common ANSI codes to HTML spans
    // \x1b[31m = red, \x1b[32m = green, \x1b[33m = yellow, etc.
    // Using CSS custom properties to match the app's color scheme
    let html = text
      .replace(/\x1b\[31m/g, '<span style="color: var(--color-error);">') // Red for errors
      .replace(/\x1b\[32m/g, '<span style="color: var(--color-success);">') // Green for success
      .replace(/\x1b\[33m/g, '<span style="color: var(--color-warning);">') // Yellow for warnings
      .replace(/\x1b\[34m/g, '<span style="color: var(--color-primary);">') // Blue for info
      .replace(/\x1b\[35m/g, '<span style="color: var(--color-accent);">') // Magenta/purple
      .replace(/\x1b\[36m/g, '<span style="color: var(--color-info);">') // Cyan/blue
      .replace(/\x1b\[37m/g, '<span style="color: var(--color-text);">') // White/bright text
      .replace(/\x1b\[0m/g, '</span>') // Reset
      .replace(/\x1b\[1m/g, '<span style="font-weight: bold;">') // Bold
      .replace(/\x1b\[4m/g, '<span style="text-decoration: underline;">'); // Underline

    // Close any unclosed spans
    const openSpans = (html.match(/<span/g) || []).length;
    const closeSpans = (html.match(/<\/span>/g) || []).length;
    if (openSpans > closeSpans) {
      html += '</span>'.repeat(openSpans - closeSpans);
    }

    return html;
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
  };

  return (
    <div className="space-y-6">
      {/* Logs Header */}
      <div className={controlPanelSectionClass}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Server Logs</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Live server logs with filtering and color support</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-[var(--color-text-secondary)]">
              {filteredLogs.length} / {logs.length} entries
            </div>
            <button
              onClick={loadLogs}
              disabled={loading}
              className={cx(controlPanelButtonClass('primary'), "disabled:opacity-60")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={controlPanelInputClass}
            />
          </div>

          {/* Filter by level */}
          <div className="flex items-center space-x-2">
            <label className="font-medium text-[var(--color-text)]">Level:</label>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className={controlPanelSelectClass}
            >
              <option value="all">All</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Auto-scroll toggle */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-[var(--color-border)] text-[var(--color-primary)]"
              />
              <span className="text-sm text-[var(--color-text)]">Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            <button
              onClick={downloadLogs}
              className={controlPanelButtonClass('secondary')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Logs</span>
            </button>
            <button
              onClick={clearLogs}
              className={controlPanelButtonClass('danger')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <svg className="w-8 h-8 animate-spin text-[var(--color-primary)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p>Loading server logs...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-[var(--color-error)]">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Logs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadLogs}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          /* Logs Display */
          <div className={controlPanelInsetClass}>
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="font-medium text-[var(--color-text)]">
                Server Logs
                {filteredLogs.length !== logs.length && (
                  <span className="text-[var(--color-text-secondary)] text-sm ml-2">
                    (filtered)
                  </span>
                )}
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-[1rem] bg-[var(--color-background)] p-4 font-mono text-sm">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-[var(--color-text-secondary)] py-8">
                  {logs.length === 0 ? (
                    <>
                      <svg className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No logs available</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">Server logs will appear here when they become available</p>
                    </>
                  ) : (
                    <p>No logs match your search criteria</p>
                  )}
                </div>
              ) : (
                <>
                  {filteredLogs.map((line, index) => (
                    <div
                      key={index}
                      className="mb-1 hover:bg-[var(--color-surface)] px-2 py-1 rounded text-[var(--color-text)]"
                      dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                    />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div
          className="mt-6 rounded-[1.25rem] border p-4"
          style={{
            background: 'linear-gradient(to right, color-mix(in srgb, var(--color-primary) 18%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
            borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
          }}
        >
          <h3 className="mb-2 text-lg font-medium text-[var(--color-text)]">About Server Logs</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Server logs capture all system activity including requests, errors, warnings, and debug information.
            Color codes are preserved for better readability. Use filters to focus on specific types of logs or search by content.
          </p>
        </div>
      </div>
    </div>
  );
}
