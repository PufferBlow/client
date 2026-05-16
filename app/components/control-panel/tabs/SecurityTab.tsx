/**
 * SecurityTab — placeholder UI for instance-level security toggles
 * (content moderation, spam protection, IP logging, 2FA).
 */

// Security Tab Component
export function SecurityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Security Settings</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Content Moderation</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Automatically filter inappropriate content</div>
            </div>
            <button className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-[var(--color-on-success)] transition-colors hover:opacity-90">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Spam Protection</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Prevent spam messages and raids</div>
            </div>
            <button className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-[var(--color-on-success)] transition-colors hover:opacity-90">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">IP Logging</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Log IP addresses for security monitoring</div>
            </div>
            <button className="rounded-lg bg-[var(--color-error)] px-4 py-2 text-[var(--color-on-error)] transition-colors hover:opacity-90">
              Disable
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <div>
              <div className="font-medium text-[var(--color-text)]">Two-Factor Authentication</div>
              <div className="text-[var(--color-text-secondary)] text-sm">Require 2FA for all administrators</div>
            </div>
            <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors">
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
