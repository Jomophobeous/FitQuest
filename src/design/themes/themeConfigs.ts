/**
 * FitQuest Theme Configurations
 *
 * All 8 theme definitions with full palettes, animation settings, accessibility metadata, and effects.
 * Complete theme infrastructure with glass-morphism, gradients, shadows, and easing.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeColorPalette {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  accent: string;
  accentDark: string;
  onAccent: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  accent2: string;
  accent3: string;
  purple: string;
  indigo: string;
  pink: string;
  blue: string;
  orange: string;
  skyBlue: string;
  purpleLight: string;
  pinkLight: string;
  overlay: string;
}

export interface ThemeAnimationSettings {
  transitionDuration: number;
  useHighContrast: boolean;
  animationSpeed: number;
}

export interface ThemeAccessibility {
  wcagLevel: 'AA' | 'AAA';
  minContrastRatio: number;
}

export type ThemeCategory = 'dark' | 'light' | 'premium' | 'vibrant' | 'wellness';

/** Glass-morphism effect specification */
export interface GlassSpec {
  blur: number;
  opacity: number;
  borderOpacity: number;
  shadowBlur: number;
}

/** Gradient color pair [start, end] */
export type GradientPair = [string, string];

/** Shadow elevation specification */
export interface ElevationSpec {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** Complete theme effects configuration */
export interface ThemeEffects {
  glass: {
    card: GlassSpec;
    button: GlassSpec;
    modal: GlassSpec;
    navbar: GlassSpec;
  };
  gradients: {
    primary: GradientPair;
    secondary: GradientPair;
    warm: GradientPair;
    cool: GradientPair;
  };
  elevations: {
    sm: ElevationSpec;
    md: ElevationSpec;
    lg: ElevationSpec;
  };
  glassOpacity: number;
}

export interface ThemeConfig {
  id: string;
  label: string;
  category: ThemeCategory;
  description: string;
  colors: ThemeColorPalette;
  animations: ThemeAnimationSettings;
  accessibility: ThemeAccessibility;
  effects: ThemeEffects;
}

// ============================================================================
// HELPERS
// ============================================================================

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildEffects(
  accent: string,
  accent2: string,
  warning: string,
  info: string,
  glassOpacity: number,
  isDark: boolean,
): ThemeEffects {
  const shadowColor = isDark ? '#000000' : '#1a1a2e';
  return {
    glass: {
      card: { blur: 12, opacity: glassOpacity, borderOpacity: 0.3, shadowBlur: 20 },
      button: { blur: 8, opacity: glassOpacity + 0.04, borderOpacity: 0.4, shadowBlur: 12 },
      modal: { blur: 20, opacity: glassOpacity + 0.07, borderOpacity: 0.35, shadowBlur: 24 },
      navbar: { blur: 10, opacity: glassOpacity + 0.02, borderOpacity: 0.25, shadowBlur: 16 },
    },
    gradients: {
      primary: [accent, hexAlpha(accent, 0.7)],
      secondary: [accent2, hexAlpha(accent2, 0.7)],
      warm: [warning, accent],
      cool: [info, accent],
    },
    elevations: {
      sm: {
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      md: {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
      },
      lg: {
        shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
      },
    },
    glassOpacity,
  };
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const darkThemeConfig: ThemeConfig = {
  id: 'dark',
  label: 'Dark',
  category: 'dark',
  description: 'Deep charcoal with emerald green. Emotion, immersion, focus.',
  colors: {
    background: '#050507',
    surface: '#0E0E12',
    surfaceVariant: '#161619',
    text: '#F4F5F9',
    textSecondary: '#A8B0C0',
    textMuted: '#6B7590',
    border: '#1E1E24',
    divider: '#18181D',
    accent: '#10B981',
    accentDark: '#059669',
    onAccent: '#FFFFFF',
    error: '#EF4444',
    warning: '#F4A427',
    success: '#10B981',
    info: '#3B82F6',
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
    overlay: 'rgba(0,0,0,0.65)',
  },
  animations: {
    transitionDuration: 250,
    useHighContrast: false,
    animationSpeed: 250,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#10B981', '#06B6D4', '#F4A427', '#3B82F6', 0.08, true),
};

const lightThemeConfig: ThemeConfig = {
  id: 'light',
  label: 'Light',
  category: 'light',
  description: 'Cool gray with darkened emerald green. Speed, analysis, accuracy.',
  colors: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceVariant: '#EBEDF2',
    text: '#111318',
    textSecondary: '#4A4F5C',
    textMuted: '#6D7385',
    border: '#D0D5DE',
    divider: '#DCE0E8',
    accent: '#047857',
    accentDark: '#065F46',
    onAccent: '#FFFFFF',
    error: '#DC2626',
    warning: '#F4A427',
    success: '#047857',
    info: '#3B82F6',
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
    overlay: 'rgba(0,0,0,0.60)',
  },
  animations: {
    transitionDuration: 200,
    useHighContrast: false,
    animationSpeed: 200,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#047857', '#06B6D4', '#F4A427', '#3B82F6', 0.1, false),
};

const blackGoldThemeConfig: ThemeConfig = {
  id: 'blackGold',
  label: 'Black & Gold',
  category: 'premium',
  description: 'True black with refined warm gold. Maximum luxury contrast.',
  colors: {
    background: '#020204',
    surface: '#0A0A0C',
    surfaceVariant: '#121214',
    text: '#F2F2F5',
    textSecondary: '#ACACB2',
    textMuted: '#6E6E76',
    border: '#252528',
    divider: '#1A1A1E',
    accent: '#D4A843',
    accentDark: '#B8912C',
    onAccent: '#050507',
    error: '#B83240',
    warning: '#C8943A',
    success: '#D4A843',
    info: '#5A8FBF',
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
    overlay: 'rgba(0,0,0,0.85)',
  },
  animations: {
    transitionDuration: 300,
    useHighContrast: false,
    animationSpeed: 300,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#D4A843', '#C8943A', '#C8943A', '#5A8FBF', 0.08, true),
};

const neonThemeConfig: ThemeConfig = {
  id: 'neon',
  label: 'Neon',
  category: 'vibrant',
  description: 'Deep charcoal with electric cyan and magenta. High-energy cyberpunk aesthetic.',
  colors: {
    background: '#0D0D0F',
    surface: '#141416',
    surfaceVariant: '#1C1C1F',
    text: '#F0F4FF',
    textSecondary: '#A0AABB',
    textMuted: '#606878',
    border: '#2A2A2F',
    divider: '#1E1E24',
    accent: '#06B6D4',
    accentDark: '#0891B2',
    onAccent: '#000000',
    error: '#FF4365',
    warning: '#FFA500',
    success: '#06B6D4',
    info: '#06B6D4',
    accent2: '#EC4899',
    accent3: '#06B6D4',
    purple: '#A855F7',
    indigo: '#6366F1',
    pink: '#EC4899',
    blue: '#06B6D4',
    orange: '#F97316',
    skyBlue: '#22D3EE',
    purpleLight: '#C084FC',
    pinkLight: '#F472B6',
    overlay: 'rgba(0,0,0,0.75)',
  },
  animations: {
    transitionDuration: 200,
    useHighContrast: false,
    animationSpeed: 180,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#06B6D4', '#EC4899', '#FFA500', '#06B6D4', 0.1, true),
};

const energyThemeConfig: ThemeConfig = {
  id: 'energy',
  label: 'Energy',
  category: 'vibrant',
  description: 'Deep navy with energising orange and yellow. Built for high-intensity athletes.',
  colors: {
    background: '#0A0F1E',
    surface: '#111827',
    surfaceVariant: '#1A2236',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    border: '#1E2A40',
    divider: '#172033',
    accent: '#FF6B35',
    accentDark: '#E55A24',
    onAccent: '#FFFFFF',
    error: '#EF4444',
    warning: '#FCD34D',
    success: '#10B981',
    info: '#3B82F6',
    accent2: '#FCD34D',
    accent3: '#FF6B35',
    purple: '#8B5CF6',
    indigo: '#1E3A8A',
    pink: '#EC4899',
    blue: '#1E3A8A',
    orange: '#FF6B35',
    skyBlue: '#38BDF8',
    purpleLight: '#A78BFA',
    pinkLight: '#F472B6',
    overlay: 'rgba(0,0,0,0.70)',
  },
  animations: {
    transitionDuration: 180,
    useHighContrast: false,
    animationSpeed: 180,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#FF6B35', '#FCD34D', '#FCD34D', '#3B82F6', 0.09, true),
};

const wellnessThemeConfig: ThemeConfig = {
  id: 'wellness',
  label: 'Wellness',
  category: 'wellness',
  description: 'Cream base with darkened sage green and terracotta. Calm, restorative, nature-inspired.',
  colors: {
    background: '#FAF5F0',
    surface: '#FFFFFF',
    surfaceVariant: '#F0EBE3',
    text: '#2D2A26',
    textSecondary: '#5C5248',
    textMuted: '#8C7E72',
    border: '#D9CEC4',
    divider: '#E5DDD6',
    accent: '#5C8A3E',
    accentDark: '#4A7032',
    onAccent: '#FFFFFF',
    error: '#C1643F',
    warning: '#D4875A',
    success: '#5C8A3E',
    info: '#7BA7BC',
    accent2: '#C1643F',
    accent3: '#5C8A3E',
    purple: '#9B7FA6',
    indigo: '#7B82A8',
    pink: '#C97D8C',
    blue: '#7BA7BC',
    orange: '#C1643F',
    skyBlue: '#87BECC',
    purpleLight: '#B89DC0',
    pinkLight: '#D9A3AD',
    overlay: 'rgba(44,38,30,0.55)',
  },
  animations: {
    transitionDuration: 320,
    useHighContrast: false,
    animationSpeed: 320,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#5C8A3E', '#C1643F', '#D4875A', '#7BA7BC', 0.12, false),
};

const eliteThemeConfig: ThemeConfig = {
  id: 'elite',
  label: 'Elite',
  category: 'premium',
  description: 'Deep charcoal with platinum and titanium gray. Understated executive authority.',
  colors: {
    background: '#111214',
    surface: '#1A1C1F',
    surfaceVariant: '#222528',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#2D3139',
    divider: '#252830',
    accent: '#E2E8F0',
    accentDark: '#CBD5E1',
    onAccent: '#111214',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#6EE7B7',
    info: '#93C5FD',
    accent2: '#94A3B8',
    accent3: '#E2E8F0',
    purple: '#A78BFA',
    indigo: '#818CF8',
    pink: '#F9A8D4',
    blue: '#93C5FD',
    orange: '#FDBA74',
    skyBlue: '#BAE6FD',
    purpleLight: '#C4B5FD',
    pinkLight: '#FBCFE8',
    overlay: 'rgba(0,0,0,0.80)',
  },
  animations: {
    transitionDuration: 280,
    useHighContrast: false,
    animationSpeed: 280,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#E2E8F0', '#94A3B8', '#FBBF24', '#93C5FD', 0.09, true),
};

const sunsetThemeConfig: ThemeConfig = {
  id: 'sunset',
  label: 'Sunset',
  category: 'vibrant',
  description: 'Deep purple with coral and amber. Warm, dramatic, golden-hour energy.',
  colors: {
    background: '#1A0F2E',
    surface: '#231540',
    surfaceVariant: '#2D1B55',
    text: '#FFF1E6',
    textSecondary: '#E8C9B0',
    textMuted: '#B8957A',
    border: '#3D2468',
    divider: '#2D1B52',
    accent: '#FF6B6B',
    accentDark: '#E54B4B',
    onAccent: '#FFFFFF',
    error: '#FF4040',
    warning: '#FCD34D',
    success: '#6EE7B7',
    info: '#93C5FD',
    accent2: '#FCD34D',
    accent3: '#FF6B6B',
    purple: '#2D1B69',
    indigo: '#4C2D8C',
    pink: '#FF6B6B',
    blue: '#7B6FCC',
    orange: '#FF8C42',
    skyBlue: '#9FB4FF',
    purpleLight: '#B19CDB',
    pinkLight: '#FF9999',
    overlay: 'rgba(0,0,0,0.72)',
  },
  animations: {
    transitionDuration: 260,
    useHighContrast: false,
    animationSpeed: 260,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
  effects: buildEffects('#FF6B6B', '#FCD34D', '#FCD34D', '#93C5FD', 0.1, true),
};

// ============================================================================
// EXPORTS
// ============================================================================

export const themeConfigs: Record<string, ThemeConfig> = {
  dark: darkThemeConfig,
  light: lightThemeConfig,
  blackGold: blackGoldThemeConfig,
  neon: neonThemeConfig,
  energy: energyThemeConfig,
  wellness: wellnessThemeConfig,
  elite: eliteThemeConfig,
  sunset: sunsetThemeConfig,
};

export const allThemes: ThemeConfig[] = [
  darkThemeConfig,
  lightThemeConfig,
  blackGoldThemeConfig,
  neonThemeConfig,
  energyThemeConfig,
  wellnessThemeConfig,
  eliteThemeConfig,
  sunsetThemeConfig,
];

export const DEFAULT_THEME_ID = 'dark';

export {
  darkThemeConfig,
  lightThemeConfig,
  blackGoldThemeConfig,
  neonThemeConfig,
  energyThemeConfig,
  wellnessThemeConfig,
  eliteThemeConfig,
  sunsetThemeConfig,
};
