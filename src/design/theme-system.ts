/**
 * FitQuest Design System
 *
 * Philosophy:
 * - Dark Mode: Emotion, immersion, focus (glowing accents, visual drama)
 * - Light Mode: Speed, analysis, accuracy (clinical, sharp, zero glare)
 * - Premium: Luxury and authority (gold, platinum)
 * - Vibrant: Energy and engagement (neon, saturation)
 * - Wellness: Calm and restoration (natural palette)
 */

import { themeConfigs, type ThemeEffects } from './themes/themeConfigs';
import { animationEasing, getThemeEffect, getThemeEffects } from './themes/themeEffects';

export { animationEasing, getThemeEffect, getThemeEffects };
export type { ThemeEffects };

// ============================================================================
// COLOR SYSTEM (Legacy - for backward compatibility)
// ============================================================================

export const colorSystem = {
  dark: {
    background: '#050507',
    surface: '#0E0E12',
    surfaceVariant: '#161619',
    text: '#F4F5F9',
    textSecondary: '#A8B0C0',
    textMuted: '#6B7590',
    border: '#1E1E24',
    divider: '#18181D',
    accent: '#10B981',
    error: '#EF4444',
    warning: '#F4A427',
    success: '#10B981',
    info: '#3B82F6',
    accentDark: '#059669',
    accent2: '#F4A427',
    accent3: '#10B981',
    purple: '#8B5CF6',
    indigo: '#5F63FF',
    pink: '#EC4899',
    blue: '#3B82F6',
    orange: '#F97316',
    skyBlue: '#38BDF8',
    purpleLight: '#A78BFA',
    pinkLight: '#F472B6',
    onAccent: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.65)',
  },

  light: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceVariant: '#EBEDF2',
    text: '#111318',
    textSecondary: '#4A4F5C',
    textMuted: '#6D7385',
    border: '#D0D5DE',
    divider: '#DCE0E8',
    accent: '#047857',
    error: '#DC2626',
    warning: '#F4A427',
    success: '#047857',
    info: '#3B82F6',
    accentDark: '#065F46',
    accent2: '#F4A427',
    accent3: '#047857',
    purple: '#8B5CF6',
    indigo: '#5F63FF',
    pink: '#EC4899',
    blue: '#3B82F6',
    orange: '#F97316',
    skyBlue: '#38BDF8',
    purpleLight: '#A78BFA',
    pinkLight: '#F472B6',
    onAccent: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.60)',
  },

  blackGold: {
    background: '#020204',
    surface: '#0A0A0C',
    surfaceVariant: '#121214',
    text: '#F2F2F5',
    textSecondary: '#ACACB2',
    textMuted: '#6E6E76',
    border: '#252528',
    divider: '#1A1A1E',
    accent: '#D4A843',
    error: '#B83240',
    warning: '#C8943A',
    success: '#D4A843',
    info: '#5A8FBF',
    accentDark: '#B8912C',
    accent2: '#C8943A',
    accent3: '#D4A843',
    purple: '#9B86C7',
    indigo: '#7B7FCC',
    pink: '#C77090',
    blue: '#5A8FBF',
    orange: '#C7924A',
    skyBlue: '#5AADC7',
    purpleLight: '#B49AE0',
    pinkLight: '#D499B0',
    onAccent: '#050507',
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
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  light: {
    fast: 150,
    base: 200,
    slow: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ============================================================================
// THEME BUILDER
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'blackGold' | 'neon' | 'energy' | 'wellness' | 'elite' | 'sunset';

const LIGHT_THEMES: ThemeMode[] = ['light', 'wellness'];
const DARK_THEMES: ThemeMode[] = ['dark', 'blackGold', 'neon', 'energy', 'elite', 'sunset'];

export const createTheme = (mode: ThemeMode) => {
  const config = themeConfigs[mode];
  if (!config) {
    throw new Error(`Unknown theme mode: ${mode}`);
  }

  const colors = config.colors;
  const isDark = DARK_THEMES.includes(mode);
  const baseMode = isDark ? 'dark' : 'light';
  const animationConfig = {
    ...motion[baseMode as keyof typeof motion],
    base: config.animations.animationSpeed,
  };
  const shadowConfig = shadows[baseMode as keyof typeof shadows];

  return {
    colors,
    typography,
    spacing,
    radius,
    borderRadius: radius,
    shadows: shadowConfig,
    motion: animationConfig,
    effects: config.effects,

    isDark,
    isLight: !isDark,
    isBlackGold: mode === 'blackGold',
    themeId: mode,
  };
};

// ============================================================================
// PRE-BUILT THEMES
// ============================================================================

export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');
export const blackGoldTheme = createTheme('blackGold');
export const neonTheme = createTheme('neon');
export const energyTheme = createTheme('energy');
export const wellnessTheme = createTheme('wellness');
export const eliteTheme = createTheme('elite');
export const sunsetTheme = createTheme('sunset');

export const allThemeInstances: Record<ThemeMode, ReturnType<typeof createTheme>> = {
  dark: darkTheme,
  light: lightTheme,
  blackGold: blackGoldTheme,
  neon: neonTheme,
  energy: energyTheme,
  wellness: wellnessTheme,
  elite: eliteTheme,
  sunset: sunsetTheme,
};

export type Theme = ReturnType<typeof createTheme>;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  ThemeConfig,
  ThemeColorPalette,
  ThemeAnimationSettings,
  ThemeAccessibility,
  ThemeCategory,
  GlassSpec,
  ElevationSpec,
  GradientPair,
} from './themes/themeConfigs';

// ============================================================================
// WCAG CONTRAST VALIDATION
// ============================================================================

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

export function checkColorContrast(textColor: string, bgColor: string): ContrastCheckResult {
  const ratio = getContrastRatio(textColor, bgColor);
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7.0,
  };
}

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
