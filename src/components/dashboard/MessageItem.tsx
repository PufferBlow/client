import { memo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { FileText, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Emoji, EmojiText } from "../ui/Emoji";
import type { Message } from "../../features/messages/types";
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
}

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

function AttachmentView({ url, filename, type }: Message["attachments"][number]) {
  const href = resolveAssetUrl(url);
  if (type.startsWith("image/") && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        <img src={href} alt={filename} loading="lazy" className="mt-2 max-h-72 max-w-full rounded-xl border border-border-secondary" />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-border-secondary bg-surface-secondary px-3 py-2 text-[13px] text-text-secondary hover:text-text"
    >
      <FileText size={15} aria-hidden="true" />
      <span className="truncate">{filename}</span>
    </a>
  );
}

function EditForm({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (text: string) => Promise<unknown>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

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
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        disabled={saving}
        aria-label="Edit message"
        className="h-10 rounded-xl border border-primary/40 bg-background px-3 text-[15px] text-text outline-none"
      />
      <span className="text-xs text-text-muted">Escape to cancel · Enter to save</span>
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
}: MessageItemProps) {
  const [localEditing, setLocalEditing] = useState(false);
  const editing = controlledEditing ?? localEditing;
  const setEditing = (next: boolean) => (controlledEditing === undefined ? setLocalEditing(next) : onEditingChange?.(message.id, next));
  const isOwn = myUserId !== undefined && message.authorId === myUserId;
  // Not on the server yet (sending) or never got there (failed): nothing can act on it but retry/discard.
  const isLocal = message.status !== undefined;

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
      aria-label={`${message.authorName} at ${formatTime(message.sentAt)}`}
      tabIndex={0}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      className={`group relative flex gap-3 px-[18px] outline-none hover:bg-text/[0.03] focus-visible:bg-text/[0.05] ${isGroupStart ? "mt-[14px] py-[3px] first:mt-0" : "py-px"}`}
    >
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
            <p
              className={`m-0 whitespace-pre-wrap break-words text-[15px] text-text-secondary ${message.status === "pending" ? "opacity-60" : ""}`}
              aria-busy={message.status === "pending" || undefined}
            >
              <EmojiText text={message.text} />
              {!isGroupStart && message.editCount > 0 && <span className="ml-1.5 text-[11px] text-text-muted">(edited)</span>}
            </p>
          )
        )}

        {message.attachments.map((attachment) => (
          <AttachmentView key={attachment.url} {...attachment} />
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
        <div className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-lg border border-border-secondary bg-surface-secondary p-0.5 shadow-popover group-focus-within:flex group-hover:flex pointer-coarse:flex">
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
