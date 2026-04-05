/**
 * FitQuest Theme Configurations
 *
 * All 8 theme definitions with full palettes, animation settings, and accessibility metadata.
 * These extend the base colorSystem palettes from theme-system.ts with richer metadata.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeColorPalette {
  // Surfaces
  background: string;
  surface: string;
  surfaceVariant: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  divider: string;

  // Primary accent
  accent: string;
  accentDark: string;
  onAccent: string;

  // Semantic
  error: string;
  warning: string;
  success: string;
  info: string;

  // Backward compat
  accent2: string;
  accent3: string;

  // Category accents
  purple: string;
  indigo: string;
  pink: string;
  blue: string;
  orange: string;
  skyBlue: string;
  purpleLight: string;
  pinkLight: string;

  // Chrome
  overlay: string;
}

export interface ThemeAnimationSettings {
  /** Base transition duration in ms */
  transitionDuration: number;
  /** Whether to use reduced motion / high-contrast mode */
  useHighContrast: boolean;
}

export interface ThemeAccessibility {
  /** WCAG level this theme targets */
  wcagLevel: 'AA' | 'AAA';
  /** Minimum contrast ratio for text/background pairs */
  minContrastRatio: number;
}

export type ThemeCategory = 'dark' | 'light' | 'premium' | 'vibrant' | 'wellness';

export interface ThemeConfig {
  id: string;
  label: string;
  category: ThemeCategory;
  description: string;
  colors: ThemeColorPalette;
  animations: ThemeAnimationSettings;
  accessibility: ThemeAccessibility;
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
};

const lightThemeConfig: ThemeConfig = {
  id: 'light',
  label: 'Light',
  category: 'light',
  description: 'Cool gray with emerald green. Speed, analysis, accuracy.',
  colors: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceVariant: '#EBEDF2',
    text: '#111318',
    textSecondary: '#4A4F5C',
    textMuted: '#6D7385',
    border: '#D0D5DE',
    divider: '#DCE0E8',
    accent: '#10B981',
    accentDark: '#059669',
    onAccent: '#FFFFFF',
    error: '#DC2626',
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
    overlay: 'rgba(0,0,0,0.60)',
  },
  animations: {
    transitionDuration: 200,
    useHighContrast: false,
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
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
    accent: '#06B6D4', // Electric cyan
    accentDark: '#0891B2',
    onAccent: '#000000',
    error: '#FF4365',
    warning: '#FFA500',
    success: '#06B6D4',
    info: '#06B6D4',
    accent2: '#EC4899', // Magenta
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
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
    accent: '#FF6B35', // High-energy orange
    accentDark: '#E55A24',
    onAccent: '#FFFFFF',
    error: '#EF4444',
    warning: '#FCD34D', // Yellow
    success: '#10B981',
    info: '#3B82F6',
    accent2: '#FCD34D', // Yellow
    accent3: '#FF6B35',
    purple: '#8B5CF6',
    indigo: '#1E3A8A', // Navy
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
};

const wellnessThemeConfig: ThemeConfig = {
  id: 'wellness',
  label: 'Wellness',
  category: 'wellness',
  description: 'Sage green with cream and terracotta. Calm, restorative, nature-inspired.',
  colors: {
    background: '#FAF5F0', // Cream base
    surface: '#FFFFFF',
    surfaceVariant: '#F0EBE3',
    text: '#2D2A26',
    textSecondary: '#5C5248',
    textMuted: '#8C7E72',
    border: '#D9CEC4',
    divider: '#E5DDD6',
    accent: '#9DC183', // Sage green
    accentDark: '#7EA662',
    onAccent: '#FFFFFF',
    error: '#C1643F', // Terracotta for warnings (softer)
    warning: '#D4875A',
    success: '#9DC183',
    info: '#7BA7BC',
    accent2: '#C1643F', // Terracotta
    accent3: '#9DC183',
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
};

const eliteThemeConfig: ThemeConfig = {
  id: 'elite',
  label: 'Elite',
  category: 'premium',
  description: 'Deep charcoal with platinum and titanium gray. Understated executive authority.',
  colors: {
    background: '#111214', // Deep charcoal
    surface: '#1A1C1F',
    surfaceVariant: '#222528',
    text: '#E2E8F0', // Platinum
    textSecondary: '#94A3B8', // Titanium gray
    textMuted: '#64748B',
    border: '#2D3139',
    divider: '#252830',
    accent: '#E2E8F0', // Platinum accent
    accentDark: '#CBD5E1',
    onAccent: '#111214',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#6EE7B7',
    info: '#93C5FD',
    accent2: '#94A3B8', // Titanium
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
};

const sunsetThemeConfig: ThemeConfig = {
  id: 'sunset',
  label: 'Sunset',
  category: 'vibrant',
  description: 'Deep purple with coral and amber. Warm, dramatic, golden-hour energy.',
  colors: {
    background: '#1A0F2E', // Deep purple
    surface: '#231540',
    surfaceVariant: '#2D1B55',
    text: '#FFF1E6',
    textSecondary: '#E8C9B0',
    textMuted: '#B8957A',
    border: '#3D2468',
    divider: '#2D1B52',
    accent: '#FF6B6B', // Coral
    accentDark: '#E54B4B',
    onAccent: '#FFFFFF',
    error: '#FF4040',
    warning: '#FCD34D', // Amber
    success: '#6EE7B7',
    info: '#93C5FD',
    accent2: '#FCD34D', // Amber
    accent3: '#FF6B6B',
    purple: '#2D1B69', // Deep purple
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
  },
  accessibility: {
    wcagLevel: 'AA',
    minContrastRatio: 4.5,
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

/** All theme configurations indexed by id */
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

/** Ordered list of all available themes */
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

/** Default theme id */
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
