/**
 * useThemeViewModel
 *
 * Central theme state management for FitQuest.
 * Persists the user's theme preference to the app_state SQLite table.
 *
 * Usage:
 *   const { currentTheme, setTheme, availableThemes, autoTheme, accessibilityMode } = useThemeViewModel();
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Appearance } from 'react-native';
import { allThemes, themeConfigs, DEFAULT_THEME_ID, type ThemeConfig } from '../design/themes/themeConfigs';
import { getAppState, setAppState } from '../database/service';

// ============================================================================
// CONSTANTS
// ============================================================================

const APP_STATE_KEY_THEME = 'ui:theme:selected';
const APP_STATE_KEY_AUTO = 'ui:theme:auto';
const APP_STATE_KEY_A11Y = 'ui:theme:accessibility';

// ============================================================================
// TYPES
// ============================================================================

export type AccessibilityMode = 'none' | 'highContrast' | 'reducedMotion';

export interface ThemeViewModelReturn {
  /** The currently active theme config */
  currentTheme: ThemeConfig;
  /** All available themes */
  availableThemes: ThemeConfig[];
  /** Whether auto-theming (system light/dark) is active */
  autoTheme: boolean;
  /** Active accessibility mode */
  accessibilityMode: AccessibilityMode;
  /** Id of the currently selected theme */
  selectedThemeId: string;
  /** Whether the ViewModel has loaded persisted prefs */
  isLoaded: boolean;
  /** Switch to a specific theme by id */
  setTheme: (themeId: string) => Promise<void>;
  /** Toggle auto-theme (follows system dark/light) */
  setAutoTheme: (enabled: boolean) => Promise<void>;
  /** Set accessibility mode */
  setAccessibilityMode: (mode: AccessibilityMode) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useThemeViewModel(): ThemeViewModelReturn {
  const [selectedThemeId, setSelectedThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [autoTheme, setAutoThemeState] = useState<boolean>(false);
  const [accessibilityMode, setAccessibilityModeState] = useState<AccessibilityMode>('none');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // ── Load persisted prefs on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      try {
        const [storedTheme, storedAuto, storedA11y] = await Promise.all([
          getAppState(APP_STATE_KEY_THEME),
          getAppState(APP_STATE_KEY_AUTO),
          getAppState(APP_STATE_KEY_A11Y),
        ]);

        if (cancelled) return;

        if (storedTheme && themeConfigs[storedTheme]) {
          setSelectedThemeId(storedTheme);
        }
        if (storedAuto === 'true') {
          setAutoThemeState(true);
        }
        if (storedA11y && ['none', 'highContrast', 'reducedMotion'].includes(storedA11y)) {
          setAccessibilityModeState(storedA11y as AccessibilityMode);
        }
      } catch {
        // DB not ready or first run — defaults are fine
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-theme: follow system color scheme ─────────────────────────────────
  useEffect(() => {
    if (!autoTheme) return;

    function handleSchemeChange({ colorScheme }: { colorScheme: string | null | undefined }) {
      const resolved = colorScheme === 'light' ? 'light' : 'dark';
      setSelectedThemeId(resolved);
    }

    const subscription = Appearance.addChangeListener(handleSchemeChange);
    // Apply immediately
    const current = Appearance.getColorScheme();
    setSelectedThemeId(current === 'light' ? 'light' : 'dark');

    return () => subscription.remove();
  }, [autoTheme]);

  // ── Setters ────────────────────────────────────────────────────────────────

  const setTheme = useCallback(async (themeId: string) => {
    if (!themeConfigs[themeId]) return;
    setSelectedThemeId(themeId);
    try {
      await setAppState(APP_STATE_KEY_THEME, themeId);
    } catch {
      // Non-fatal — UI update already applied
    }
  }, []);

  const setAutoTheme = useCallback(async (enabled: boolean) => {
    setAutoThemeState(enabled);
    try {
      await setAppState(APP_STATE_KEY_AUTO, String(enabled));
    } catch {
      // Non-fatal
    }
  }, []);

  const setAccessibilityMode = useCallback(async (mode: AccessibilityMode) => {
    setAccessibilityModeState(mode);
    try {
      await setAppState(APP_STATE_KEY_A11Y, mode);
    } catch {
      // Non-fatal
    }
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────

  const currentTheme = useMemo<ThemeConfig>(
    () => themeConfigs[selectedThemeId] ?? themeConfigs[DEFAULT_THEME_ID] ?? allThemes[0]!,
    [selectedThemeId],
  );

  const availableThemes = useMemo<ThemeConfig[]>(() => allThemes, []);

  return {
    currentTheme,
    availableThemes,
    autoTheme,
    accessibilityMode,
    selectedThemeId,
    isLoaded,
    setTheme,
    setAutoTheme,
    setAccessibilityMode,
  };
}
