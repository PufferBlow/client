import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./ui/Modal";

interface ChannelCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (channelData: {
    name: string;
    type: "text" | "voice";
    description?: string;
    isPrivate?: boolean;
  }) => void;
}

export function ChannelCreationModal({ isOpen, onClose, onCreateChannel }: ChannelCreationModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const resetForm = () => {
    setName("");
    setType("text");
    setDescription("");
    setIsPrivate(false);
  };

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!name.trim()) {
      return;
    }

    onCreateChannel({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      isPrivate,
    });
    resetForm();
    onClose();
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>Create Channel</Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Channel"
      description="Configure a new text or voice channel."
      widthClassName="max-w-lg"
      footer={footer}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          id="channelName"
          label="Channel Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="new-channel"
          required
        />

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Channel Type</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("text")}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                type === "text"
                  ? "pb-border bg-[var(--color-active)] text-[var(--color-text)]"
                  : "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setType("voice")}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                type === "voice"
                  ? "pb-border bg-[var(--color-active)] text-[var(--color-text)]"
                  : "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
              }`}
            >
              Voice
            </button>
          </div>
        </div>

        {type === "text" ? (
          <div>
            <label htmlFor="channelDescription" className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
              Description (optional)
            </label>
            <textarea
              id="channelDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              placeholder="How should members use this channel?"
            />
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-3">
          <input
            id="private-channel"
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium text-[var(--color-text)]">Private Channel</div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Only invited members can view and interact in this channel.
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
}
