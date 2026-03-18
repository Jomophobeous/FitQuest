import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkTheme, lightTheme, blackGoldTheme, type Theme, type ThemeMode } from '../design/theme-system';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'fitquest.theme.mode';

const VALID_MODES: ThemeMode[] = ['dark', 'light', 'blackGold'];

function isValidMode(value: string | null): value is ThemeMode {
  return value !== null && VALID_MODES.includes(value as ThemeMode);
}

const themeMap: Record<ThemeMode, Theme> = {
  dark: darkTheme,
  light: lightTheme,
  blackGold: blackGoldTheme,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Load saved theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (isValidMode(saved)) {
          setModeState(saved);
        } else if (systemColorScheme && isValidMode(systemColorScheme)) {
          setModeState(systemColorScheme);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    })();
  }, [systemColorScheme]);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, []);

  // Cycle: dark → light → blackGold → dark
  const toggleTheme = useCallback(() => {
    const next: Record<ThemeMode, ThemeMode> = {
      dark: 'light',
      light: 'blackGold',
      blackGold: 'dark',
    };
    setMode(next[mode]);
  }, [mode, setMode]);

  const theme = themeMap[mode];

  const contextValue = useMemo(() => ({
    mode, theme, toggleTheme, setMode,
  }), [mode, theme, toggleTheme, setMode]);

  // Always provide context, even during loading (use default dark theme)
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useColors() {
  const { theme } = useTheme();
  return theme.colors;
}

export function useThemeValue<T>(darkValue: T, lightValue: T, blackGoldValue?: T): T {
  const { mode } = useTheme();
  if (mode === 'blackGold') return blackGoldValue ?? darkValue;
  return mode === 'dark' ? darkValue : lightValue;
}
