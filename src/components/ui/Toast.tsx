import type { Toast as ToastData } from "../../hooks/useToast";

/** Live region for the current toast. Always mounted so screen readers announce changes. */
export function ToastRegion({ toast }: { toast: ToastData | null }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 px-4" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={[
            "rounded-xl border px-4 py-2.5 text-sm shadow-popover",
            toast.tone === "error" ? "border-error/50 bg-surface-secondary text-error" : "border-border-secondary bg-surface-secondary text-text",
          ].join(" ")}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
