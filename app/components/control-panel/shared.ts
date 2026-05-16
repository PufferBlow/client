/**
 * shared — class string constants, the `cx` helper, and number formatters used
 * across every control-panel tab. No JSX, no React.
 */

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const controlPanelSectionClass =
  "rounded-[1.5rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface)] p-6 shadow-sm";
export const controlPanelInsetClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
export const controlPanelQuietClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_72%,var(--color-background)_28%)] p-5";
export const controlPanelCardClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4";
export const controlPanelMetricClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
export const controlPanelChartCardClass =
  "rounded-[1.25rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-5";
export const controlPanelRowClass =
  "rounded-[1rem] border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-4 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]";
export const controlPanelInputClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";
export const controlPanelTextAreaClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";
export const controlPanelSelectClass =
  "w-full rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-4 py-2.5 text-[var(--color-text)] transition-colors focus:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";

export const controlPanelButtonClass = (variant: "primary" | "secondary" | "ghost" | "danger" = "secondary") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-colors",
    variant === "primary" &&
      "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]",
    variant === "secondary" &&
      "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)]",
    variant === "ghost" &&
      "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
    variant === "danger" &&
      "border-[color:color-mix(in_srgb,var(--color-error)_32%,var(--color-border-secondary))] bg-[color:color-mix(in_srgb,var(--color-error)_10%,var(--color-surface-secondary))] text-[var(--color-text)] hover:bg-[color:color-mix(in_srgb,var(--color-error)_16%,var(--color-surface-secondary))]",
  );

export const controlPanelSegmentClass = (active: boolean) =>
  cx(
    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
      : "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
  );

export const controlPanelBadgeClass = (tone: "neutral" | "success" | "warning" | "info" | "danger" = "neutral") =>
  cx(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]",
    tone === "neutral" &&
      "border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
    tone === "success" && "pb-status-success",
    tone === "warning" && "pb-status-warning",
    tone === "info" && "pb-status-info",
    tone === "danger" && "pb-status-danger",
  );

export const formatCompactNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
