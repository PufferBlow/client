import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AtSign, Eye, EyeOff, File as FileIcon, Music, Paperclip, Reply, Send, Smile, Trash2, Upload, X } from "lucide-react";
import { EmojiPickerPopover } from "../ui/EmojiPickerPopover";
import { classifyAuthError } from "../../utils/authErrors";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import { applyEdit, fits, handleFormatShortcut } from "../../lib/textEditing";
import { asSpoiler, fileKind, formatBytes } from "../../lib/files";
import { findMentionQuery, insertMention, matchMentionables, type Mentionable } from "../../lib/mentions";
import {
  completeTypedShortcode,
  findShortcodeQuery,
  insertShortcode,
  matchShortcodes,
  replaceShortcodes,
  type ShortcodeSuggestion,
} from "../../lib/shortcodes";
import { Emoji } from "../ui/Emoji";
import { Avatar } from "./Avatar";
import { TypingIndicator } from "./TypingIndicator";

/** One row of the suggestion list: a person to mention or an emoji to insert. */
type Suggestion = { kind: "mention"; item: Mentionable } | { kind: "emoji"; item: ShortcodeSuggestion };

interface ComposerProps {
  channelName: string;
  /** Who the message goes to, as shown in the field ("#general", "@grace"). Defaults to `#channelName`. */
  target?: string;
  /** Instance limit for message text, when known. */
  maxLength?: number;
  /** Instance limit for all attachments of one message together, in MB, when known. */
  maxAttachmentMB?: number;
  /** The message being replied to, shown above the field until sent or cancelled. */
  replyingTo?: { id: string; authorName: string };
  onCancelReply?: () => void;
  /** People (and `@everyone`, if the viewer may use it) offered when typing `@`. Omit for no suggestions. */
  mentionables?: Mentionable[];
  onSend: (input: { text: string; files: File[] }) => Promise<unknown>;
  /** Called as the user types, so the others can be told (the caller throttles). */
  onTyping?: () => void;
  /** Names of the people typing here, shown under the field. */
  typingNames?: readonly string[];
}

/** How close to the length limit the remaining-characters count appears. */
const counterThreshold = (maxLength: number) => Math.min(200, Math.max(20, Math.floor(maxLength * 0.1)));

/** A file waiting to be sent, with a local preview for images and video. */
interface PendingFile {
  id: number;
  file: File;
  spoiler: boolean;
  previewUrl: string | null;
}

function toPending(file: File, id: number): PendingFile {
  const kind = fileKind(file.type);
  const canPreview = (kind === "image" || kind === "video") && typeof URL.createObjectURL === "function";
  return { id, file, spoiler: false, previewUrl: canPreview ? URL.createObjectURL(file) : null };
}

const releasePreview = (pending: PendingFile) => {
  if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
};

