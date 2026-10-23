import { Select } from "../ui/Select";
import { useState, type FormEvent } from "react";
import type { Message } from "../../features/messages/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const preview = (message: Message) => (message.text.trim() || (message.attachments.length > 0 ? "[attachment]" : "")).slice(0, 140);

function MessagePreview({ message }: { message: Message }) {
  return (
    <blockquote className="m-0 mb-1 rounded-lg border-l-2 border-border bg-background/50 px-3 py-2 text-[13px] text-text-secondary">
      <span className="font-semibold text-text">{message.authorName}</span>
      <span className="block break-words">{preview(message)}</span>
    </blockquote>
  );
}

interface DeleteProps {
  message: Message;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Deleting is permanent, so it always asks first. */
export function DeleteMessageDialog({ message, busy, error, onConfirm, onClose }: DeleteProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Delete message?"
      description="This removes it for everyone and can't be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <MessagePreview message={message} />
      {error && (
        <p role="alert" className="m-0 mt-2 text-[13px] text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

export const REPORT_CATEGORIES = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "other", label: "Something else" },
] as const;

interface ReportProps {
  message: Message;
  busy: boolean;
  error?: string;
  onSubmit: (category: string, description: string) => void;
  onClose: () => void;
}

export function ReportMessageDialog({ message, busy, error, onSubmit, onClose }: ReportProps) {
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0].value);
  const [description, setDescription] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(category, description.trim());
  };

  return (
    <Modal isOpen onClose={onClose} title="Report message" description="Moderators will review it. The author isn't told who reported them.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <MessagePreview message={message} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-secondary">Reason</span>
          <Select label="Reason" className="h-10! w-full text-sm!" value={category} onChange={setCategory} options={REPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-secondary">Details (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="resize-none rounded-xl border border-border bg-surface-secondary px-3 py-2 text-sm text-text outline-none focus:border-primary/60"
          />
        </label>
        {error && (
          <p role="alert" className="m-0 text-[13px] text-error">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
