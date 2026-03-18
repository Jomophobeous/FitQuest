/**
 * Steps Chart
 * 
 * Bar chart showing daily steps with goal indicator.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { formatDate, parseISO } from './dateUtils';
import {
  ThemedChartWrapper,
  useChartTheme,
  MiniStat,
} from './ThemedChart';
import type { StepsChartProps, StepDataPoint } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// STATS CALCULATION
// ============================================

function calculateStats(data: StepDataPoint[]) {
  if (data.length === 0) {
    return { totalSteps: 0, avgDaily: 0, bestDay: 0, goalDays: 0, trend: 0 };
  }

  const totalSteps = data.reduce((sum, d) => sum + d.steps, 0);
  const avgDaily = Math.round(totalSteps / data.length);
  const bestDay = Math.max(...data.map(d => d.steps));
  const goalDays = data.filter(d => d.metGoal).length;

  // Calculate trend
  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  
  const firstAvg = firstHalf.length > 0
    ? firstHalf.reduce((s, d) => s + d.steps, 0) / firstHalf.length
    : 0;
  const secondAvg = secondHalf.length > 0
    ? secondHalf.reduce((s, d) => s + d.steps, 0) / secondHalf.length
    : 0;
  
  const trend = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  return { totalSteps, avgDaily, bestDay, goalDays, trend };
}

function formatSteps(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return String(value);
}

// ============================================
// SIMPLE BAR CHART WITH GOAL LINE
// ============================================

interface SimpleStepsBarChartProps {
  data: StepDataPoint[];
  height: number;
  primaryColor: string;
  successColor: string;
  warningColor: string;
  mutedColor: string;
}

function SimpleStepsBarChart({
  data,
  height,
  primaryColor,
  successColor,
  warningColor,
  mutedColor,
}: SimpleStepsBarChartProps) {
  const chartHeight = height - 40;
  const maxValue = Math.max(...data.map(d => Math.max(d.steps, d.goal)), 1);
  const barWidth = Math.max(8, Math.min(24, (SCREEN_WIDTH - 80) / data.length - 4));
  const avgGoal = data.length > 0 ? data[0]!.goal : 10000;
  const goalLineY = chartHeight - (avgGoal / maxValue) * chartHeight;

  return (
    <View style={[styles.chartContainer, { height }]}>
      {/* Goal line */}
      <View
        style={[
          styles.goalLine,
          {
            top: goalLineY,
            borderColor: warningColor,
          },
        ]}
      >
        <Text style={[styles.goalLabel, { color: warningColor }]}>
          Goal: {formatSteps(avgGoal)}
        </Text>
      </View>

      {/* Bars */}
      <View style={styles.barsContainer}>
        {data.map((point, index) => {
          const barHeight = (point.steps / maxValue) * chartHeight;
          
          return (
            <View key={point.date} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: point.metGoal ? successColor : primaryColor,
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
        <Text style={[styles.yLabel, { color: mutedColor }]}>
          {formatSteps(maxValue)}
        </Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>
          {formatSteps(Math.round(maxValue / 2))}
        </Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>0</Text>
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StepsChart({
  data,
  config = {},
  dateRange = '7d',
  showGoal = true,
  onDataPointPress,
}: StepsChartProps) {
  const chartTheme = useChartTheme();
  const height = config.height ?? 200;
  
  const stats = useMemo(() => calculateStats(data), [data]);
  
  const isEmpty = data.length === 0;
  
  return (
    <ThemedChartWrapper
      title="Daily Steps"
      subtitle={isEmpty ? undefined : `${stats.goalDays}/${data.length} days at goal`}
      isEmpty={isEmpty}
      emptyMessage="Start walking to track steps"
      config={config}
    >
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <MiniStat
          label="Total"
          value={formatSteps(stats.totalSteps)}
        />
        <MiniStat
          label="Avg/Day"
          value={formatSteps(stats.avgDaily)}
          delta={stats.trend}
        />
        <MiniStat
          label="Best Day"
          value={formatSteps(stats.bestDay)}
        />
      </View>

      {/* Chart */}
      <SimpleStepsBarChart
        data={data}
        height={height}
        primaryColor={chartTheme.secondary}
        successColor={chartTheme.success}
        warningColor={chartTheme.warning}
        mutedColor={chartTheme.textMuted}
      />
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
  chartContainer: {
    paddingLeft: 40,
    paddingRight: 8,
    position: 'relative',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 2,
    paddingBottom: 20,
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
  goalLine: {
    position: 'absolute',
    left: 40,
    right: 8,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  goalLabel: {
    position: 'absolute',
    right: 0,
    top: -14,
    fontSize: 10,
    fontWeight: '500',
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

export default StepsChart;
