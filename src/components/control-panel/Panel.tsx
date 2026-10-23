import type { ReactNode } from "react";

/** A titled card, the basic building block of every control panel screen. */
export function Panel({
  title,
  description,
  action,
  children,
  flush = false,
  grow = false,
}: {
  title: string;
  description?: string;
  /** Rendered at the right edge of the header (a button or link). */
  action?: ReactNode;
  children: ReactNode;
  /** Drop the body padding, e.g. for a table that should run edge to edge. */
  flush?: boolean;
  /** Take the height the page has left, so the screen reaches the bottom of the window. */
  grow?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-lg bg-background-secondary ${grow ? "flex flex-1 flex-col" : ""}`}>
      <header className="flex items-start justify-between gap-4 px-5 pb-0 pt-5">
        <div className="min-w-0">
          <h2 className="pb-title m-0 text-xl">{title}</h2>
          {description && <p className="m-0 mt-1 text-[13px] text-text-tertiary">{description}</p>}
        </div>
        {action}
      </header>
      <div className={`${flush ? "mt-4" : "p-5 pt-4"} ${grow ? "flex-1" : ""}`}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-[14px] border border-border-secondary bg-surface-secondary p-4">
      <div className="font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="mt-2 font-display text-[32px] leading-none">{value}</div>
      {hint && <div className="mt-2 text-xs text-text-tertiary">{hint}</div>}
    </div>
  );
}

/** Small pill for types and states in tables. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brass" | "green" | "red" }) {
  const tones = {
    neutral: "bg-text/5 text-text-tertiary",
    brass: "bg-warning/15 text-warning",
    green: "bg-success/15 text-success",
    red: "bg-error/15 text-error",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[10.5px] font-semibold uppercase tracking-[0.1em] ${tones[tone]}`}>
      {children}
    </span>
  );
}
