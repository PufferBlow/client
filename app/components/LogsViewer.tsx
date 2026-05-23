import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Modal } from "./ui/Modal";
import {
  logStore,
  type LogEntry,
  type LogLevelName,
  type LogContextName,
} from "../services/logStore";

interface LogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

type LevelFilter = "all" | LogLevelName;
type ContextFilter = "all" | LogContextName;

const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "trace", label: "Trace" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

const CONTEXT_TABS: { value: ContextFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "system", label: "Startup" },
  { value: "api", label: "API" },
  { value: "network", label: "WS / Net" },
  { value: "user", label: "User" },
  { value: "auth", label: "Auth" },
  { value: "ui", label: "UI" },
];

const LEVEL_COLOR: Record<LogLevelName, string> = {
  trace: "var(--color-text-muted)",
  debug: "var(--color-text-muted)",
  info: "var(--color-info)",
  warn: "var(--color-warning)",
  error: "var(--color-error)",
};

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatArg = (arg: unknown): string => {
  if (arg === null || arg === undefined) return String(arg);
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
};

const triggerDownload = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const electronOpenLogsFolder = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  const el = (window as unknown as {
    electron?: { openLogsFolder?: () => Promise<boolean> };
  }).electron;
  if (!el?.openLogsFolder) return false;
  try {
    return !!(await el.openLogsFolder());
  } catch {
    return false;
  }
};

export function LogsViewer({ isOpen, onClose }: LogsViewerProps) {
  const [entries, setEntries] = useState<LogEntry[]>(() => logStore.getAll());
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [contextFilter, setContextFilter] = useState<ContextFilter>("all");
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const levelMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the level dropdown on any click outside its wrapper.
  useEffect(() => {
    if (!levelMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!levelMenuRef.current) return;
      if (!levelMenuRef.current.contains(event.target as Node)) {
        setLevelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [levelMenuOpen]);

  // Subscribe to live entries while open.
  useEffect(() => {
    if (!isOpen) return;
    setEntries(logStore.getAll());
    logStore.markRead();
    const unsubscribe = logStore.subscribe((snapshot) => {
      setEntries(snapshot.entries);
    });
    return unsubscribe;
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) return false;
      if (contextFilter !== "all" && entry.context !== contextFilter) return false;
      if (q) {
        const haystack = `${entry.message} ${entry.context} ${entry.level}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, levelFilter, contextFilter, search]);

  // Auto-scroll to bottom on new entries when tail is on.
  useEffect(() => {
    if (!isOpen || !tail) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, isOpen, tail]);

  const handleCopyAll = async () => {
    const text = logStore.exportPlainText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be unavailable in some contexts; fall back to download.
      triggerDownload(buildLogFilename("txt"), text, "text/plain");
    }
  };

  const handleExportFile = () => {
    triggerDownload(buildLogFilename("log"), logStore.exportPlainText(), "text/plain");
  };

  const handleExportJson = () => {
    triggerDownload(buildLogFilename("json"), logStore.exportJson(), "application/json");
  };

  const handleClear = () => {
    logStore.clear();
  };

  const handleOpenFolder = async () => {
    const ok = await electronOpenLogsFolder();
    if (!ok) {
      // No Electron bridge; fall back to file export so the user can still attach a log.
      handleExportFile();
    }
  };

  const isElectron = typeof window !== "undefined" && "electron" in window;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      widthClassName="max-w-5xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAll}
            className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
          >
            Copy all
          </button>
          <button
            type="button"
            onClick={handleExportFile}
            className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
          >
            Export .log
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
          >
            Export .json
          </button>
          {isElectron && (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)]"
            >
              Open logs folder
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {filtered.length} / {entries.length}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-hover)]"
            >
              Clear
            </button>
          </div>
        </div>
      }
    >
      <div className="-mx-5 -my-4 flex flex-col">
        {/* Header — title + dedicated close button. The modal's backdrop also
            closes on click, but the visible X gives the user an obvious exit
            inside the window frame itself. */}
        <div className="flex items-start justify-between gap-3 border-b pb-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Client logs
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Buffered in memory for debugging and bug reports.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close logs viewer"
            title="Close"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Controls */}
        <div className="flex flex-col gap-2 border-b pb-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {CONTEXT_TABS.map((tab) => {
              const active = contextFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setContextFilter(tab.value)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                      : "border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Custom level dropdown — keeps the same rounded chrome + design
                tokens as the rest of the modal; the native <select> inherits
                OS theming we can't reach with Tailwind. */}
            <div ref={levelMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setLevelMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={levelMenuOpen}
                className={`inline-flex w-36 items-center justify-between gap-2 rounded-lg border bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs transition-colors ${
                  levelMenuOpen
                    ? "border-[var(--color-primary)] text-[var(--color-text)] ring-2 ring-[var(--color-focus)]"
                    : "border-[var(--color-border-secondary)] text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                }`}
              >
                <span className="truncate">
                  {LEVEL_OPTIONS.find((opt) => opt.value === levelFilter)?.label ?? "All levels"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)] transition-transform ${
                    levelMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {levelMenuOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface)] py-1 shadow-lg"
                >
                  {LEVEL_OPTIONS.map((option) => {
                    const isSelected = levelFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setLevelFilter(option.value);
                          setLevelMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                            : "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                        }`}
                      >
                        <span>{option.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <input
              type="search"
              placeholder="Search messages…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              aria-label="Search log messages"
            />
            {/* Auto-scroll — square checkbox button matching the control-panel
                Logs tab pattern (custom rounded square, no native checkbox). */}
            <button
              type="button"
              onClick={() => setTail((v) => !v)}
              aria-pressed={tail}
              className="group inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-[var(--color-text)]"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-md border transition-colors ${
                  tail
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent group-hover:bg-[var(--color-hover)]"
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>Auto-scroll</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="max-h-[60vh] min-h-[300px] overflow-y-auto bg-[var(--color-background)] font-mono text-[11px] leading-relaxed"
        >
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12 text-[var(--color-text-muted)]">
              No log entries match the current filters.
            </div>
          ) : (
            filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const hasArgs = !!entry.args?.length;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex w-full flex-col gap-0.5 border-b border-[var(--color-border-secondary)] px-5 py-1.5 text-left hover:bg-[var(--color-hover)]"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[var(--color-text-muted)]">
                      {formatTime(entry.ts)}
                    </span>
                    <span
                      className="font-semibold uppercase"
                      style={{ color: LEVEL_COLOR[entry.level] }}
                    >
                      {entry.level}
                    </span>
                    <span className="rounded bg-[var(--color-surface-secondary)] px-1.5 py-px text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {entry.context}
                    </span>
                    <span className="break-words text-[var(--color-text)]">
                      {entry.message}
                    </span>
                    {hasArgs && !isExpanded && (
                      <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                        +{entry.args!.length} arg{entry.args!.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {isExpanded && hasArgs && (
                    <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-surface)] p-2 text-[10px] text-[var(--color-text-secondary)]">
                      {entry.args!.map((arg, idx) => (
                        <div key={idx} className="whitespace-pre-wrap break-words">
                          {formatArg(arg)}
                        </div>
                      ))}
                    </pre>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

const buildLogFilename = (ext: string): string => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `pufferblow-client-${stamp}.${ext}`;
};
