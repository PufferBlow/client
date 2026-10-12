import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign } from "lucide-react";
import { AuthField, PasswordField } from "../../components/auth/AuthFields";
import { FeedbackLine, SettingsCard } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
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
          label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          error={errors.current}
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          error={errors.next}
        />
        <PasswordField
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

export function AccountSection({ profile }: { profile: UserProfile }) {
  return (
    <>
      <UsernameCard profile={profile} />
      <PasswordCard />
    </>
  );
}
