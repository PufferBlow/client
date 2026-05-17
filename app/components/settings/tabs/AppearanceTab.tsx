/**
 * AppearanceTab — Settings page > Appearance pane. The biggest tab
 * (~670 lines), and a likely follow-up target for further sub-
 * splitting (preset grid, color groups, fonts, layout, import/export
 * would each make sense as their own component). For now this is a
 * straight verbatim extraction so the cut stays purely structural —
 * the parent's render goes from one 670-line block to a one-liner.
 *
 * Theme state comes through as `theme` (the useTheme return) so the
 * tab can read appearanceConfig and call setters / preset / import-
 * export helpers without a separate prop for each. `setMessage` is
 * passed through for the export-to-clipboard success/error toast and
 * the import success/error toast. `onOpenThemeNameModal` is a thin
 * callback over the SettingsPage-owned themeNameModal state, so the
 * tab doesn't need to know that the rename happens in a Modal at
 * the page level.
 */
import { useEffect, useState } from "react";
import { Button } from "../../Button";
import { ModernToggle } from "../../AudioControls";
import { themePresets, useTheme } from "../../ThemeProvider";

/**
 * Subset of `window.electron` we depend on for the hardware-acceleration
 * toggle. The full bridge type lives elsewhere; we duplicate just these
 * two methods so the tab compiles cleanly in non-Electron environments
 * (web build) where `window.electron` is undefined.
 */
type ElectronHwAccelBridge = {
  getHardwareAcceleration?: () => Promise<boolean>;
  setHardwareAcceleration?: (enabled: boolean) => Promise<void>;
};

function getElectronHwAccel(): ElectronHwAccelBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { electron?: ElectronHwAccelBridge }).electron;
}

interface AppearanceTabProps {
  // The whole useTheme return is threaded through so the tab can read
  // appearanceConfig and call setters / preset / import-export helpers
  // without a separate prop for each. themePresets isn't part of the
  // context, so the tab imports it directly.
  theme: ReturnType<typeof useTheme>;
  setMessage: (
    msg: { type: "success" | "error"; text: string } | null,
  ) => void;
  onOpenThemeNameModal: () => void;
}

