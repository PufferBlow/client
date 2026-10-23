import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { listAccounts, removeAccount, saveActiveAccount, switchAccount, type Account } from "../../services/accounts";
import { getActiveAccountId } from "../../services/auth";
import { Avatar } from "./Avatar";

/** Another instance's relative avatar path only means something on that instance. */
function avatarFor(account: Account): string | null {
  if (!account.avatarUrl) return null;
  try {
    return new URL(account.avatarUrl, account.instance.origin).toString();
  } catch {
    return null;
  }
}

/**
 * The account switcher, opened from its own button in the user panel. One account per instance, so
 * you switch who you are, not just where. The button shows whatever it wraps; the menu opens above
 * the nearest positioned ancestor (the user card), not above the button.
 */
export function AccountSwitcher({ children, className }: { children: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const activeId = getActiveAccountId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setAccounts(listAccounts());
      setFailed(null);
    }
    setOpen(!open);
  };

  const choose = async (account: Account) => {
    if (account.id === activeId) {
      setOpen(false);
      return;
    }
    if (!(await switchAccount(account.id))) {
      setFailed(`Couldn't open ${account.username}. Sign in again to use it.`);
      return;
    }
    queryClient.clear();
    window.location.assign("/dashboard");
  };

  const add = () => {
    saveActiveAccount();
    setOpen(false);
    navigate("/login?add=1");
  };

  const remove = async (account: Account) => {
    await removeAccount(account.id);
    setAccounts(listAccounts());
  };

  return (
    <div ref={root} className="flex items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch account"
        onClick={toggle}
        title="Switch account"
        className={className ?? "flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"}
      >
        {children}
      </button>
      {open && (
        <div role="menu" aria-label="Accounts" className="absolute bottom-full left-0 z-40 mb-2 flex w-[300px] flex-col gap-1 rounded-lg bg-surface-tertiary p-2.5 shadow-popover">
          <p className="pb-section-label m-0 px-2 pb-1 pt-1">Accounts</p>
          {accounts.map((account) => {
            const active = account.id === activeId;
            return (
              <div key={account.id} className="group/account flex items-center rounded-sm hover:bg-surface-secondary">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => void choose(account)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-sm p-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Avatar name={account.username} src={avatarFor(account)} seed={account.id} size={36} ringColor="var(--color-surface-tertiary)" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                    <span className="truncate text-sm font-semibold">{account.username}</span>
                    <span className="pb-meta truncate text-xs">{account.instance.raw}</span>
                  </span>
                  {active && <Check size={16} aria-hidden="true" />}
                </button>
                {!active && (
                  <button
                    type="button"
                    aria-label={`Remove ${account.username} from this device`}
                    onClick={() => void remove(account)}
                    className="mr-1.5 hidden size-6 place-items-center rounded-md text-text-muted hover:bg-active hover:text-text group-focus-within/account:grid group-hover/account:grid"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          {failed && <p className="pb-error m-0 px-2 py-1">{failed}</p>}
          <button
            type="button"
            role="menuitem"
            onClick={add}
            className="flex items-center gap-3 rounded-sm p-2 text-left text-text-tertiary outline-none hover:bg-surface-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span className="grid size-9 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_rgba(242,242,242,0.25)]">
              <Plus size={16} aria-hidden="true" />
            </span>
            <span className="text-sm">Add account on another instance</span>
          </button>
        </div>
      )}
    </div>
  );
}
