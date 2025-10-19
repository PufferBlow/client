import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Enhanced theme configuration schema
export interface AppearanceConfig {
  name: string;
  colors: {
    // Background & surface colors
    background: string;
    'background-secondary': string;
    'background-tertiary': string;
    surface: string;
    'surface-secondary': string;
    'surface-tertiary': string;

    // Text colors
    text: string;
    'text-secondary': string;
    'text-tertiary': string;
    'text-muted': string;

    // Borders & interaction
    border: string;
    'border-secondary': string;
    hover: string;
    active: string;
    focus: string;

    // Brand colors
    primary: string;
    'primary-hover': string;
    secondary: string;
    'secondary-hover': string;
    accent: string;
    'accent-hover': string;

    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;

    // Shadows
    shadow: string;
    'shadow-lg': string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  layout: {
    viewMode: 'default' | 'compact' | 'cozy';
    messageSize: 'small' | 'medium' | 'large' | 'extra-large';
    messageSpacing: 'tight' | 'normal' | 'loose';
  };
}

// Legacy simple theme type for backward compatibility
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: 'light' | 'dark'; // Keep for backward compatibility
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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default theme presets
export const themePresets: Record<string, AppearanceConfig> = {
  'Nord Dark': {
    name: 'Nord Dark',
    colors: {
      background: '#2E3440',
      'background-secondary': '#3B4252',
      'background-tertiary': '#434C5E',
      surface: '#3B4252',
      'surface-secondary': '#434C5E',
      'surface-tertiary': '#4C566A',
      text: '#ECEFF4',
      'text-secondary': '#E5E9F0',
      'text-tertiary': '#D8DEE9',
      'text-muted': '#81A1C1',
      border: '#4C566A',
      'border-secondary': '#434C5E',
      primary: '#5E81AC',
      'primary-hover': '#81A1C1',
      secondary: '#8FBCBB',
      'secondary-hover': '#88C0D0',
      accent: '#81A1C1',
      'accent-hover': '#5E81AC',
      success: '#A3BE8C',
      warning: '#EBCB8B',
      error: '#BF616A',
      info: '#88C0D0',
      hover: '#434C5E',
      active: '#4C566A',
      focus: '#5E81AC',
      shadow: 'rgba(0, 0, 0, 0.3)',
      'shadow-lg': 'rgba(0, 0, 0, 0.4)',
    },
    fonts: {
      sans: '"Inter", "Poppins", "Nunito", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'default',
      messageSize: 'medium',
      messageSpacing: 'normal',
    },
  },
  'Nord Light': {
    name: 'Nord Light',
    colors: {
      background: '#ECEFF4',
      'background-secondary': '#E5E9F0',
      'background-tertiary': '#D8DEE9',
      surface: '#E5E9F0',
      'surface-secondary': '#D8DEE9',
      'surface-tertiary': '#C1C7D0',
      text: '#2E3440',
      'text-secondary': '#3B4252',
      'text-tertiary': '#434C5E',
      'text-muted': '#4C566A',
      border: '#D8DEE9',
      'border-secondary': '#C1C7D0',
      primary: '#5E81AC',
      'primary-hover': '#4C566A',
      secondary: '#8FBCBB',
      'secondary-hover': '#5E81AC',
      accent: '#88C0D0',
      'accent-hover': '#5E81AC',
      success: '#A3BE8C',
      warning: '#EBCB8B',
      error: '#BF616A',
      info: '#88C0D0',
      hover: '#E5E9F0',
      active: '#D8DEE9',
      focus: '#5E81AC',
      shadow: 'rgba(46, 52, 64, 0.1)',
      'shadow-lg': 'rgba(46, 52, 64, 0.2)',
    },
    fonts: {
      sans: '"Inter", "Poppins", "Nunito", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'default',
      messageSize: 'medium',
      messageSpacing: 'normal',
    },
  },
  'Discord Dark': {
    name: 'Discord Dark',
    colors: {
      background: '#313338',
      'background-secondary': '#2B2D31',
      'background-tertiary': '#1E1F22',
      surface: '#2B2D31',
      'surface-secondary': '#1E1F22',
      'surface-tertiary': '#111214',
      text: '#F2F3F5',
      'text-secondary': '#C4C9CE',
      'text-tertiary': '#949BA4',
      'text-muted': '#6D737A',
      border: '#404249',
      'border-secondary': '#35373C',
      primary: '#5865F2',
      'primary-hover': '#4752C4',
      secondary: '#57F287',
      'secondary-hover': '#3BA55C',
      accent: '#FEE75C',
      'accent-hover': '#FAB81E',
      success: '#23A559',
      warning: '#F0B132',
      error: '#F23F42',
      info: '#0078D4',
      hover: '#35373C',
      active: '#404249',
      focus: '#5865F2',
      shadow: 'rgba(0, 0, 0, 0.3)',
      'shadow-lg': 'rgba(0, 0, 0, 0.6)',
    },
    fonts: {
      sans: '"Whitney", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
      mono: '"Consolas", "Liberation Mono", "Menlo", "Courier", monospace',
    },
    layout: {
      viewMode: 'default',
      messageSize: 'medium',
      messageSpacing: 'normal',
    },
  }
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Initialize with custom config or fallback to Nord Dark
  const [appearanceConfig, setAppearanceConfigState] = useState<AppearanceConfig>(() => {
    if (typeof window === 'undefined') {
      return themePresets['Nord Dark'];
    }
    try {
      const savedCustom = localStorage.getItem('pufferblow-custom-theme');
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        // Validate required properties
        if (parsed.colors && parsed.fonts) {
          // Ensure layout property exists for backward compatibility
          const config = parsed as AppearanceConfig;
          if (!config.layout) {
            config.layout = themePresets['Nord Dark'].layout;
          }
          return config;
        }
      }
      // Fallback to Nord Dark
      return themePresets['Nord Dark'];
    } catch {
      return themePresets['Nord Dark'];
    }
  });

