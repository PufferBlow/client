/**
 * AppearanceTab — Settings page > Appearance pane.
 *
 * Reworked from the previous 670-line scroller that crammed:
 *   - 26 colour pickers split across 6 H4-banner sections,
 *   - 10 large card-buttons for layout (view mode + message size + spacing),
 *   - 2 textarea font-stack inputs,
 *   - import/export, electron-only rendering toggle, save/reset
 * all visible at once. The default view scored ~52 form controls
 * on screen at first paint, which the user (correctly) flagged as
 * overwhelming.
 *
 * New shape:
 *
 *   * Presets — always visible. Pick a theme, you're done in
 *     ~80% of cases.
 *   * Layout — compact pill groups (View / Density / Spacing).
 *     Replaces 10 card-buttons; same 3-3-4 options reduced to
 *     small inline pills.
 *   * Typography — single-line inputs (was textareas).
 *   * Advanced colours — collapsed by default. Tinkerer territory.
 *   * Import / Export — collapsed by default.
 *   * Rendering — Electron-only, unchanged.
 *
 * Hook contract (useTheme, themePresets) is unchanged. Pure visual
 * rework — every setter still resolves to the same appearanceConfig
 * mutation it did before.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../Button";
import { ModernToggle } from "../../AudioControls";
import { themePresets, useTheme } from "../../ThemeProvider";

type ElectronHwAccelBridge = {
  getHardwareAcceleration?: () => Promise<boolean>;
  setHardwareAcceleration?: (enabled: boolean) => Promise<void>;
};

function getElectronHwAccel(): ElectronHwAccelBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { electron?: ElectronHwAccelBridge }).electron;
}

interface AppearanceTabProps {
  theme: ReturnType<typeof useTheme>;
  setMessage: (
    msg: { type: "success" | "error"; text: string } | null,
  ) => void;
  onOpenThemeNameModal: () => void;
}

/**
 * Tiny collapsible card. Wraps each tab section in a uniform shell
 * with a clickable header that flips an "open" state. Collapsed
 * sections still render the header (so the user knows the feature
 * exists) but hide the body — which is the whole point of the
 * rework: tinkerer surfaces stay accessible without dominating
 * the default view.
 *
 * `defaultOpen` controls the first-render state; the user can
 * still toggle freely after that.
 */
function Section({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--color-hover)]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Compact pill-group selector. Replaces the previous "row of 3-4
 * giant card-buttons with descriptions" pattern that ate ~120px of
 * vertical space per group. Description for the active option is
 * shown below the pills as a small hint.
 */
function PillGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string; description?: string }>;
}) {
  const active = options.find((o) => o.value === value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        {active?.description && (
          <span className="text-xs text-[var(--color-text-muted)]">{active.description}</span>
        )}
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-0.5">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One row of: small swatch + label + hex text input. Replaces the
 * previous bulky two-column-per-color layout. Six previously-
 * H4-banner color groups all share this same row shape now,
 * separated only by a single mb-2 group header.
 */
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-[var(--color-border)]"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-xs text-[var(--color-text)]"
        placeholder="#000000"
      />
    </div>
  );
}

// Color groupings — same six groups as before, just rendered more
// compactly. Kept as data so adding / renaming a colour doesn't
// require touching the JSX.
const COLOR_GROUPS: ReadonlyArray<{
  title: string;
  keys: ReadonlyArray<{ key: string; label: string }>;
}> = [
  {
    title: "Background layer",
    keys: [
      { key: "background", label: "Main" },
      { key: "background-secondary", label: "Secondary" },
      { key: "background-tertiary", label: "Tertiary" },
    ],
  },
  {
    title: "Surface layer",
    keys: [
      { key: "surface", label: "Primary" },
      { key: "surface-secondary", label: "Secondary" },
      { key: "surface-tertiary", label: "Tertiary" },
    ],
  },
  {
    title: "Text",
    keys: [
      { key: "text", label: "Primary" },
      { key: "text-secondary", label: "Secondary" },
      { key: "text-tertiary", label: "Tertiary" },
      { key: "text-muted", label: "Muted" },
    ],
  },
  {
    title: "Brand",
    keys: [
      { key: "primary", label: "Primary" },
      { key: "primary-hover", label: "Primary hover" },
      { key: "secondary", label: "Secondary" },
      { key: "secondary-hover", label: "Secondary hover" },
    ],
  },
  {
    title: "Accent & status",
    keys: [
      { key: "accent", label: "Accent" },
      { key: "accent-hover", label: "Accent hover" },
      { key: "success", label: "Success" },
      { key: "warning", label: "Warning" },
      { key: "error", label: "Error" },
      { key: "info", label: "Info" },
      { key: "border", label: "Border" },
      { key: "border-secondary", label: "Border secondary" },
    ],
  },
  {
    title: "Interactive",
    keys: [
      { key: "hover", label: "Hover" },
      { key: "active", label: "Active" },
      { key: "focus", label: "Focus" },
      { key: "shadow", label: "Shadow" },
    ],
  },
];

