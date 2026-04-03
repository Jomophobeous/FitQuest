import { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { MOTION, PRESS_SPRING } from '../design/motion';

interface PressAnimationOptions {
  /** Scale factor when pressed (default: 0.97) */
  scaleTo?: number;
  /** Override press-in duration in ms (default: MOTION.pressIn = 80ms) */
  duration?: number;
}

/**
 * Reusable press-scale animation.
 * Press-in: fast timing with deceleration.
 * Press-out: spring (bounce-back feel).
 */
export function usePressAnimation(options: PressAnimationOptions = {}) {
  const { scaleTo = 0.97, duration = MOTION.pressIn } = options;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withTiming(scaleTo, { duration, easing: Easing.out(Easing.cubic) });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, PRESS_SPRING);
  };

  return { animatedStyle, onPressIn, onPressOut };
}
