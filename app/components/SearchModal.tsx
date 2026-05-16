import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: string;
  type: "message" | "user" | "channel";
  title: string;
  subtitle?: string;
  content?: string;
  timestamp?: string;
  avatar?: string;
  /**
   * Channel containing this result. Required for message-type results so the
   * selection handler can jump to the right channel — including hits that
   * came from the server-side scan and aren't in the local message cache.
   */
  channel_id?: string;
}

/**
 * Optional metadata the search handler can attach to a result set.
 * `truncatedScan` means the server-side decrypt-and-scan didn't cover
 * the channel's full history — there may be older matches the user
 * doesn't see. We surface this honestly so the user doesn't assume
 * "no results" means "no matches in history."
 */
export interface SearchResultMeta {
  truncatedScan?: boolean;
  scannedChannelName?: string;
}

export type SearchHandlerReturn = SearchResult[] | {
  results: SearchResult[];
  meta?: SearchResultMeta;
};

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchHandlerReturn>;
  onSelectResult: (result: SearchResult) => void;
  /**
   * Name of the channel currently being searched, used for the header
   * label ("Search #channel-name"). Optional — falls back to a generic
   * label when omitted (e.g. when no channel is selected, though in
   * that case the parent should hide the search button entirely).
   */
  channelName?: string;
}

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  message: "Message",
  user: "User",
  channel: "Channel",
};

/**
 * Channel-scoped search panel.
 *
 * Rendered as a floating dropdown anchored to the search-icon button in
 * the ChatHeader (parent supplies a `relative` wrapper, just like the
 * notification bell does). Same visual language as `NotificationMenu`
 * (rounded-2xl panel, separator-divided header, scrollable body) but
 * larger because search results carry more text per row than
 * notifications.
 *
 * Despite the legacy filename "SearchModal", this is no longer a
 * centered modal -- the rename would touch every import site, so the
 * file keeps its name and the component is just behaviorally different.
 */
export function SearchModal({
  isOpen,
  onClose,
  onSearch,
  onSelectResult,
  channelName,
}: SearchModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<SearchResultMeta>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Reset state on close so reopening shows an empty panel rather than
  // stale results from the previous channel.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setMeta({});
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Autofocus the input on open. We use a microtask defer because the
  // dropdown is conditionally rendered, so the input isn't in the DOM
  // on the same tick `isOpen` flips to true.
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Click-outside-to-close, mirroring the dismiss UX of NotificationMenu
  // and the ContextMenu component. Escape key handled separately in the
  // input keyDown so the input's own clearing/blur behavior takes priority.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const runSearch = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setMeta({});
        return;
      }

      setIsLoading(true);
      try {
        const handlerReturn = await onSearch(query.trim());
        // Normalize both supported return shapes — array (legacy) or
        // {results, meta} (preferred). Keeps older callers working
        // without forcing a migration.
        if (Array.isArray(handlerReturn)) {
          setResults(handlerReturn);
          setMeta({});
        } else {
          setResults(handlerReturn.results);
          setMeta(handlerReturn.meta ?? {});
        }
        setSelectedIndex(-1);
      } catch {
        setResults([]);
        setMeta({});
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(runSearch, 250);
    return () => clearTimeout(debounce);
  }, [query, onSearch]);

  const selectResult = (result: SearchResult) => {
    onSelectResult(result);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
      return;
    }

    if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      selectResult(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      // Position mirrors NotificationMenu's anchor (right:0, top:12).
      // Wider + taller because search rows carry richer content -- a
      // notification is a one-line summary, a message hit can have a
      // sender name + channel + multi-line excerpt.
      className="absolute right-0 top-12 z-40 w-[34rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      role="dialog"
      aria-label="Search this channel"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            Search {channelName ? <span className="font-mono">#{channelName}</span> : "channel"}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Type at least 2 characters. Searches messages in this channel only.
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          aria-label="Close search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 px-4 py-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={channelName ? `Search in #${channelName}…` : "Search this channel…"}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
        />
      </div>

      <div className="max-h-[32rem] overflow-y-auto">
        {/* Honest banner when the server-side scan didn't cover the
            whole channel. Substring search decrypts up to scan_limit
            (1000 by default) recent messages — older matches won't
            appear and the user deserves to know. */}
        {meta.truncatedScan && !isLoading && query.trim().length >= 2 && (
          <div
            role="status"
            className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/50 px-4 py-2 text-xs text-[var(--color-text-secondary)]"
          >
            Search covered only the most recent messages
            {meta.scannedChannelName ? <> in <span className="font-medium text-[var(--color-text)]">#{meta.scannedChannelName}</span></> : null}
            . Older history wasn't scanned — open the channel to load
            it, or narrow your query.
          </div>
        )}

        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            Searching…
          </div>
        ) : query.trim().length < 2 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Enter at least 2 characters to start searching.
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            No matches found for "{query}".
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => selectResult(result)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  selectedIndex === index
                    ? "bg-[var(--color-active)]"
                    : "hover:bg-[var(--color-hover)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text)]">
                      {result.title}
                    </span>
                    <span className="shrink-0 rounded border border-[var(--color-border-secondary)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {TYPE_LABELS[result.type]}
                    </span>
                  </div>
                  {result.subtitle ? (
                    <div className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                      {result.subtitle}
                    </div>
                  ) : null}
                  {result.content ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                      {result.content}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
          {results.length} result{results.length === 1 ? "" : "s"} · ↑↓ to navigate, Enter to open
        </div>
      )}
    </div>
  );
}
