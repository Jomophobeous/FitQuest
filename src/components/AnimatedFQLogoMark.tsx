/**
 * AnimatedFQLogoMark — Reanimated-powered animated FitQuest logo.
 *
 * Features:
 * - Pulse glow animation (2.5s cycle) via opacity
 * - Tap to rotate 360° + 1.1x scale bounce
 * - Theme-aware accent color
 * - Uses existing FQLogoMark SVG with Reanimated wrapper
 * - No native Skia dependency (EAS-build safe)
 */
import React, { useCallback } from 'react';
import { TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import FQLogoMark from './FQLogoMark';

interface Props {
  size?: 56 | 80 | 96 | 120;
  showGlow?: boolean;
}

export default function AnimatedFQLogoMark({ size = 80, showGlow = true }: Props) {
  const { theme } = useTheme();
  const accent = theme.colors.accent;

  // Animation values
  const pulseOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  // Start pulse on mount
  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false,
    );
  }, [pulseOpacity]);

  // Tap handler: 360° rotation + scale bounce
  const handleTap = useCallback(() => {
    rotation.value = withTiming(rotation.value + 360, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 150 }),
    );
  }, [rotation, scale]);

  // Animated styles for the logo wrapper
  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  // Animated glow style
  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[styles.container, { width: size, height: size }]}>
        {/* Glow ring behind logo */}
        {showGlow && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                width: size * 0.9,
                height: size * 0.9,
                borderRadius: size * 0.45,
                borderColor: accent,
                shadowColor: accent,
              },
              animatedGlowStyle,
            ]}
          />
        )}
        {/* Animated logo */}
        <Animated.View style={animatedLogoStyle}>
          <FQLogoMark size={size} showGlow={showGlow} />
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
});
