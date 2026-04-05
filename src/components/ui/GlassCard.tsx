/**
 * GlassCard — Glass-morphism card component
 *
 * Renders a card with blur backdrop, accent-colored border glow,
 * and theme-aware styling across all theme modes.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { spacing, radius } from '../../design/theme-system';
import { MOTION } from '../../design/motion';

// ============================================================================
// TYPES
// ============================================================================

export type GlassCardVariant = 'card' | 'modal' | 'navbar' | 'overlay';

export interface GlassCardProps {
  children: React.ReactNode;
  /** Visual variant controlling blur, border, and shadow intensity */
  variant?: GlassCardVariant;
  /** Remove default padding */
  noPadding?: boolean;
  /** Override glass surface opacity (0-1) */
  glassOpacity?: number;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Entry animation delay in ms */
  delay?: number;
  /** Press handler — makes card tappable with scale animation */
  onPress?: () => void;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// ============================================================================
// VARIANT SPECS
// ============================================================================

interface VariantSpec {
  blur: number;
  surfaceOpacity: number;
  borderOpacity: number;
  shadowRadius: number;
  shadowOpacity: number;
  borderRadius: number;
  padding: number;
}

const VARIANT_SPECS: Record<GlassCardVariant, VariantSpec> = {
  card: {
    blur: 12,
    surfaceOpacity: 0.04,
    borderOpacity: 0.3,
    shadowRadius: 20,
    shadowOpacity: 0.08,
    borderRadius: radius.xl,
    padding: spacing[4],
  },
  modal: {
    blur: 20,
    surfaceOpacity: 0.07,
    borderOpacity: 0.35,
    shadowRadius: 24,
    shadowOpacity: 0.15,
    borderRadius: radius.xl,
    padding: spacing[5],
  },
  navbar: {
    blur: 10,
    surfaceOpacity: 0.02,
    borderOpacity: 0.25,
    shadowRadius: 16,
    shadowOpacity: 0.06,
    borderRadius: 0,
    padding: spacing[4],
  },
  overlay: {
    blur: 16,
    surfaceOpacity: 0.06,
    borderOpacity: 0.2,
    shadowRadius: 12,
    shadowOpacity: 0.1,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const GlassCard = memo(function GlassCard({
  children,
  variant = 'card',
  noPadding = false,
  glassOpacity,
  style,
  delay = 0,
  onPress,
  accessibilityLabel,
}: GlassCardProps) {
  const { theme } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({ scaleTo: 0.97 });
  const spec = VARIANT_SPECS[variant];

  // Compute glass surface color
  const surfaceAlpha = glassOpacity ?? spec.surfaceOpacity;
  const surfaceColor = theme.isDark ? `rgba(255,255,255,${surfaceAlpha})` : `rgba(255,255,255,${0.85 + surfaceAlpha})`;

  // Accent-tinted border
  const { r, g, b } = hexToRgb(theme.colors.accent);
  const borderColor = theme.isDark ? `rgba(${r},${g},${b},${spec.borderOpacity})` : `rgba(0,0,0,0.06)`;

  const cardStyle: ViewStyle = {
    borderRadius: spec.borderRadius,
    borderWidth: theme.isDark ? 1.5 : 1,
    borderColor,
    backgroundColor: surfaceColor,
    padding: noPadding ? 0 : spec.padding,
    overflow: 'hidden',
    // Shadow (glow effect on dark)
    shadowColor: theme.isDark ? theme.colors.accent : '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.isDark ? spec.shadowOpacity : spec.shadowOpacity * 0.5,
    shadowRadius: spec.shadowRadius,
    elevation: 4,
  };

  const cardContent = (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(MOTION.fast)}
      style={[cardStyle, style]}
      accessibilityRole={onPress ? undefined : 'none'}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {cardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return cardContent;
});

export default GlassCard;
