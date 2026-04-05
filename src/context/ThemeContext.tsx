import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { allThemeInstances, type Theme, type ThemeMode, type ThemeEffects } from '../design/theme-system';
import { getThemeEffects } from '../design/themes/themeEffects';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  themeEffects: ThemeEffects | undefined;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'fitquest.theme.mode';

const ALL_MODES: ThemeMode[] = ['dark', 'light', 'blackGold', 'neon', 'energy', 'wellness', 'elite', 'sunset'];

function isValidMode(value: string | null): value is ThemeMode {
  return value !== null && ALL_MODES.includes(value as ThemeMode);
}

// Build theme cycle map
const CYCLE_MAP = (() => {
  const map = {} as Record<ThemeMode, ThemeMode>;
  ALL_MODES.forEach((mode, i) => {
    map[mode] = ALL_MODES[(i + 1) % ALL_MODES.length];
  });
  return map;
})();

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
        if (__DEV__) console.warn('Failed to load theme preference:', e);
      }
    })();
  }, [systemColorScheme]);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      if (__DEV__) console.warn('Failed to save theme preference:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(CYCLE_MAP[mode]);
  }, [mode, setMode]);

  const theme = allThemeInstances[mode];

  let effects: ThemeEffects | undefined;
  try {
    effects = getThemeEffects(mode);
  } catch {
    effects = undefined;
  }

  const contextValue = useMemo(
    () => ({
      mode,
      theme,
      themeEffects: effects,
      toggleTheme,
      setMode,
    }),
    [mode, theme, effects, toggleTheme, setMode],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
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

export function useThemeEffects(): ThemeEffects | undefined {
  const { themeEffects } = useTheme();
  return themeEffects;
}

export function useThemeValue<T>(darkValue: T, lightValue: T, blackGoldValue?: T): T {
  const { mode } = useTheme();
  if (mode === 'blackGold') return blackGoldValue ?? darkValue;
  const lightModes: ThemeMode[] = ['light', 'wellness'];
  return lightModes.includes(mode) ? lightValue : darkValue;
}
