import type { Toast as ToastData } from "../../hooks/useToast";

/** Live region for the current toast. Always mounted so screen readers announce changes. */
export function ToastRegion({ toast }: { toast: ToastData | null }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 px-4" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={[
            "rounded-lg bg-surface-tertiary px-4 py-2.5 text-[13.5px] font-semibold shadow-popover",
            toast.tone === "error" ? "text-error-text shadow-[inset_0_0_0_1px_rgba(226,101,79,0.4),var(--shadow-popover)]" : "text-text",
          ].join(" ")}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
