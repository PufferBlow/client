import type { ControlPanelTab } from "./types";

type ControlPanelHeaderProps = {
  activeLabel: string;
};

export function ControlPanelHeader({ activeLabel }: ControlPanelHeaderProps) {
  // The "Host" badge already lives once in ControlPanelSidebar's top bar,
  // next to "Server Control Panel" -- it's a static, panel-wide identity
  // badge, not something that varies per page, so repeating it here next
  // to every page title was pure duplication rather than added info.
  return (
    <div className="flex h-12 flex-shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-base font-semibold text-[var(--color-text)]">{activeLabel}</h1>
      </div>
    </div>
  );
}
