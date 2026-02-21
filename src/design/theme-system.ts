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
    background: '#0A0E14', // Deep navy-black (premium depth)
    surface: '#121821', // Elevated surface
    surfaceVariant: '#1A2030', // Secondary surface (cards)
    
    // Text
    text: '#F2F4F8', // Primary text (crisp white)
    textSecondary: '#B0B8C8', // Secondary text
    textMuted: '#7A849A', // Tertiary/meta text
    
    // Dividers
    border: '#2A3245', // Hairline borders
    divider: '#222B3D', // Internal dividers
    
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
    // Base — pure black, zero warm tint for maximum contrast
    background: '#09090B',
    surface: '#141416',
    surfaceVariant: '#1C1C1F',

    // Text — crisp platinum/silver (no warm parchment)
    text: '#EDEDEF',
    textSecondary: '#A1A1A6',
    textMuted: '#6E6E76',

    // Dividers — cool charcoal
    border: '#2C2C30',
    divider: '#222225',

    // Single accent color — refined champagne gold (less saturated, more elegant)
    accent: '#C9A84C',

    // Semantic — distinct colors, not all gold
    error: '#B83240',
    warning: '#D4963A',
    success: '#C9A84C', // Use gold for success in blackGold theme (no green)

    // Backward compatibility aliases
    accent2: '#D4963A',
    accent3: '#C9A84C', // Changed from green to gold

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
    onAccent: '#09090B',

    // Chrome
    overlay: 'rgba(0,0,0,0.80)',
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
