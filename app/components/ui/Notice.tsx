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

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  switch (tone) {
    case "success":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case "warning":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case "error":
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "info":
    default:
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

/**
 * Inline notification surface for section-level feedback.
 * Renders a tone-coloured background with a matching leading icon
 * (checkmark, exclamation triangle, exclamation circle, information
 * circle) so the type of the message is recognisable at a glance.
 */
export function Notice({ tone, message, onClose }: NoticeProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClassMap[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
          <NoticeIcon tone={tone} />
        </span>
        <div className="min-w-0 flex-1">{message}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-0.5 flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            aria-label="Dismiss notice"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
