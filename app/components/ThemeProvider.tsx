import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

export interface AppearanceConfig {
  name: string;
  colors: {
    background: string;
    "background-secondary": string;
    "background-tertiary": string;
    surface: string;
    "surface-secondary": string;
    "surface-tertiary": string;
    text: string;
    "text-secondary": string;
    "text-tertiary": string;
    "text-muted": string;
    border: string;
    "border-secondary": string;
    hover: string;
    active: string;
    focus: string;
    primary: string;
    "primary-hover": string;
    secondary: string;
    "secondary-hover": string;
    accent: string;
    "accent-hover": string;
    success: string;
    warning: string;
    error: string;
    info: string;
    shadow: string;
    "shadow-lg": string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  layout: {
    viewMode: "default" | "compact" | "cozy";
    messageSize: "small" | "medium" | "large" | "extra-large";
    messageSpacing: "tight" | "normal" | "loose";
  };
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  appearanceConfig: AppearanceConfig;
  setAppearanceConfig: (config: AppearanceConfig) => void;
  toggleTheme: () => void;
  saveCustomConfig: (config: AppearanceConfig) => void;
  loadCustomConfig: () => AppearanceConfig | null;
  exportConfig: () => string;
  importConfig: (jsonString: string) => boolean;
  resetToPreset: (presetName: string) => void;
}

const defaultFonts = {
  sans: '"Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
};

const defaultLayout = {
  viewMode: "default" as const,
  messageSize: "medium" as const,
  messageSpacing: "normal" as const,
};

const monochromeDark: AppearanceConfig = {
  name: "Monochrome Dark",
  colors: {
    background: "#050505",
    "background-secondary": "#0C0C0C",
    "background-tertiary": "#111111",
    surface: "#101010",
    "surface-secondary": "#171717",
    "surface-tertiary": "#232323",
    text: "#FAFAFA",
    "text-secondary": "#D4D4D4",
    "text-tertiary": "#A3A3A3",
    "text-muted": "#737373",
    border: "rgba(255, 255, 255, 0.16)",
    "border-secondary": "rgba(255, 255, 255, 0.08)",
    hover: "#1A1A1A",
    active: "#242424",
    focus: "#FFFFFF",
    primary: "#FAFAFA",
    "primary-hover": "#E5E5E5",
    secondary: "#D4D4D4",
    "secondary-hover": "#C5C5C5",
    accent: "#E5E5E5",
    "accent-hover": "#D4D4D4",
    success: "#7ECF9F",
    warning: "#D6B36A",
    error: "#D8837B",
    info: "#86AEE8",
    shadow: "rgba(0, 0, 0, 0.22)",
    "shadow-lg": "rgba(0, 0, 0, 0.34)",
  },
  fonts: defaultFonts,
  layout: defaultLayout,
};

const monochromeLight: AppearanceConfig = {
  name: "Monochrome Light",
  colors: {
    background: "#FFFFFF",
    "background-secondary": "#F7F7F7",
    "background-tertiary": "#EFEFEF",
    surface: "#FFFFFF",
    "surface-secondary": "#F3F3F3",
    "surface-tertiary": "#E7E7E7",
    text: "#0A0A0A",
    "text-secondary": "#303030",
    "text-tertiary": "#525252",
    "text-muted": "#737373",
    border: "rgba(10, 10, 10, 0.16)",
    "border-secondary": "rgba(10, 10, 10, 0.08)",
    hover: "#ECECEC",
    active: "#E2E2E2",
    focus: "#0A0A0A",
    primary: "#0A0A0A",
    "primary-hover": "#242424",
    secondary: "#303030",
    "secondary-hover": "#454545",
    accent: "#1A1A1A",
    "accent-hover": "#303030",
    success: "#2F7D57",
    warning: "#9B6D17",
    error: "#B4544D",
    info: "#3767B7",
    shadow: "rgba(0, 0, 0, 0.06)",
    "shadow-lg": "rgba(0, 0, 0, 0.12)",
  },
  fonts: defaultFonts,
  layout: defaultLayout,
};

export const themePresets: Record<string, AppearanceConfig> = {
  "Monochrome Dark": monochromeDark,
  "Monochrome Light": monochromeLight,
};

const REQUIRED_COLOR_KEYS = Object.keys(monochromeDark.colors) as Array<
  keyof AppearanceConfig["colors"]
>;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function parseColorToRgb(color: string): [number, number, number] | null {
  const normalized = color.trim();

  const hex6 = normalized.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
  }

  const hex3 = normalized.match(/^#([a-f\d])([a-f\d])([a-f\d])$/i);
  if (hex3) {
    return [
      parseInt(hex3[1] + hex3[1], 16),
      parseInt(hex3[2] + hex3[2], 16),
      parseInt(hex3[3] + hex3[3], 16),
    ];
  }

  const rgb = normalized.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i,
  );
  if (rgb) {
    return [
      Math.min(255, parseInt(rgb[1], 10)),
      Math.min(255, parseInt(rgb[2], 10)),
      Math.min(255, parseInt(rgb[3], 10)),
    ];
  }

