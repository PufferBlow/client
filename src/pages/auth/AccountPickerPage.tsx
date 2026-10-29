import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, KeyRound, Lock, Plus, X } from "lucide-react";
import { BrandLockup, Button, defaultAvatarUrl } from "@pufferblow/spines";
import { previewAssetUrl } from "../../features/instance/preview";
import { listPeople, removeAccount, switchAccount, type Account } from "../../services/accounts";
import { login } from "../../services/auth";
import { classifyAuthError } from "../../utils/authErrors";
import { resolvePostAuthRedirect } from "../../utils/authRedirect";

function avatarOf(account: Account): string {
  return previewAssetUrl(account.instance, account.avatarUrl) ?? defaultAvatarUrl(account.id);
}

/**
 * "Who's playing?": the accounts saved on this device, one per instance. An account whose session is
 * still good opens with one click; one that has signed out asks for its password, on its own instance.
 * Saved accounts stay on this device, and each signs in only to the instance it belongs to.
 */
export function AccountPickerPage() {
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const [accounts, setAccounts] = useState<Account[]>(() => listPeople());
  const [chosen, setChosen] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = accounts.find((a) => a.id === chosen);
  const enter = () => window.location.assign(resolvePostAuthRedirect(redirect));

  const pick = async (account: Account) => {
    if (managing) return;
    setError(null);
    setPassword("");
    if (account.snapshot && (await switchAccount(account.id))) {
      enter();
      return;
    }
    setChosen(account.id); // signed out: it needs its password
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login({ username: selected.username, password, instance: selected.instance, remember: true });
      enter();
    } catch (err) {
      setError(classifyAuthError(err, "Sign in failed. Please try again.").message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (account: Account) => {
    await removeAccount(account.id);
    setAccounts(listPeople());
    if (chosen === account.id) setChosen(null);
  };

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-[radial-gradient(80%_70%_at_50%_0%,#222222_0%,#121212_60%,#0a0a0a_100%)] px-10 py-7 text-text">
      <header className="flex w-full items-center justify-between">
        <BrandLockup size={32} />
        {accounts.length > 0 && (
          <button type="button" aria-pressed={managing} onClick={() => setManaging((m) => !m)} className="text-[13px] text-text-tertiary hover:text-text">
            {managing ? "Done" : "Manage accounts"}
          </button>
        )}
      </header>

      <p className="pb-section-label mt-14 text-text">Choose an account</p>
      <h1 className="pb-display mb-10 mt-3 text-5xl">Who&apos;s playing?</h1>

      <ul className="m-0 flex list-none flex-wrap justify-center gap-5 p-0">
        {accounts.map((account) => {
          const active = chosen === account.id;
          const needsPassword = !account.snapshot;
          return (
            <li key={account.id} className="relative">
              <button
                type="button"
                onClick={() => void pick(account)}
                aria-pressed={active}
                aria-label={`${account.username} on ${account.instance.raw}${needsPassword ? ", signed out" : ""}`}
                className={`flex w-[196px] cursor-pointer flex-col items-center gap-3 rounded-[20px] border px-4 pb-[18px] pt-6 transition-colors duration-(--motion-fast) hover:bg-surface-secondary ${
                  active ? "border-border bg-surface-secondary" : "border-transparent bg-surface"
                }`}
              >
                <span className="relative grid size-[104px] place-items-center rounded-full" style={active ? { boxShadow: "0 0 0 3px var(--color-surface-secondary), 0 0 0 5px var(--color-text)" } : undefined}>
                  <img src={avatarOf(account)} alt="" draggable={false} className="size-[104px] rounded-full object-cover" />
                  {needsPassword && (
                    <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-surface-tertiary text-text-tertiary shadow-[0_0_0_3px_var(--color-surface)]">
                      <Lock size={13} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="text-center leading-snug">
                  <span className="block truncate font-heading text-[19px] font-semibold">{account.username}</span>
                  <span className="pb-meta block truncate text-xs text-text-tertiary">{account.instance.raw}</span>
                </span>
              </button>
              {managing && (
                <button
                  type="button"
                  aria-label={`Remove ${account.username} from this device`}
                  onClick={() => void remove(account)}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-surface-tertiary text-text-body hover:bg-active"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
        <li>
          <Link
            to="/login?add=1"
            className="flex h-full w-[196px] flex-col items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-border px-4 pb-[18px] pt-6 text-text-tertiary no-underline transition-colors hover:bg-surface"
          >
            <span className="grid size-[104px] place-items-center rounded-full bg-surface">
              <Plus size={30} aria-hidden="true" />
            </span>
            <span className="text-center leading-snug">
              <span className="block font-heading text-[19px] font-semibold text-text">Add account</span>
              <span className="text-xs">Any instance</span>
            </span>
          </Link>
        </li>
      </ul>

      {selected && (
        <form onSubmit={submit} className="mt-9 flex w-[560px] max-w-full flex-col gap-2 rounded-xl bg-surface p-[18px]" aria-label={`Sign in as ${selected.username}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 flex-1 items-center gap-2.5 rounded-md bg-surface-secondary px-3.5 text-text-tertiary shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]">
              <Lock size={16} aria-hidden="true" />
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Password for ${selected.instance.raw}`}
                aria-label={`Password for ${selected.instance.raw}`}
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
              />
            </div>
            <Button type="submit" loading={busy}>
              Enter
              {!busy && <ArrowRight size={15} aria-hidden="true" />}
            </Button>
            <Button type="button" variant="secondary" disabled title="Passkeys are not available on this instance yet" aria-label="Use a passkey">
              <KeyRound size={18} aria-hidden="true" />
            </Button>
          </div>
          {error && (
            <p role="alert" className="pb-error m-0 px-1">
              {error}
            </p>
          )}
        </form>
      )}

      <p className="pb-meta mt-auto pt-8 text-[12.5px]">Saved accounts stay on this device. Each one signs in on its own instance.</p>
    </div>
  );
}