export function Composer({
  channelName,
  target = `#${channelName}`,
  maxLength,
  maxAttachmentMB,
  replyingTo,
  onCancelReply,
  mentionables,
  onSend,
  onTyping,
  typingNames = [],
}: ComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const nextFileId = useRef(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  /** The popover closes itself on any press outside it, including on this button, so remember it was open to make the button a toggle. */
  const pickerWasOpen = useRef(false);
  useAutoGrow(textInput, text);

  // Typing `@` offers people to mention. The caret decides which `@word` is being typed.
  const [caret, setCaret] = useState(0);
  const [activeMention, setActiveMention] = useState(0);
  /** The `@word` whose list was dismissed with Escape; it stays away until the word changes. */
  const [dismissedMention, setDismissedMention] = useState<string | null>(null);
  const mention = useMemo(() => (mentionables?.length ? findMentionQuery(text, caret) : null), [mentionables, text, caret]);
  // Typing `:` and two letters offers emoji the same way (a `@word` wins when the caret is in one).
  const shortcode = useMemo(() => (mention ? null : findShortcodeQuery(text, caret)), [mention, text, caret]);
  const mentionKey = mention ? `@${mention.start}:${mention.query}` : shortcode ? `:${shortcode.start}:${shortcode.query}` : null;
  const suggestions = useMemo<Suggestion[]>(() => {
    if (mentionKey === null || mentionKey === dismissedMention) return [];
    if (mention && mentionables) return matchMentionables(mentionables, mention.query).map((item) => ({ kind: "mention", item }));
    if (shortcode) return matchShortcodes(shortcode.query).map((item) => ({ kind: "emoji", item }));
    return [];
  }, [mention, shortcode, mentionables, mentionKey, dismissedMention]);
  const suggesting = suggestions.length > 0;
  useEffect(() => setActiveMention(0), [mentionKey]);

  const pickSuggestion = (choice: Suggestion) => {
    const next =
      choice.kind === "mention" && mention
        ? insertMention(text, mention, caret, choice.item.name)
        : choice.kind === "emoji" && shortcode
          ? insertShortcode(text, shortcode, caret, choice.item.emoji)
          : null;
    if (!next) return;
    if (maxLength !== undefined && next.text.length > maxLength) return;
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      const input = textInput.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
    });
  };

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  const tooLarge = maxAttachmentMB !== undefined && totalBytes > maxAttachmentMB * 1024 * 1024;
  const canSend = !sending && !tooLarge && (text.trim().length > 0 || files.length > 0);
  const remaining = maxLength === undefined ? null : maxLength - text.length;
  const showCounter = remaining !== null && maxLength !== undefined && remaining <= counterThreshold(maxLength);

  const addFiles = useCallback((added: File[]) => {
    if (added.length === 0) return;
    setFiles((prev) => [...prev, ...added.map((file) => toPending(file, nextFileId.current++))]);
  }, []);

  const removeFile = (id: number) =>
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === id);
      if (gone) releasePreview(gone);
      return prev.filter((f) => f.id !== id);
    });

  const toggleSpoiler = (id: number) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, spoiler: !f.spoiler } : f)));

  // Previews are object URLs; let them go when the composer goes away.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  });
  useEffect(() => () => filesRef.current.forEach(releasePreview), []);

  // Files dragged anywhere onto the window land here (and Electron doesn't navigate to them).
  useEffect(() => {
    let depth = 0;
    const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files ?? []));
      textInput.current?.focus();
    };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = ""; // allow picking the same file again
  };

  /** Pasted files (a screenshot, files copied in the file manager) are attached instead of pasted as text. */
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length === 0) return;
    e.preventDefault();
    addFiles(pasted);
  };

  /** Put an emoji where the caret is (or replace the selection), then hand focus back to the field. */
  const insertEmoji = (emoji: string) => {
    setPicker(null);
    // After the popover has closed, since closing hands focus back to whatever had it before.
    requestAnimationFrame(() => {
      const input = textInput.current;
      if (!input) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const edit = { from: start, to: end, insert: emoji, selectionStart: start + emoji.length, selectionEnd: start + emoji.length };
      if (fits(input.value, edit, maxLength)) applyEdit(input, edit, setText);
      else input.focus();
    });
  };

  // Starting a reply puts the caret in the field, ready to type it.
  const replyingToId = replyingTo?.id;
  useEffect(() => {
    if (replyingToId) textInput.current?.focus();
  }, [replyingToId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggesting && !e.nativeEvent.isComposing) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveMention((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const choice = suggestions[activeMention] ?? suggestions[0];
        if (choice) pickSuggestion(choice);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedMention(mentionKey);
        return;
      }
    }
    if (e.key === "Escape" && replyingTo && onCancelReply) {
      e.preventDefault();
      onCancelReply();
      return;
    }
    // Enter sends; Shift+Enter is a new line. Not while an IME is composing (Enter picks the candidate).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
      return;
    }
    handleFormatShortcut(e, setText, maxLength);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSend({ text: replaceShortcodes(text.trim()), files: files.map((f) => (f.spoiler ? asSpoiler(f.file) : f.file)) });
      setText("");
      files.forEach(releasePreview);
      setFiles([]);
    } catch (err) {
      setError(classifyAuthError(err, "Message couldn't be sent. Try again.").message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative mx-3.5 mb-3.5 shrink-0">
      {suggesting && (
        <ul
          id="composer-mentions"
          role="listbox"
          aria-label={suggestions[0]?.kind === "emoji" ? "Emoji" : "People to mention"}
          className="absolute bottom-full left-0 right-0 z-20 m-0 mb-2 max-h-72 list-none overflow-y-auto rounded-xl border border-border-secondary bg-surface-secondary p-1.5 shadow-popover"
        >
          {suggestions.map((choice, i) => (
            <li
              key={choice.kind === "mention" ? choice.item.id : choice.item.name}
              id={`composer-mention-${i}`}
              role="option"
              aria-label={choice.kind === "mention" ? choice.item.name : `:${choice.item.name}:`}
              aria-selected={i === activeMention}
              onMouseDown={(e) => {
                e.preventDefault(); // keep the caret in the field
                pickSuggestion(choice);
              }}
              onMouseEnter={() => setActiveMention(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${i === activeMention ? "bg-surface-tertiary text-text" : "text-text-secondary"}`}
            >
              {choice.kind === "emoji" ? (
                <>
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-lg">
                    <Emoji char={choice.item.emoji} size="1.4em" />
                  </span>
                  <span className="min-w-0 truncate font-medium">:{choice.item.name}:</span>
                </>
              ) : (
                <>
                  {choice.item.everyone ? (
                    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                      <AtSign size={14} />
                    </span>
                  ) : (
                    <Avatar name={choice.item.name} src={choice.item.avatarUrl} seed={choice.item.id} size={24} />
                  )}
                  <span className="min-w-0 truncate font-medium">{choice.item.name}</span>
                  {choice.item.everyone && <span className="ml-auto shrink-0 text-[12px] text-text-muted">Notify everyone who can read this channel</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] text-error">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <form
        onSubmit={submit}
        className="rounded-[14px] bg-surface-secondary text-text-tertiary focus-within:ring-2 focus-within:ring-primary/30"
      >
        {replyingTo && (
          <div className="flex items-center gap-2 rounded-t-[14px] border-b border-border-secondary bg-surface-tertiary/50 py-1.5 pl-3.5 pr-2 text-[13px]">
            <Reply size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="min-w-0 truncate text-text-muted">
              Replying to <span className="font-semibold text-text-secondary">{replyingTo.authorName}</span>
            </span>
            {onCancelReply && (
              <button
                type="button"
                aria-label="Cancel reply"
                title="Cancel reply (Esc)"
                onClick={onCancelReply}
                className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {files.length > 0 && (
          <>
            <ul aria-label="Attachments" className="m-0 flex list-none gap-3 overflow-x-auto px-3 pb-2 pt-3.5">
              {files.map((pending) => (
                <AttachmentPreview
                  key={pending.id}
                  pending={pending}
                  onRemove={() => removeFile(pending.id)}
                  onToggleSpoiler={() => toggleSpoiler(pending.id)}
                />
              ))}
            </ul>
            {tooLarge && maxAttachmentMB !== undefined && (
              <p role="alert" className="m-0 flex items-center gap-1.5 px-3.5 pb-1 text-[12.5px] text-error">
                <AlertCircle size={13} aria-hidden="true" />
                {formatBytes(totalBytes)} in total; this server allows {maxAttachmentMB} MB per message.
              </p>
            )}
            <div className="mx-3 border-t border-border-secondary" />
          </>
        )}
        <div className="flex items-end gap-3 py-1.75 pl-3 pr-2">
          <input ref={fileInput} type="file" multiple hidden onChange={handleFiles} />
          <button
            type="button"
            aria-label="Attach files"
            onClick={() => fileInput.current?.click()}
            className="mb-0.75 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-surface-tertiary hover:text-text"
          >
            <Paperclip size={15} />
          </button>
          <textarea
            ref={textInput}
            rows={1}
            value={text}
            onChange={(e) => {
              // The closing colon of `:tada:` turns it into the emoji on the spot.
              const typed = e.target.selectionStart;
              const closed = (e.nativeEvent as InputEvent).inputType === "insertText" ? completeTypedShortcode(e.target.value, typed) : null;
              if (closed && (maxLength === undefined || closed.text.length <= maxLength)) {
                setText(closed.text);
                setCaret(closed.caret);
                requestAnimationFrame(() => textInput.current?.setSelectionRange(closed.caret, closed.caret));
              } else {
                setText(e.target.value);
                setCaret(typed);
              }
              if (e.target.value.trim()) onTyping?.();
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            maxLength={maxLength}
            placeholder={`Message ${target}`}
            aria-label={`Message ${target}`}
            aria-describedby={showCounter ? "composer-remaining" : undefined}
            aria-autocomplete="list"
            aria-controls={suggesting ? "composer-mentions" : undefined}
            aria-activedescendant={suggesting ? `composer-mention-${activeMention}` : undefined}
            className="max-h-[50vh] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[14.5px] leading-5 text-text outline-none placeholder:text-text-tertiary"
          />
          {showCounter && remaining !== null && (
            <span
              id="composer-remaining"
              aria-label={`${remaining} characters left`}
              className={`mb-2.5 shrink-0 text-xs tabular-nums ${remaining <= 0 ? "text-error" : remaining <= 20 ? "text-warning" : "text-text-muted"}`}
            >
              {remaining}
            </span>
          )}
          <button
            type="button"
            aria-label="Add emoji"
            aria-haspopup="dialog"
            aria-expanded={picker !== null}
            onPointerDown={() => {
              pickerWasOpen.current = picker !== null;
            }}
            onClick={(e) => {
              if (pickerWasOpen.current) {
                pickerWasOpen.current = false;
                return; // this press already closed it
              }
              const rect = e.currentTarget.getBoundingClientRect();
              // Open above the field with its right edge on the button.
              setPicker({ x: rect.right - 334, y: rect.top - 394 - 10 });
            }}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-surface-tertiary hover:text-text ${picker ? "bg-surface-tertiary text-primary" : ""}`}
          >
            <Smile size={18} />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary text-on-primary transition-opacity disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      {/* Lives in the space under the field, so it never moves the layout. */}
      <div className="absolute left-2 right-2 top-full h-3.5">
        <TypingIndicator names={typingNames} />
      </div>
      {picker && <EmojiPickerPopover x={picker.x} y={picker.y} onSelect={insertEmoji} onClose={() => setPicker(null)} />}
      {dragging &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-surface-secondary px-12 py-9 text-center shadow-modal">
              <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
                <Upload size={26} />
              </span>
              <p className="m-0 text-[17px] font-bold text-text">Drop to attach</p>
              <p className="m-0 text-[13px] text-text-muted">The files will be added to your message to {target}.</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** One file waiting to be sent: a preview (or icon), its name and size, and spoiler/remove actions. */
function AttachmentPreview({ pending, onRemove, onToggleSpoiler }: { pending: PendingFile; onRemove: () => void; onToggleSpoiler: () => void }) {
  const { file, spoiler, previewUrl } = pending;
  const kind = fileKind(file.type);
  const hide = spoiler ? "scale-110 blur-xl" : "";
  const action = "grid h-7 w-7 place-items-center text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text";

  return (
    <li className="relative w-[164px] shrink-0 rounded-xl border border-border-secondary bg-background-secondary p-2">
      <div className="relative grid h-[108px] place-items-center overflow-hidden rounded-lg bg-surface">
        {kind === "image" && previewUrl ? (
          <img src={previewUrl} alt="" className={`h-full w-full object-cover ${hide}`} />
        ) : kind === "video" && previewUrl ? (
          <video src={previewUrl} muted preload="metadata" className={`h-full w-full object-cover ${hide}`} />
        ) : kind === "audio" ? (
          <Music size={30} className="text-text-muted" aria-hidden="true" />
        ) : (
          <FileIcon size={30} className="text-text-muted" aria-hidden="true" />
        )}
        {spoiler && (
          <span className="absolute rounded-full bg-black/75 px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.12em] text-white">SPOILER</span>
        )}
      </div>
      <p className="m-0 mt-1.5 truncate text-[12.5px] text-text-secondary" title={file.name}>
        {file.name}
      </p>
      <p className="m-0 text-[11px] text-text-muted">{formatBytes(file.size)}</p>
      <div className="absolute -right-2 -top-2 flex overflow-hidden rounded-lg border border-border-secondary bg-surface-secondary shadow-popover">
        <button
          type="button"
          aria-label={spoiler ? `Unmark ${file.name} as spoiler` : `Mark ${file.name} as spoiler`}
          aria-pressed={spoiler}
          title={spoiler ? "Remove spoiler" : "Mark as spoiler"}
          onClick={onToggleSpoiler}
          className={`${action} ${spoiler ? "text-primary" : ""}`}
        >
          {spoiler ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button type="button" aria-label={`Remove ${file.name}`} title="Remove" onClick={onRemove} className={`${action} hover:text-error`}>
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
