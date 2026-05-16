/**
 * ServerTab — Settings page > Server pane. Lets the user inspect the
 * currently-configured home instance and point the client at a new one.
 *
 * State lives in the SettingsPage shell because the new-instance string is
 * a form value with no other consumers. We accept the read-only `hostPort`
 * + the controlled `newHostPort` / setter + the submit handler as props.
 */
import { Button } from "../../Button";

interface ServerTabProps {
  hostPort: string;
  newHostPort: string;
  setNewHostPort: (value: string) => void;
  onSubmit: () => void;
}

export function ServerTab({
  hostPort,
  newHostPort,
  setNewHostPort,
  onSubmit,
}: ServerTabProps) {
  return (
    <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
        Server Settings
      </h3>
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text)]">Home Instance</h4>
          <p className="mt-1 mb-4 text-sm text-[var(--color-text-secondary)]">
            Set the instance origin the client uses for API, websocket, and media requests.
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="currentHostPort"
                className="block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Current Instance
              </label>
              <input
                type="text"
                name="currentHostPort"
                id="currentHostPort"
                value={hostPort || "No home instance configured"}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="newHostPort"
                className="block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                New Instance Address
              </label>
              <input
                type="text"
                name="newHostPort"
                id="newHostPort"
                placeholder="localhost:7575, https://pb.example, or chat.example.com"
                value={newHostPort}
                onChange={(e) => setNewHostPort(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!newHostPort.trim()}
              variant="primary"
            >
              Update Instance
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
