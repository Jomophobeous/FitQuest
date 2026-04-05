/**
 * InteractionFeedback — Micro-interaction primitives.
 *
 * Three components for tangible, alive UI feedback:
 *
 * 1. `PressableScale`   — scale-to-0.95 + haptic on press, spring release
 * 2. `RippleButton`     — Android ripple + iOS press-dim, haptic included
 * 3. `ConfirmGlow`      — brief success glow overlay (green flash on action)
 *
 * Usage:
 *   <PressableScale onPress={fn} hapticEvent="buttonPress">
 *     <ThemedText>Tap me</ThemedText>
 *   </PressableScale>
 *
 *   <RippleButton onPress={fn} rippleColor={theme.colors.accent}>
 *     <ThemedText>Press me</ThemedText>
 *   </RippleButton>
 */

import React, { useCallback, useRef } from 'react';
import { Pressable, View, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { MOTION, PRESS_SPRING } from '../../design/motion';
import { haptic } from '../../utils/haptics';
import type { HapticEvent } from '../../utils/haptics';

// ============================================
// PRESSABLE SCALE
// ============================================

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Scale target on press-in. Default: 0.95 */
  scaleTo?: number;
  hapticEvent?: HapticEvent;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'radio' | 'checkbox';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  scaleTo = 0.95,
  hapticEvent = 'buttonPress',
  style,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(scaleTo, {
      duration: MOTION.pressIn,
      easing: Easing.out(Easing.cubic),
    });
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  const handlePress = useCallback(() => {
    haptic(hapticEvent);
    onPress?.();
  }, [hapticEvent, onPress]);

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// RIPPLE BUTTON
// ============================================

interface RippleButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Ripple/highlight color (Android ripple + iOS overlay tint). Default: accent */
  rippleColor?: string;
  hapticEvent?: HapticEvent;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  borderless?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'radio' | 'checkbox';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}

export function RippleButton({
  children,
  onPress,
  rippleColor,
  hapticEvent = 'buttonPress',
  style,
  disabled = false,
  borderless = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: RippleButtonProps) {
  const { theme } = useTheme();
  const resolvedRipple = rippleColor ?? theme.colors.accent + '40';

  // iOS: dim overlay on press
  const pressOpacity = useSharedValue(1);
  const iosOverlayOpacity = useSharedValue(0);

  const pressableStyle = useAnimatedStyle(() => ({
    opacity: pressOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: iosOverlayOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    if (Platform.OS === 'ios') {
      pressOpacity.value = withTiming(0.82, { duration: MOTION.pressIn });
      iosOverlayOpacity.value = withTiming(0.12, { duration: MOTION.pressIn });
    }
  }, [pressOpacity, iosOverlayOpacity]);

  const handlePressOut = useCallback(() => {
    if (Platform.OS === 'ios') {
      pressOpacity.value = withTiming(1, { duration: MOTION.fast });
      iosOverlayOpacity.value = withTiming(0, { duration: MOTION.fast });
    }
  }, [pressOpacity, iosOverlayOpacity]);

  const handlePress = useCallback(() => {
    haptic(hapticEvent);
    onPress?.();
  }, [hapticEvent, onPress]);

  const androidRipple = Platform.OS === 'android' ? { color: resolvedRipple, borderless } : undefined;

  return (
    <Animated.View style={[{ overflow: 'hidden' }, style, pressableStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        android_ripple={androidRipple}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      >
        {children}
        {/* iOS press overlay */}
        {Platform.OS === 'ios' && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                ...StyleSheet_absoluteFill,
                backgroundColor: resolvedRipple,
                borderRadius: 999,
              },
              overlayStyle,
            ]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// CONFIRM GLOW — brief success flash overlay
// ============================================

interface ConfirmGlowProps {
  /** Trigger: increment to fire the glow */
  trigger: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function ConfirmGlow({ trigger, color, style }: ConfirmGlowProps) {
  const { theme } = useTheme();
  const glowColor = color ?? theme.colors.accent;
  const prevTrigger = useRef(0);

  // Only renders the glow flash when trigger increments
  const shouldShow = trigger !== prevTrigger.current;
  if (shouldShow) prevTrigger.current = trigger;

  if (!shouldShow) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(80)}
      exiting={FadeOut.duration(300)}
      pointerEvents="none"
      style={[
        {
          ...StyleSheet_absoluteFill,
          backgroundColor: glowColor + '25',
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: glowColor + '60',
        },
        style,
      ]}
    />
  );
}

// Inline absoluteFill substitute (avoids importing StyleSheet just for this)
const StyleSheet_absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
