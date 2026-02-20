// Nord color palette - Official Arctic Ice Studio colors
export const nord = [
  '#2E3440', // nord0 - Polar Night
  '#3B4252', // nord1
  '#434C5E', // nord2
  '#4C566A', // nord3
  '#D8DEE9', // nord4 - Snow Storm
  '#E5E9F0', // nord5
  '#ECEFF4', // nord6
  '#8FBCBB', // nord7 - Frost
  '#88C0D0', // nord8
  '#81A1C1', // nord9
  '#5E81AC', // nord10
  '#BF616A', // nord11 - Aurora
  '#D08770', // nord12
  '#EBCB8B', // nord13
  '#A3BE8C', // nord14
  '#B48EAD'  // nord15
];

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

// Theme variation generation utilities
export const createVariationFromBase = (
  baseConfig: AppearanceConfig,
  variationType: 'frost' | 'aurora' | 'polar' | 'minimal' | 'clean',
  name: string
): AppearanceConfig => {
  const variation = { ...baseConfig, name };

  // Determine if this is a light or dark theme
  const isLight = getBrightness(baseConfig.colors.background) > 150;

  switch (variationType) {
    case 'frost':
      // Use frost colors (nord[7], nord[8], nord[9], nord[10]) for accent
      variation.colors.primary = nord[8];
      variation.colors['primary-hover'] = isLight ? nord[10] : nord[9];
      variation.colors.secondary = nord[7];
      variation.colors['secondary-hover'] = nord[8];
      variation.colors.accent = nord[9];
      variation.colors['accent-hover'] = nord[10];
      break;

    case 'aurora':
      // Use aurora colors (nord[11], nord[12], nord[13], nord[14], nord[15]) for accent
      variation.colors.primary = nord[11];
      variation.colors['primary-hover'] = nord[12];
      variation.colors.secondary = nord[14];
      variation.colors['secondary-hover'] = nord[13];
      variation.colors.accent = nord[15];
      variation.colors['accent-hover'] = nord[14];
      break;

    case 'polar':
      // Use polar night colors for higher contrast
      variation.colors.border = nord[1];
      variation.colors['border-secondary'] = nord[2];
      variation.colors.hover = nord[1];
      variation.colors.active = nord[0];
      variation.colors.primary = nord[9];
      variation.colors['primary-hover'] = nord[10];
      variation.colors.secondary = nord[8];
      variation.colors['secondary-hover'] = nord[9];
      variation.colors.shadow = isLight ? 'rgba(46, 52, 64, 0.1)' : 'rgba(0, 0, 0, 0.5)';
      variation.colors['shadow-lg'] = isLight ? 'rgba(46, 52, 64, 0.2)' : 'rgba(0, 0, 0, 0.7)';
      break;

    case 'minimal':
      // Reduce color variety, make more monochromatic
      variation.colors.secondary = variation.colors.primary;
      variation.colors['secondary-hover'] = variation.colors['primary-hover'];
      variation.colors.accent = variation.colors.primary;
      variation.colors['accent-hover'] = variation.colors['primary-hover'];
      variation.colors.hover = variation.colors.surface;
      variation.colors.active = variation.colors['surface-secondary'];
      variation.colors.shadow = isLight ? 'rgba(46, 52, 64, 0.05)' : 'rgba(0, 0, 0, 0.2)';
      variation.colors['shadow-lg'] = isLight ? 'rgba(46, 52, 64, 0.1)' : 'rgba(0, 0, 0, 0.3)';
      break;

    case 'clean':
      // Clean whites and subtle contrast for light themes
      variation.colors.background = nord[6];
      variation.colors['background-secondary'] = nord[5];
      variation.colors['background-tertiary'] = nord[6];
      variation.colors.surface = nord[5];
      variation.colors['surface-secondary'] = nord[6];
      variation.colors.hover = nord[6];
      variation.colors.active = nord[5];
      variation.colors.border = nord[4];
      variation.colors['border-secondary'] = nord[5];
      variation.colors.shadow = 'rgba(46, 52, 64, 0.05)';
      variation.colors['shadow-lg'] = 'rgba(46, 52, 64, 0.1)';
      break;
  }

  return variation;
};

export const getNordThemePresets = (): Record<string, AppearanceConfig> => {
  return Object.fromEntries(
    Object.entries(themePresets).filter(([key]) => key.includes('Nord'))
  );
};

