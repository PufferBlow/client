/**
 * SecurityTab — Settings page > Security pane. Three concerns:
 *
 *   1. Change Password — controlled form for current/new/confirm, owned
 *      by the SettingsPage shell because the success path triggers a
 *      shell-level toast.
 *   2. Reset Authentication Token — opens a confirmation modal that
 *      lives at the SettingsPage level (it shares state with other
 *      destructive flows there).
 *   3. Sign Out — fires the logout mutation and redirects.
 *
 * All controlled state and handlers are passed in as props; this tab
 * is intentionally dumb so the parent owns the lifecycle.
 */
import { Button } from "../../Button";

interface SecurityTabProps {
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  onUpdatePassword: () => void;
  isUpdatingPassword: boolean;
  onOpenResetTokenModal: () => void;
  onSignOut: () => void;
}

export function SecurityTab({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onUpdatePassword,
  isUpdatingPassword,
  onOpenResetTokenModal,
  onSignOut,
}: SecurityTabProps) {
  const inputClass =
    "mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm";

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
          Security Settings
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)]">Change Password</h4>
            <div className="mt-2 space-y-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Current password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  New password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <Button
                type="button"
                onClick={onUpdatePassword}
                disabled={isUpdatingPassword}
                loading={isUpdatingPassword}
                variant="primary"
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-6">
            <h4 className="text-sm font-medium text-[var(--color-text)]">
              Authentication Token
            </h4>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Resetting your authentication token will log you out
            </p>
            <div className="mt-3">
              <Button type="button" onClick={onOpenResetTokenModal} variant="danger">
                Reset Auth Token
              </Button>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-6">
            <h4 className="text-sm font-medium text-[var(--color-text)]">Sign Out</h4>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Sign out of your account
            </p>
            <div className="mt-3">
              <Button type="button" onClick={onSignOut} variant="danger">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
