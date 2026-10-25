import { useState, type FormEvent } from "react";
import { useEffect } from "react";
import { useAuthArt } from "../../layouts/authLayoutContext";
import { useHandleInstance } from "../../features/instance/useHandleInstance";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, AtSign, KeyRound } from "lucide-react";
import { Button } from "@pufferblow/spines";
import { AuthField, FoundBadge, Notice, PasswordField, Switch } from "../../components/auth/AuthFields";
import { login } from "../../services/auth";
import { classifyAuthError } from "../../utils/authErrors";
import { resolveHandle } from "../../utils/authForm";
import { lastAppLocation } from "../../features/navigation/lastAppLocation";
import { buildSiblingAuthLink, resolvePostAuthRedirect } from "../../utils/authRedirect";

interface FormErrors {
  handle?: string;
  password?: string;
  form?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const adding = params.has("add");

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // The art beside the form follows the instance the handle points at.
  const { instance: pointedAt, preview, probe } = useHandleInstance(handle);
  const setArt = useAuthArt();
  useEffect(() => setArt({ instance: pointedAt, info: preview }), [setArt, pointedAt, preview]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const target = resolveHandle(handle);
    const next: FormErrors = {};
    if (!target.ok) next.handle = target.error;
    if (!password) next.password = "Enter your password.";
    if (!target.ok || next.password) {
      setErrors(next);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await login({ username: target.username, password, instance: target.instance, remember });
      // Adding an account swaps who is signed in, so start clean rather than carry the old one's data.
      if (adding) window.location.assign(resolvePostAuthRedirect(redirect));
      else navigate(resolvePostAuthRedirect(redirect), { replace: true });
    } catch (err) {
      const info = classifyAuthError(err, "Sign in failed. Please try again.");
      setErrors(info.field === "instance" ? { handle: info.message } : { form: info.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col gap-[18px]">
      <div>
        <div className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {adding ? "Add an instance" : "Welcome back"}
        </div>
        <h1 className="mt-2 font-display text-[34px] font-normal leading-[1.1] tracking-normal sm:text-[38px]">
          {adding ? "Join another instance" : "Sign in to your instance"}
        </h1>
        {adding && (
          <p className="m-0 mt-3 text-[14px] leading-relaxed text-text-tertiary">
            Enter your handle on the other instance. You stay signed in here, and can switch between accounts from the user card.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        {errors.form && <Notice>{errors.form}</Notice>}

        <AuthField
          label="Handle"
          icon={<AtSign size={16} aria-hidden="true" />}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="name@chat.example.com"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          error={errors.handle}
          trailing={probe === "idle" ? undefined : <FoundBadge state={probe} />}
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
        />

        <Switch checked={remember} onChange={setRemember}>
          Stay signed in on this device
        </Switch>

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? (adding ? "Adding" : "Signing in") : adding ? "Add instance" : "Sign in"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border-secondary" />
        or
        <span className="h-px flex-1 bg-border-secondary" />
      </div>
      {/* Passkeys need the instance to support them; this stays off until it does. */}
      <Button type="button" variant="secondary" size="lg" fullWidth disabled title="Passkeys are not available on this instance yet">
        <KeyRound size={16} aria-hidden="true" />
        Use a passkey
      </Button>

      <p className="mt-auto pt-6 text-center text-[13px] text-text-tertiary">
        {adding && (
          <>
            <Link to={lastAppLocation()} className="font-semibold text-text-secondary hover:underline">
              Cancel
            </Link>
            {" · "}
          </>
        )}
        New here?{" "}
        <Link to={buildSiblingAuthLink("/signup", redirect, adding)} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
