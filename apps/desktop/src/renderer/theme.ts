import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeTokens {
  bg: string;
  bgSurface: string;
  bgDeep: string;
  border: string;
  borderAccent: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentBg: string;
  danger: string;
  success: string;
  warning: string;
}

const dark: ThemeTokens = {
  bg: '#1a1a2e',
  bgSurface: '#16162a',
  bgDeep: '#0d0d1a',
  border: '#333',
  borderAccent: '#5555aa',
  text: '#e0e0e0',
  textMuted: '#888',
  textDim: '#555',
  accent: '#5555aa',
  accentBg: '#2d2d4e',
  danger: '#ff6b6b',
  success: '#88cc88',
  warning: '#cc8855',
};

const light: ThemeTokens = {
  bg: '#f5f5f5',
  bgSurface: '#ffffff',
  bgDeep: '#e8e8e8',
  border: '#d0d0d0',
  borderAccent: '#5555aa',
  text: '#222222',
  textMuted: '#666666',
  textDim: '#999999',
  accent: '#5555aa',
  accentBg: '#e8e8f4',
  danger: '#cc3333',
  success: '#2a8a2a',
  warning: '#b07020',
};

export const themeTokens: Record<Theme, ThemeTokens> = { dark, light };

export interface ThemeContextValue {
  theme: Theme;
  tokens: ThemeTokens;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  tokens: dark,
  toggleTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
