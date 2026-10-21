import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { MIN_SEARCH_LENGTH, useMessageSearch } from "../../features/messages/hooks";
import type { Message } from "../../features/messages/types";
import { classifyAuthError } from "../../utils/authErrors";
import { Avatar } from "./Avatar";

const DEBOUNCE_MS = 300;

/** Wraps each case-insensitive occurrence of `query` in a highlight. */
function highlight(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const pattern = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-text/20 px-0.5 text-text">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

interface ChannelSearchProps {
  channelId: string;
  channelName: string;
  /** Jump to a message in the open conversation. */
  onPick: (message: Message) => void;
}

/** The channel search field, always shown in the header, with matches listed under it while you type. */
export function ChannelSearch({ channelId, channelName, onPick }: ChannelSearchProps) {
  const [text, setText] = useState("");
  // The matches are a popover: clicking elsewhere puts them away without touching what you typed.
  const [showResults, setShowResults] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const clear = () => {
    setText("");
    setQuery("");
    setShowResults(false);
  };

  useEffect(() => {
    if (!showResults) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showResults]);

  const ready = query.length >= MIN_SEARCH_LENGTH;
  const search = useMessageSearch(channelId, query);

  const results = search.data?.messages ?? [];

  return (
    <div ref={root} className="relative">
      <div role="search" className="flex h-8 w-[190px] max-w-full items-center gap-2 rounded-pill bg-surface-secondary pl-3 pr-1 transition-[width,box-shadow] duration-(--motion-base) focus-within:w-[260px] focus-within:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]">
        <Search size={15} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") clear();
          }}
          placeholder={`Search #${channelName}`}
          aria-label={`Search #${channelName}`}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text.length > 0 && (
          <button type="button" aria-label="Clear search" onClick={clear} className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary hover:bg-active hover:text-text">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {showResults && text.trim().length > 0 && (
        <div
          role="region"
          aria-label="Search results"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[380px] w-[min(440px,calc(100vw-48px))] overflow-y-auto rounded-lg bg-surface-tertiary p-1.5 shadow-popover"
        >
          {!ready ? (
            <p className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">Type at least {MIN_SEARCH_LENGTH} characters.</p>
          ) : search.isPending ? (
            <p className="m-0 flex items-center justify-center gap-2 px-3 py-4 text-[13px] text-text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Searching…
            </p>
          ) : search.error ? (
            <p role="alert" className="m-0 px-3 py-4 text-center text-[13px] text-error">
              {classifyAuthError(search.error, "Search failed. Try again.").message}
            </p>
          ) : results.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">No messages match “{query}”.</p>
          ) : (
            <>
              <ul className="m-0 list-none p-0">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(m);
                        clear();
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Avatar name={m.authorName} src={m.authorAvatarUrl} seed={m.authorId} size={28} />
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[13.5px] font-bold">{m.authorName}</span>
                          <span className="shrink-0 text-[11px] text-text-muted">{formatWhen(m.sentAt)}</span>
                        </span>
                        <span className="line-clamp-2 block break-words text-[13.5px] text-text-secondary">{highlight(m.text, query)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {search.data?.truncated && (
                <p className="m-0 px-3 pb-1 pt-2 text-center text-[11.5px] text-text-muted">Only the most recent {search.data.scanned.toLocaleString()} messages were searched.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
