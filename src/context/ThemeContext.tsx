import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type Theme } from '../design/theme-system';

interface ThemeContextType {
  mode: 'dark' | 'light';
  theme: Theme;
  toggleTheme: () => void;
  setMode: (mode: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'fitquest.theme.mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<'dark' | 'light'>('dark');

  // Load saved theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        } else if (systemColorScheme) {
          setModeState(systemColorScheme);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    })();
  }, [systemColorScheme]);

  const setMode = async (newMode: 'dark' | 'light') => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  };

  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  // Always provide context, even during loading (use default dark theme)
  return (
    <ThemeContext.Provider value={{ mode, theme, toggleTheme, setMode }}>
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

export function useThemeValue<T>(darkValue: T, lightValue: T): T {
  const { mode } = useTheme();
  return mode === 'dark' ? darkValue : lightValue;
}
