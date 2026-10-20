import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, AtSign } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { AuthField, Notice, PasswordField, Switch } from "../../components/auth/AuthFields";
import { login } from "../../services/auth";
import { setStoredInstance } from "../../services/instance";
import { classifyAuthError } from "../../utils/authErrors";
import { resolveHandle } from "../../utils/authForm";
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

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

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
      setStoredInstance(target.instance);
      await login({ username: target.username, password, instance: target.instance, remember });
      navigate(resolvePostAuthRedirect(redirect), { replace: true });
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
          Welcome back
        </div>
        <h1 className="mt-2 font-display text-[34px] font-normal leading-[1.1] tracking-normal sm:text-[38px]">
          Sign in to your instance
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
          {loading ? "Signing in" : "Sign in"}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </Button>
      </form>

      <p className="mt-auto pt-6 text-center text-[13px] text-text-tertiary">
        New here?{" "}
        <Link to={buildSiblingAuthLink("/signup", redirect)} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
