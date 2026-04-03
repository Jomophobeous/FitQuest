// Legacy theme file — canonical theme is src/design/theme-system.ts
// Kept for backward compatibility with any remaining consumers

import { darkTheme } from '../design/theme-system';

const canonical = darkTheme;

export const theme = {
  colors: {
    primary: canonical.colors.accent,
    onPrimary: canonical.colors.onAccent,
    primaryContainer: canonical.colors.accent,
    onPrimaryContainer: canonical.colors.accentDark,
    secondary: canonical.colors.accent,
    onSecondary: canonical.colors.onAccent,
    secondaryContainer: canonical.colors.accent,
    onSecondaryContainer: canonical.colors.accentDark,
    tertiary: canonical.colors.warning,
    onTertiary: canonical.colors.onAccent,
    tertiaryContainer: canonical.colors.warning,
    onTertiaryContainer: canonical.colors.warning,
    error: canonical.colors.error,
    onError: canonical.colors.onAccent,
    errorContainer: canonical.colors.error,
    onErrorContainer: canonical.colors.error,
    background: canonical.colors.onAccent,
    onBackground: canonical.colors.surface,
    surface: canonical.colors.onAccent,
    onSurface: canonical.colors.surface,
    surfaceVariant: canonical.colors.text,
    onSurfaceVariant: canonical.colors.textMuted,
    outline: canonical.colors.border,
  },
};

export const lightColors = {
  primary: ACCENT_GREEN,
  secondary: ACCENT_GREEN,
  accent: ACCENT_GREEN,
  success: ACCENT_GREEN,
  warning: WARNING_AMBER,
  error: ERROR_RED,
  background: theme.colors.onAccent,
  surface: theme.colors.onAccent,
  text: theme.colors.surface,
  textSecondary: theme.colors.textMuted,
  border: theme.colors.border,
  disabled: theme.colors.border,
};

export type ColorScheme = typeof lightColors;
