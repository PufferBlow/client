import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign, Check, Copy, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { AuthField, PasswordField, Switch } from "../../components/auth/AuthFields";
import { FeedbackLine, SettingsCard } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "@pufferblow/spines";
import { Avatar } from "../../components/dashboard/Avatar";
import { copyToClipboard } from "../../lib/clipboard";
import { playSound, setSoundsEnabled, soundsEnabled } from "../../features/sounds/sounds";
import { listPeople, removeAccount, saveActiveAccount, switchAccount, type Account } from "../../services/accounts";
import { getActiveAccountId } from "../../services/auth";
import { changePassword, updateUsername } from "../../features/users/api";
import { userKeys } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_PATTERN, USERNAME_RULE } from "../../utils/authErrors";

function UsernameCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(profile.username);
  const [error, setError] = useState<string>();
  const { run, loading, feedback } = useSave("Username updated.");

  const unchanged = username.trim() === profile.username;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = username.trim();
    if (!USERNAME_PATTERN.test(next)) {
      setError(USERNAME_RULE);
      return;
    }
    setError(undefined);
    const ok = await run(() => updateUsername(next));
    if (ok) await queryClient.invalidateQueries({ queryKey: userKeys.profile });
  };

  return (
    <SettingsCard title="Username" description={`Your handle on this instance is @${profile.username}@${profile.origin_server}.`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthField
          onCard
          label="Username"
          icon={<AtSign size={16} aria-hidden="true" />}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
          error={error}
        />
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} disabled={unchanged}>
            Save username
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </SettingsCard>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const { run, loading, feedback } = useSave("Password updated.");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password.";
    if (next.length < PASSWORD_MIN) found.next = `Use at least ${PASSWORD_MIN} characters.`;
    else if (next.length > PASSWORD_MAX) found.next = `Use at most ${PASSWORD_MAX} characters.`;
    if (confirm !== next) found.confirm = "Passwords don't match.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const ok = await run(() => changePassword(current, next));
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  };

  return (
    <SettingsCard title="Password" description="Choose a strong password you don't use anywhere else.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <PasswordField
          onCard
          label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          error={errors.current}
        />
        <PasswordField
          onCard
          label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          error={errors.next}
        />
        <PasswordField
          onCard
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={errors.confirm}
        />
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading}>
            Change password
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </SettingsCard>
  );
}

/** One line of the account overview: a label, the value, and optionally a button to copy it. */
function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 border-b border-border-secondary py-2.5 last:border-b-0">
      <span className="w-28 shrink-0 text-[13px] text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1 break-all text-[14px] text-text">{value}</span>
      {copy && (
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          title={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            if (await copyToClipboard(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="grid size-7 shrink-0 place-items-center rounded-md border-0 bg-transparent text-text-tertiary hover:bg-active hover:text-text"
        >
          {copied ? <Check size={14} className="text-success" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

/** Who this account is, in the terms other people and other instances know it by. */
function OverviewCard({ profile }: { profile: UserProfile }) {
  const since = profile.created_at ? new Date(profile.created_at) : null;
  const roles = profile.resolved_roles?.map((r) => r.role_name) ?? profile.roles_ids ?? [];
  return (
    <SettingsCard title="Your account" description="What other people, and other instances, know you by.">
      <div>
        <Row label="Handle" value={`${profile.username}@${profile.origin_server}`} copy />
        <Row label="User ID" value={profile.user_id} copy />
        <Row label="Instance" value={profile.origin_server} />
        {since && !Number.isNaN(since.getTime()) && <Row label="Member since" value={since.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })} />}
        {roles.length > 0 && (
          <div className="flex items-center gap-3 py-2.5">
            <span className="w-28 shrink-0 text-[13px] text-text-tertiary">Roles</span>
            <span className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <span key={role} className="rounded-pill bg-surface-tertiary px-2.5 py-1 text-[12px] font-semibold capitalize text-text-body">
                  {role}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/** The accounts signed in on this device, one per instance: switch, remove or add another. */
function DeviceAccountsCard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>(() => listPeople());
  const [failed, setFailed] = useState<string | null>(null);
  const activeId = getActiveAccountId();

  const choose = async (account: Account) => {
    if (!(await switchAccount(account.id))) {
      setFailed(`Couldn't open ${account.username}. Sign in again to use it.`);
      return;
    }
    window.location.assign("/dashboard");
  };

  return (
    <SettingsCard title="Accounts on this device" description="One account per instance. Switch between them from the user card in the sidebar.">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {accounts.map((account) => {
          const active = account.id === activeId;
          return (
            <li key={account.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5">
              <Avatar name={account.username} src={account.avatarUrl} seed={account.id} size={32} ringColor="var(--color-background)" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{account.username}</span>
                <span className="pb-meta truncate text-xs">{account.instance.raw}</span>
              </span>
              {active ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary">
                  <Check size={14} aria-hidden="true" />
                  Signed in
                </span>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => void choose(account)}>
                    Switch
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remove ${account.username} from this device`}
                    onClick={async () => {
                      await removeAccount(account.id);
                      setAccounts(listPeople());
                    }}
                    className="grid size-7 place-items-center rounded-md border-0 bg-transparent text-text-muted hover:bg-active hover:text-text"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {failed && <p className="pb-error m-0">{failed}</p>}
      <div>
        <Button
          variant="secondary"
          onClick={() => {
            saveActiveAccount();
            navigate("/login?add=1");
          }}
        >
          <Plus size={15} aria-hidden="true" />
          Add an account on another instance
        </Button>
      </div>
    </SettingsCard>
  );
}

function SoundsCard() {
  const [on, setOn] = useState(soundsEnabled);
  return (
    <SettingsCard title="Sounds" description="Calls ringing, answered and ended, joining and leaving a voice channel, and being pinged.">
      <Switch
        checked={on}
        onChange={(next) => {
          setSoundsEnabled(next);
          setOn(next);
          if (next) playSound("ping");
        }}
      >
        Play sounds
      </Switch>
    </SettingsCard>
  );
}

export function AccountSection({ profile }: { profile: UserProfile }) {
  return (
    <>
      <OverviewCard profile={profile} />
      <DeviceAccountsCard />
      <SoundsCard />
      <UsernameCard profile={profile} />
      <PasswordCard />
    </>
  );
}
