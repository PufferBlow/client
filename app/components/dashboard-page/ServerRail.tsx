import type { ReactNode } from "react";

export function ServerRail({ children }: { children: ReactNode }) {
  return (
    <div className="w-16 shrink-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
      {children}
    </div>
  );
}
