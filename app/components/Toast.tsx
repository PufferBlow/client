import React, { createContext, useContext, useRef, useState } from "react";

export type ToastTone = "success" | "warning" | "error";
export type ToastCategory = "destructive" | "system" | "validation" | "info";

export interface ToastEvent {
  message: string;
  tone: ToastTone;
  category: ToastCategory;
  dedupeKey?: string;
  ttlMs?: number;
}

export type LegacyToastTone = "success" | "error";

export interface ShowToast {
  (event: ToastEvent): void;
  (message: string, legacyTone?: LegacyToastTone): void;
}

interface ToastContextType {
  showToast: ShowToast;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
  children: React.ReactNode;
}

const NOISY_PATTERNS = [
  /message sent/i,
  /connected to/i,
  /disconnected from/i,
  /copied to clipboard/i,
  /copied message/i,
  /audio devices updated/i,
  /microphone muted/i,
  /microphone unmuted/i,
  /speakers\/headphones/i,
];

const HIGH_IMPACT_SUCCESS_PATTERNS = [
  /deleted/i,
  /blocked/i,
  /unblocked/i,
  /banned/i,
  /warned/i,
  /reset/i,
  /created/i,
  /report submitted/i,
];

function normalizeToastInput(input: ToastEvent | string, legacyTone?: LegacyToastTone): ToastEvent {
  if (typeof input !== "string") {
    return input;
  }

  return {
    message: input,
    tone: legacyTone === "error" ? "error" : "success",
    category: legacyTone === "error" ? "validation" : "info",
  };
}

function shouldSuppressToast(event: ToastEvent): boolean {
  if (event.tone === "error" || event.tone === "warning") {
    return false;
  }

  if (event.category === "destructive" || event.category === "system") {
    return false;
  }

  if (NOISY_PATTERNS.some((pattern) => pattern.test(event.message))) {
    return true;
  }

  return !HIGH_IMPACT_SUCCESS_PATTERNS.some((pattern) => pattern.test(event.message));
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [currentToast, setCurrentToast] = useState<(ToastEvent & { isOpen: boolean }) | null>(null);
  const dedupeTrackerRef = useRef<Map<string, number>>(new Map());
  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast: ShowToast = (input: ToastEvent | string, legacyTone?: LegacyToastTone) => {
    const event = normalizeToastInput(input, legacyTone);

    if (!event.message || shouldSuppressToast(event)) {
      return;
    }

    const now = Date.now();
    const dedupeKey = event.dedupeKey || `${event.category}:${event.tone}:${event.message}`;
    const lastShownAt = dedupeTrackerRef.current.get(dedupeKey);

    if (lastShownAt && now - lastShownAt < 1600) {
      return;
    }

    dedupeTrackerRef.current.set(dedupeKey, now);
    setCurrentToast({ ...event, isOpen: true });

    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
    }

    const ttl =
      event.ttlMs ??
      (event.tone === "error" ? 5000 : event.tone === "warning" ? 4500 : 3000);

    activeTimerRef.current = setTimeout(() => {
      setCurrentToast(null);
    }, ttl);
  };

  const toneClass =
    currentToast?.tone === "error"
      ? "border-[var(--color-error)]/70 text-[var(--color-text)]"
      : currentToast?.tone === "warning"
        ? "border-[var(--color-warning)]/70 text-[var(--color-text)]"
        : "border-[var(--color-success)]/70 text-[var(--color-text)]";

  const contextValue = { showToast };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {currentToast?.isOpen ? (
        <div className="animate-slide-in-right fixed right-4 top-4 z-[9999] max-w-sm">
          <div
            className={`rounded-lg border-l-4 border bg-[var(--color-surface)] px-4 py-3 shadow-xl ${toneClass}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                {currentToast.tone}
              </div>
              <p className="flex-1 text-sm leading-relaxed">{currentToast.message}</p>
              <button
                onClick={() => setCurrentToast(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                aria-label="Close"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.showToast;
}
