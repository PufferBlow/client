import { Button, LoadingState, Modal } from "@pufferblow/spines";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, Trash2 } from "lucide-react";
import { PasswordField } from "../../components/auth/AuthFields";
import { FeedbackLine, SettingsCard } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { signOutActiveAccount } from "../../services/accounts";
import { isSessionRemembered } from "../../services/auth";
import { deleteAccount, resetSessionTokens } from "../../features/users/api";
import { useMyProfile } from "../../features/users/hooks";
import { listIdentityKeys, removeIdentityKey } from "../../features/calls/api";
import { classifyAuthError } from "../../utils/authErrors";

function ResetTokensCard() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const { run, loading, feedback } = useSave(
    "Session tokens reset. Other devices were signed out.",
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setError(undefined);
    if (await run(() => resetSessionTokens(password, isSessionRemembered()))) setPassword("");
  };

  return (
    <SettingsCard
      title="Reset session tokens"
      description="Issues new tokens for this device and signs you out everywhere else. Use this if you think someone else has access to your account."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <PasswordField
          onCard
          label="Confirm with your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={error}
        />
        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" loading={loading}>
            Reset tokens
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </SettingsCard>
  );
}

function SignOutCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const next = await signOutActiveAccount();
    // Nothing of this account may survive for whoever signs in next.
    queryClient.clear();
    // Another saved account takes over with a fresh start; otherwise it is the login page.
    if (next === "switched") window.location.assign("/dashboard");
    else navigate("/login", { replace: true });
  };

  return (
    <SettingsCard title="Sign out" description="End your session on this device.">
      <div>
        <Button variant="danger" loading={loading} onClick={handleSignOut}>
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </SettingsCard>
  );
}

/**
 * Delete your own account. Only its owner can, and they confirm with their password. The name, picture, bio, friends and
 * keys are erased; what they wrote stays in the channels, shown as "Deleted user".
 */
function DeleteAccountCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError(undefined);
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await deleteAccount(password);
    } catch (cause) {
      const info = classifyAuthError(cause, "Couldn't delete the account.");
      // Here the sign-in message would be wrong: they are signed in, it is the confirmation that failed.
      setError(info.kind === "credentials" ? "That password is incorrect." : info.message);
      setLoading(false);
      return;
    }
    // The account is gone: forget it here too, as signing out does.
    const next = await signOutActiveAccount();
    queryClient.clear();
    if (next === "switched") window.location.assign("/dashboard");
    else navigate("/login", { replace: true });
  };

  return (
    <SettingsCard
      title="Delete account"
      description="Erase your account on this server for good. What you wrote stays, shown as Deleted user. This cannot be undone."
    >
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 size={15} aria-hidden="true" />
          Delete account…
        </Button>
      </div>
      {open && (
        <Modal
          isOpen
          onClose={close}
          title="Delete your account?"
          description="Your name, picture, bio, friends and keys are erased and you are signed out everywhere. The server's owner has to hand the server over before deleting."
        >
          <form onSubmit={confirm} className="flex flex-col gap-4" noValidate>
            <PasswordField
              label="Confirm with your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={error}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={loading}>
                Delete my account
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </SettingsCard>
  );
}

/** The signing keys of the devices this account has made calls from. Remove one for a device you no longer have. */
function CallKeysCard() {
  const queryClient = useQueryClient();
  const { data: me } = useMyProfile();
  const userId = me?.user_id;
  const queryKey = ["identity-keys", userId] as const;
  const {
    data: keys,
    isPending,
    isError,
  } = useQuery({ queryKey, queryFn: () => listIdentityKeys(userId!), enabled: !!userId });
  const { run, feedback } = useSave("Key removed.");

  return (
    <SettingsCard
      title="Call keys"
      description="Each device you call from signs its calls with a key that never leaves it. People you call compare these keys to notice a stranger in between."
    >
      {isPending ? (
        <LoadingState message="Loading…" />
      ) : isError ? (
        <p className="pb-error m-0">Couldn&apos;t load your keys.</p>
      ) : keys.length === 0 ? (
        <p className="pb-meta m-0 text-[13px]">No device has made a call yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {keys.map((key) => (
            <li
              key={key.key_id}
              className="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5"
            >
              <KeyRound size={16} aria-hidden="true" className="shrink-0 text-text-tertiary" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{key.label || "This device"}</span>
                <span className="pb-meta truncate text-xs">
                  {key.key_id.slice(0, 12)} · added {new Date(key.created_at).toLocaleDateString()}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Remove key ${key.label || key.key_id.slice(0, 12)}`}
                onClick={async () => {
                  if (await run(() => removeIdentityKey(key.key_id).then(() => undefined)))
                    await queryClient.invalidateQueries({ queryKey });
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FeedbackLine feedback={feedback} />
    </SettingsCard>
  );
}

export function SecuritySection() {
  return (
    <>
      <CallKeysCard />
      <ResetTokensCard />
      <SignOutCard />
      <DeleteAccountCard />
    </>
  );
}
