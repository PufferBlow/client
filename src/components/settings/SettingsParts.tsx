import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-border-secondary bg-surface-secondary p-5">
      <h2 className="m-0 font-heading text-lg font-semibold">{title}</h2>
      {description && <p className="m-0 mt-1 text-[13px] text-text-tertiary">{description}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export type Feedback = { kind: "success" | "error"; message: string } | null;

export function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const success = feedback.kind === "success";
  const Icon = success ? Check : AlertCircle;
  return (
    <p
      role={success ? "status" : "alert"}
      className={`m-0 flex items-center gap-1.5 text-[13px] ${success ? "text-success" : "text-error"}`}
    >
      <Icon size={14} aria-hidden="true" />
      {feedback.message}
    </p>
  );
}

/** Bare label + textarea styled to match AuthField. */
export function TextArea({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-[7px] text-[13px] text-text-tertiary">
      <span className="flex justify-between">
        {label}
        <span className="text-text-muted">
          {value.length}/{maxLength}
        </span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={4}
        className="resize-y rounded-xl border border-border-secondary bg-background px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-muted focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}
