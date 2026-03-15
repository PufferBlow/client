import type { ControlPanelTab } from "./types";

type ControlPanelHeaderProps = {
  activeLabel: string;
};

export function ControlPanelHeader({ activeLabel }: ControlPanelHeaderProps) {
  return (
    <div className="flex h-12 flex-shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-base font-semibold text-[var(--color-text)]">{activeLabel}</h1>
      </div>
      <div className="ml-auto">
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
          Host
        </span>
      </div>
    </div>
  );
}
