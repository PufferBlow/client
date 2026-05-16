import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./ui/Modal";

/**
 * Shape of the form data the modal collects before handing it back to the
 * caller. Duration is always set for timeout actions and undefined for ban
 * actions; reason is optional in both cases.
 */
export interface ModerationActionSubmit {
  durationMinutes?: number;
  reason?: string;
}

interface ModerationActionModalProps {
  /**
   * `null` keeps the modal closed. Setting to a populated object opens the
   * modal in the corresponding mode. This shape keeps the parent's state
   * a single field instead of three parallel booleans.
   */
  action: { kind: "timeout" | "ban"; username: string } | null;
  isSubmitting?: boolean;
  onSubmit: (data: ModerationActionSubmit) => void;
  onCancel: () => void;
}

const DEFAULT_TIMEOUT_MINUTES = "60";

/**
 * Replacement for the chain of `window.prompt` / `window.confirm` calls the
 * moderator flow used to issue when timing out or banning a user. Renders
 * as a real Modal so it's keyboard-accessible (Esc closes), matches app
 * theming, and gives us a real submit button we can label as destructive.
 *
 * For `timeout` we collect a duration (minutes, integer >= 1) and an
 * optional reason. For `ban` we collect an optional reason — the action
 * itself is the confirmation.
 *
 * Validation lives here so the parent only sees a well-formed submit. If
 * the duration is invalid the inline error appears and the submit button
 * stays disabled; the parent never needs to re-prompt.
 */
export function ModerationActionModal({
  action,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: ModerationActionModalProps) {
  const [durationInput, setDurationInput] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [reason, setReason] = useState("");

  // Reset the form whenever the modal re-opens for a different user/action
  // so a previous ban's reason doesn't leak into the next timeout dialog.
  useEffect(() => {
    if (action) {
      setDurationInput(DEFAULT_TIMEOUT_MINUTES);
      setReason("");
    }
  }, [action]);

  if (!action) return null;

  const isTimeout = action.kind === "timeout";
  const parsedDuration = Number.parseInt(durationInput, 10);
  const durationValid =
    !isTimeout || (Number.isFinite(parsedDuration) && parsedDuration >= 1);
  const canSubmit = durationValid && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const trimmedReason = reason.trim();
    onSubmit({
      durationMinutes: isTimeout ? parsedDuration : undefined,
      reason: trimmedReason.length > 0 ? trimmedReason : undefined,
    });
  };

  const title = isTimeout ? `Timeout ${action.username}` : `Ban ${action.username}`;
  const description = isTimeout
    ? "The user will be unable to post or interact in this home instance for the duration you set."
    : "The user will be removed from this home instance. They can be unbanned later from the control panel.";
  const confirmLabel = isTimeout ? "Timeout user" : "Ban user";

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      description={description}
      widthClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isTimeout && (
          <div>
            <label
              htmlFor="moderation-duration"
              className="mb-1 block text-sm font-medium text-[var(--color-text)]"
            >
              Duration (minutes)
            </label>
            <input
              id="moderation-duration"
              type="number"
              min={1}
              step={1}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            {!durationValid && (
              <p className="mt-1 text-xs text-[var(--color-error,#ef4444)]">
                Enter a whole number of minutes (1 or more).
              </p>
            )}
          </div>
        )}

        <div>
          <label
            htmlFor="moderation-reason"
            className="mb-1 block text-sm font-medium text-[var(--color-text)]"
          >
            Reason{" "}
            <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="moderation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            placeholder={
              isTimeout
                ? "Why is this user being timed out? Visible in audit logs."
                : "Why is this user being banned? Visible in audit logs."
            }
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            autoFocus={!isTimeout}
          />
        </div>
      </div>
    </Modal>
  );
}
