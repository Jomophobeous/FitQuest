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
import { View, StyleSheet, TouchableOpacity, Text, type StyleProp, ViewStyle, Dimensions } from 'react-native';
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
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const cardContent = (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(150)}
      style={[
        styles.glassCard,
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
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
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

export function GradientHeader({ title, subtitle, icon, rightContent }: GradientHeaderProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(150)} accessibilityRole="header">
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
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{title}</Text>
            {!!subtitle && (
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
            )}
          </View>
        </View>
        {rightContent}
      </View>
    </Animated.View>
  );
}

// ============================================
// PULSE DOT (Live indicator - only pulses when active)
// ============================================

export function PulseDot({
  color = '#10B981',
  size = 8,
  active = true,
}: {
  color?: string;
  size?: number;
  active?: boolean;
}) {
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
}

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
      entering={FadeInUp.delay(delay).duration(150)}
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
      <Text style={[styles.statChipValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: theme.colors.textMuted }]}>{label}</Text>
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
    <Animated.View entering={ZoomIn.delay(200).duration(150)}>
      <Text style={[styles.animatedCounter, { color: theme.colors.text }, style]}>
        {value}
        {suffix}
      </Text>
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
  variant = 'primary',
  size = 'md',
  style: containerStyle,
}: GradientButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  // All variants use green as primary action color
  const variantColors: Record<string, string> = {
    primary: theme.colors.accent,
    success: theme.colors.accent,
    warning: theme.colors.warning,
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const paddingY = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const bgColor = disabled ? theme.colors.surfaceVariant : colors?.[0] || variantColors[variant];

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          haptic('buttonPress');
          onPress();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
      >
        <View
          style={[
            styles.gradientButton,
            {
              paddingVertical: paddingY,
              opacity: disabled ? 0.5 : 1,
              backgroundColor: bgColor,
            },
          ]}
        >
          {!!icon && (
            <MaterialCommunityIcons
              name={icon}
              size={fontSize + 4}
              color={theme.colors.onAccent}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.gradientButtonText, { fontSize, color: theme.colors.onAccent }]}>{title}</Text>
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

export function WeekCalendar({ activeDate = new Date(), workoutDates = [], onDatePress }: WeekCalendarProps) {
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
    <Animated.View entering={FadeInDown.delay(100).duration(150)} style={styles.weekCalendar}>
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
            <Text style={[styles.calendarDayName, { color: isActive ? '#fff' : theme.colors.textMuted }]}>
              {dayNames[i]}
            </Text>
            <Text style={[styles.calendarDayNum, { color: isActive ? '#fff' : theme.colors.text }]}>
              {day.getDate()}
            </Text>
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
}

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

export function ProgressRing({ progress, size = 80, strokeWidth = 6, color, children }: ProgressRingProps) {
  const { theme } = useTheme();
  const ringColor = color || theme.colors.accent;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const progressPercent = Math.round(clampedProgress * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <Animated.View
      entering={ZoomIn.delay(200).duration(150)}
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
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </View>
    </Animated.View>
  );
}

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
    <Animated.View entering={FadeInLeft.delay(delay).duration(150)} style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[styles.sectionAction, { color: theme.colors.accent }]}>{action}</Text>
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

export function AnimatedListItem({
  children,
  index,
  style,
  onPress,
  accessibilityRole: a11yRole,
  accessibilityLabel,
  accessibilityHint,
}: AnimatedListItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Separate transform wrapper from layout animation to avoid Reanimated conflicts
  const content = (
    <Animated.View style={animatedStyle}>
      <Animated.View entering={FadeIn.delay(Math.min(index * 30, 200)).duration(120)} style={style}>
        {children}
      </Animated.View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 120 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        onPress={onPress}
        accessibilityRole={a11yRole || 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

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
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  gradientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  pulseDotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
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
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
  },
  gradientButtonText: {
    fontWeight: '700',
  },
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 38,
  },
  calendarDayName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  calendarDayNum: {
    fontSize: 15,
    fontWeight: '700',
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
