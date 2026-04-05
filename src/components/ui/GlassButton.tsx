/**
 * GlassButton — Themed button with gradient fills, glass-morphism, and haptic feedback
 *
 * Variants: primary (gradient), secondary (flat), outline (border), danger (red gradient)
 * Sizes: sm (32px), md (44px), lg (56px) — all meet 48px min touch target via hitSlop
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, ActivityIndicator, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { spacing, radius } from '../../design/theme-system';
import ThemedText from '../ThemedText';

// ============================================================================
// TYPES
// ============================================================================

export type GlassButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type GlassButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps {
  /** Button label text */
  label: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: GlassButtonVariant;
  /** Size — sm: 32px, md: 44px, lg: 56px */
  size?: GlassButtonSize;
  /** Show loading spinner */
  loading?: boolean;
  /** Disable interactions */
  disabled?: boolean;
  /** Optional icon (left of label) */
  icon?: React.ReactNode;
  /** Additional container styles */
  style?: ViewStyle;
  /** Accessibility hint */
  accessibilityHint?: string;
}

// ============================================================================
// SIZE SPECS
// ============================================================================

interface SizeSpec {
  height: number;
  paddingHorizontal: number;
  fontSize: number;
  borderRadius: number;
  hitSlop: number; // ensure 48px min touch target
}

const SIZE_SPECS: Record<GlassButtonSize, SizeSpec> = {
  sm: { height: 32, paddingHorizontal: spacing[3], fontSize: 13, borderRadius: radius.md, hitSlop: 8 },
  md: { height: 44, paddingHorizontal: spacing[5], fontSize: 15, borderRadius: radius.lg, hitSlop: 2 },
  lg: { height: 56, paddingHorizontal: spacing[6], fontSize: 17, borderRadius: radius.xl, hitSlop: 0 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const GlassButton = memo(function GlassButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityHint,
}: GlassButtonProps) {
  const { theme } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({ scaleTo: 0.98 });
  const spec = SIZE_SPECS[size];
  const isDisabled = disabled || loading;

  // --- Variant-specific styling ---
  const getVariantStyles = (): {
    gradientColors?: readonly [string, string, ...string[]];
    backgroundColor?: string;
    borderWidth: number;
    borderColor: string;
    textColor: string;
  } => {
    const accent = theme.colors.accent;
    const accentDark = theme.colors.accentDark;

    switch (variant) {
      case 'primary':
        return {
          gradientColors: [accent, accentDark] as const,
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: theme.colors.onAccent,
        };
      case 'secondary':
        return {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: accent,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.isDark ? `${accent}60` : `${accent}40`,
          textColor: accent,
        };
      case 'danger':
        return {
          gradientColors: [theme.colors.error, '#B91C1C'] as const,
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: '#FFFFFF',
        };
    }
  };

  const vs = getVariantStyles();

  const containerStyle: ViewStyle = {
    height: spec.height,
    paddingHorizontal: spec.paddingHorizontal,
    borderRadius: spec.borderRadius,
    borderWidth: vs.borderWidth,
    borderColor: vs.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    opacity: isDisabled ? 0.5 : 1,
    overflow: 'hidden',
  };

  const hitSlop =
    spec.hitSlop > 0 ? { top: spec.hitSlop, bottom: spec.hitSlop, left: spec.hitSlop, right: spec.hitSlop } : undefined;

  const content = (
    <>
      {loading ? <ActivityIndicator size="small" color={vs.textColor} /> : icon ? icon : null}
      <ThemedText
        style={{
          fontSize: spec.fontSize,
          fontWeight: '700',
          color: vs.textColor,
        }}
      >
        {loading ? 'Loading…' : label}
      </ThemedText>
    </>
  );

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        disabled={isDisabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={loading ? `${label}, loading` : label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityHint={accessibilityHint}
      >
        {vs.gradientColors ? (
          <LinearGradient colors={vs.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={containerStyle}>
            {content}
          </LinearGradient>
        ) : (
          <View style={[containerStyle, { backgroundColor: vs.backgroundColor }]}>{content}</View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default GlassButton;
