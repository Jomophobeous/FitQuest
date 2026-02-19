/**
 * Workout Trend Chart
 * 
 * Line chart showing workout duration over time.
 * Uses Victory-native when available, falls back to simple bar visualization.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { formatDate, parseISO } from './dateUtils';
import {
  ThemedChartWrapper,
  useChartTheme,
  MiniStat,
  ChartLegend,
} from './ThemedChart';
import type {
  WorkoutTrendChartProps,
  WorkoutDataPoint,
  ChartConfig,
  DEFAULT_CHART_CONFIG,
} from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// STATS CALCULATION
// ============================================

function calculateStats(data: WorkoutDataPoint[]) {
  if (data.length === 0) {
    return {
      totalWorkouts: 0,
      avgDuration: 0,
      totalMinutes: 0,
      trend: 0,
    };
  }

  const totalMinutes = data.reduce((sum, d) => sum + d.durationMinutes, 0);
  const avgDuration = Math.round(totalMinutes / data.length);
  
  // Calculate trend (compare first half to second half)
  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  
  const firstAvg = firstHalf.length > 0
    ? firstHalf.reduce((s, d) => s + d.durationMinutes, 0) / firstHalf.length
    : 0;
  const secondAvg = secondHalf.length > 0
    ? secondHalf.reduce((s, d) => s + d.durationMinutes, 0) / secondHalf.length
    : 0;
  
  const trend = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  return {
    totalWorkouts: data.length,
    avgDuration,
    totalMinutes,
    trend,
  };
}

// ============================================
// SIMPLE BAR CHART FALLBACK
// ============================================

interface SimpleBarChartProps {
  data: WorkoutDataPoint[];
  height: number;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mutedColor: string;
}

function SimpleBarChart({
  data,
  height,
  primaryColor,
  secondaryColor,
  textColor,
  mutedColor,
}: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.durationMinutes), 1);
  const barWidth = Math.max(8, Math.min(24, (SCREEN_WIDTH - 80) / data.length - 4));

  return (
    <View style={[styles.simpleChartContainer, { height }]}>
      <View style={styles.barsContainer}>
        {data.map((point, index) => {
          const barHeight = (point.durationMinutes / maxValue) * (height - 40);
          const isDeload = point.isDeload ?? false;
          
          return (
            <View key={point.date} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: isDeload ? secondaryColor : primaryColor,
                    opacity: isDeload ? 0.6 : 1,
                  },
                ]}
              />
              {data.length <= 14 && (
                <Text
                  style={[styles.barLabel, { color: mutedColor }]}
                  numberOfLines={1}
                >
                  {formatDate(parseISO(point.date), data.length <= 7 ? 'EEE' : 'd')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      
      {/* Y-axis labels */}
      <View style={styles.yAxisLabels}>
        <Text style={[styles.yLabel, { color: mutedColor }]}>{maxValue}m</Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>{Math.round(maxValue / 2)}m</Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>0</Text>
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkoutTrendChart({
  data,
  config = {},
  dateRange = '7d',
  showExerciseCount = false,
  onDataPointPress,
}: WorkoutTrendChartProps) {
  const chartTheme = useChartTheme();
  const height = config.height ?? 200;
  
  const stats = useMemo(() => calculateStats(data), [data]);
  
  const isEmpty = data.length === 0;
  
  return (
    <ThemedChartWrapper
      title="Workout Duration"
      subtitle={isEmpty ? undefined : `${stats.totalWorkouts} workouts`}
      isEmpty={isEmpty}
      emptyMessage="Complete a workout to see trends"
      config={config}
    >
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <MiniStat
          label="Total Time"
          value={stats.totalMinutes}
          unit="min"
        />
        <MiniStat
          label="Avg Duration"
          value={stats.avgDuration}
          unit="min"
          delta={stats.trend}
        />
        <MiniStat
          label="Workouts"
          value={stats.totalWorkouts}
        />
      </View>

      {/* Chart */}
      <SimpleBarChart
        data={data}
        height={height}
        primaryColor={chartTheme.primary}
        secondaryColor={chartTheme.secondary}
        textColor={chartTheme.text}
        mutedColor={chartTheme.textMuted}
      />

      {/* Legend for deload workouts */}
      {data.some(d => d.isDeload) && (
        <ChartLegend
          items={[
            { label: 'Regular', color: chartTheme.primary },
            { label: 'Deload', color: chartTheme.secondary },
          ]}
        />
      )}
    </ThemedChartWrapper>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  simpleChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 40,
    paddingRight: 8,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 2,
  },
  barColumn: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 20,
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 10,
  },
});

export default WorkoutTrendChart;
