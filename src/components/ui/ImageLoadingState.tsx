/**
 * ImageLoadingState — Skeleton loader, error state, and frame indicators
 * for exercise images. Used by ExerciseImage during async resolution.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../design/theme-system';

// ─── Types ───

export type ImageVariant = 'thumbnail' | 'card' | 'detail' | 'hero';

interface ImageLoadingStateProps {
  /** Show skeleton shimmer */
  isLoading: boolean;
  /** Show error UI */
  isError: boolean;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Total frame count (for dot indicators) */
  frameCount?: number;
  /** Currently active frame index */
  currentFrame?: number;
  /** Size variant — matches ExerciseImage dimensions */
  variant?: ImageVariant;
}

// ─── Variant dimensions (mirrors ExerciseImage) ───

const VARIANT_DIMENSIONS: Record<ImageVariant, { width: number; height: number }> = {
  thumbnail: { width: 56, height: 56 },
  card: { width: 72, height: 72 },
  detail: { width: 120, height: 120 },
  hero: { width: 999, height: 300 },
};

// ─── Component ───

export default function ImageLoadingState({
  isLoading,
  isError,
  onRetry,
  frameCount = 0,
  currentFrame = 0,
  variant = 'thumbnail',
}: ImageLoadingStateProps) {
  const { theme } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const dimensions = VARIANT_DIMENSIONS[variant];
  const borderR = variant === 'thumbnail' ? 8 : 12;

  // Shimmer animation loop
  useEffect(() => {
    if (!isLoading) return;

    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading, shimmerAnim]);

  const containerStyle = [
    { width: dimensions.width === 999 ? ('100%' as const) : dimensions.width, height: dimensions.height },
    styles.container,
    {
      borderRadius: borderR,
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
  ];

  // ─── Error State ───
  if (isError) {
    const iconSize = variant === 'thumbnail' ? 20 : variant === 'card' ? 24 : 32;
    const showText = variant !== 'thumbnail';

    return (
      <View style={containerStyle}>
        <Pressable
          style={styles.errorInner}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading image"
        >
          <MaterialCommunityIcons name="image-broken-variant" size={iconSize} color={theme.colors.error} />
          {showText && (
            <Text style={[styles.errorText, { color: theme.colors.textMuted, fontSize: variant === 'card' ? 9 : 11 }]}>
              Tap to retry
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ─── Loading / Skeleton ───
  if (isLoading) {
    const translateX = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [
        -(dimensions.width === 999 ? 400 : dimensions.width),
        dimensions.width === 999 ? 400 : dimensions.width,
      ],
    });

    return (
      <View style={containerStyle}>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: borderR - 1 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
            <LinearGradient
              colors={['transparent', `${theme.colors.border}80`, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        {/* Frame indicator dots during loading */}
        {frameCount > 1 && (
          <View style={styles.frameIndicator}>
            {Array.from({ length: frameCount }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.frameDot,
                  { backgroundColor: i === currentFrame ? theme.colors.accent : 'rgba(255,255,255,0.3)' },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Nothing to render (neither loading nor error)
  return null;
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[0.5],
  },
  errorText: {
    textAlign: 'center',
  },
  frameIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[0.75],
  },
  frameDot: {
    width: 4,
    height: 4,
    borderRadius: radius.sm,
  },
});
