import type { ReactNode } from "react";

export function MessagePane({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {children}
    </div>
  );
}
