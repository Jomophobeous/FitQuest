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
    background: '#0A0E17', // Matte black (primary background)
    surface: '#121820', // Slightly elevated surface
    surfaceVariant: '#1A1F2B', // Secondary surface (cards)
    
    // Text
    text: '#F5F7FB', // Primary text (almost white)
    textSecondary: '#BBC4D3', // Secondary text (lifted contrast)
    textMuted: '#8C96A8', // Tertiary/meta text (lifted contrast)
    
    // Dividers
    border: '#343C4B', // Hairline borders (clearer separation)
    divider: '#2B3342', // Internal dividers
    
    // Single accent color - GREEN for all primary actions
    accent: '#10B981',
    
    // Semantic
    error: '#EF4444',
    warning: '#F4A427',
    success: '#10B981',
    
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
    background: '#F4F5F7', // Soft neutral gray (no pure white)
    surface: '#FFFFFF', // Primary surface (cards)
    surfaceVariant: '#ECEEF2', // Secondary surface
    
    // Text
    text: '#121316', // Primary text (almost black)
    textSecondary: '#4B4F58', // Secondary text
    textMuted: '#6E7480', // Tertiary/meta text (clearer)
    
    // Dividers
    border: '#CDD3DC', // Hairline borders
    divider: '#D9DEE6', // Internal dividers
    
    // Single accent color - GREEN for all primary actions
    accent: '#10B981',
    
    // Semantic
    error: '#DC2626',
    warning: '#F4A427',
    success: '#10B981',
    
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

  blackGold: {
    // Base — deep black with warm undertones
    background: '#0D0D0D',
    surface: '#1A1610',
    surfaceVariant: '#242018',

    // Text — warm parchment whites
    text: '#F5F0E1',
    textSecondary: '#C9BFA5',
    textMuted: '#8A7E6B',

    // Dividers — warm dark lines
    border: '#3D3428',
    divider: '#2E2820',

    // Single accent color — GOLD for all primary actions
    accent: '#D4AF37',

    // Semantic
    error: '#C41E3A',
    warning: '#E8A317',
    success: '#D4AF37',

    // Backward compatibility aliases
    accent2: '#E8A317',
    accent3: '#D4AF37',

    // Category accent colors — gold-tinted palette
    purple: '#9B7FD4',
    indigo: '#7B7FCC',
    pink: '#D4789B',
    blue: '#5A9FD4',
    orange: '#D49537',
    skyBlue: '#5AB8D4',
    purpleLight: '#B49AE0',
    pinkLight: '#E099B8',

    // Contrast text on accent-colored (gold) surfaces
    onAccent: '#0D0D0D',

    // Chrome
    overlay: 'rgba(0,0,0,0.75)',
  },
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  sizes: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 16,
    bodySmall: 14,
    label: 13,
    caption: 12,
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

export const spacing = {
  px: 1,
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
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

// Export default theme (dark mode by default)
export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');
export const blackGoldTheme = createTheme('blackGold');

export type Theme = ReturnType<typeof createTheme>;