  return null;
}

function getBrightness(color: string) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return 255;
  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getReadableTextColor(background: string): string {
  return getBrightness(background) < 128 ? "#ffffff" : "#000000";
}

function normalizeConfig(config: AppearanceConfig): AppearanceConfig {
  const normalizedColors = { ...monochromeDark.colors, ...config.colors };

  for (const key of REQUIRED_COLOR_KEYS) {
    if (!normalizedColors[key]) {
      normalizedColors[key] = monochromeDark.colors[key];
    }
  }

  return {
    ...config,
    colors: normalizedColors,
    fonts: { ...defaultFonts, ...(config.fonts || {}) },
    layout: { ...defaultLayout, ...(config.layout || {}) },
  };
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [appearanceConfig, setAppearanceConfigState] = useState<AppearanceConfig>(() => {
    if (typeof window === "undefined") {
      return monochromeDark;
    }

    try {
      const savedCustom = localStorage.getItem("pufferblow-custom-theme");
      if (!savedCustom) {
        return monochromeDark;
      }

      const parsed = JSON.parse(savedCustom) as AppearanceConfig;
      const presetMatch = parsed?.name ? themePresets[parsed.name] : undefined;
      if (presetMatch) {
        return normalizeConfig({
          ...presetMatch,
          fonts: { ...presetMatch.fonts, ...(parsed.fonts || {}) },
          layout: { ...presetMatch.layout, ...(parsed.layout || {}) },
        });
      }

      if (!parsed?.colors || !parsed?.fonts) {
        return monochromeDark;
      }

      return normalizeConfig(parsed);
    } catch {
      return monochromeDark;
    }
  });

  const [theme, setThemeState] = useState<Theme>(
    getBrightness(appearanceConfig.colors.background) < 128 ? "dark" : "light",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const isDark = getBrightness(appearanceConfig.colors.background) < 128;

    Object.entries(appearanceConfig.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(appearanceConfig.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });

    root.style.setProperty("--color-on-primary", getReadableTextColor(appearanceConfig.colors.primary));
    root.style.setProperty("--color-on-secondary", getReadableTextColor(appearanceConfig.colors.secondary));
    root.style.setProperty("--color-on-accent", getReadableTextColor(appearanceConfig.colors.accent));
    root.style.setProperty("--color-on-success", getReadableTextColor(appearanceConfig.colors.success));
    root.style.setProperty("--color-on-warning", getReadableTextColor(appearanceConfig.colors.warning));
    root.style.setProperty("--color-on-error", getReadableTextColor(appearanceConfig.colors.error));
    root.style.setProperty("--color-on-info", getReadableTextColor(appearanceConfig.colors.info));

    root.classList.toggle("dark", isDark);
    root.style.setProperty("color-scheme", isDark ? "dark" : "light");
    setThemeState(isDark ? "dark" : "light");

    localStorage.setItem("pufferblow-custom-theme", JSON.stringify(appearanceConfig));
  }, [appearanceConfig]);

  const setTheme = (nextTheme: Theme) => {
    setAppearanceConfigState(nextTheme === "dark" ? monochromeDark : monochromeLight);
    setThemeState(nextTheme);
  };

  const setAppearanceConfig = (config: AppearanceConfig) => {
    setAppearanceConfigState(normalizeConfig(config));
  };

  const saveCustomConfig = (config: AppearanceConfig) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pufferblow-custom-theme", JSON.stringify(normalizeConfig(config)));
    }
  };

  const loadCustomConfig = (): AppearanceConfig | null => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const saved = localStorage.getItem("pufferblow-custom-theme");
      if (!saved) {
        return null;
      }

      const parsed = JSON.parse(saved) as AppearanceConfig;
      const presetMatch = parsed?.name ? themePresets[parsed.name] : undefined;
      if (presetMatch) {
        return normalizeConfig({
          ...presetMatch,
          fonts: { ...presetMatch.fonts, ...(parsed.fonts || {}) },
          layout: { ...presetMatch.layout, ...(parsed.layout || {}) },
        });
      }

      return normalizeConfig(parsed);
    } catch {
      return null;
    }
  };

  const exportConfig = () => JSON.stringify(appearanceConfig, null, 2);

  const importConfig = (jsonString: string) => {
    try {
      const imported = JSON.parse(jsonString) as AppearanceConfig;
      if (!imported?.colors || !imported?.fonts || typeof imported.name !== "string") {
        return false;
      }

      setAppearanceConfigState(normalizeConfig(imported));
      return true;
    } catch {
      return false;
    }
  };

  const resetToPreset = (presetName: string) => {
    const preset = themePresets[presetName];
    if (!preset) {
      return;
    }
    setAppearanceConfigState(preset);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      appearanceConfig,
      setAppearanceConfig,
      toggleTheme,
      saveCustomConfig,
      loadCustomConfig,
      exportConfig,
      importConfig,
      resetToPreset,
    }),
    [theme, appearanceConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
