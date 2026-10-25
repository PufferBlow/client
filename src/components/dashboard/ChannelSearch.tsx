import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AtSign, Hash, Loader2, Paperclip, Search, SlidersHorizontal, User, X } from "lucide-react";
import { MIN_SEARCH_LENGTH, useMessageSearch } from "../../features/messages/hooks";
import type { Message } from "../../features/messages/types";
import {
  AUTHOR_OPTIONS,
  HAS_OPTIONS,
  currentWord,
  dayRange,
  parseSearch,
  withFilter,
  type FilterKey,
  type ServerFilters,
} from "../../lib/searchFilters";
import { classifyAuthError } from "../../utils/authErrors";
import { Chip } from "../settings/Pickers";
import { DatePicker } from "../ui/DatePicker";
import { Avatar } from "./Avatar";

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

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

export interface SearchPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface SearchChannel {
  id: string;
  name: string;
}

interface ChannelSearchProps {
  channelId: string;
  /** What it searches, as the field says it: `#general`, or `@ada` in a direct message. */
  label: string;
  /** The id is a direct-message conversation's. */
  dm?: boolean;
  /** Who `from:` and `mentions:` can name. */
  people?: SearchPerson[];
  /** The channels `in:` can name; leave out where the search cannot leave its conversation (a DM). */
  channels?: SearchChannel[];
  /** Jump to a message (in another channel when the search was `in:` one). */
  onPick: (message: Message) => void;
}

/** The filters on offer, as Discord words them. `in` is left out where there is no other channel to name. */
const MENU: { key: FilterKey; icon: typeof User; title: string; hint: string }[] = [
  { key: "from", icon: User, title: "From a specific user", hint: "from: user" },
  { key: "in", icon: Hash, title: "Sent in a specific channel", hint: "in: channel" },
  { key: "has", icon: Paperclip, title: "Includes a specific type of data", hint: "has: link, file or image" },
  { key: "mentions", icon: AtSign, title: "Mentions a specific user", hint: "mentions: user" },
];

interface Suggestion {
  value: string;
  title: string;
  hint?: string;
  avatar?: { name: string; src?: string | null; seed: string };
}

/**
 * The search field in a header: text plus Discord-style filters typed into it (`from:ada has:image`), a menu
 * of the filters when the field is empty, suggestions for a filter's value as it is typed, and the matches
 * under it. Either a text or at least one filter is enough to search.
 */
