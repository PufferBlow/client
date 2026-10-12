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
      <mark key={i} className="rounded bg-primary/25 px-0.5 text-text">
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

/** A search button that opens a field next to the channel name, with matches listed under it. */
export function ChannelSearch({ channelId, channelName, onPick }: ChannelSearchProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setText("");
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const ready = query.length >= MIN_SEARCH_LENGTH;
  const search = useMessageSearch(channelId, query);

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Search #${channelName}`}
        title="Search this channel"
        onClick={() => setOpen(true)}
        className="grid h-8 w-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Search size={17} aria-hidden="true" />
      </button>
    );
  }

  const results = search.data?.messages ?? [];

  return (
    <div ref={root} className="relative">
      <div role="search" className="flex h-8 w-[240px] items-center gap-2 rounded-lg border border-border bg-background pl-2.5 pr-1 focus-within:border-primary/55">
        <Search size={15} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <input
          ref={field}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          placeholder={`Search #${channelName}`}
          aria-label={`Search #${channelName}`}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <button type="button" aria-label="Close search" onClick={close} className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary hover:bg-active hover:text-text">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {text.trim().length > 0 && (
        <div
          role="region"
          aria-label="Search results"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[380px] w-[min(440px,calc(100vw-48px))] overflow-y-auto rounded-xl border border-border bg-surface-secondary p-1.5 shadow-popover"
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
                        close();
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
