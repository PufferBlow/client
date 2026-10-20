import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { PasswordField } from "../../components/auth/AuthFields";
import { FeedbackLine, SettingsCard } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { signOutActiveAccount } from "../../services/accounts";
import { isSessionRemembered } from "../../services/auth";
import { resetSessionTokens } from "../../features/users/api";

function ResetTokensCard() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const { run, loading, feedback } = useSave("Session tokens reset. Other devices were signed out.");

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

export function SecuritySection() {
  return (
    <>
      <ResetTokensCard />
      <SignOutCard />
    </>
  );
}
