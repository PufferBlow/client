import { useEffect, useRef, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { usePins } from "../../features/channels/pins";
import type { Message } from "../../features/messages/types";
import { classifyAuthError } from "../../utils/authErrors";
import { ApiError } from "../../services/api";
import { Avatar } from "./Avatar";

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

/**
 * The pin button in a channel header and the list it opens. Choosing a pinned message takes you to it
 * (when it is loaded). Moderators can unpin from here too.
 */
export function PinnedMessages({
  channelId,
  onJump,
  canUnpin,
  onUnpin,
}: {
  channelId: string;
  onJump: (message: Message) => void;
  canUnpin: boolean;
  onUnpin: (messageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Fetched once the list is first opened, then kept fresh by the realtime pin events.
  const [wanted, setWanted] = useState(false);
  const { data, isPending, error } = usePins(channelId, wanted);
  const count = data?.pins.length ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const unsupported = error instanceof ApiError && (error.status === 404 || error.status === 405);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={count > 0 ? `Pinned messages, ${count}` : "Pinned messages"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pinned messages"
        onClick={() => {
          setWanted(true);
          setOpen(!open);
        }}
        className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-(--motion-fast) hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-focus ${open ? "bg-surface-secondary text-text" : "text-text-tertiary"}`}
      >
        <Pin size={17} aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label="Pinned messages" className="absolute right-0 top-[calc(100%+8px)] z-30 flex max-h-[420px] w-[min(380px,calc(100vw-48px))] flex-col overflow-hidden rounded-lg bg-surface-tertiary shadow-popover">
          <h2 className="pb-section-label m-0 px-4 pb-2 pt-3.5 text-text-tertiary">Pinned messages{count > 0 ? ` — ${count}` : ""}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
            {isPending && wanted ? (
              <p className="pb-meta m-0 px-3 py-4 text-center text-[13px]">Loading…</p>
            ) : unsupported ? (
              <p className="pb-meta m-0 px-3 py-4 text-center text-[13px]">This instance does not support pins yet.</p>
            ) : error ? (
              <p role="alert" className="pb-error m-0 px-3 py-4 text-center">
                {classifyAuthError(error, "Couldn't load the pins.").message}
              </p>
            ) : count === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
                <Pin size={22} aria-hidden="true" className="text-text-muted" />
                <p className="m-0 text-sm text-text">Nothing is pinned yet</p>
                <p className="pb-meta m-0 text-[12.5px]">Moderators can pin a message from its menu.</p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {data!.pins.map(({ message, pinnedAt }) => (
                  <li key={message.id} className="group/pin relative">
                    <button
                      type="button"
                      onClick={() => {
                        onJump(message);
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md border-0 bg-transparent p-2.5 text-left hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Avatar name={message.authorName} src={message.authorAvatarUrl} seed={message.authorId} size={28} ringColor="var(--color-surface-tertiary)" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="pb-username text-[13.5px]">{message.authorName}</span>
                          <span className="pb-timestamp">{when(message.sentAt)}</span>
                        </span>
                        <span className="line-clamp-3 block break-words text-[13.5px] leading-snug text-text-body">
                          {message.text || (message.attachments.length > 0 ? `${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}` : "")}
                        </span>
                        {pinnedAt && <span className="pb-meta mt-0.5 block text-[11.5px]">Pinned {when(pinnedAt)}</span>}
                      </span>
                    </button>
                    {canUnpin && (
                      <button
                        type="button"
                        aria-label={`Unpin the message from ${message.authorName}`}
                        title="Unpin"
                        onClick={() => onUnpin(message.id)}
                        className="absolute right-2 top-2 hidden size-7 place-items-center rounded-md bg-surface-secondary text-text-tertiary hover:text-text group-focus-within/pin:grid group-hover/pin:grid"
                      >
                        <PinOff size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
