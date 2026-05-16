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
import { Button } from "../../Button";
import { themePresets, useTheme } from "../../ThemeProvider";

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
    </div>
  );
}
