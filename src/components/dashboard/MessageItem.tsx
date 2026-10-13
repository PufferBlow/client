import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { FileText, Image as ImageIcon, MoreHorizontal, Music, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { Emoji, EmojiText } from "../ui/Emoji";
import { LinkEmbed } from "../ui/Embed";
import { Markdown } from "../ui/Markdown";
import { isEmojiOnly } from "../../lib/emoji";
import { embeddableUrls, parseMarkdown, toPlainText } from "../../lib/markdown";
import { handleFormatShortcut } from "../../lib/textEditing";
import { displayName, fileKind, formatBytes, isSpoilerName } from "../../lib/files";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import type { Message, ReplyPreview } from "../../features/messages/types";
import { resolveAssetUrl } from "../../services/authed";
import { Avatar } from "./Avatar";
import { QUICK_REACTIONS } from "./messageMenu";

export interface MenuPoint {
  x: number;
  y: number;
}

interface MessageItemProps {
  message: Message;
  /** First message of a group shows the avatar and header; the rest are compact. */
  isGroupStart?: boolean;
  myUserId: string | undefined;
  onEdit: (id: string, text: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  onToggleReaction: (id: string, emoji: string, present: boolean) => void;
  /** Opens the message menu at a point. Right-click, the context-menu key and the "More" button all land here. */
  onOpenMenu?: (id: string, point: MenuPoint) => void;
  /** Opens the full emoji picker for adding a reaction. */
  onOpenPicker?: (id: string, point: MenuPoint) => void;
  /**
   * Controlled edit mode, so the context menu and the toolbar share one state. When omitted the
   * row manages its own.
   */
  editing?: boolean;
  onEditingChange?: (id: string, editing: boolean) => void;
  /** Resend a message that failed to go out (reuses its idempotency key). */
  onRetry?: (id: string) => void;
  /** Throw away a message that failed to go out. */
  onDiscard?: (id: string) => void;
  /** Start replying to this message in the composer. */
  onReply?: (id: string) => void;
  /** Scroll to (and flash) another message, e.g. the one a reply answers. */
  onJumpTo?: (id: string) => void;
}

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

function AttachmentView({ url, filename, type, size }: Message["attachments"][number]) {
  const href = resolveAssetUrl(url);
  const spoiler = isSpoilerName(filename);
  const name = displayName(filename);
  const [revealed, setRevealed] = useState(false);
  const kind = fileKind(type);

  let body;
  if (kind === "image" && href) {
    body = (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        <img src={href} alt={name} loading="lazy" className="block max-h-72 max-w-full rounded-xl border border-border-secondary" />
      </a>
    );
  } else if (kind === "video" && href) {
    body = <video src={href} controls preload="metadata" aria-label={name} className="block max-h-80 max-w-[min(100%,480px)] rounded-xl border border-border-secondary bg-black" />;
  } else if (kind === "audio" && href) {
    body = (
      <div className="flex w-[min(100%,400px)] flex-col gap-2 rounded-xl border border-border-secondary bg-surface-secondary p-3">
        <a href={href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-[13px] text-text-secondary hover:text-text">
          <Music size={15} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{name}</span>
          {size !== undefined && <span className="shrink-0 text-[11.5px] text-text-muted">{formatBytes(size)}</span>}
        </a>
        <audio src={href} controls preload="none" className="w-full" />
      </div>
    );
  } else {
    body = (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border-secondary bg-surface-secondary px-3 py-2 text-[13px] text-text-secondary hover:text-text"
      >
        <FileText size={15} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{name}</span>
        {size !== undefined && <span className="shrink-0 text-[11.5px] text-text-muted">{formatBytes(size)}</span>}
      </a>
    );
  }

  if (!spoiler || revealed) return <div className="mt-2 max-w-full">{body}</div>;
  return (
    <div className="relative mt-2 inline-block max-w-full overflow-hidden rounded-xl align-top">
      {/* Blurred and unreachable until revealed. */}
      <div aria-hidden="true" inert className="pointer-events-none select-none blur-2xl">
        {body}
      </div>
      <button
        type="button"
        aria-label={`Spoiler attachment ${name}, select to reveal`}
        onClick={() => setRevealed(true)}
        className="absolute inset-0 grid place-items-center bg-black/35 transition-colors hover:bg-black/25"
      >
        <span className="rounded-full bg-black/75 px-3 py-1 text-[11.5px] font-bold tracking-[0.12em] text-white">SPOILER</span>
      </button>
    </div>
  );
}

/**
 * The line above a reply: who and what it answers, joined to the avatar below by a curved spine
 * the way Discord draws it. Clicking it jumps to the original.
 */
function ReplyLine({ reply, onJumpTo }: { reply: ReplyPreview; onJumpTo?: (id: string) => void }) {
  const snippet = reply.deleted ? "" : toPlainText(reply.text);
  return (
    <div className="flex basis-full items-center gap-3">
      <div className="relative h-[22px] w-10 shrink-0" aria-hidden="true">
        <span className="absolute -bottom-1 left-[19px] top-[11px] w-[29px] rounded-tl-[7px] border-l-2 border-t-2 border-border" />
      </div>
      {reply.deleted ? (
        <span className="min-w-0 truncate text-[13px] italic text-text-muted">Original message was deleted</span>
      ) : (
        <button
          type="button"
          onClick={() => onJumpTo?.(reply.id)}
          aria-label={`Replying to ${reply.authorName || "a message"}: ${snippet || (reply.hasAttachments ? "attachment" : "")}. Jump to it`}
          className="flex min-w-0 items-center gap-1.5 rounded text-left text-[13px] text-text-muted outline-none hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Avatar name={reply.authorName} src={reply.authorAvatarUrl} seed={reply.authorId} size={16} />
          <span className="shrink-0 font-semibold text-text-tertiary">{reply.authorName || "Unknown user"}</span>
          {snippet ? (
            <span className="min-w-0 truncate">
              <EmojiText text={snippet} size="1.1em" />
            </span>
          ) : (
            <span className="flex items-center gap-1 italic">
              {reply.hasAttachments ? "Click to see attachment" : "Click to see the message"}
              {reply.hasAttachments && <ImageIcon size={13} aria-hidden="true" />}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function EditForm({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (text: string) => Promise<unknown>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(field, text);

  // Focus with the caret at the end, ready to keep typing.
  useLayoutEffect(() => {
    const el = field.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") return onCancel();
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
      return;
    }
    handleFormatShortcut(e, setText);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = text.trim();
    if (!next || next === initial) return onCancel();
    setSaving(true);
    try {
      await onSubmit(next);
      onCancel();
    } catch {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <textarea
        ref={field}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        aria-label="Edit message"
        className="max-h-[40vh] resize-none overflow-y-auto rounded-xl border border-primary/40 bg-background px-3 py-2.25 text-[15px] leading-5 text-text outline-none"
      />
      <span className="text-xs text-text-muted">Escape to cancel · Enter to save · Shift+Enter for a new line</span>
    </form>
  );
}

const toolButton = "grid h-7 w-7 place-items-center rounded-md text-text-tertiary hover:bg-active hover:text-text";

export const MessageItem = memo(function MessageItem({
  message,
  isGroupStart = true,
  myUserId,
  onEdit,
  onDelete,
  onToggleReaction,
  onOpenMenu,
  onOpenPicker,
  editing: controlledEditing,
  onEditingChange,
  onRetry,
  onDiscard,
  onReply,
  onJumpTo,
}: MessageItemProps) {
  const [localEditing, setLocalEditing] = useState(false);
  const editing = controlledEditing ?? localEditing;
  const setEditing = (next: boolean) => (controlledEditing === undefined ? setLocalEditing(next) : onEditingChange?.(message.id, next));
  const isOwn = myUserId !== undefined && message.authorId === myUserId;
  // Not on the server yet (sending) or never got there (failed): nothing can act on it but retry/discard.
  const isLocal = message.status !== undefined;
  const blocks = useMemo(() => parseMarkdown(message.text), [message.text]);
  const embedUrls = useMemo(() => embeddableUrls(blocks), [blocks]);
  // Someone else answering one of my messages: tinted, like a mention.
  const repliesToMe =
    myUserId !== undefined && message.replyTo !== undefined && !message.replyTo.deleted && message.replyTo.authorId === myUserId && message.authorId !== myUserId;
  const editedMarker = !isGroupStart && message.editCount > 0 && <span className="ml-1.5 text-[11px] text-text-muted">(edited)</span>;

  const handleContextMenu = (e: MouseEvent<HTMLElement>) => {
    if (!onOpenMenu || editing || isLocal) return;
    // Links and text fields keep the browser menu (open image, paste, spellcheck...).
    if ((e.target as HTMLElement).closest("a, input, textarea, [contenteditable='true']")) return;
    e.preventDefault();
    onOpenMenu(message.id, { x: e.clientX, y: e.clientY });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!onOpenMenu || editing || isLocal || e.target !== e.currentTarget) return;
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onOpenMenu(message.id, { x: rect.left + 72, y: rect.top + Math.min(rect.height, 40) });
    }
  };

  return (
    <article
      data-message-id={message.id}
      aria-label={`${message.authorName} at ${formatTime(message.sentAt)}`}
      tabIndex={0}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-wrap gap-x-3 gap-y-0.5 px-[18px] outline-none hover:bg-text/[0.03] focus-visible:bg-text/[0.05] ${isGroupStart ? "mt-[14px] py-[3px] first:mt-0" : "py-px"} ${repliesToMe ? "bg-primary/[0.06] shadow-[inset_2px_0_0_var(--color-primary)] hover:bg-primary/[0.09]" : ""}`}
    >
      {message.replyTo && <ReplyLine reply={message.replyTo} onJumpTo={onJumpTo} />}
      {/* Same gutter width for every row so content never shifts horizontally. */}
      <div className="w-10 shrink-0">
        {isGroupStart ? (
          <Avatar name={message.authorName} src={message.authorAvatarUrl} seed={message.authorId} size={40} />
        ) : (
          <time
            dateTime={message.sentAt}
            className="block pt-[3px] text-center text-[10.5px] text-text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {formatTime(message.sentAt)}
          </time>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <header className="flex flex-wrap items-baseline gap-2">
            <span className="text-[15px] font-bold">{message.authorName}</span>
            <time dateTime={message.sentAt} className="text-[11.5px] text-text-muted">
              {formatTime(message.sentAt)}
            </time>
            {message.editCount > 0 && <span className="text-[11px] text-text-muted">(edited)</span>}
          </header>
        )}

        {editing ? (
          <EditForm initial={message.text} onSubmit={(text) => onEdit(message.id, text)} onCancel={() => setEditing(false)} />
        ) : (
          message.text && (
            <div
              className={`whitespace-pre-wrap break-words text-[15px] text-text-secondary ${message.status === "pending" ? "opacity-60" : ""}`}
              aria-busy={message.status === "pending" || undefined}
            >
              {isEmojiOnly(message.text) ? (
                <p className="m-0 leading-[1.15]">
                  <EmojiText text={message.text} size={48} />
                  {editedMarker}
                </p>
              ) : (
                <Markdown blocks={blocks} trailing={editedMarker} />
              )}
            </div>
          )
        )}

        {message.attachments.map((attachment) => (
          <AttachmentView key={attachment.url} {...attachment} />
        ))}

        {!editing &&
          embedUrls.map((url) => (
            <LinkEmbed key={url} url={url} />
          ))}

        {message.status === "failed" && (
          <p role="alert" className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-error">
            <span>{message.failure?.message ?? "The message couldn't be sent."}</span>
            {message.failure?.retryable !== false && onRetry && (
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => onRetry(message.id)}>
                Retry
              </button>
            )}
            {onDiscard && (
              <button type="button" className="text-text-tertiary underline underline-offset-2 hover:text-text" onClick={() => onDiscard(message.id)}>
                Delete
              </button>
            )}
          </p>
        )}

        {message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.reactions.map((reaction) => {
              const mine = myUserId !== undefined && reaction.userIds.includes(myUserId);
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  aria-pressed={mine}
                  onClick={() => onToggleReaction(message.id, reaction.emoji, !mine)}
                  className={[
                    "flex h-6 items-center gap-1.5 rounded-full border px-2 text-[13px]",
                    mine ? "border-primary/50 bg-primary/10 text-text" : "border-border-secondary bg-surface-secondary text-text-tertiary hover:text-text",
                  ].join(" ")}
                >
                  <Emoji char={reaction.emoji} size={16} />
                  <span className="text-xs">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!editing && !isLocal && (
        <div data-message-toolbar className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-lg border border-border-secondary bg-surface-secondary p-0.5 shadow-popover group-focus-within:flex group-hover:flex pointer-coarse:flex">
          {QUICK_REACTIONS.map((emoji) => {
            const mine = message.reactions.some((r) => r.emoji === emoji && myUserId !== undefined && r.userIds.includes(myUserId));
            return (
              <button key={emoji} type="button" className={toolButton} aria-label={`${mine ? "Remove" : "Add"} ${emoji} reaction`} onClick={() => onToggleReaction(message.id, emoji, !mine)}>
                <Emoji char={emoji} size={18} />
              </button>
            );
          })}
          {onOpenPicker && (
            <button
              type="button"
              className={toolButton}
              aria-label="Add reaction"
              aria-haspopup="dialog"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenPicker(message.id, { x: rect.left, y: rect.bottom + 4 });
              }}
            >
              <SmilePlus size={14} />
            </button>
          )}
          {onReply && (
            <button type="button" className={toolButton} aria-label="Reply" title="Reply" onClick={() => onReply(message.id)}>
              <Reply size={14} />
            </button>
          )}
          {isOwn && (
            <>
              <button type="button" className={toolButton} aria-label="Edit message" onClick={() => setEditing(true)}>
                <Pencil size={14} />
              </button>
              <button type="button" className={`${toolButton} hover:text-error`} aria-label="Delete message" onClick={() => onDelete(message.id)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
          {onOpenMenu && (
            <button
              type="button"
              className={toolButton}
              aria-label="More actions"
              aria-haspopup="menu"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenMenu(message.id, { x: rect.left, y: rect.bottom + 4 });
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        </div>
      )}
    </article>
  );
});
