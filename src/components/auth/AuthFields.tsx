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
        {/* A raised field; focus is a 2px white ring offset by 2, an error a 1px inset line in the danger colour. */}
        <div
          className={[
            "flex h-11 items-center gap-2.5 rounded-md bg-surface-secondary pl-3.5 pr-2 text-[15px] text-text-tertiary transition-shadow duration-(--motion-fast)",
            error
              ? "shadow-[inset_0_0_0_1px_var(--color-error)] focus-within:shadow-[inset_0_0_0_1px_var(--color-error),0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]"
              : "focus-within:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-text)]",
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
          <p id={`${inputId}-error`} className="pb-error flex items-center gap-1.5">
            <AlertCircle size={12} aria-hidden="true" />
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="pb-meta">
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
          className="grid h-8 w-8 place-items-center rounded-sm text-text-tertiary transition-colors hover:bg-hover hover:text-text"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
});
PasswordField.displayName = "PasswordField";

/** The small badge inside a field that says whether the instance in the handle answered. */
export function FoundBadge({ state }: { state: "checking" | "found" | "missing" }) {
  if (state === "checking") return <span className="pb-meta px-2 text-xs">Checking…</span>;
  return state === "found" ? (
    <span className="inline-flex items-center gap-1 rounded-sm bg-success/14 px-2 py-[5px] text-xs font-semibold text-success">Found</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-sm bg-error/14 px-2 py-[5px] text-xs font-semibold text-error-text">Not found</span>
  );
}

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
      <span className={["relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-surface-tertiary"].join(" ")}>
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full transition-[left,transform] duration-(--motion-base) ease-(--motion-ease-out)",
            checked ? "left-[18px] bg-on-primary" : "left-0.5 bg-text-muted",
          ].join(" ")}
        />
      </span>
      {children}
    </button>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-md bg-error/10 px-3.5 py-3 text-sm text-text shadow-[inset_0_0_0_1px_rgba(226,101,79,0.35)]">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