export function ChannelSearch({ channelId, label, dm = false, people = [], channels, onPick }: ChannelSearchProps) {
  const [text, setText] = useState("");
  // The panel under the field is a popover: clicking elsewhere puts it away without touching what you typed.
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const clear = () => {
    setText("");
    setQuery("");
    setOpen(false);
    setMore(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      // A date picker opens in front of everything, outside this box, but belongs to it.
      if (!root.current?.contains(target) && !target.closest?.('[role="dialog"]')) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // What is searched for: the debounced text with its filters read out and matched to people and channels.
  const parsed = useMemo(() => parseSearch(query), [query]);
  const findPerson = (name: string) => people.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const problems = [...parsed.problems.map((p) => `“${p}” is not something to filter by.`)];
  const from = parsed.from ? findPerson(parsed.from) : undefined;
  if (parsed.from && !from) problems.push(`No one called ${parsed.from} here.`);
  const channel = parsed.inChannel && channels ? channels.find((c) => c.name.toLowerCase() === parsed.inChannel!.toLowerCase()) : undefined;
  if (parsed.inChannel && !channel) problems.push(channels ? `No channel called ${parsed.inChannel}.` : "in: does not work in a direct message.");

  const filters: ServerFilters = {
    ...(from ? { fromUserId: from.id } : {}),
    ...(parsed.mentions ? { mentions: parsed.mentions } : {}),
    ...(parsed.has.length ? { has: parsed.has } : {}),
    ...dayRange(parsed),
    ...(parsed.author ? { authorType: parsed.author } : {}),
  };
  const filtered = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const tooShort = parsed.text.length > 0 && parsed.text.length < MIN_SEARCH_LENGTH;
  const ready = problems.length === 0 && !tooShort && (parsed.text.length >= MIN_SEARCH_LENGTH || filtered);
  const searchIn = channel?.id ?? channelId;
  const search = useMessageSearch(searchIn, parsed.text, dm && searchIn === channelId, filters, ready);
  const results = search.data?.messages ?? [];

  // What to offer while typing: the values of a filter whose key is there, or the menu of filters.
  const word = currentWord(text);
  const live = parseSearch(text);
  const suggestions: Suggestion[] = (() => {
    if (!word.key) return [];
    const partial = word.partial.replace(/^[@#]/, "").toLowerCase();
    const starts = (value: string) => value.toLowerCase().startsWith(partial);
    switch (word.key) {
      case "from":
      case "mentions":
        return people
          .filter((p) => starts(p.name))
          .slice(0, MAX_SUGGESTIONS)
          .map((p) => ({ value: p.name, title: p.name, avatar: { name: p.name, src: p.avatarUrl, seed: p.id } }));
      case "in":
        return (channels ?? []).filter((c) => starts(c.name)).slice(0, MAX_SUGGESTIONS).map((c) => ({ value: c.name, title: `#${c.name}` }));
      case "has":
        return HAS_OPTIONS.filter((o) => starts(o.value)).map((o) => ({ value: o.value, title: o.value, hint: o.hint }));
      case "author":
        return AUTHOR_OPTIONS.filter((o) => starts(o.value)).map((o) => ({ value: o.value, title: o.value, hint: o.hint }));
      default:
        return [];
    }
  })();
  const dateKey = word.key === "before" || word.key === "after" || word.key === "during";
  // While More filters is open its controls stay put, even though using them puts a filter in the field.
  const showMenu = more || (word.key === null && word.empty && !ready && problems.length === 0);
  const showValues = !more && word.key !== null && (suggestions.length > 0 || dateKey);
  const showResults = !showMenu && !showValues && text.trim().length > 0;

  const edit = (next: string) => {
    setText(next);
    setOpen(true);
  };
  const pick = (value: string) => {
    edit(`${text.slice(0, word.start)}${word.key}:${value} `);
    field.current?.focus();
  };
  const startFilter = (key: FilterKey) => {
    setMore(false);
    edit(`${text}${text && !text.endsWith(" ") ? " " : ""}${key}:`);
    field.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <div role="search" className="flex h-8 w-[190px] max-w-full items-center gap-2 rounded-pill bg-surface-secondary pl-3 pr-1 transition-[width,box-shadow] duration-(--motion-base) focus-within:w-[260px] focus-within:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]">
        <Search size={15} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <input
          ref={field}
          type="search"
          value={text}
          onChange={(e) => {
            setMore(false);
            edit(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") clear();
            if (e.key === "Enter" && showValues && suggestions[0]) {
              e.preventDefault();
              pick(suggestions[0].value);
            }
          }}
          placeholder={`Search ${label}`}
          aria-label={`Search ${label}`}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text.length > 0 && (
          <button type="button" aria-label="Clear search" onClick={clear} className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary hover:bg-active hover:text-text">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && showMenu && (
        <div role="region" aria-label="Search filters" className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[440px] w-[min(380px,calc(100vw-48px))] overflow-y-auto rounded-lg bg-surface-tertiary p-1.5 shadow-popover">
          <h2 className="pb-section-label m-0 px-2.5 pb-1 pt-2 text-text-tertiary">Filters</h2>
          {MENU.filter((item) => item.key !== "in" || channels).map(({ key, icon: Icon, title, hint }) => (
            <button
              key={key}
              type="button"
              onClick={() => startFilter(key)}
              className="flex w-full items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Icon size={18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
              <span className="min-w-0 leading-snug">
                <span className="block text-[13.5px] font-semibold text-text">{title}</span>
                <span className="block text-[12.5px] text-text-muted">{hint}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="flex w-full items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-focus"
          >
            <SlidersHorizontal size={18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
            <span className="min-w-0 leading-snug">
              <span className="block text-[13.5px] font-semibold text-text">More filters</span>
              <span className="block text-[12.5px] text-text-muted">dates, author type, and more</span>
            </span>
          </button>
          {more && (
            <div className="mx-1.5 mb-1.5 mt-1 flex flex-col gap-3 rounded-md bg-surface-secondary p-3">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted">
                  Sent after
                  <DatePicker label="Sent after" value={live.after ?? ""} max={live.before} onChange={(day) => edit(withFilter(text, "after", day))} placeholder="Any day" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted">
                  Sent before
                  <DatePicker label="Sent before" value={live.before ?? ""} min={live.after} onChange={(day) => edit(withFilter(text, "before", day))} placeholder="Any day" />
                </label>
              </div>
              <div role="group" aria-label="Author type" className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[12px] text-text-muted">Author</span>
                <Chip selected={!live.author} onClick={() => edit(withFilter(text, "author", ""))}>
                  Anyone
                </Chip>
                {AUTHOR_OPTIONS.map((o) => (
                  <Chip key={o.value} selected={live.author === o.value} onClick={() => edit(withFilter(text, "author", o.value))}>
                    {o.value === "user" ? "People" : "Bots"}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {open && showValues && (
        <div role="region" aria-label={`Suggestions for ${word.key}:`} className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[320px] w-[min(380px,calc(100vw-48px))] overflow-y-auto rounded-lg bg-surface-tertiary p-1.5 shadow-popover">
          {dateKey ? (
            <p className="m-0 px-3 py-3 text-[13px] text-text-muted">
              Type a day like <b className="text-text-secondary">2026-03-31</b>, or choose one under More filters.
            </p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => pick(s.value)}
                className="flex w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-focus"
              >
                {s.avatar && <Avatar name={s.avatar.name} src={s.avatar.src ?? null} seed={s.avatar.seed} size={22} />}
                <span className="text-[13.5px] font-semibold text-text">{s.title}</span>
                {s.hint && <span className="text-[12.5px] text-text-muted">{s.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}

      {open && showResults && (
        <div
          role="region"
          aria-label="Search results"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[380px] w-[min(440px,calc(100vw-48px))] overflow-y-auto rounded-lg bg-surface-tertiary p-1.5 shadow-popover"
        >
          {problems.length > 0 ? (
            <p role="alert" className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">
              {problems[0]}
            </p>
          ) : !ready ? (
            <p className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">Type at least {MIN_SEARCH_LENGTH} characters, or add a filter.</p>
          ) : search.isPending ? (
            <p className="m-0 flex items-center justify-center gap-2 px-3 py-4 text-[13px] text-text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Searching…
            </p>
          ) : search.error ? (
            <p role="alert" className="m-0 px-3 py-4 text-center text-[13px] text-error">
              {classifyAuthError(search.error, "Search failed. Try again.").message}
            </p>
          ) : results.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-[13px] text-text-muted">{parsed.text ? <>No messages match “{parsed.text}”{filtered ? " with those filters" : ""}.</> : "No messages match those filters."}</p>
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
                        <span className="line-clamp-2 block break-words text-[13.5px] text-text-secondary">{highlight(m.text, parsed.text)}</span>
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
