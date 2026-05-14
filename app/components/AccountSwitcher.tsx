import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import {
  forgetAccount,
  getActiveAccountId,
  listAccounts,
  setActiveAccountId,
  touchAccount,
  type SavedAccount,
} from "../services/accounts";
import {
  setAuthTokenInStorage,
  setHostPortToStorage,
} from "../services/user";
import { logger } from "../utils/logger";

interface AccountSwitcherProps {
  className?: string;
  /**
   * Snapshot of the currently-signed-in user so the trigger row stays in sync
   * even before `rememberAccount` runs for a fresh login. Username is the
   * primary display string; the avatar URL is optional.
   */
  currentDisplay?: {
    username?: string;
    avatarUrl?: string | null;
    hostPort?: string;
  };
}

/**
 * Dropdown row that lets the user pick between every account they've signed
 * into across instances. The active account drives the API client; switching
 * just rewrites the cached host_port + auth_token and reloads the dashboard.
 *
 * "Add another account" routes to `/login` — the existing flow already calls
 * `rememberAccount` on success via the dashboard's hook, so the new identity
 * is captured automatically.
 */
export function AccountSwitcher({ className = "", currentDisplay }: AccountSwitcherProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const refresh = () => {
    setAccounts(listAccounts());
    setActiveId(getActiveAccountId());
  };

  // Reload from storage on mount and whenever the dropdown opens so newly
  // remembered accounts appear without a page reload.
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const activeAccount = accounts.find((account) => account.id === activeId) ?? null;
  const triggerName =
    activeAccount?.username || currentDisplay?.username || "Signed in";
  const triggerInstance = activeAccount?.hostPort || currentDisplay?.hostPort || "";

  const handleSwitch = async (account: SavedAccount) => {
    if (account.id === activeId || switching) return;
    setSwitching(true);
    try {
      // Mirror the rest of the codebase: persist as "remember me" (localStorage)
      // so a switched account survives across desktop / web sessions.
      await setHostPortToStorage(account.hostPort, true);
      await setAuthTokenInStorage(account.authToken);
      setActiveAccountId(account.id);
      touchAccount(account.id);
      logger.ui.info("Switched account", { accountId: account.id });
      // Hard reload so every cached fetch / WebSocket / store is rebuilt
      // against the new identity. Mirrors what logging out + back in does.
      if (typeof window !== "undefined") {
        window.location.assign("/dashboard");
      }
    } catch (error) {
      logger.ui.error("Failed to switch account", {
        error: error instanceof Error ? error.message : String(error),
      });
      setSwitching(false);
    }
  };

  const handleForget = (event: React.MouseEvent, account: SavedAccount) => {
    event.stopPropagation();
    forgetAccount(account.id);
    refresh();
  };

  const handleAddAccount = () => {
    setOpen(false);
    navigate("/login");
  };

  // Hide the switcher entirely when there are no remembered accounts AND no
  // active session — there's nothing for the user to switch between yet.
  if (accounts.length === 0 && !currentDisplay?.username) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pb-transition pb-focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-left hover:bg-[var(--color-hover)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--color-text)]">
            {triggerName}
          </div>
          {triggerInstance ? (
            <div className="truncate text-xs text-[var(--color-text-secondary)]">
              {triggerInstance}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={`pb-transition-fast h-4 w-4 shrink-0 text-[var(--color-text-secondary)] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="pb-popover absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden"
        >
          <ul className="max-h-64 overflow-y-auto py-1">
            {accounts.map((account) => {
              const isActive = account.id === activeId;
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => handleSwitch(account)}
                    disabled={switching}
                    className={`pb-transition-fast flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      isActive
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{account.username}</div>
                      <div className="truncate text-xs text-[var(--color-text-secondary)]">
                        {account.hostPort}
                      </div>
                    </div>
                    {!isActive ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => handleForget(event, account)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleForget(event as unknown as React.MouseEvent, account);
                          }
                        }}
                        className="pb-transition-fast rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)]"
                        aria-label={`Forget ${account.username} on ${account.hostPort}`}
                        title={`Forget ${account.username}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={handleAddAccount}
            className="pb-transition-fast flex w-full items-center gap-2 border-t border-[var(--color-border-secondary)] px-3 py-2 text-left text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-hover)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another account
          </button>
        </div>
      ) : null}
    </div>
  );
}
