/**
 * FitQuest Design System
 *
 * Philosophy:
 * - Dark Mode: Emotion, immersion, focus (glowing accents, visual drama)
 * - Light Mode: Speed, analysis, accuracy (clinical, sharp, zero glare)
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

// ONE accent color: Green (#10B981) for all primary actions
// Warnings: Amber (#F4A427) / Red (#EF4444)
// Everything else: Grayscale

export const colorSystem = {
  dark: {
    // Base
    background: '#050507', // Pure charcoal black
    surface: '#0E0E12', // Elevated surface
    surfaceVariant: '#161619', // Secondary surface (cards)

    // Text
    text: '#F4F5F9', // Primary text (crisp white)
    textSecondary: '#A8B0C0', // Secondary text
    textMuted: '#6B7590', // Tertiary/meta text

    // Dividers
    border: '#1E1E24', // Hairline borders
    divider: '#18181D', // Internal dividers

    // Single accent color - GREEN for all primary actions
    accent: '#10B981',

    // Semantic
    error: '#EF4444',
    warning: '#F4A427',
    success: '#10B981',
    info: '#3B82F6',
    accentDark: '#059669',

    // Backward compatibility aliases (use warning/success instead)
    accent2: '#F4A427', // → use warning
    accent3: '#10B981', // → use success/accent

    // Category accent colors
    purple: '#8B5CF6',
    indigo: '#5F63FF',
    pink: '#EC4899',
    blue: '#3B82F6',
    orange: '#F97316',
    skyBlue: '#38BDF8',
    purpleLight: '#A78BFA',
    pinkLight: '#F472B6',

    // Contrast text on accent-colored surfaces
    onAccent: '#FFFFFF',

    // Chrome
    overlay: 'rgba(0,0,0,0.65)',
  },

  light: {
    // Base
    background: '#F5F6F8', // Soft cool gray
    surface: '#FFFFFF', // Primary surface (cards)
    surfaceVariant: '#EBEDF2', // Secondary surface

    // Text
    text: '#111318', // Primary text (near-black)
    textSecondary: '#4A4F5C', // Secondary text
    textMuted: '#6D7385', // Tertiary/meta text

    // Dividers
    border: '#D0D5DE', // Hairline borders
    divider: '#DCE0E8', // Internal dividers

    // Single accent color - GREEN for all primary actions
    accent: '#10B981',

    // Semantic
    error: '#DC2626',
    warning: '#F4A427',
    success: '#10B981',
    info: '#3B82F6',
    accentDark: '#059669',

    // Backward compatibility aliases (use warning/success instead)
    accent2: '#F4A427', // → use warning
    accent3: '#10B981', // → use success/accent

    // Category accent colors
    purple: '#8B5CF6',
    indigo: '#5F63FF',
    pink: '#EC4899',
    blue: '#3B82F6',
    orange: '#F97316',
    skyBlue: '#38BDF8',
    purpleLight: '#A78BFA',
    pinkLight: '#F472B6',

    // Contrast text on accent-colored surfaces
    onAccent: '#FFFFFF',

    // Chrome
    overlay: 'rgba(0,0,0,0.60)',
  },

  blackGold: {
    // Base — deep true black for maximum luxury contrast
    background: '#020204',
    surface: '#0A0A0C',
    surfaceVariant: '#121214',

    // Text — crisp platinum/silver (no warm parchment)
    text: '#F2F2F5',
    textSecondary: '#ACACB2',
    textMuted: '#6E6E76',

    // Dividers — cool charcoal
    border: '#252528',
    divider: '#1A1A1E',

    // Single accent color — refined warm gold (not blinding)
    accent: '#D4A843',

    // Semantic — distinct colors, not all gold
    error: '#B83240',
    warning: '#C8943A',
    success: '#D4A843', // Gold for success in blackGold theme
    info: '#5A8FBF',
    accentDark: '#B8912C',

    // Backward compatibility aliases
    accent2: '#C8943A',
    accent3: '#D4A843', // Warm gold

    // Category accent colors — understated luxury palette
    purple: '#9B86C7',
    indigo: '#7B7FCC',
    pink: '#C77090',
    blue: '#5A8FBF',
    orange: '#C7924A',
    skyBlue: '#5AADC7',
    purpleLight: '#B49AE0',
    pinkLight: '#D499B0',

    // Contrast text on accent-colored (gold) surfaces
    onAccent: '#050507',

    // Chrome
    overlay: 'rgba(0,0,0,0.85)',
  },
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  sizes: {
    mega: 120,
    jumbo: 56,
    hero: 48,
    displayLg: 40,
    display: 36,
    h1: 32,
    h1Sm: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 16,
    bodyMid: 15,
    bodySmall: 14,
    label: 13,
    caption: 12,
    captionSm: 11,
    xs: 10,
    micro: 9,
    xxs: 8,
  },

  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============================================================================
// SPACING
// ============================================================================

export const spacing: Record<string | number, number> = {
  px: 1,
  0: 0,
  0.5: 2,
  0.75: 3,
  1: 4,
  1.25: 5,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  15: 60,
  20: 80,
  25: 100,
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  dark: {
    none: 'none',
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  light: {
    none: 'none',
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

// ============================================================================
// ANIMATION / MOTION
// ============================================================================

export const motion = {
  dark: {
    fast: 150,
    base: 250,
    slow: 350,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material easing
  },
  light: {
    fast: 150,
    base: 200, // Shorter, more snappy
    slow: 300, // Motion is quieter
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ============================================================================
// COMPLETE THEME OBJECTS
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'blackGold';

export const createTheme = (mode: ThemeMode) => {
  const colors = colorSystem[mode];
  // Black & Gold is a dark variant — reuse dark shadow/motion configs
  const baseMode = mode === 'blackGold' ? 'dark' : mode;
  const animationConfig = motion[baseMode];
  const shadowConfig = shadows[baseMode];

  return {
    colors,
    typography,
    spacing,
    radius,
    borderRadius: radius,
    shadows: shadowConfig,
    motion: animationConfig,

    // Utilities for theme switching
    isDark: mode === 'dark' || mode === 'blackGold',
    isLight: mode === 'light',
    isBlackGold: mode === 'blackGold',
  };
};

// ============================================================================
// EXERCISE CATEGORY GRADIENTS & ICONS
// ============================================================================

export const categoryTheme: Record<
  string,
  {
    colors: [string, string];
    icon: string;
  }
> = {
  body_control: { colors: ['#10B981', '#059669'], icon: 'human-handsup' },
  posture: { colors: ['#6366F1', '#4F46E5'], icon: 'human-male-height' },
  speed: { colors: ['#F59E0B', '#D97706'], icon: 'lightning-bolt' },
  mobility: { colors: ['#EC4899', '#DB2777'], icon: 'yoga' },
  focus: { colors: ['#8B5CF6', '#7C3AED'], icon: 'meditation' },
  strength: { colors: ['#EF4444', '#DC2626'], icon: 'dumbbell' },
};

export const defaultCategoryTheme = { colors: ['#64748B', '#475569'] as [string, string], icon: 'dumbbell' };

// Export default theme (dark mode by default)
export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');
export const blackGoldTheme = createTheme('blackGold');

export type Theme = ReturnType<typeof createTheme>;

// ============================================================================
// THEME CONFIG TYPE (re-exported from themes/themeConfigs for convenience)
// ============================================================================

export type {
  ThemeConfig,
  ThemeColorPalette,
  ThemeAnimationSettings,
  ThemeAccessibility,
  ThemeCategory,
} from './themes/themeConfigs';

// ============================================================================
// WCAG CONTRAST VALIDATION
// ============================================================================

/**
 * Converts a hex color string to relative luminance (WCAG 2.1 definition).
 * Accepts #RRGGBB or #RGB.
 */