export function AppearanceTab({
  theme,
  setMessage,
  onOpenThemeNameModal,
}: AppearanceTabProps) {
  // Hardware acceleration is a main-process preference. We load it on
  // mount and write changes back via the Electron IPC bridge. The
  // toggle is hidden when the bridge isn't available (web build).
  // Changes don't take effect until the user restarts the client, so
  // we surface that fact alongside the toggle.
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
      // Roll back the optimistic state since the write failed.
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

  return (
    <div className="space-y-6">
      {/* Preset Themes Section */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Preset Themes</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose from built-in themes or create your own</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(themePresets).map(([presetName, presetConfig]) => (
              <button
                key={presetName}
                onClick={() => resetToPreset(presetName)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  appearanceConfig.name === presetName
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full border border-[var(--color-border-secondary)] flex-shrink-0"
                    style={{ backgroundColor: presetConfig.colors.primary }}
                  ></div>
                  <div className="text-left">
                    <div className="font-medium text-[var(--color-text)]">{presetName}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Monochrome {presetName.toLowerCase().includes('dark') ? "dark" : "light"} preset
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[var(--color-text)]">Current Theme</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {appearanceConfig.name || 'Custom Theme'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const configJson = exportConfig();
                    navigator.clipboard.writeText(configJson).then(() => {
                      setMessage({ type: 'success', text: 'Theme configuration copied to clipboard!' });
                    }).catch(() => {
                      setMessage({ type: 'error', text: 'Failed to copy to clipboard. Try exporting manually.' });
                    });
                  }}
                  className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] text-sm rounded-lg transition-colors"
                >
                  Export Theme
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Color Customization */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Customize Colors</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Fine-tune every aspect of your theme</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Background Colors */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Background Layer</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { key: 'background', label: 'Main Background' },
                { key: 'background-secondary', label: 'Secondary Background' },
                { key: 'background-tertiary', label: 'Tertiary Background' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surface Colors */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Surface Layer</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { key: 'surface', label: 'Primary Surface' },
                { key: 'surface-secondary', label: 'Secondary Surface' },
                { key: 'surface-tertiary', label: 'Tertiary Surface' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text Colors */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Text Colors</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {([
                { key: 'text', label: 'Primary Text' },
                { key: 'text-secondary', label: 'Secondary Text' },
                { key: 'text-tertiary', label: 'Tertiary Text' },
                { key: 'text-muted', label: 'Muted Text' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Colors */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Brand Colors</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {([
                { key: 'primary', label: 'Primary' },
                { key: 'primary-hover', label: 'Primary Hover' },
                { key: 'secondary', label: 'Secondary' },
                { key: 'secondary-hover', label: 'Secondary Hover' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accent & Status Colors */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Accent & Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {([
                { key: 'accent', label: 'Accent' },
                { key: 'accent-hover', label: 'Accent Hover' },
                { key: 'success', label: 'Success' },
                { key: 'warning', label: 'Warning' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              {([
                { key: 'error', label: 'Error' },
                { key: 'info', label: 'Info' },
                { key: 'border', label: 'Border' },
                { key: 'border-secondary', label: 'Border Secondary' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Elements */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Interactive Elements</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {([
                { key: 'hover', label: 'Hover' },
                { key: 'active', label: 'Active' },
                { key: 'focus', label: 'Focus' },
                { key: 'shadow', label: 'Shadow' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {label}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={appearanceConfig.colors[key]}
                      onChange={(e) => setAppearanceConfig({
                        ...appearanceConfig,
                        colors: { ...appearanceConfig.colors, [key]: e.target.value }
                      })}
                      className="flex-1 px-3 py-1 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fonts Customization */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Typography</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Customize fonts for your theme</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Sans Serif Font Family
            </label>
            <textarea
              value={appearanceConfig.fonts.sans}
              onChange={(e) => setAppearanceConfig({
                ...appearanceConfig,
                fonts: { ...appearanceConfig.fonts, sans: e.target.value }
              })}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono"
              rows={2}
              placeholder="font-family stack for sans-serif fonts"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Include fallback fonts: e.g., "Custom Sans, Inter, Helvetica, Arial, sans-serif"
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Monospace Font Family
            </label>
            <textarea
              value={appearanceConfig.fonts.mono}
              onChange={(e) => setAppearanceConfig({
                ...appearanceConfig,
                fonts: { ...appearanceConfig.fonts, mono: e.target.value }
              })}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono"
              rows={2}
              placeholder="font-family stack for monospace fonts"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Include fallback fonts: e.g., "JetBrains Mono, Fira Code, Consolas, monospace"
            </p>
          </div>
        </div>
      </div>

      {/* Layout & Display Options */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Layout & Display</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Customize the visual layout and sizing</p>
        </div>

        <div className="p-6 space-y-6">
          {/* View Mode */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">View Mode</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, viewMode: 'default' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.viewMode === 'default'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Default</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Standard Discord-like layout with full timestamps</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, viewMode: 'compact' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.viewMode === 'compact'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Compact</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Minimal layout with reduced spacing</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, viewMode: 'cozy' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.viewMode === 'cozy'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Cozy</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Comfortable layout with generous spacing</div>
                </button>
              </div>
            </div>
          </div>

          {/* Message Size */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Message Size</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSize: 'small' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSize === 'small'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Small</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Compact messages</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSize: 'medium' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSize === 'medium'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Medium</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Balanced size</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSize: 'large' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSize === 'large'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Large</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Larger messages</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSize: 'extra-large' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSize === 'extra-large'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Extra Large</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Very large messages</div>
                </button>
              </div>
            </div>
          </div>

          {/* Message Spacing */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Message Spacing</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSpacing: 'tight' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSpacing === 'tight'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Tight</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Minimal spacing between messages</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSpacing: 'normal' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSpacing === 'normal'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Normal</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Standard spacing</div>
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAppearanceConfig({
                    ...appearanceConfig,
                    layout: { ...appearanceConfig.layout, messageSpacing: 'loose' }
                  })}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
                    appearanceConfig.layout.messageSpacing === 'loose'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="font-medium text-[var(--color-text)] text-left">Loose</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 text-left">Extra spacing for better readability</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import/Export Section */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-medium text-[var(--color-text)]">Import/Export</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Share your themes with others</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Import Theme JSON
            </label>
            <textarea
              id="importThemeJson"
              placeholder='Paste theme JSON here...'
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] text-sm font-mono h-32"
            />
            <div className="mt-3 flex space-x-2">
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => {
                  const textarea = document.getElementById('importThemeJson') as HTMLTextAreaElement;
                  const jsonString = textarea.value.trim();
                  if (jsonString) {
                    if (importConfig(jsonString)) {
                      setMessage({ type: 'success', text: 'Theme imported successfully!' });
                      textarea.value = '';
                    } else {
                      setMessage({ type: 'error', text: 'Invalid theme configuration. Please check the JSON format.' });
                    }
                  }
                }}
              >
                Import & Apply
              </Button>
              <button
                onClick={() => {
                  const textarea = document.getElementById('importThemeJson') as HTMLTextAreaElement;
                  textarea.value = '';
                }}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              Tip: Theme files use the .pufferblow-theme extension. Export your current theme and share it with other users!
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => resetToPreset('Monochrome Dark')}
          className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] text-sm rounded transition-colors"
        >
          Reset to Default
        </button>
        <button
          onClick={onOpenThemeNameModal}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] text-sm rounded transition-colors"
        >
          Save Custom Theme
        </button>
      </div>

      {/* Rendering / Performance Section. Only shown in the Electron
          desktop client; the IPC bridge is undefined in the web build.
          The hardware-acceleration toggle is a main-process setting --
          changing it requires a restart, which we surface inline. */}
      {hwAccelSupported && (
        <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
          <div className="p-6 border-b border-[var(--color-border)]">
            <h3 className="text-lg font-medium text-[var(--color-text)]">Rendering</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Low-level display options. Changes require a restart.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--color-text)] text-sm">
                  Hardware acceleration
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Off by default. Enable to render through the GPU process
                  -- smoother animations and video playback on most
                  machines, but can cause graphical glitches with old or
                  flaky drivers. Toggle this off if you see rendering
                  artifacts.
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
          </div>
        </div>
      )}
    </div>
  );
}
