/**
 * P7 — Exercise Complete Checkmark Burst
 *
 * Shows a brief animated checkmark + text badge when an exercise is completed.
 * Renders as an overlay that auto-dismisses after ~1.2s.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { darkTheme as theme, typography, spacing, radius } from '../design/theme-system';
import { MOTION } from '../design/motion';

interface Props {
  visible: boolean;
  message?: string;
  color?: string;
}

export default function ExerciseCompleteBadge({ visible, message = 'Nice!', color = theme.colors.accent }: Props) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: MOTION.fast });
      translateY.value = withTiming(0, { duration: MOTION.swift, easing: Easing.out(Easing.back(2)) });
      scale.value = withSequence(
        withTiming(1.3, { duration: MOTION.swift, easing: Easing.out(Easing.back(3)) }),
        withTiming(1, { duration: MOTION.fast }),
      );
      // Auto-hide
      opacity.value = withDelay(900, withTiming(0, { duration: MOTION.medium }));
      scale.value = withDelay(900, withTiming(0.5, { duration: MOTION.medium }));
    } else {
      scale.value = 0;
      opacity.value = 0;
      translateY.value = 20;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opacity/scale/translateY are Reanimated SharedValues (stable mutable refs)
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: color + '20' }, animStyle]}>
      <MaterialCommunityIcons name="check-circle" size={22} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    zIndex: 100,
  },
  text: {
    fontSize: typography.sizes.h4,
    fontWeight: '700',
  },
});
