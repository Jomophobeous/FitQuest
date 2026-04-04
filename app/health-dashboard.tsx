import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { ScreenContainer } from '../src/components/ui/primitives';
import { spacing, radius } from '../src/design/theme-system';
import { healthMonitor, type DailyHealthSummary, type HealthGoals } from '../src/engines/HealthMonitor';

// ─── Metric Ring ───

function MetricRing({
  label,
  value,
  target,
  unit,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  icon: string;
  color: string;
  bgColor: string;
}) {
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const percent = Math.round(progress * 100);

  return (
    <View style={[styles.metricCard, { backgroundColor: bgColor }]}>
      <View style={styles.metricHeader}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={color} />
        <ThemedText variant="caption" color="muted" style={styles.metricLabel}>
          {label}
        </ThemedText>
      </View>
      <ThemedText variant="h3" style={[styles.metricValue, { color }]}>
        {value.toLocaleString()}
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        / {target.toLocaleString()} {unit}
      </ThemedText>
      {/* Simple progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${percent}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ─── Summary Card ───

function SummaryCard({
  title,
  items,
  bgColor,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
  bgColor: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bgColor }]}>
      <ThemedText variant="h4" style={styles.summaryTitle}>
        {title}
      </ThemedText>
      {items.map((item) => (
        <View key={item.label} style={styles.summaryRow}>
          <ThemedText variant="body" color="secondary">
            {item.label}
          </ThemedText>
          <ThemedText variant="body">{item.value}</ThemedText>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ───

function HealthDashboardContent() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [today, setToday] = useState<Partial<DailyHealthSummary>>({});
  const [goals, setGoals] = useState<HealthGoals | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});
  const [weekSummaries, setWeekSummaries] = useState<Partial<DailyHealthSummary>[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const todaySummary = healthMonitor.getTodaySummary();
      const currentGoals = healthMonitor.getGoals();
      const progress = healthMonitor.getGoalProgress();
      const summaries = await healthMonitor.getDailySummaries(7);

      setToday(todaySummary);
      setGoals(currentGoals);
      setGoalProgress(progress);
      setWeekSummaries(summaries);
    } catch {
      // Graceful degradation — show defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ThemedText variant="body" color="muted">
          Loading health data...
        </ThemedText>
      </View>
    );
  }

  const steps = today.totalSteps ?? 0;
  const calories = today.totalCalories ?? 0;
  const activeMin = today.activeMinutes ?? 0;

  // Compute week totals
  const weekSteps = weekSummaries.reduce((sum, d) => sum + (d.totalSteps ?? 0), 0);
  const weekCalories = weekSummaries.reduce((sum, d) => sum + (d.totalCalories ?? 0), 0);
  const weekWorkouts = weekSummaries.reduce((sum, d) => sum + (d.workoutCount ?? 0), 0);

  const cardBg = theme.colors.surface;

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="heart-pulse" size={28} color={theme.colors.accent} />
          <ThemedText variant="h2" style={styles.headerTitle}>
            {t('nav.health')}
          </ThemedText>
        </View>

        {/* Today's Metrics */}
        <ThemedText variant="h4" color="secondary" style={styles.sectionLabel}>
          Today
        </ThemedText>
        <View style={styles.metricsGrid}>
          <MetricRing
            label="Steps"
            value={steps}
            target={goals?.dailySteps ?? 10000}
            unit="steps"
            icon="shoe-print"
            color="#10B981"
            bgColor={cardBg}
          />
          <MetricRing
            label="Calories"
            value={calories}
            target={goals?.dailyCalories ?? 500}
            unit="kcal"
            icon="fire"
            color="#F4A427"
            bgColor={cardBg}
          />
          <MetricRing
            label="Active"
            value={activeMin}
            target={goals?.dailyActiveMinutes ?? 30}
            unit="min"
            icon="run"
            color="#3B82F6"
            bgColor={cardBg}
          />
        </View>

        {/* Goal Progress */}
        <ThemedText variant="h4" color="secondary" style={styles.sectionLabel}>
          Goal Progress
        </ThemedText>
        <SummaryCard
          title="Daily Goals"
          bgColor={cardBg}
          items={[
            { label: 'Steps', value: `${Math.round((goalProgress.steps ?? 0) * 100)}%` },
            { label: 'Calories', value: `${Math.round((goalProgress.calories ?? 0) * 100)}%` },
            { label: 'Active Minutes', value: `${Math.round((goalProgress.activeMinutes ?? 0) * 100)}%` },
          ]}
        />

        {/* Weekly Summary */}
        <ThemedText variant="h4" color="secondary" style={styles.sectionLabel}>
          This Week
        </ThemedText>
        <SummaryCard
          title="7-Day Totals"
          bgColor={cardBg}
          items={[
            { label: 'Total Steps', value: weekSteps.toLocaleString() },
            { label: 'Total Calories', value: `${weekCalories.toLocaleString()} kcal` },
            { label: 'Workouts', value: String(weekWorkouts) },
            { label: 'Days Tracked', value: String(weekSummaries.length) },
          ]}
        />

        {/* Streak */}
        <SummaryCard
          title="Streak"
          bgColor={cardBg}
          items={[{ label: 'Current Streak', value: `${today.streakDays ?? 0} days` }]}
        />

        <View style={styles.spacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default function HealthDashboardScreen() {
  return (
    <ScreenErrorBoundary screenName="health-dashboard">
      <HealthDashboardContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },
  headerTitle: { marginLeft: spacing[2] },
  sectionLabel: { marginTop: spacing[4], marginBottom: spacing[2] },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  metricCard: {
    flex: 1,
    padding: spacing[3],
    borderRadius: radius.lg,
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  metricLabel: { flex: 1 },
  metricValue: { marginTop: spacing[1] },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: spacing[2],
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  summaryCard: {
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[3],
  },
  summaryTitle: { marginBottom: spacing[3] },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  spacer: { height: spacing[12] },
});
