type SettingsHeaderProps = {
  title: string;
};

/**
 * Settings page header — just the tab title now.
 *
 * The header used to also surface success / error feedback via an
 * inline `Notice` banner pinned to the right. That created two
 * separate feedback surfaces (inline banner here + global toast
 * elsewhere) and meant settings confirmations didn't follow the
 * rest of the app's "bottom-right toast" convention. The inline
 * Notice was deleted and `setMessage` in SettingsPage now bridges
 * to the toast system, so all feedback lands in the same place.
 */
export function SettingsHeader({ title }: SettingsHeaderProps) {
  return (
    <div className="flex h-12 flex-shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-base font-semibold text-[var(--color-text)]">{title}</h1>
      </div>
    </div>
  );
}