export function hexToRelativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates the WCAG contrast ratio between two hex colors.
 * Returns a value between 1 (no contrast) and 21 (max contrast).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToRelativeLuminance(hex1);
  const l2 = hexToRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastCheckResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}

/**
 * Check contrast ratio between text and background colors.
 * WCAG AA requires ≥ 4.5:1 for normal text, ≥ 3:1 for large text.
 * WCAG AAA requires ≥ 7:1 for normal text.
 */
export function checkColorContrast(textColor: string, bgColor: string): ContrastCheckResult {
  const ratio = getContrastRatio(textColor, bgColor);
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7.0,
  };
}

/**
 * Validate that a theme's primary text/accent colors meet WCAG AA (4.5:1)
 * against the background. Returns a map of color key → ContrastCheckResult.
 */
export function validateThemeColors(
  colors: import('./themes/themeConfigs').ThemeColorPalette,
): Record<string, ContrastCheckResult> {
  const pairs: Array<[string, string]> = [
    ['text', colors.text],
    ['textSecondary', colors.textSecondary],
    ['accent', colors.accent],
  ];

  const results: Record<string, ContrastCheckResult> = {};
  for (const [label, textColor] of pairs) {
    results[label] = checkColorContrast(textColor, colors.background);
  }
  return results;
}
