import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./ui/Modal";

interface MessageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: { category: string; description: string }) => void;
  messageCount?: number;
  entityLabel?: string;
  title?: string;
  description?: string;
}

const REPORT_CATEGORIES = [
  "Nudity or Sexual Content",
  "Racist or Discriminatory",
  "Spam or Solicitation",
  "Harassment or Bullying",
  "Violent or Threatening",
  "Hate Speech",
  "Misinformation",
  "Child Exploitation",
  "Illegal Activity",
  "Spam or Scams",
  "Copyright Infringement",
  "Other",
];

export function MessageReportModal({
  isOpen,
  onClose,
  onSubmit,
  messageCount = 1,
  entityLabel = "message",
  title,
  description: modalDescription = "Help keep the server safe by reporting policy violations.",
}: MessageReportModalProps) {
  const [step, setStep] = useState<"category" | "description">("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setStep("category");
      setSelectedCategory("");
      setReportDescription("");
    }
  }, [isOpen]);

  const submitReport = () => {
    onSubmit({ category: selectedCategory, description: reportDescription.trim() });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        title ||
        `Report ${
          messageCount === 1
            ? entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)
            : `${messageCount} ${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)}s`
        }`
      }
      description={modalDescription}
      widthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          {step === "description" ? (
            <Button variant="ghost" onClick={() => setStep("category")}>
              Back
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step === "category" ? (
            <Button onClick={() => setStep("description")} disabled={!selectedCategory}>
              Next
            </Button>
          ) : (
            <Button variant="warning" onClick={submitReport} disabled={!selectedCategory}>
              Submit Report
            </Button>
          )}
        </div>
      }
    >
      {step === "category" ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-secondary)]">Choose a report reason:</p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-2">
            {REPORT_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedCategory === category
                    ? "pb-border bg-[var(--color-active)] text-[var(--color-text)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            Category: <span className="font-medium text-[var(--color-text)]">{selectedCategory}</span>
          </div>
          <div>
            <label htmlFor="reportDescription" className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
              Additional details (optional)
            </label>
            <textarea
              id="reportDescription"
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder={`Describe why this ${entityLabel} should be reviewed.`}
              className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            />
            <p className="mt-1 text-right text-xs text-[var(--color-text-muted)]">{reportDescription.length}/500</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