  // Legacy theme state for backward compatibility
  const [theme, setTheme] = useState<Theme>('dark');

  // Apply theme to DOM when configuration changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply colors
    Object.entries(appearanceConfig.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply fonts
    Object.entries(appearanceConfig.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });

    // Update Tailwind dark mode class based on background brightness
    const isDark = getBrightness(appearanceConfig.colors.background) < 128;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save custom theme
    saveCustomConfig(appearanceConfig);

  }, [appearanceConfig]);

  // Helper function to calculate color brightness
  const getBrightness = (hex: string) => {
    const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!rgb) return 255; // fallback to light
    const r = parseInt(rgb[1], 16);
    const g = parseInt(rgb[2], 16);
    const b = parseInt(rgb[3], 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const setAppearanceConfig = (config: AppearanceConfig) => {
    setAppearanceConfigState(config);
  };

  const saveCustomConfig = (config: AppearanceConfig) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pufferblow-custom-theme', JSON.stringify(config));
    }
  };

  const loadCustomConfig = (): AppearanceConfig | null => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('pufferblow-custom-theme');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const exportConfig = (): string => {
    return JSON.stringify(appearanceConfig, null, 2);
  };

  const importConfig = (jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString);
      // Basic validation - check if it has required structure
      if (imported.colors && imported.fonts && typeof imported.name === 'string') {
        // Check if all required color properties exist
        const requiredColors = Object.keys(appearanceConfig.colors);
        const hasAllColors = requiredColors.every(color => typeof imported.colors[color] === 'string');

        if (hasAllColors && typeof imported.fonts.sans === 'string' && typeof imported.fonts.mono === 'string') {
          // Ensure layout property exists for backward compatibility
          if (!imported.layout) {
            imported.layout = themePresets['Nord Dark'].layout;
          }
          setAppearanceConfig(imported);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const resetToPreset = (presetName: string) => {
    const preset = themePresets[presetName];
    if (preset) {
      setAppearanceConfig(preset);
    }
  };

  const toggleTheme = () => {
    // Legacy compatibility - toggle between light and dark presets
    if (appearanceConfig.name === 'Nord Dark') {
      resetToPreset('Nord Light');
      setTheme('light');
    } else {
      resetToPreset('Nord Dark');
      setTheme('dark');
    }
  };

  const value: ThemeContextType = {
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
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
