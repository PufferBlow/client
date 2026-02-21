import { Button } from "../Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation dialog for destructive and warning flows.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const buttonVariant = tone === "primary" ? "primary" : tone;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      description={description}
      widthClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={buttonVariant} onClick={onConfirm} loading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-[var(--color-text-secondary)]">
        This action may be irreversible. Please confirm to continue.
      </p>
    </Modal>
  );
}

