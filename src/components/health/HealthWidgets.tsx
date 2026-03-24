/**
 * Health Widgets — Reusable health visualization components
 *
 * Extracted from health-dashboard.tsx for reuse across health-related screens.
 * MetricRing: Circular progress for daily metrics (steps, calories, etc.)
 * AlertCard: Dismissible health anomaly alert
 * TrendBar: 7-day bar chart for trends
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../ThemedText';

// ============================================
// TYPES
// ============================================

export interface HealthAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

// ============================================
// METRIC RING — Circular progress for a single metric
// ============================================

interface MetricRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  icon: string;
  label: string;
  unit: string;
  theme: any;
}

export function MetricRing({
  value,
  max,
  size = 80,
  strokeWidth = 6,
  color,
  icon,
  label,
  unit,
  theme,
}: MetricRingProps) {
  const progress = Math.min(1, value / Math.max(1, max));

  return (
    <View style={{ alignItems: 'center', width: size + 16 }} accessibilityLabel={`${label}: ${value}${unit}`}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {/* Background ring */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color + '20',
          }}
        />
        {/* Progress ring */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderRightColor: progress < 0.75 ? 'transparent' : color,
            borderBottomColor: progress < 0.5 ? 'transparent' : color,
            borderLeftColor: progress < 0.25 ? 'transparent' : color,
            transform: [{ rotate: '-90deg' }],
          }}
        />
        <MaterialCommunityIcons name={icon as any} size={size * 0.3} color={color} />
      </View>
      <ThemedText variant="caption" color="muted" style={{ marginTop: 4, textAlign: 'center' }}>
        {label}
      </ThemedText>
      <ThemedText variant="body" style={{ color, fontWeight: '700', textAlign: 'center' }}>
        {value.toLocaleString()}
        {unit}
      </ThemedText>
    </View>
  );
}

// ============================================
// ALERT CARD — Dismissible health anomaly alert
// ============================================

interface AlertCardProps {
  alert: HealthAlert;
  theme: any;
  onDismiss: (id: string) => void;
}

export function AlertCard({ alert, theme, onDismiss }: AlertCardProps) {
  const severityColors: Record<string, string> = {
    LOW: theme.colors.textMuted,
    MEDIUM: theme.colors.warning,
    HIGH: theme.colors.warning,
    CRITICAL: theme.colors.error,
  };
  const bgColor = severityColors[alert.severity] ?? theme.colors.textMuted;

  return (
    <Animated.View entering={SlideInRight.duration(300)}>
      <TouchableOpacity
        onPress={() => onDismiss(alert.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${alert.severity} alert: ${alert.type}. Tap to dismiss.`}
      >
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: bgColor + '15',
              borderLeftColor: bgColor,
              borderLeftWidth: 3,
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons
              name={alert.severity === 'CRITICAL' ? 'alert-circle' : 'alert-outline'}
              size={18}
              color={bgColor}
            />
            <ThemedText variant="caption" style={{ color: bgColor, fontWeight: '700', marginLeft: 6, flex: 1 }}>
              {alert.severity} — {alert.type}
            </ThemedText>
            <MaterialCommunityIcons name="close" size={16} color={theme.colors.textMuted} />
          </View>
          <ThemedText variant="caption" color="secondary" style={{ marginTop: 4 }}>
            {alert.message}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// TREND BAR — 7-day bar chart
// ============================================

interface TrendBarProps {
  data: TrendPoint[];
  color: string;
  theme: any;
}

export function TrendBar({ data, color, theme }: TrendBarProps) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.trendContainer} accessibilityLabel={`Trend chart with ${data.length} data points`}>
      {data.map((point, i) => (
        <View key={i} style={styles.trendBarWrapper}>
          <View style={[styles.trendBarBg, { backgroundColor: color + '20' }]}>
            <Animated.View
              entering={FadeInUp.delay(i * 50).duration(300)}
              style={[
                styles.trendBarFill,
                {
                  backgroundColor: color,
                  height: `${Math.max(5, (point.value / maxVal) * 100)}%`,
                },
              ]}
            />
          </View>
          <ThemedText variant="caption" color="muted" style={{ fontSize: 9, marginTop: 2 }}>
            {point.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  alertCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    paddingHorizontal: 4,
  },
  trendBarWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  trendBarBg: {
    width: '100%',
    height: 60,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 4,
  },
});
