import type { ReactNode } from "react";

type NoticeTone = "success" | "warning" | "error" | "info";

interface NoticeProps {
  tone: NoticeTone;
  message: ReactNode;
  onClose?: () => void;
}

const toneClassMap: Record<NoticeTone, string> = {
  success: "pb-status-success",
  warning: "pb-status-warning",
  error: "pb-status-danger",
  info: "pb-status-info",
};

/**
 * Inline notification surface for section-level feedback.
 */
export function Notice({ tone, message, onClose }: NoticeProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClassMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>{message}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            aria-label="Dismiss notice"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
