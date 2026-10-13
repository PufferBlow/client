import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, Paperclip, Send, Smile, X } from "lucide-react";
import { EmojiPickerPopover } from "../ui/EmojiPickerPopover";
import { classifyAuthError } from "../../utils/authErrors";
import { useAutoGrow } from "../../hooks/useAutoGrow";
import { applyEdit, fits, handleFormatShortcut } from "../../lib/textEditing";

interface ComposerProps {
  channelName: string;
  /** Instance limit for message text, when known. */
  maxLength?: number;
  onSend: (input: { text: string; files: File[] }) => Promise<unknown>;
}

/** How close to the length limit the remaining-characters count appears. */
const counterThreshold = (maxLength: number) => Math.min(200, Math.max(20, Math.floor(maxLength * 0.1)));

export function Composer({ channelName, maxLength, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  /** The popover closes itself on any press outside it, including on this button, so remember it was open to make the button a toggle. */
  const pickerWasOpen = useRef(false);
  useAutoGrow(textInput, text);

  const canSend = !sending && (text.trim().length > 0 || files.length > 0);
  const remaining = maxLength === undefined ? null : maxLength - text.length;
  const showCounter = remaining !== null && maxLength !== undefined && remaining <= counterThreshold(maxLength);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) setFiles((prev) => [...prev, ...picked]);
    e.target.value = ""; // allow picking the same file again
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
      await onSend({ text: text.trim(), files });
      setText("");
      setFiles([]);
    } catch (err) {
      setError(classifyAuthError(err, "Message couldn't be sent. Try again.").message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-3.5 mb-3.5 shrink-0">
      {error && (
        <p role="alert" className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] text-error">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="m-0 mb-2 flex list-none flex-wrap gap-2 p-0">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex max-w-[220px] items-center gap-1.5 rounded-lg bg-surface-secondary py-1 pl-2.5 pr-1 text-xs text-text-secondary">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-text"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={submit}
        className="flex items-end gap-3 rounded-[14px] bg-surface-secondary py-1.75 pl-3 pr-2 text-text-tertiary focus-within:ring-2 focus-within:ring-primary/30"
      >
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          placeholder={`Message #${channelName}`}
          aria-label={`Message #${channelName}`}
          aria-describedby={showCounter ? "composer-remaining" : undefined}
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
      </form>
      {picker && <EmojiPickerPopover x={picker.x} y={picker.y} onSelect={insertEmoji} onClose={() => setPicker(null)} />}
    </div>
  );
}
