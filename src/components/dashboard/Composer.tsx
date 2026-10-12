import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Paperclip, Send, X } from "lucide-react";
import { classifyAuthError } from "../../utils/authErrors";

interface ComposerProps {
  channelName: string;
  /** Instance limit for message text, when known. */
  maxLength?: number;
  onSend: (input: { text: string; files: File[] }) => Promise<unknown>;
}

export function Composer({ channelName, maxLength, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSend = !sending && (text.trim().length > 0 || files.length > 0);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) setFiles((prev) => [...prev, ...picked]);
    e.target.value = ""; // allow picking the same file again
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
        className="flex h-[50px] items-center gap-3 rounded-[14px] bg-surface-secondary pl-3 pr-2 text-text-tertiary focus-within:ring-2 focus-within:ring-primary/30"
      >
        <input ref={fileInput} type="file" multiple hidden onChange={handleFiles} />
        <button
          type="button"
          aria-label="Attach files"
          onClick={() => fileInput.current?.click()}
          className="grid h-[30px] w-[30px] place-items-center rounded-full bg-surface-tertiary hover:text-text"
        >
          <Paperclip size={15} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={maxLength}
          placeholder={`Message #${channelName}`}
          aria-label={`Message #${channelName}`}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-text outline-none placeholder:text-text-tertiary"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!canSend}
          className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-on-primary transition-opacity disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
