import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      return 'light'; // Default for SSR
    }

    // Check localStorage first, then system preference
    const saved = localStorage.getItem('pufferblow-theme') as Theme;
    if (saved) return saved;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Save to localStorage
    localStorage.setItem('pufferblow-theme', theme);

    // Update document class for Tailwind dark mode
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update CSS custom properties
    const root = document.documentElement;
    const colors = theme === 'dark' ? darkTheme : lightTheme;

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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

// Pufferblow Nord theme colors
// Arctic-inspired cold color palette with blues and whites
const lightTheme = {
  // Background colors - Polar Night
  background: '#2E3440',
  'background-secondary': '#3B4252',
  'background-tertiary': '#434C5E',

  // Surface colors - slightly lighter Polar Night
  surface: 'rgba(59, 66, 82, 0.9)',
  'surface-secondary': 'rgba(59, 66, 82, 0.7)',
  'surface-tertiary': 'rgba(59, 66, 82, 0.5)',

  // Text colors - Snow Storm
  text: '#ECEFF4',
  'text-secondary': '#E5E9F0',
  'text-tertiary': '#D8DEE9',
  'text-muted': '#4C566A',

  // Border colors - Frost
  border: 'rgba(136, 192, 208, 0.3)',
  'border-secondary': 'rgba(136, 192, 208, 0.5)',

  // Accent colors - Frost
  primary: '#88C0D0', // Frost blue
  'primary-hover': '#81A1C1',
  secondary: '#5E81AC', // Deep frost
  'secondary-hover': '#4C566A',
  accent: '#8FBCBB', // Frost cyan
  'accent-hover': '#88C0D0',

  // Status colors - Aurora
  success: '#A3BE8C', // Aurora green
  warning: '#EBCB8B', // Aurora yellow
  error: '#BF616A', // Aurora red
  info: '#88C0D0', // Frost blue

  // Interactive elements - subtle frost effects
  hover: 'rgba(136, 192, 208, 0.1)',
  active: 'rgba(136, 192, 208, 0.2)',
  focus: '#88C0D0',

  // Shadows - arctic shadows
  shadow: 'rgba(46, 52, 64, 0.3)',
  'shadow-lg': 'rgba(46, 52, 64, 0.5)',
};

// Dark theme - Nord (true dark variant with slightly different contrast)
const darkTheme = {
  // Background colors - deeper Polar Night
  background: '#242933',
  'background-secondary': '#2E3440',
  'background-tertiary': '#3B4252',

  // Surface colors - Polar Night surfaces
  surface: 'rgba(46, 52, 64, 0.9)',
  'surface-secondary': 'rgba(46, 52, 64, 0.7)',
  'surface-tertiary': 'rgba(46, 52, 64, 0.5)',

  // Text colors - brighter Snow Storm for dark background
  text: '#ECEFF4',
  'text-secondary': '#E5E9F0',
  'text-tertiary': '#D8DEE9',
  'text-muted': '#4C566A',

  // Border colors - Frost borders
  border: 'rgba(136, 192, 208, 0.4)',
  'border-secondary': 'rgba(136, 192, 208, 0.6)',

  // Accent colors - brighter Frost variants
  primary: '#88C0D0', // Frost blue
  'primary-hover': '#81A1C1',
  secondary: '#5E81AC', // Deep frost
  'secondary-hover': '#4C566A',
  accent: '#8FBCBB', // Frost cyan
  'accent-hover': '#88C0D0',

  // Status colors - Aurora
  success: '#A3BE8C', // Aurora green
  warning: '#EBCB8B', // Aurora yellow
  error: '#BF616A', // Aurora red
  info: '#88C0D0', // Frost blue

  // Interactive elements - frost effects
  hover: 'rgba(136, 192, 208, 0.15)',
  active: 'rgba(136, 192, 208, 0.25)',
  focus: '#88C0D0',

  // Shadows - deeper arctic shadows
  shadow: 'rgba(36, 41, 51, 0.4)',
  'shadow-lg': 'rgba(36, 41, 51, 0.6)',
};
