import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./ui/Modal";

interface ServerCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (serverData: { name: string; description: string; isPrivate: boolean }) => void;
}

export function ServerCreationModal({ isOpen, onClose, onCreateServer }: ServerCreationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsPrivate(false);
  };

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) {
      return;
    }

    onCreateServer({
      name: name.trim(),
      description: description.trim(),
      isPrivate,
    });
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Server"
      description="Set up a decentralized server space for your community."
      widthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Server</Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          id="serverName"
          label="Server Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My Community"
          required
        />

        <div>
          <label htmlFor="serverDescription" className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
            Description
          </label>
          <textarea
            id="serverDescription"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            placeholder="What is this server about?"
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-3">
          <input
            id="private-server"
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium text-[var(--color-text)]">Private Server</div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Only invited users can discover and join this server.
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
}

