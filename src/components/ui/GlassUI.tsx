/**
 * FitQuest Glass UI Components
 * Premium, high-tech visual components with glass-morphism,
 * animated cards, gradients, and micro-interactions.
 *
 * Uses: react-native-reanimated, expo-linear-gradient, expo-blur
 *
 * Keeps existing colors from theme-system.ts — only adds texture & feel.
 */

import React, { useEffect, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  type StyleProp,
  ViewStyle,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  SlideInDown,
  SlideInUp,
  ZoomIn,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Reanimated from 'react-native-reanimated';
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
import { useTheme } from '../../context/ThemeContext';
import { usePressAnimation } from '../../hooks/usePressAnimation';
import { spacing, radius } from '../../design/theme-system';

// InteractionManager removed — inline stub that just executes the callback
const Interaction = { execute: (_id: string, fn: () => void, _opts?: Record<string, unknown>) => fn() };
import { MOTION } from '../../design/motion';
import ThemedText from '../ThemedText';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// ANIMATED CARD (Simplified flat design)
// ============================================

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  gradient?: boolean; // kept for API compatibility but simplified
  gradientColors?: string[];
  onPress?: () => void;
  glowColor?: string; // ignored - no glows
}

export const GlassCard = memo(function GlassCard({
  children,
  style,
  delay = 0,
  gradient: _gradient = false,
  gradientColors: _gradientColors,
  onPress,
  glowColor: _glowColor, // ignored
}: GlassCardProps) {
  const { theme } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({ scaleTo: 0.97 });

  const cardContent = (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(theme.motion.fast)}
      style={[
        styles.glassCard,
        theme.shadows.sm,
        {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
          borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
      accessibilityRole={onPress ? undefined : 'none'}
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
          onPress={() => {
            Interaction.execute(
              'glass_card',
              () => {
                onPress();
              },
              { haptic: 'light' },
            );
          }}
          accessibilityRole="button"
        >
          {cardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return cardContent;
});

// ============================================
// HEADER BAR (Simplified flat design)
// ============================================

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  rightContent?: React.ReactNode;
}

export const GradientHeader = memo(function GradientHeader({
  title,
  subtitle,
  icon,
  rightContent,
}: GradientHeaderProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(MOTION.fast)} accessibilityRole="header">
      <View
        style={[
          styles.gradientHeader,
          {
            backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {!!icon && (
            <View style={[styles.headerIcon, { backgroundColor: theme.colors.accent + '15' }]}>
              <MaterialCommunityIcons name={icon} size={22} color={theme.colors.accent} />
            </View>
          )}
          <View>
            <ThemedText style={[styles.headerTitle, { color: theme.colors.text }]}>{title}</ThemedText>
            {!!subtitle && (
              <ThemedText style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</ThemedText>
            )}
          </View>
        </View>
        {rightContent}
      </View>
    </Animated.View>
  );
});

// ============================================
// PULSE DOT (Live indicator - only pulses when active)
// ============================================

export const PulseDot = memo(function PulseDot({
  color: colorProp,
  size = 8,
  active = true,
}: {
  color?: string;
  size?: number;
  active?: boolean;
}) {
  const { theme: _theme } = useTheme();
  const color = colorProp ?? _theme.colors.accent;
  const haloOpacity = useSharedValue(active ? 0.4 : 0);

  useEffect(() => {
    if (active) {
      haloOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      haloOpacity.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- haloOpacity is a Reanimated SharedValue (stable mutable ref)
  }, [active]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
  }));

  return (
    <View style={styles.pulseDotContainer}>
      {!!active && (
        <Animated.View
          style={[
            {
              width: size * 2.5,
              height: size * 2.5,
              borderRadius: size * 1.25,
              backgroundColor: color + '30',
            },
            haloStyle,
          ]}
        />
      )}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
});

// ============================================
// STAT CHIP (Compact stat - grayscale by default)
// ============================================

interface StatChipProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | number;
  color?: string; // optional - defaults to gray
  delay?: number;
}

export const StatChip = memo(function StatChip({ icon, label, value, color, delay = 0 }: StatChipProps) {
  const { theme } = useTheme();
  // Default to gray unless explicitly colored
  const chipColor = color || theme.colors.textMuted;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(MOTION.fast)}
      style={[
        styles.statChip,
        {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: theme.colors.border,
        },
      ]}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="text"
    >
      <MaterialCommunityIcons name={icon} size={16} color={chipColor} />
      <ThemedText style={[styles.statChipValue, { color: theme.colors.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.statChipLabel, { color: theme.colors.textMuted }]}>{label}</ThemedText>
    </Animated.View>
  );
});

// ============================================
// ANIMATED COUNTER
// ============================================

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  style?: any;
}

export const AnimatedCounter = memo(function AnimatedCounter({ value, suffix = '', style }: AnimatedCounterProps) {
  const { theme } = useTheme();

  // Simple animated counter — displays the raw value with a zoom-in entrance
  return (
    <Animated.View entering={ZoomIn.delay(MOTION.base).duration(MOTION.fast)}>
      <ThemedText style={[styles.animatedCounter, { color: theme.colors.text }, style]}>
        {value}
        {suffix}
      </ThemedText>
    </Animated.View>
  );
});

// ============================================
// BUTTON (Simplified solid colors)
// ============================================

export interface GradientButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  colors?: string[];
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  style?: import('react-native').ViewStyle;
}

