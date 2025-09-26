import { useState } from "react";

interface ServerCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (serverData: { name: string; description: string; isPrivate: boolean }) => void;
}

export function ServerCreationModal({ isOpen, onClose, onCreateServer }: ServerCreationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateServer({ name: name.trim(), description: description.trim(), isPrivate });
      setName("");
      setDescription("");
      setIsPrivate(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 w-full max-w-md mx-4 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Create Server</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="serverName" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Server Name
            </label>
            <input
              id="serverName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="Enter server name"
              required
            />
          </div>

          <div>
            <label htmlFor="serverDescription" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Description (optional)
            </label>
            <textarea
              id="serverDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
              placeholder="What's this server about?"
              rows={3}
            />
          </div>

          <div className="flex items-center">
            <input
              id="isPrivate"
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)] rounded"
            />
            <label htmlFor="isPrivate" className="ml-2 block text-sm text-[var(--color-text-secondary)]">
              Make this server private
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] rounded-md hover:bg-[var(--color-surface-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              Create Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
