/**
 * Themed Chart Wrapper
 * 
 * Provides consistent theming, date range selector, and loading states
 * for all Victory-native chart components.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  DateRangeOption,
  DATE_RANGE_LABELS,
  ChartConfig,
  DEFAULT_CHART_CONFIG,
  ChartThemeColors,
  DARK_CHART_THEME,
  LIGHT_CHART_THEME,
} from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// PROPS
// ============================================

interface ThemedChartWrapperProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
  showDateRange?: boolean;
  dateRange?: DateRangeOption;
  onDateRangeChange?: (range: DateRangeOption) => void;
  availableRanges?: DateRangeOption[];
  config?: Partial<ChartConfig>;
}

// ============================================
// HOOK: useChartTheme
// ============================================

export function useChartTheme(): ChartThemeColors {
  const { theme, mode } = useTheme();
  return mode === 'dark' ? DARK_CHART_THEME : LIGHT_CHART_THEME;
}

// ============================================
// DATE RANGE SELECTOR
// ============================================

interface DateRangeSelectorProps {
  selected: DateRangeOption;
  onChange: (range: DateRangeOption) => void;
  options?: DateRangeOption[];
}

export function DateRangeSelector({
  selected,
  onChange,
  options = ['7d', '30d', '90d', '1y'],
}: DateRangeSelectorProps) {
  const chartTheme = useChartTheme();

  return (
    <View style={styles.rangeSelectorContainer}>
      {options.map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.rangeButton,
            {
              backgroundColor:
                selected === range ? chartTheme.primary : chartTheme.surface,
              borderColor: chartTheme.grid,
            },
          ]}
          onPress={() => onChange(range)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.rangeButtonText,
              {
                color: selected === range ? '#FFFFFF' : chartTheme.textMuted,
                fontWeight: selected === range ? '600' : '400',
              },
            ]}
          >
            {DATE_RANGE_LABELS[range]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================
// THEMED CHART WRAPPER
// ============================================

export function ThemedChartWrapper({
  title,
  subtitle,
  children,
  loading = false,
  error,
  emptyMessage = 'No data available',
  isEmpty = false,
  showDateRange = false,
  dateRange = '7d',
  onDateRangeChange,
  availableRanges,
  config = {},
}: ThemedChartWrapperProps) {
  const chartTheme = useChartTheme();
  const mergedConfig = { ...DEFAULT_CHART_CONFIG, ...config };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.stateContainer, { height: mergedConfig.height }]}>
          <ActivityIndicator size="large" color={chartTheme.primary} />
          <Text style={[styles.stateText, { color: chartTheme.textMuted }]}>
            Loading chart data...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.stateContainer, { height: mergedConfig.height }]}>
          <Text style={[styles.stateIcon, { color: chartTheme.error }]}>⚠️</Text>
          <Text style={[styles.stateText, { color: chartTheme.error }]}>
            {error}
          </Text>
        </View>
      );
    }

    if (isEmpty) {
      return (
        <View style={[styles.stateContainer, { height: mergedConfig.height }]}>
          <Text style={[styles.stateIcon, { color: chartTheme.textMuted }]}>📊</Text>
          <Text style={[styles.stateText, { color: chartTheme.textMuted }]}>
            {emptyMessage}
          </Text>
        </View>
      );
    }

    return children;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: chartTheme.surface, borderColor: chartTheme.grid },
      ]}
    >
      {(title || showDateRange) && (
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            {title && (
              <Text style={[styles.title, { color: chartTheme.text }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: chartTheme.textMuted }]}>
                {subtitle}
              </Text>
            )}
          </View>
          {showDateRange && onDateRangeChange && (
            <DateRangeSelector
              selected={dateRange}
              onChange={onDateRangeChange}
              options={availableRanges}
            />
          )}
        </View>
      )}
      <View style={styles.chartContainer}>{renderContent()}</View>
    </View>
  );
}

// ============================================
// MINI STAT COMPONENT
// ============================================

interface MiniStatProps {
  label: string;
  value: string | number;
  delta?: number;
  unit?: string;
}

export function MiniStat({ label, value, delta, unit }: MiniStatProps) {
  const chartTheme = useChartTheme();
  const deltaColor =
    delta === undefined
      ? chartTheme.textMuted
      : delta >= 0
      ? chartTheme.success
      : chartTheme.error;

  return (
    <View style={styles.miniStatContainer}>
      <Text style={[styles.miniStatLabel, { color: chartTheme.textMuted }]}>
        {label}
      </Text>
      <View style={styles.miniStatValueRow}>
        <Text style={[styles.miniStatValue, { color: chartTheme.text }]}>
          {value}
          {unit && (
            <Text style={[styles.miniStatUnit, { color: chartTheme.textMuted }]}>
              {' '}{unit}
            </Text>
          )}
        </Text>
        {delta !== undefined && (
          <Text style={[styles.miniStatDelta, { color: deltaColor }]}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================
// LEGEND COMPONENT
// ============================================

interface LegendItem {
  label: string;
  color: string;
  value?: string | number;
}

interface ChartLegendProps {
  items: LegendItem[];
  orientation?: 'horizontal' | 'vertical';
}

export function ChartLegend({
  items,
  orientation = 'horizontal',
}: ChartLegendProps) {
  const chartTheme = useChartTheme();

  return (
    <View
      style={[
        styles.legendContainer,
        orientation === 'vertical' && styles.legendVertical,
      ]}
    >
      {items.map((item, index) => (
        <View key={index} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={[styles.legendLabel, { color: chartTheme.textMuted }]}>
            {item.label}
          </Text>
          {item.value !== undefined && (
            <Text style={[styles.legendValue, { color: chartTheme.text }]}>
              {item.value}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  chartContainer: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  stateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  stateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  stateText: {
    fontSize: 14,
    marginTop: 8,
  },
  rangeSelectorContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  rangeButtonText: {
    fontSize: 12,
  },
  miniStatContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  miniStatLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  miniStatUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  miniStatDelta: {
    fontSize: 12,
    marginLeft: 6,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  legendVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ThemedChartWrapper;