export const GradientButton = memo(function GradientButton({
  title,
  onPress,
  icon,
  colors,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style: containerStyle,
}: GradientButtonProps) {
  const { theme } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({ scaleTo: 0.96 });

  // All variants use green as primary action color
  const variantColors: Record<string, string> = {
    primary: theme.colors.accent,
    success: theme.colors.accent,
    warning: theme.colors.warning,
  };

  const isDisabled = disabled || loading;
  const paddingY = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const bgColor = isDisabled ? theme.colors.surfaceVariant : colors?.[0] || variantColors[variant];

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          Interaction.execute(
            'btn_' + title.replace(/\s+/g, '_').toLowerCase(),
            () => {
              onPress();
            },
            { haptic: 'light' },
          );
        }}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={loading ? `${title}, loading` : title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        <View
          style={[
            styles.gradientButton,
            {
              paddingVertical: paddingY,
              opacity: isDisabled ? 0.5 : 1,
              backgroundColor: bgColor,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.onAccent} style={{ marginRight: spacing[2] }} />
          ) : !!icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={fontSize + 4}
              color={theme.colors.onAccent}
              style={{ marginRight: spacing[2] }}
            />
          ) : null}
          <ThemedText style={[styles.gradientButtonText, { fontSize, color: theme.colors.onAccent }]}>
            {loading ? 'Loading…' : title}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ============================================
// WEEK CALENDAR STRIP
// ============================================

interface WeekCalendarProps {
  activeDate?: Date;
  workoutDates?: string[]; // ISO date strings
  onDatePress?: (date: Date) => void;
}

export const WeekCalendar = memo(function WeekCalendar({
  activeDate = new Date(),
  workoutDates = [],
  onDatePress,
}: WeekCalendarProps) {
  const { theme } = useTheme();
  const today = new Date();

  const weekDays = [];
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push(d);
  }

  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(MOTION.fast)} style={styles.weekCalendar}>
      {weekDays.map((day, i) => {
        const dateStr = day.toISOString().split('T')[0]!;
        const isToday = today.toISOString().split('T')[0] === dateStr;
        const isActive = activeDate.toISOString().split('T')[0] === dateStr;
        const hasWorkout = workoutDates.includes(dateStr);

        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.calendarDay,
              isActive && { backgroundColor: theme.colors.accent },
              isToday &&
                !isActive && {
                  borderColor: theme.colors.accent,
                  borderWidth: 1.5,
                },
            ]}
            onPress={() => onDatePress?.(day)}
            accessibilityRole="button"
            accessibilityLabel={`${dayNames[i]}, ${day.getDate()}${isToday ? ', today' : ''}${hasWorkout ? ', workout completed' : ''}`}
            accessibilityState={{ selected: isActive }}
          >
            <ThemedText
              style={[styles.calendarDayName, { color: isActive ? theme.colors.onAccent : theme.colors.textMuted }]}
            >
              {dayNames[i]}
            </ThemedText>
            <ThemedText
              style={[styles.calendarDayNum, { color: isActive ? theme.colors.onAccent : theme.colors.text }]}
            >
              {day.getDate()}
            </ThemedText>
            {!!hasWorkout && (
              <View
                style={[
                  styles.calendarDot,
                  { backgroundColor: isActive ? theme.colors.surface : theme.colors.success },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
});

// ============================================
// ANIMATED PROGRESS RING
// ============================================

interface ProgressRingProps {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}

export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color,
  children,
}: ProgressRingProps) {
  const { theme } = useTheme();
  const ringColor = color || theme.colors.accent;
  const clampedTarget = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated progress value — counts up from 0 on mount
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(clampedTarget, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  // Derived integer percent for accessibility
  const progressPercent = Math.round(clampedTarget * 100);

  return (
    <Animated.View
      entering={ZoomIn.delay(MOTION.base).duration(MOTION.fast)}
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Progress: ${progressPercent}%`}
      accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
    >
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — animated */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          animatedProps={animatedCircleProps}
        />
      </Svg>
      <View style={{ position: 'absolute', width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </View>
    </Animated.View>
  );
});

// ============================================
// SECTION HEADER
// ============================================

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  delay?: number;
}

export const SectionHeader = memo(function SectionHeader({ title, action, onAction, delay = 0 }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeInLeft.delay(delay).duration(MOTION.fast)} style={styles.sectionHeader}>
      <ThemedText style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</ThemedText>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <ThemedText style={[styles.sectionAction, { color: theme.colors.accent }]}>{action}</ThemedText>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ============================================
// ANIMATED LIST ITEM
// ============================================

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const AnimatedListItem = memo(function AnimatedListItem({
  children,
  index,
  style,
  onPress,
  accessibilityRole: a11yRole,
  accessibilityLabel,
  accessibilityHint,
}: AnimatedListItemProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({ scaleTo: 0.98 });

  const content = (
    <Animated.View style={animatedStyle}>
      <Animated.View
        entering={FadeIn.delay(Math.min(index * MOTION.stagger, MOTION.staggerCap)).duration(MOTION.fast)}
        style={style}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          Interaction.execute(
            'list_item_' + index,
            () => {
              onPress();
            },
            { haptic: 'light' },
          );
        }}
        accessibilityRole={a11yRole || 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
});

// Re-export animation presets for easy use
export const Animations = {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  SlideInDown,
  SlideInUp,
  ZoomIn,
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    overflow: 'hidden',
  },
  gradientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerIcon: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
  pulseDotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    gap: spacing[1.5],
  },
  statChipValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statChipLabel: {
    fontSize: 11,
  },
  animatedCounter: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    borderRadius: radius.xl,
    gap: spacing[2],
  },
  gradientButtonText: {
    fontWeight: '700',
  },
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2.5],
    borderRadius: radius.lg,
    minWidth: 38,
  },
  calendarDayName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  calendarDayNum: {
    fontSize: 15,
    fontWeight: '700',
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: spacing[1],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
  },
});
