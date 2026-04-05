/**
 * Streak Calendar
 *
 * Visual calendar showing workout completion streaks.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { formatDate, startOfMonth, getDaysInMonth, getDay, addDays, isSameDay, parseISO } from './dateUtils';
import { ThemedChartWrapper, useChartTheme } from './ThemedChart';
import { useTheme } from '../../context/ThemeContext';
import { darkTheme as theme, typography, spacing, radius } from '../../design/theme-system';
import type { StreakCalendarProps, StreakDay } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// CONSTANTS
// ============================================

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 64) / 7);

// ============================================
// CALENDAR GRID
// ============================================

interface CalendarGridProps {
  year: number;
  month: number;
  streakDays: Map<string, StreakDay>;
  primaryColor: string;
  successColor: string;
  mutedColor: string;
  textColor: string;
  surfaceColor: string;
  onDayPress?: (day: StreakDay) => void;
}

function CalendarGrid({
  year,
  month,
  streakDays,
  primaryColor,
  successColor,
  mutedColor,
  textColor,
  surfaceColor: _surfaceColor,
  onDayPress,
}: CalendarGridProps) {
  const { theme } = useTheme();
  const today = new Date();
  const firstDayOfMonth = startOfMonth(new Date(year, month));
  const daysInMonth = getDaysInMonth(firstDayOfMonth);
  const startWeekday = getDay(firstDayOfMonth);

  // Generate calendar grid
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Pad the first week with nulls
  for (let i = 0; i < startWeekday; i++) {
    currentWeek.push(null);
  }

  // Fill in the days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    currentWeek.push(date);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad the last week
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return (
    <View style={styles.calendarContainer}>
      {/* Day labels */}
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={[styles.dayLabelCell, { width: CELL_SIZE }]}>
            <Text style={[styles.dayLabel, { color: mutedColor }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar weeks */}
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date, dayIndex) => {
            if (!date) {
              return (
                <View key={`empty-${dayIndex}`} style={[styles.dayCell, { width: CELL_SIZE, height: CELL_SIZE }]} />
              );
            }

            const dateStr = formatDate(date, 'yyyy-MM-dd');
            const streakDay = streakDays.get(dateStr);
            const isCompleted = streakDay?.completed ?? false;
            const isToday = isSameDay(date, today);
            const isFuture = date > today;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  { width: CELL_SIZE, height: CELL_SIZE },
                  isCompleted && { backgroundColor: successColor },
                  isToday && !isCompleted && styles.todayCell,
                  isToday && { borderColor: primaryColor },
                ]}
                onPress={() => {
                  if (streakDay && onDayPress) {
                    onDayPress(streakDay);
                  }
                }}
                disabled={isFuture || !streakDay}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    { color: isFuture ? mutedColor : textColor },
                    isCompleted && { color: theme.colors.onAccent, fontWeight: '600' },
                  ]}
                >
                  {date.getDate()}
                </Text>
                {isCompleted && (
                  <View style={styles.checkmark}>
                    <Text style={[styles.checkmarkText, { color: theme.colors.onAccent }]}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ============================================
// STREAK STATS
// ============================================

interface StreakStatsProps {
  data: StreakDay[];
  primaryColor: string;
  textColor: string;
  mutedColor: string;
}

function StreakStats({ data, primaryColor, textColor, mutedColor }: StreakStatsProps) {
  const completedDays = data.filter((d) => d.completed).length;

  // Calculate current streak
  let currentStreak = 0;
  const sortedDays = [...data]
    .filter((d) => d.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDays.length; i++) {
    const expectedDate = addDays(today, -i);
    const dayDate = parseISO(sortedDays[i]!.date);
    dayDate.setHours(0, 0, 0, 0);

    if (isSameDay(dayDate, expectedDate)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  const allSorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 0; i < allSorted.length; i++) {
    if (allSorted[i]!.completed) {
      tempStreak++;
      if (i === 0 || !allSorted[i - 1]?.completed) {
        // Check if consecutive with previous day
        if (i > 0) {
          const prevDate = parseISO(allSorted[i - 1]!.date);
          const currDate = parseISO(allSorted[i]!.date);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays !== 1) {
            tempStreak = 1;
          }
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  const consistencyPct = data.length > 0 ? Math.round((completedDays / data.length) * 100) : 0;

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: primaryColor }]}>{currentStreak}</Text>
        <Text style={[styles.statLabel, { color: mutedColor }]}>Current</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: mutedColor }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: textColor }]}>{longestStreak}</Text>
        <Text style={[styles.statLabel, { color: mutedColor }]}>Longest</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: mutedColor }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: textColor }]}>{consistencyPct}%</Text>
        <Text style={[styles.statLabel, { color: mutedColor }]}>Consistency</Text>
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StreakCalendar({ data, month, year, onDayPress }: StreakCalendarProps) {
  const chartTheme = useChartTheme();

  // Create a map for quick lookup
  const streakDaysMap = useMemo(() => {
    const map = new Map<string, StreakDay>();
    data.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  const monthName = formatDate(new Date(year, month), 'MMMM yyyy');
  const isEmpty = data.length === 0;

  return (
    <ThemedChartWrapper
      title="Workout Streak"
      subtitle={monthName}
      isEmpty={isEmpty}
      emptyMessage="Complete workouts to build your streak"
      config={{ height: 340 }}
    >
      <StreakStats
        data={data}
        primaryColor={chartTheme.primary}
        textColor={chartTheme.text}
        mutedColor={chartTheme.textMuted}
      />

      <CalendarGrid
        year={year}
        month={month}
        streakDays={streakDaysMap}
        primaryColor={chartTheme.primary}
        successColor={chartTheme.success}
        mutedColor={chartTheme.textMuted}
        textColor={chartTheme.text}
        surfaceColor={chartTheme.surface}
        onDayPress={onDayPress}
      />
    </ThemedChartWrapper>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  calendarContainer: {
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[1],
  },
  dayLabelCell: {
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  dayLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    margin: spacing[0.5],
  },
  todayCell: {
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: typography.sizes.bodySmall,
  },
  checkmark: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  checkmarkText: {
    fontSize: typography.sizes.xxs,
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.h2,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: typography.sizes.captionSm,
    marginTop: spacing[0.5],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    opacity: 0.2,
  },
});

export default StreakCalendar;