// Helper function to calculate color brightness (moved to top for utility use)
const getBrightness = (hex: string) => {
  const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!rgb) return 255; // fallback to light
  const r = parseInt(rgb[1], 16);
  const g = parseInt(rgb[2], 16);
  const b = parseInt(rgb[3], 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default theme presets
export const themePresets: Record<string, AppearanceConfig> = {
  'Nord Dark': {
    name: 'Nord Dark',
    colors: {
      background: '#000000',
      'background-secondary': '#0a0a0a',
      'background-tertiary': '#121212',
      surface: '#0a0a0a',
      'surface-secondary': '#121212',
      'surface-tertiary': '#1a1a1a',
      text: '#ffffff',
      'text-secondary': '#f0f0f0',
      'text-tertiary': '#d9d9d9',
      'text-muted': '#b3b3b3',
      border: '#2a2a2a',
      'border-secondary': '#1f1f1f',
      primary: '#ffffff',
      'primary-hover': '#e6e6e6',
      secondary: '#ffffff',
      'secondary-hover': '#e6e6e6',
      accent: '#ffffff',
      'accent-hover': '#e6e6e6',
      success: '#ffffff',
      warning: '#ffffff',
      error: '#ffffff',
      info: '#ffffff',
      hover: '#111111',
      active: '#1a1a1a',
      focus: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.6)',
      'shadow-lg': 'rgba(0, 0, 0, 0.8)',
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
      background: '#ffffff',
      'background-secondary': '#f7f7f7',
      'background-tertiary': '#efefef',
      surface: '#f7f7f7',
      'surface-secondary': '#efefef',
      'surface-tertiary': '#e6e6e6',
      text: '#000000',
      'text-secondary': '#0d0d0d',
      'text-tertiary': '#1a1a1a',
      'text-muted': '#4d4d4d',
      border: '#d9d9d9',
      'border-secondary': '#cfcfcf',
      primary: '#000000',
      'primary-hover': '#1a1a1a',
      secondary: '#000000',
      'secondary-hover': '#1a1a1a',
      accent: '#000000',
      'accent-hover': '#1a1a1a',
      success: '#000000',
      warning: '#000000',
      error: '#000000',
      info: '#000000',
      hover: '#f0f0f0',
      active: '#e6e6e6',
      focus: '#000000',
      shadow: 'rgba(0, 0, 0, 0.08)',
      'shadow-lg': 'rgba(0, 0, 0, 0.16)',
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
  'Nord Dark Frost': {
    name: 'Nord Dark Frost',
    colors: {
      background: nord[0],
      'background-secondary': nord[1],
      'background-tertiary': nord[2],
      surface: nord[1],
      'surface-secondary': nord[2],
      'surface-tertiary': nord[3],
      text: nord[6],
      'text-secondary': nord[5],
      'text-tertiary': nord[4],
      'text-muted': nord[9],
      border: nord[3],
      'border-secondary': nord[2],
      primary: nord[8], // Frost cyan
      'primary-hover': nord[7], // Frost teal
      secondary: nord[9], // Frost blue
      'secondary-hover': nord[8], // Frost cyan
      accent: nord[10], // Frost dark blue
      'accent-hover': nord[9], // Frost blue
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[8],
      hover: nord[2],
      active: nord[3],
      focus: nord[10],
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
  'Nord Dark Aurora': {
    name: 'Nord Dark Aurora',
    colors: {
      background: nord[0],
      'background-secondary': nord[1],
      'background-tertiary': nord[2],
      surface: nord[1],
      'surface-secondary': nord[2],
      'surface-tertiary': nord[3],
      text: nord[6],
      'text-secondary': nord[5],
      'text-tertiary': nord[4],
      'text-muted': nord[9],
      border: nord[3],
      'border-secondary': nord[2],
      primary: nord[11], // Aurora red
      'primary-hover': nord[12], // Aurora orange
      secondary: nord[14], // Aurora green
      'secondary-hover': nord[13], // Aurora yellow
      accent: nord[15], // Aurora purple
      'accent-hover': nord[14], // Aurora green
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[12],
      hover: nord[2],
      active: nord[3],
      focus: nord[11],
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
  'Nord Dark Polar': {
    name: 'Nord Dark Polar',
    colors: {
      background: nord[0],
      'background-secondary': nord[1],
      'background-tertiary': nord[2],
      surface: nord[1],
      'surface-secondary': nord[2],
      'surface-tertiary': nord[3],
      text: nord[6],
      'text-secondary': nord[5],
      'text-tertiary': nord[4],
      'text-muted': nord[3],
      border: nord[1],
      'border-secondary': nord[2],
      primary: nord[9],
      'primary-hover': nord[10],
      secondary: nord[8],
      'secondary-hover': nord[9],
      accent: nord[7],
      'accent-hover': nord[8],
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[8],
      hover: nord[1],
      active: nord[0],
      focus: nord[9],
      shadow: 'rgba(0, 0, 0, 0.5)',
      'shadow-lg': 'rgba(0, 0, 0, 0.7)',
    },
    fonts: {
      sans: '"Inter", "Poppins", "Nunito", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'compact',
      messageSize: 'medium',
      messageSpacing: 'tight',
    },
  },
  'Nord Dark Minimal': {
    name: 'Nord Dark Minimal',
    colors: {
      background: nord[0],
      'background-secondary': nord[1],
      'background-tertiary': nord[2],
      surface: nord[1],
      'surface-secondary': nord[2],
      'surface-tertiary': nord[1],
      text: nord[6],
      'text-secondary': nord[5],
      'text-tertiary': nord[4],
      'text-muted': nord[3],
      border: nord[2],
      'border-secondary': nord[3],
      primary: nord[9],
      'primary-hover': nord[10],
      secondary: nord[9],
      'secondary-hover': nord[10],
      accent: nord[9],
      'accent-hover': nord[10],
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[8],
      hover: nord[1],
      active: nord[2],
      focus: nord[9],
      shadow: 'rgba(0, 0, 0, 0.2)',
      'shadow-lg': 'rgba(0, 0, 0, 0.3)',
    },
    fonts: {
      sans: 'system-ui, sans-serif',
      mono: '"SF Mono", Monaco, "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'compact',
      messageSize: 'medium',
      messageSpacing: 'tight',
    },
  },
  'Nord Light Frost': {
    name: 'Nord Light Frost',
    colors: {
      background: nord[6],
      'background-secondary': nord[5],
      'background-tertiary': nord[4],
      surface: nord[5],
      'surface-secondary': nord[4],
      'surface-tertiary': nord[0],
      text: nord[0],
      'text-secondary': nord[1],
      'text-tertiary': nord[2],
      'text-muted': nord[3],
      border: nord[4],
      'border-secondary': nord[0],
      primary: nord[8],
      'primary-hover': nord[0],
      secondary: nord[7],
      'secondary-hover': nord[10],
      accent: nord[9],
      'accent-hover': nord[10],
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[8],
      hover: nord[5],
      active: nord[4],
      focus: nord[8],
      shadow: `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.1)`,
      'shadow-lg': `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.2)`,
    },
    fonts: {
      sans: '"Inter", "Poppins", "Nunito", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'cozy',
      messageSize: 'large',
      messageSpacing: 'loose',
    },
  },
  'Nord Light Aurora': {
    name: 'Nord Light Aurora',
    colors: {
      background: nord[6],
      'background-secondary': nord[5],
      'background-tertiary': nord[4],
      surface: nord[5],
      'surface-secondary': nord[4],
      'surface-tertiary': nord[0],
      text: nord[0],
      'text-secondary': nord[1],
      'text-tertiary': nord[2],
      'text-muted': nord[3],
      border: nord[4],
      'border-secondary': nord[0],
      primary: nord[11],
      'primary-hover': nord[0],
      secondary: nord[14],
      'secondary-hover': nord[10],
      accent: nord[15],
      'accent-hover': nord[10],
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[12],
      hover: nord[5],
      active: nord[4],
      focus: nord[11],
      shadow: `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.1)`,
      'shadow-lg': `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.2)`,
    },
    fonts: {
      sans: '"Inter", "Poppins", "Nunito", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'cozy',
      messageSize: 'large',
      messageSpacing: 'loose',
    },
  },
  'Nord Light Clean': {
    name: 'Nord Light Clean',
    colors: {
      background: nord[6],
      'background-secondary': nord[5],
      'background-tertiary': nord[6],
      surface: nord[5],
      'surface-secondary': nord[6],
      'surface-tertiary': nord[0],
      text: nord[0],
      'text-secondary': nord[1],
      'text-tertiary': nord[2],
      'text-muted': nord[3],
      border: nord[4],
      'border-secondary': nord[5],
      primary: nord[9],
      'primary-hover': nord[0],
      secondary: nord[8],
      'secondary-hover': nord[10],
      accent: nord[10],
      'accent-hover': nord[0],
      success: nord[14],
      warning: nord[13],
      error: nord[11],
      info: nord[8],
      hover: nord[6],
      active: nord[5],
      focus: nord[9],
      shadow: `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.05)`,
      'shadow-lg': `rgba(${parseInt(nord[0].slice(1, 3), 16)}, ${parseInt(nord[0].slice(3, 5), 16)}, ${parseInt(nord[0].slice(5, 7), 16)}, 0.1)`,
    },
    fonts: {
      sans: 'system-ui, sans-serif',
      mono: '"SF Mono", Monaco, "Source Code Pro", monospace',
    },
    layout: {
      viewMode: 'cozy',
      messageSize: 'large',
      messageSpacing: 'loose',
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
