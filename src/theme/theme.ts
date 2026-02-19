// Legacy theme file — canonical theme is src/design/theme-system.ts
// Kept for backward compatibility with any remaining consumers

// GREEN is the ONE accent color for primary actions
const ACCENT_GREEN = '#10B981';
const WARNING_AMBER = '#F4A427';
const ERROR_RED = '#EF4444';

export const theme = {
  colors: {
    primary: ACCENT_GREEN,
    onPrimary: '#FFFFFF',
    primaryContainer: '#D1FAE5',
    onPrimaryContainer: '#065F46',
    secondary: ACCENT_GREEN,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#D1FAE5',
    onSecondaryContainer: '#065F46',
    tertiary: WARNING_AMBER,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FEF3C7',
    onTertiaryContainer: '#78350F',
    error: ERROR_RED,
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',
    background: '#FAFAFA',
    onBackground: '#1F2937',
    surface: '#FFFFFF',
    onSurface: '#1F2937',
    surfaceVariant: '#F3F4F6',
    onSurfaceVariant: '#6B7280',
    outline: '#D1D5DB',
  },
};

export const lightColors = {
  primary: ACCENT_GREEN,
  secondary: ACCENT_GREEN,
  accent: ACCENT_GREEN,
  success: ACCENT_GREEN,
  warning: WARNING_AMBER,
  error: ERROR_RED,
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  disabled: '#D1D5DB',
};

export type ColorScheme = typeof lightColors;
