/**
 * SwipeableRow — Gesture-driven swipe actions for list items.
 *
 * Left swipe  → reveals edit/delete actions
 * Right swipe → reveals quick-start/repeat action
 *
 * Built on react-native-gesture-handler + react-native-reanimated.
 * Runs entirely on the native thread — zero JS blocking.
 *
 * Phase 6 implementation.
 */

import React, { useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Gesture,
  GestureDetector,
  type PanGestureHandlerEventPayload,
  type GestureUpdateEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { haptic } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, radius } from '../../design/theme-system';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80; // px before snap open
const DELETE_THRESHOLD = 140; // px to trigger delete immediately
const ACTION_WIDTH = 72; // single action button width
const ACTIONS_WIDTH = 150; // total reveal width (2 actions)

const SPRING = { damping: 20, stiffness: 180 };

export interface SwipeableRowActions {
  close: () => void;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Right swipe: quick start / repeat */
  onQuickStart?: () => void;
  quickStartLabel?: string;
  quickStartIcon?: string;
  /** Left swipe: edit */
  onEdit?: () => void;
  /** Left swipe: delete */
  onDelete?: () => void;
  /** Whether swipe gestures are enabled */
  enabled?: boolean;
}

export const SwipeableRow = forwardRef<SwipeableRowActions, SwipeableRowProps>(function SwipeableRow(
  {
    children,
    onQuickStart,
    quickStartLabel = 'Start',
    quickStartIcon = 'play-circle-outline',
    onEdit,
    onDelete,
    enabled = true,
  },
  ref,
) {
  const { theme } = useTheme();
  const translateX = useSharedValue(0);
  const hapticFiredRef = { current: false };

  // Expose close() to parent
  useImperativeHandle(ref, () => ({
    close() {
      translateX.value = withSpring(0, SPRING);
    },
  }));

  const close = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
  }, [translateX]);

  const triggerHaptic = useCallback((type: 'buttonPress' | 'error') => {
    haptic(type);
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      // Clamp: left swipe opens actions, right swipe opens quick-start
      const maxLeft = onDelete || onEdit ? -ACTIONS_WIDTH - 10 : 0;
      const maxRight = onQuickStart ? ACTION_WIDTH + 10 : 0;
      translateX.value = Math.max(maxLeft, Math.min(maxRight, e.translationX));

      // Haptic at threshold — fire once per gesture
      if (!hapticFiredRef.current && Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        hapticFiredRef.current = true;
        runOnJS(triggerHaptic)('buttonPress');
      }
    })
    .onEnd((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      hapticFiredRef.current = false;
      const velocity = ((e as any).velocityX as number) ?? 0;

      // Right swipe (quick-start)
      if (translateX.value > SWIPE_THRESHOLD || velocity > 500) {
        if (onQuickStart) {
          runOnJS(triggerHaptic)('buttonPress');
          translateX.value = withSpring(0, SPRING);
          runOnJS(onQuickStart)();
        } else {
          translateX.value = withSpring(0, SPRING);
        }
        return;
      }

      // Left swipe — either open actions or trigger delete
      if (translateX.value < -DELETE_THRESHOLD && onDelete) {
        runOnJS(triggerHaptic)('error');
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(onDelete)();
        });
        return;
      }

      if (translateX.value < -SWIPE_THRESHOLD && (onEdit || onDelete)) {
        translateX.value = withSpring(-ACTIONS_WIDTH, SPRING);
        return;
      }

      // Snap back
      translateX.value = withSpring(0, SPRING);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Right action opacity/scale (quick-start)
  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD, ACTION_WIDTH], [0.6, 0.95, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  // Left actions opacity/scale (edit + delete)
  const leftActionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      {/* Right action (quick-start) — revealed by swiping right */}
      {onQuickStart && (
        <Animated.View style={[styles.rightAction, rightActionStyle]}>
          <View style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]}>
            <MaterialCommunityIcons name={quickStartIcon as any} size={22} color={theme.colors.background} />
          </View>
        </Animated.View>
      )}

      {/* Left actions (edit + delete) — revealed by swiping left */}
      <Animated.View style={[styles.leftActions, leftActionsStyle]}>
        {onEdit && (
          <View style={[styles.actionBtn, { backgroundColor: theme.colors.blue, width: ACTION_WIDTH }]}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#fff" />
          </View>
        )}
        {onDelete && (
          <View style={[styles.actionBtn, { backgroundColor: theme.colors.error, width: ACTION_WIDTH }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
          </View>
        )}
      </Animated.View>

      {/* Main row content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  row: {
    zIndex: 2,
  },
  rightAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: spacing[2],
  },
  leftActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  actionBtn: {
    width: ACTION_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.lg,
    marginHorizontal: spacing[1],
  },
});