export function AppearanceTab({
  theme,
  setMessage,
  onOpenThemeNameModal,
}: AppearanceTabProps) {
  const hwAccelBridge = getElectronHwAccel();
  const hwAccelSupported = !!(
    hwAccelBridge?.getHardwareAcceleration && hwAccelBridge?.setHardwareAcceleration
  );
  const [hwAccelEnabled, setHwAccelEnabled] = useState<boolean | null>(null);
  const [hwAccelNeedsRestart, setHwAccelNeedsRestart] = useState(false);

  useEffect(() => {
    if (!hwAccelSupported || !hwAccelBridge?.getHardwareAcceleration) return;
    let cancelled = false;
    void hwAccelBridge.getHardwareAcceleration().then((value) => {
      if (cancelled) return;
      setHwAccelEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, [hwAccelSupported, hwAccelBridge]);

  const onToggleHwAccel = async (next: boolean) => {
    if (!hwAccelBridge?.setHardwareAcceleration) return;
    setHwAccelEnabled(next);
    setHwAccelNeedsRestart(true);
    try {
      await hwAccelBridge.setHardwareAcceleration(next);
      setMessage({
        type: "success",
        text: `Hardware acceleration ${next ? "enabled" : "disabled"}. Restart Pufferblow for the change to take effect.`,
      });
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save hardware acceleration preference. Please try again.",
      });
      setHwAccelEnabled(!next);
    }
  };

  const {
    appearanceConfig,
    setAppearanceConfig,
    exportConfig,
    importConfig,
    resetToPreset,
  } = theme;

  const setLayout = <K extends keyof typeof appearanceConfig.layout>(
    key: K,
    value: (typeof appearanceConfig.layout)[K],
  ) =>
    setAppearanceConfig({
      ...appearanceConfig,
      layout: { ...appearanceConfig.layout, [key]: value },
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Presets ────────────────────────────────────────────────
          The 80% case. Always visible — most users pick a preset and
          never open another section. Card now also surfaces the
          current theme name + an "Export theme" action inline so
          the dedicated Import/Export section can stay collapsed. */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Theme</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Pick a preset, or customise below.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(themePresets).map(([presetName, presetConfig]) => {
              const isActive = appearanceConfig.name === presetName;
              return (
                <button
                  key={presetName}
                  onClick={() => resetToPreset(presetName)}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-[var(--color-border-secondary)]"
                    style={{ backgroundColor: presetConfig.colors.primary }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                      {presetName}
                    </span>
                  </span>
                  {isActive && (
                    <svg className="h-4 w-4 shrink-0 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-xs">
            <span className="text-[var(--color-text-muted)]">
              Active: <span className="text-[var(--color-text)]">{appearanceConfig.name || "Custom theme"}</span>
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const configJson = exportConfig();
                  navigator.clipboard.writeText(configJson)
                    .then(() => setMessage({ type: "success", text: "Theme JSON copied to clipboard." }))
                    .catch(() => setMessage({ type: "error", text: "Could not access the clipboard." }));
                }}
              >
                Copy JSON
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={onOpenThemeNameModal}>
                Save as…
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout ─────────────────────────────────────────────────
          Three pill groups, ~80px total. Was 10 card-buttons taking
          ~400px. */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Layout</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Message density and spacing.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <PillGroup
            label="View mode"
            value={appearanceConfig.layout.viewMode}
            onChange={(v) => setLayout("viewMode", v)}
            options={[
              { value: "default", label: "Default", description: "Discord-like with full timestamps" },
              { value: "compact", label: "Compact", description: "Minimal layout, reduced spacing" },
              { value: "cozy", label: "Cozy", description: "Generous spacing" },
            ] as const}
          />
          <PillGroup
            label="Message size"
            value={appearanceConfig.layout.messageSize}
            onChange={(v) => setLayout("messageSize", v)}
            options={[
              { value: "small", label: "Small", description: "Compact messages" },
              { value: "medium", label: "Medium", description: "Balanced" },
              { value: "large", label: "Large", description: "Larger messages" },
              { value: "extra-large", label: "Extra large", description: "Very large messages" },
            ] as const}
          />
          <PillGroup
            label="Message spacing"
            value={appearanceConfig.layout.messageSpacing}
            onChange={(v) => setLayout("messageSpacing", v)}
            options={[
              { value: "tight", label: "Tight", description: "Minimal spacing" },
              { value: "normal", label: "Normal", description: "Standard" },
              { value: "loose", label: "Loose", description: "Extra spacing" },
            ] as const}
          />
        </div>
      </div>

      {/* ── Typography (collapsed by default) ───────────────────── */}
      <Section title="Typography" description="Font families.">
        <div className="space-y-3">
          <div>
            <label htmlFor="font-sans" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              Sans-serif stack
            </label>
            <input
              id="font-sans"
              type="text"
              value={appearanceConfig.fonts.sans}
              onChange={(e) =>
                setAppearanceConfig({
                  ...appearanceConfig,
                  fonts: { ...appearanceConfig.fonts, sans: e.target.value },
                })
              }
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 font-mono text-xs text-[var(--color-text)]"
              placeholder="Inter, Helvetica, Arial, sans-serif"
            />
          </div>
          <div>
            <label htmlFor="font-mono" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              Monospace stack
            </label>
            <input
              id="font-mono"
              type="text"
              value={appearanceConfig.fonts.mono}
              onChange={(e) =>
                setAppearanceConfig({
                  ...appearanceConfig,
                  fonts: { ...appearanceConfig.fonts, mono: e.target.value },
                })
              }
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 font-mono text-xs text-[var(--color-text)]"
              placeholder="JetBrains Mono, Fira Code, Consolas, monospace"
            />
          </div>
        </div>
      </Section>

      {/* ── Advanced colours (collapsed by default) ───────────────
          26 colour pickers across six logical groups. Same set as
          before, now in compact rows instead of two-column grids
          inside per-group bordered cards. Each group is just an
          mb-3 H4 + a tight stack of rows. */}
      <Section
        title="Advanced colours"
        description="Fine-tune every colour token. Most users won't need this — pick a preset above instead."
      >
        <div className="space-y-5">
          {COLOR_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {group.title}
              </h4>
              <div className="divide-y divide-[var(--color-border)]">
                {group.keys.map(({ key, label }) => (
                  <ColorRow
                    key={key}
                    label={label}
                    value={(appearanceConfig.colors as Record<string, string>)[key] ?? ""}
                    onChange={(v) =>
                      setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: v },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => resetToPreset("Monochrome Dark")}
            >
              Reset to default
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Import / export (collapsed by default) ──────────────── */}
      <Section title="Import / export" description="Share themes as JSON.">
        <div className="space-y-3">
          <div>
            <label htmlFor="importThemeJson" className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              Paste theme JSON
            </label>
            <textarea
              id="importThemeJson"
              placeholder="Paste a theme JSON blob here…"
              className="h-32 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => {
                const textarea = document.getElementById("importThemeJson") as HTMLTextAreaElement;
                const jsonString = textarea.value.trim();
                if (!jsonString) return;
                if (importConfig(jsonString)) {
                  setMessage({ type: "success", text: "Theme imported." });
                  textarea.value = "";
                } else {
                  setMessage({ type: "error", text: "Invalid theme JSON." });
                }
              }}
            >
              Import & apply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const textarea = document.getElementById("importThemeJson") as HTMLTextAreaElement;
                textarea.value = "";
              }}
            >
              Clear
            </Button>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              Theme files use the <code className="font-mono">.pufferblow-theme</code> extension.
            </span>
          </div>
        </div>
      </Section>

      {/* ── Rendering (Electron only) ───────────────────────────── */}
      {hwAccelSupported && (
        <Section title="Rendering" description="Low-level display options. Requires restart.">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text)]">
                Hardware acceleration
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Off by default. Enable to render through the GPU — smoother
                animations on most machines, but can cause artifacts with old
                or flaky drivers.
              </div>
              {hwAccelNeedsRestart && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-1 text-xs text-[var(--color-warning)]">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restart Pufferblow for this to take effect.
                </div>
              )}
            </div>
            <ModernToggle
              checked={hwAccelEnabled ?? false}
              onChange={(v) => void onToggleHwAccel(v)}
              size="medium"
            />
          </div>
        </Section>
      )}
    </div>
  );
}
