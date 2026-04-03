/**
 * Skeleton — Shimmer loading placeholders
 *
 * Usage:
 *   <Skeleton width={120} height={16} />              // text line
 *   <Skeleton width={64} height={64} radius="full" /> // circular avatar
 *   <SkeletonCard />                                   // full card placeholder
 *   <SkeletonList count={5} />                          // list of placeholder rows
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../design/theme-system';

// ============================================
// BASE SKELETON BONE
// ============================================

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | number;
  style?: any;
}

export function Skeleton({ width, height, radius = 'md', style }: SkeletonProps) {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0.3);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  const borderRadius =
    radius === 'full'
      ? typeof height === 'number'
        ? height / 2
        : 999
      : radius === 'none'
        ? 0
        : radius === 'sm'
          ? 4
          : radius === 'md'
            ? 8
            : radius === 'lg'
              ? 16
              : radius;

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ============================================
// SKELETON CARD — Full card placeholder
// ============================================

export function SkeletonCard({ style }: { style?: any }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        skeletonStyles.card,
        {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
          borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      <Skeleton width="60%" height={16} radius="sm" />
      <Skeleton width="90%" height={12} radius="sm" style={{ marginTop: spacing[2.5] }} />
      <Skeleton width="40%" height={12} radius="sm" style={{ marginTop: spacing[1.5] }} />
    </View>
  );
}

// ============================================
// SKELETON LIST — Multiple placeholder rows
// ============================================

export function SkeletonList({ count = 4 }: { count?: number }) {
  const { theme } = useTheme();

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            skeletonStyles.listRow,
            {
              borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            },
          ]}
        >
          <Skeleton width={40} height={40} radius="full" />
          <View style={skeletonStyles.listRowContent}>
            <Skeleton width="65%" height={14} radius="sm" />
            <Skeleton width="40%" height={10} radius="sm" style={{ marginTop: spacing[1.5] }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// SKELETON DASHBOARD — Full dashboard placeholder
// ============================================

export function SkeletonDashboard() {
  return (
    <View style={skeletonStyles.dashboard}>
      {/* Header area */}
      <View style={skeletonStyles.dashboardHeader}>
        <View>
          <Skeleton width={100} height={12} radius="sm" />
          <Skeleton width={140} height={24} radius="sm" style={{ marginTop: spacing[1.5] }} />
        </View>
        <View style={skeletonStyles.headerPills}>
          <Skeleton width={48} height={28} radius={10} />
          <Skeleton width={48} height={28} radius={10} />
          <Skeleton width={56} height={28} radius={10} />
        </View>
      </View>

      {/* Main card */}
      <SkeletonCard style={{ marginHorizontal: spacing[4], marginTop: spacing[3], minHeight: 160 }} />

      {/* Recovery bar */}
      <Skeleton width="90%" height={48} radius="lg" style={{ alignSelf: 'center', marginTop: spacing[4] }} />

      {/* Week strip */}
      <View style={skeletonStyles.weekStrip}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} width={38} height={54} radius="lg" />
        ))}
      </View>

      {/* Section */}
      <Skeleton width={140} height={18} radius="sm" style={{ marginLeft: spacing[5], marginTop: spacing[4] }} />
      <SkeletonCard style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }} />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing[4],
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    gap: spacing[3],
  },
  listRowContent: {
    flex: 1,
  },
  dashboard: {
    paddingTop: spacing[2],
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  headerPills: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
  },
});
