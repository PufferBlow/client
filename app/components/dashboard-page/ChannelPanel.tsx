import type { ReactNode } from "react";

export function ChannelPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-[16rem] max-w-[22rem] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:w-80 w-72">
      {children}
    </div>
  );
}
