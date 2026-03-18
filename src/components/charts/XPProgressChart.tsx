/**
 * XP Progress Chart
 * 
 * Area/line chart showing XP accumulation over time.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { formatDate, parseISO } from './dateUtils';
import {
  ThemedChartWrapper,
  useChartTheme,
  MiniStat,
} from './ThemedChart';
import type { XPProgressChartProps, XPDataPoint } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// STATS CALCULATION
// ============================================

function calculateStats(data: XPDataPoint[]) {
  if (data.length === 0) {
    return { totalXP: 0, avgDaily: 0, bestDay: 0, trend: 0 };
  }

  const totalXP = data[data.length - 1]?.totalXP ?? 0;
  const totalDelta = data.reduce((sum, d) => sum + d.deltaXP, 0);
  const avgDaily = Math.round(totalDelta / data.length);
  const bestDay = Math.max(...data.map(d => d.deltaXP));

  // Calculate trend
  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  
  const firstAvg = firstHalf.length > 0
    ? firstHalf.reduce((s, d) => s + d.deltaXP, 0) / firstHalf.length
    : 0;
  const secondAvg = secondHalf.length > 0
    ? secondHalf.reduce((s, d) => s + d.deltaXP, 0) / secondHalf.length
    : 0;
  
  const trend = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  return { totalXP, avgDaily, bestDay, trend };
}

// ============================================
// SIMPLE AREA CHART
// ============================================

interface SimpleAreaChartProps {
  data: XPDataPoint[];
  height: number;
  primaryColor: string;
  mutedColor: string;
}

function SimpleAreaChart({
  data,
  height,
  primaryColor,
  mutedColor,
}: SimpleAreaChartProps) {
  const chartHeight = height - 40;
  const chartWidth = SCREEN_WIDTH - 80;
  
  const maxValue = Math.max(...data.map(d => d.totalXP), 1);
  const minValue = Math.min(...data.map(d => d.totalXP));
  const range = maxValue - minValue || 1;

  // Generate SVG-like path points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * chartWidth;
    const y = chartHeight - ((d.totalXP - minValue) / range) * chartHeight;
    return { x, y, value: d.totalXP, date: d.date };
  });

  return (
    <View style={[styles.areaChartContainer, { height }]}>
      {/* Grid lines */}
      <View style={styles.gridLines}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              { top: pct * chartHeight, backgroundColor: mutedColor },
            ]}
          />
        ))}
      </View>

      {/* Data points and connecting lines */}
      <View style={[styles.pointsContainer, { height: chartHeight }]}>
        {points.map((point, i) => (
          <View
            key={point.date}
            style={[
              styles.dataPoint,
              {
                left: point.x - 4,
                bottom: chartHeight - point.y - 4,
                backgroundColor: primaryColor,
              },
            ]}
          />
        ))}
        
        {/* Area fill representation */}
        <View
          style={[
            styles.areaFill,
            {
              backgroundColor: primaryColor,
              opacity: 0.15,
              height: chartHeight * 0.6,
            },
          ]}
        />
      </View>

      {/* Y-axis labels */}
      <View style={styles.yAxisLabels}>
        <Text style={[styles.yLabel, { color: mutedColor }]}>
          {formatXP(maxValue)}
        </Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>
          {formatXP(Math.round((maxValue + minValue) / 2))}
        </Text>
        <Text style={[styles.yLabel, { color: mutedColor }]}>
          {formatXP(minValue)}
        </Text>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxisLabels}>
        {data.length > 0 && (
          <>
            <Text style={[styles.xLabel, { color: mutedColor }]}>
              {formatDate(parseISO(data[0]!.date), 'MMM d')}
            </Text>
            <Text style={[styles.xLabel, { color: mutedColor }]}>
              {formatDate(parseISO(data[data.length - 1]!.date), 'MMM d')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function formatXP(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return String(value);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function XPProgressChart({
  data,
  config = {},
  dateRange = '30d',
  showDelta = true,
  onDataPointPress,
}: XPProgressChartProps) {
  const chartTheme = useChartTheme();
  const height = config.height ?? 200;
  
  const stats = useMemo(() => calculateStats(data), [data]);
  
  const isEmpty = data.length === 0;
  
  return (
    <ThemedChartWrapper
      title="XP Progress"
      subtitle={isEmpty ? undefined : `Level ${Math.floor(stats.totalXP / 1000)}`}
      isEmpty={isEmpty}
      emptyMessage="Complete workouts to earn XP"
      config={config}
    >
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <MiniStat
          label="Total XP"
          value={formatXP(stats.totalXP)}
        />
        <MiniStat
          label="Avg/Day"
          value={stats.avgDaily}
          unit="XP"
          delta={stats.trend}
        />
        <MiniStat
          label="Best Day"
          value={stats.bestDay}
          unit="XP"
        />
      </View>

      {/* Chart */}
      <SimpleAreaChart
        data={data}
        height={height}
        primaryColor={chartTheme.accent}
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
  areaChartContainer: {
    paddingLeft: 40,
    paddingRight: 8,
    paddingBottom: 24,
  },
  gridLines: {
    position: 'absolute',
    left: 40,
    right: 8,
    top: 0,
    bottom: 24,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.2,
  },
  pointsContainer: {
    position: 'relative',
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  areaFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 24,
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 10,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: 40,
    paddingRight: 8,
  },
  xLabel: {
    fontSize: 10,
  },
});

export default XPProgressChart;
