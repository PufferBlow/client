import { useState, type FormEvent } from "react";
import { useEffect } from "react";
import { useAuthArt } from "../../layouts/authLayoutContext";
import { useHandleInstance } from "../../features/instance/useHandleInstance";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../services/api";
import { ArrowRight, AtSign } from "lucide-react";
import { Button } from "@pufferblow/spines";
import { AuthField, FoundBadge, Notice, PasswordField, Switch } from "../../components/auth/AuthFields";
import { signup } from "../../services/auth";
import { Clock, KeyRound, MessageSquare } from "lucide-react";
import {
  classifyAuthError,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_PATTERN,
  USERNAME_RULE,
} from "../../utils/authErrors";
import { resolveHandle } from "../../utils/authForm";
import { buildSiblingAuthLink, resolvePostAuthRedirect } from "../../utils/authRedirect";

interface FormErrors {
  code?: string;
  handle?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const adding = params.has("add");

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const { instance: pointedAt, preview, probe } = useHandleInstance(handle);
  const setArt = useAuthArt();
  useEffect(() => setArt({ instance: pointedAt, info: preview }), [setArt, pointedAt, preview]);
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  // What the server asks of a newcomer, once it has answered about itself.
  const joinMode = preview?.join_mode ?? "open";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const target = resolveHandle(handle);
    const next: FormErrors = {};
    if (!target.ok) next.handle = target.error;
    else if (!USERNAME_PATTERN.test(target.username)) next.handle = USERNAME_RULE;

    if (password.length < PASSWORD_MIN) next.password = `Use at least ${PASSWORD_MIN} characters.`;
    else if (password.length > PASSWORD_MAX) next.password = `Use at most ${PASSWORD_MAX} characters.`;

    if (confirm !== password) next.confirm = "Passwords don't match.";
    if (joinMode === "invite" && !code.trim()) next.code = "This server is invite-only. Enter your invitation code.";

    if (!target.ok || Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const outcome = await signup({ username: target.username, password, instance: target.instance, remember, inviteCode: code, message: note });
      if ("status" in outcome) {
        setWaiting(outcome.message);
        return;
      }
      // Adding an account swaps who is signed in, so start clean rather than carry the old one's data.
      if (adding) window.location.assign(resolvePostAuthRedirect(redirect));
      else navigate(resolvePostAuthRedirect(redirect), { replace: true });
    } catch (err) {
      const info = classifyAuthError(err, "Sign up failed. Please try again.");
      if (err instanceof ApiError && (err.code === "join.invite_required" || err.code === "join.invite_invalid")) setErrors({ code: info.message });
      else if (info.field === "username" || info.field === "instance") setErrors({ handle: info.message });
      else if (info.field === "password") setErrors({ password: info.message });
      else setErrors({ form: info.message });
    } finally {
      setLoading(false);
    }
  };

  if (waiting) {
    return (
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col gap-4">
        <Clock size={28} className="text-primary" aria-hidden="true" />
        <h1 className="font-display text-[34px] font-normal leading-[1.1]">Request sent</h1>
        <p role="status" className="m-0 text-[14.5px] leading-relaxed text-text-tertiary">
          {waiting} Come back and sign in once you have been approved.
        </p>
        <Link to={buildSiblingAuthLink("/login", redirect, adding)} className="font-semibold text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col gap-[18px]">
      <div>
        <div className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Get started
        </div>
        <h1 className="mt-2 font-display text-[34px] font-normal leading-[1.1] tracking-normal sm:text-[38px]">
          Create your account
        </h1>
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
          hint="Your name, then the instance you're joining."
          trailing={probe === "idle" ? undefined : <FoundBadge state={probe} />}
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${PASSWORD_MIN} characters`}
          autoComplete="new-password"
          error={errors.password}
        />

        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={errors.confirm}
        />

        {joinMode !== "open" && (
          <AuthField
            icon={<KeyRound size={16} aria-hidden="true" />}
            label={joinMode === "invite" ? "Invitation code" : "Invitation code (optional)"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKMN"
            autoCapitalize="characters"
            spellCheck={false}
            error={errors.code}
            hint={joinMode === "invite" ? "This server is invite-only." : "With a code you are let in at once; without one a moderator approves you."}
          />
        )}
        {joinMode === "request" && !code.trim() && (
          <AuthField icon={<MessageSquare size={16} aria-hidden="true" />} label="Note for the moderators (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who you are, who sent you" hint="They see this when they decide." />
        )}

        <Switch checked={remember} onChange={setRemember}>
          Stay signed in on this device
        </Switch>

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Creating account" : "Create account"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </Button>
      </form>

      <p className="mt-auto pt-6 text-center text-[13px] text-text-tertiary">
        Already have an account?{" "}
        <Link to={buildSiblingAuthLink("/login", redirect, adding)} className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
