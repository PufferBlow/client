import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { parseExtensions } from "../../features/admin/extensions";

export interface ExtensionListProps {
  label: string;
  hint?: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Common extensions offered as one-click additions. */
  suggestions?: readonly string[];
}

/** Characters that finish a typed extension. */
const SEPARATORS = new Set([",", " ", ";", "Enter"]);

/**
 * The file types allowed for one kind of upload, as chips: `.png` with a remove button, a field to add
 * more (Enter, a comma or a space finishes one, and a pasted list is split), and the common ones the
 * list lacks as `+ webp` buttons.
 */
export function ExtensionList({ label, hint, value, onChange, suggestions = [] }: ExtensionListProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = (text: string): boolean => {
    const words = parseExtensions(text);
    if (words === null) {
      setError("Use letters and digits only, like jpg or mp4.");
      return false;
    }
    setError(null);
    const fresh = words.filter((w) => !value.includes(w));
    if (fresh.length > 0) onChange([...value, ...fresh]);
    return true;
  };

  const commit = () => {
    if (draft.trim() === "") return;
    if (add(draft)) setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (SEPARATORS.has(e.key)) {
      if (draft.trim() !== "") {
        e.preventDefault();
        commit();
      } else if (e.key !== "Enter") {
        e.preventDefault();
      }
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const missing = suggestions.filter((s) => !value.includes(s));

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="pb-section-label text-text-tertiary">{label}</span>
        <span className="pb-meta text-[12px]">{value.length === 0 ? "Nothing allowed" : `${value.length} ${value.length === 1 ? "type" : "types"}`}</span>
      </div>

      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-1.5 focus-within:shadow-[0_0_0_2px_var(--color-surface-secondary),0_0_0_4px_var(--color-text)] ${error ? "shadow-[0_0_0_1px_var(--color-error)]" : ""}`}
      >
        {value.map((ext) => (
          <span key={ext} className="inline-flex h-7 items-center gap-1 rounded-sm bg-active pl-2.5 pr-1 font-mono text-[12.5px] text-text">
            .{ext}
            <button
              type="button"
              aria-label={`Remove ${ext} from ${label}`}
              onClick={() => onChange(value.filter((e) => e !== ext))}
              className="grid size-5 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-text-tertiary hover:bg-hover hover:text-text"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          aria-label={`Add a type to ${label}`}
          aria-invalid={error ? true : undefined}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          value={draft}
          placeholder={value.length === 0 ? "png, jpg, webp" : "Add another"}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,;]/.test(text.trim())) {
              e.preventDefault();
              if (add(text)) setDraft("");
            }
          }}
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 font-mono text-[13px] text-text outline-none placeholder:font-sans placeholder:text-text-muted"
        />
      </div>

      {error && (
        <p role="alert" className="pb-error m-0 text-[12.5px]">
          {error}
        </p>
      )}
      {hint && !error && <p className="pb-meta m-0 text-[12.5px]">{hint}</p>}

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={`Common ${label.toLowerCase()} types`}>
          {missing.map((ext) => (
            <button
              key={ext}
              type="button"
              aria-label={`Add ${ext} to ${label}`}
              onClick={() => onChange([...value, ext])}
              className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed border-border bg-transparent px-2 font-mono text-[11.5px] text-text-tertiary hover:border-solid hover:bg-hover hover:text-text"
            >
              <Plus size={11} aria-hidden="true" />
              {ext}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
