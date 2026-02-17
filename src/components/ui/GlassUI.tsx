/**
 * FitQuest Glass UI Components
 * Premium, high-tech visual components with glass-morphism,
 * animated cards, gradients, and micro-interactions.
 * 
 * Uses: react-native-reanimated, expo-linear-gradient, expo-blur
 * 
 * Keeps existing colors from theme-system.ts — only adds texture & feel.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  type StyleProp,
  ViewStyle,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export function GlassCard({
  children,
  style,
  delay = 0,
  gradient = false,
  gradientColors,
  onPress,
  glowColor, // ignored
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
          backgroundColor: theme.isDark
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.95)',
          borderColor: theme.isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
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
        >
          {cardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return cardContent;
}

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
    <Animated.View entering={FadeIn.duration(150)}>
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
  active = true 
}: { color?: string; size?: number; active?: boolean }) {
  // No idle animations - static dot only
  return (
    <View style={styles.pulseDotContainer}>
      {!!active && (
        <View
          style={{
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: color + '25',
          }}
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

export function StatChip({ icon, label, value, color, delay = 0 }: StatChipProps) {
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
    >
      <MaterialCommunityIcons name={icon} size={16} color={chipColor} />
      <Text style={[styles.statChipValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: theme.colors.textMuted }]}>{label}</Text>
    </Animated.View>
  );
}

// ============================================
// ANIMATED COUNTER
// ============================================

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  style?: any;
}

export function AnimatedCounter({ value, suffix = '', style }: AnimatedCounterProps) {
  const displayValue = useSharedValue(0);
  const { theme } = useTheme();

  useEffect(() => {
    displayValue.value = withTiming(value, {
      duration: 150,
      easing: Easing.out(Easing.linear),
    });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  // For RN we use a simple approach - the actual counting is visual-only
  return (
    <Animated.View entering={ZoomIn.delay(200).duration(150)}>
      <Text style={[styles.animatedCounter, { color: theme.colors.text }, style]}>
        {value}{suffix}
      </Text>
    </Animated.View>
  );
}

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

export function GradientButton({
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
  const bgColor = disabled ? '#666' : (colors?.[0] || variantColors[variant]);

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
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
            <MaterialCommunityIcons name={icon} size={fontSize + 4} color={theme.colors.text} style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.gradientButtonText, { fontSize, color: theme.colors.text }]}>{title}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
        const dateStr = day.toISOString().split('T')[0];
        const isToday = today.toISOString().split('T')[0] === dateStr;
        const isActive = activeDate.toISOString().split('T')[0] === dateStr;
        const hasWorkout = workoutDates.includes(dateStr);

        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.calendarDay,
              isActive && { backgroundColor: theme.colors.accent },
              isToday && !isActive && {
                borderColor: theme.colors.accent,
                borderWidth: 1.5,
              },
            ]}
            onPress={() => onDatePress?.(day)}
          >
            <Text
              style={[
                styles.calendarDayName,
                { color: isActive ? '#fff' : theme.colors.textMuted },
              ]}
            >
              {dayNames[i]}
            </Text>
            <Text
              style={[
                styles.calendarDayNum,
                { color: isActive ? '#fff' : theme.colors.text },
              ]}
            >
              {day.getDate()}
            </Text>
            {!!hasWorkout && (
              <View
                style={[
                  styles.calendarDot,
                  { backgroundColor: isActive ? '#fff' : theme.colors.success },
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

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color,
  children,
}: ProgressRingProps) {
  const { theme } = useTheme();
  const ringColor = color || theme.colors.accent;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Animated.View entering={ZoomIn.delay(200).duration(150)} style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </View>
      {/* Background ring */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }} />
      {/* Progress arc (simplified using border trick) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: ringColor,
          borderRightColor: progress > 0.25 ? ringColor : 'transparent',
          borderBottomColor: progress > 0.5 ? ringColor : 'transparent',
          borderLeftColor: progress > 0.75 ? ringColor : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }}
      />
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

export function SectionHeader({ title, action, onAction, delay = 0 }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInLeft.delay(delay).duration(150)}
      style={styles.sectionHeader}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[styles.sectionAction, { color: theme.colors.accent }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ============================================
// ANIMATED LIST ITEM
// ============================================

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: ViewStyle;
  onPress?: () => void;
}

export function AnimatedListItem({ children, index, style, onPress }: AnimatedListItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Separate transform wrapper from layout animation to avoid Reanimated conflicts
  const content = (
    <Animated.View style={animatedStyle}>
      <Animated.View
        entering={FadeInRight.delay(index * 40).duration(150)}
        style={style}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={() => { scale.value = withTiming(0.98, { duration: 120 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
        onPress={onPress}
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
