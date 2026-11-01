import { Loader2 } from "lucide-react";

/**
 * Shown while the instance is slow to answer (busy, or a brief hiccup). A small note on top of the app, which stays
 * usable underneath: nothing is covered, nothing is lost, and what was on screen stays. Pufferblow keeps asking and
 * the note goes away by itself when the instance answers.
 */
export function InstanceSlowBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 px-3"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border-secondary bg-surface-secondary px-4 py-2 text-[13px] text-text-secondary shadow-lg">
        <Loader2 size={14} className="shrink-0 animate-spin text-text-muted" aria-hidden="true" />
        <span>This server is slow to answer right now. Still trying…</span>
      </div>
    </div>
  );
}
