import { type ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  widthClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared modal container with consistent monochrome styling and accessibility basics.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  widthClassName = "max-w-xl",
  bodyClassName = "",
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pb-backdrop fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
      <button
        aria-label="Close dialog backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || "Dialog"}
          className={`pb-modal relative my-auto flex w-full max-h-[calc(100dvh-2rem)] flex-col ${widthClassName} overflow-hidden rounded-2xl`}
        >
          {(title || description) && (
            <div className="shrink-0 border-b pb-border px-5 py-4">
              {title && <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>}
              {description && (
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
              )}
            </div>
          )}

          <div className={`min-h-0 overflow-y-auto px-5 py-4 ${bodyClassName}`.trim()}>
            {children}
          </div>

          {footer && <div className="shrink-0 border-t pb-border px-5 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
