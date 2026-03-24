/**
 * Muscle Distribution Chart
 *
 * Horizontal bar chart showing muscle group training distribution.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { ThemedChartWrapper, useChartTheme } from './ThemedChart';
import type { MuscleDistributionChartProps, MuscleGroupDataPoint, MUSCLE_GROUP_COLORS } from './types';
import { formatMuscleName } from '../../utils/formatMuscle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// COLORS
// ============================================

const CHART_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#A855F7', // Purple
];

// ============================================
// HORIZONTAL BAR CHART
// ============================================

interface HorizontalBarChartProps {
  data: MuscleGroupDataPoint[];
  textColor: string;
  mutedColor: string;
}

function HorizontalBarChart({ data, textColor, mutedColor }: HorizontalBarChartProps) {
  const maxSets = Math.max(...data.map((d) => d.sets), 1);
  const totalSets = data.reduce((sum, d) => sum + d.sets, 0);
  const maxBarWidth = SCREEN_WIDTH - 140;

  // Sort by sets descending and take top 8
  const sortedData = [...data].sort((a, b) => b.sets - a.sets).slice(0, 8);

  return (
    <View style={styles.horizontalBarsContainer}>
      {sortedData.map((item, index) => {
        const barWidth = (item.sets / maxSets) * maxBarWidth;
        const percentage = totalSets > 0 ? Math.round((item.sets / totalSets) * 100) : 0;

        return (
          <View key={item.muscle} style={styles.horizontalBarRow}>
            <Text style={[styles.muscleLabel, { color: textColor }]} numberOfLines={1}>
              {formatMuscleName(item.muscle)}
            </Text>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.horizontalBar,
                  {
                    width: Math.max(barWidth, 4),
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  },
                ]}
              />
            </View>
            <Text style={[styles.setsLabel, { color: mutedColor }]}>
              {item.sets} sets ({percentage}%)
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ============================================
// SIMPLE PIE CHART (Visual Representation)
// ============================================

interface SimplePieChartProps {
  data: MuscleGroupDataPoint[];
  size: number;
  textColor: string;
}

function SimplePieChart({ data, size, textColor }: SimplePieChartProps) {
  const totalSets = data.reduce((sum, d) => sum + d.sets, 0);
  const sortedData = [...data].sort((a, b) => b.sets - a.sets).slice(0, 6);

  // Calculate cumulative percentages for segment positioning
  let cumulativePercent = 0;
  const segments = sortedData.map((item, index) => {
    const percent = totalSets > 0 ? (item.sets / totalSets) * 100 : 0;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      startPercent,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  return (
    <View style={[styles.pieContainer, { width: size, height: size }]}>
      {/* Pie segments represented as colored arcs */}
      {segments.map((seg, i) => (
        <View
          key={seg.muscle}
          style={[
            styles.pieSegment,
            {
              backgroundColor: seg.color,
              transform: [{ rotate: `${(seg.startPercent / 100) * 360}deg` }],
              width: size * 0.4,
              height: size * 0.4,
            },
          ]}
        />
      ))}

      {/* Center circle */}
      <View style={[styles.pieCenter, { width: size * 0.5, height: size * 0.5 }]}>
        <Text style={[styles.pieCenterText, { color: textColor }]}>{totalSets}</Text>
        <Text style={[styles.pieCenterLabel, { color: textColor, opacity: 0.6 }]}>sets</Text>
      </View>

      {/* Legend */}
      <View style={styles.pieLegend}>
        {segments.map((seg) => (
          <View key={seg.muscle} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[styles.legendText, { color: textColor }]} numberOfLines={1}>
              {formatMuscleName(seg.muscle)} ({Math.round(seg.percent)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MuscleDistributionChart({
  data,
  config = {},
  chartType = 'bar',
  onDataPointPress,
}: MuscleDistributionChartProps) {
  const chartTheme = useChartTheme();
  const height = config.height ?? 280;

  const isEmpty = data.length === 0;

  const totalSets = useMemo(() => data.reduce((sum, d) => sum + d.sets, 0), [data]);
  const muscleCount = data.length;

  return (
    <ThemedChartWrapper
      title="Muscle Distribution"
      subtitle={isEmpty ? undefined : `${muscleCount} muscle groups trained`}
      isEmpty={isEmpty}
      emptyMessage="Complete workouts to see distribution"
      config={{ ...config, height }}
    >
      {chartType === 'pie' ? (
        <SimplePieChart data={data} size={180} textColor={chartTheme.text} />
      ) : (
        <HorizontalBarChart data={data} textColor={chartTheme.text} mutedColor={chartTheme.textMuted} />
      )}
    </ThemedChartWrapper>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  horizontalBarsContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  horizontalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  muscleLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '500',
  },
  barWrapper: {
    flex: 1,
    height: 16,
    marginHorizontal: 8,
  },
  horizontalBar: {
    height: '100%',
    borderRadius: 4,
  },
  setsLabel: {
    width: 70,
    fontSize: 11,
    textAlign: 'right',
  },
  pieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  pieSegment: {
    position: 'absolute',
    borderRadius: 4,
  },
  pieCenter: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterText: {
    fontSize: 24,
    fontWeight: '700',
  },
  pieCenterLabel: {
    fontSize: 11,
  },
  pieLegend: {
    position: 'absolute',
    top: '100%',
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: SCREEN_WIDTH - 80,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});

export default MuscleDistributionChart;
