import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./ui/Modal";

interface SearchResult {
  id: string;
  type: "message" | "user" | "channel";
  title: string;
  subtitle?: string;
  content?: string;
  timestamp?: string;
  avatar?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onSelectResult: (result: SearchResult) => void;
}

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  message: "Message",
  user: "User",
  channel: "Channel",
};

export function SearchModal({ isOpen, onClose, onSearch, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const runSearch = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await onSearch(query.trim());
        setResults(searchResults);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Search"
      description="Find messages, users, and channels."
      widthClassName="max-w-2xl"
      footer={
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            {results.length > 0 ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No results"}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type at least 2 characters..."
          autoFocus
          className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
        />

        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-2">
          {isLoading ? (
            <div className="px-3 py-5 text-center text-sm text-[var(--color-text-secondary)]">Searching...</div>
          ) : query.trim().length < 2 ? (
            <div className="px-3 py-5 text-center text-sm text-[var(--color-text-secondary)]">
              Enter at least 2 characters to start searching.
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-5 text-center text-sm text-[var(--color-text-secondary)]">
              No matches found for "{query}".
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => selectResult(result)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  selectedIndex === index
                    ? "pb-border bg-[var(--color-active)]"
                    : "border-transparent hover:bg-[var(--color-hover)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--color-text)]">{result.title}</div>
                    {result.subtitle ? (
                      <div className="truncate text-xs text-[var(--color-text-secondary)]">{result.subtitle}</div>
                    ) : null}
                    {result.content ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{result.content}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded border border-[var(--color-border-secondary)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    {TYPE_LABELS[result.type]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

