/**
 * Inline editor that replaces a message bubble's body while the
 * sender is editing it.
 *
 * Discord-style affordance: the body becomes a small textarea
 * pre-filled with the existing text, Enter saves, Esc cancels,
 * Shift+Enter inserts a newline. The footer carries explicit
 * buttons too so a user who doesn't know the shortcuts can still
 * complete the flow.
 *
 * Used by both the channel chat and DM views — same component,
 * same behavior. The parent owns the persistence step via
 * ``onSave`` and the close transition via ``onCancel``.
 */
import { useEffect, useRef, useState } from "react";

interface InlineMessageEditorProps {
  initialBody: string;
  /** Async save handler — receives the trimmed new body. The
   *  parent is responsible for the network call + cache update;
   *  this component just collects input. */
  onSave: (next: string) => Promise<void>;
  /** Close the editor without saving. */
  onCancel: () => void;
}

export function InlineMessageEditor({
  initialBody,
  onSave,
  onCancel,
}: InlineMessageEditorProps) {
  const [draft, setDraft] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-focus + auto-resize on mount. Cursor lands at the end of
  // the body so the user can keep typing without selecting first.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, []);

  // Auto-resize on input so the textarea grows with the content
  // up to a ceiling (240px, ~10 lines) before scrolling.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [draft]);

  const trimmed = draft.trim();
  const changed = trimmed !== initialBody.trim();
  const canSave = changed && trimmed.length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-2">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSave();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        disabled={isSaving}
        rows={1}
        className="w-full resize-none bg-transparent text-sm text-[var(--color-text)] focus:outline-none disabled:opacity-50"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>Enter to save · Esc to cancel · Shift+Enter for newline</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={!canSave}
            className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
