import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  icon: ReactNode;
  error?: string;
  hint?: string;
  /** Rendered at the right edge of the label row (e.g. a link). */
  labelAside?: ReactNode;
  /** Rendered inside the input frame, after the value. */
  trailing?: ReactNode;
}

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, icon, error, hint, labelAside, trailing, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-[7px]">
        <div className="flex items-baseline justify-between text-[13px] text-text-tertiary">
          <label htmlFor={inputId}>{label}</label>
          {labelAside}
        </div>
        <div
          className={[
            "flex h-12 items-center gap-2.5 rounded-xl border bg-surface-secondary pl-3.5 pr-2 text-[15px] text-text-tertiary transition-shadow",
            error
              ? "border-error/70 focus-within:ring-4 focus-within:ring-error/15"
              : "border-border-secondary focus-within:border-primary/55 focus-within:ring-4 focus-within:ring-primary/10",
          ].join(" ")}
        >
          {icon}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-muted"
            {...props}
          />
          {trailing}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle size={12} aria-hidden="true" />
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
AuthField.displayName = "AuthField";

type PasswordFieldProps = Omit<FieldProps, "icon" | "trailing" | "type">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      icon={<Lock size={16} aria-hidden="true" />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="grid h-8 w-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-hover hover:text-text"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
});
PasswordField.displayName = "PasswordField";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

export function Switch({ checked, onChange, children }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left text-sm text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      <span
        className={[
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-tertiary",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-on-primary transition-[left]",
            checked ? "left-[18px]" : "left-0.5 bg-text-muted",
          ].join(" ")}
        />
      </span>
      {children}
    </button>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-error/35 bg-error/10 px-3.5 py-3 text-sm text-text"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
