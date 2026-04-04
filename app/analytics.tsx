/**
 * FitQuest Analytics Screen
 *
 * Wired to REAL SQLite data — workout_sessions, daily_steps, jog_sessions,
 * workout_streaks, session_exercises, app_state (XP), daily_health_summaries.
 * Falls back to zero states when no data is present.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useAnalyticsViewModel } from '../src/viewmodels/useAnalyticsViewModel';
import { GlassCard, SectionHeader, ProgressRing, AnimatedListItem, GradientButton } from '../src/components/ui/GlassUI';
import ThemedText from '../src/components/ThemedText';
import { typography, spacing, radius } from '../src/design/theme-system';

// ─── SCREEN WIDTH ──────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

function getMonthCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  return { daysInMonth, startWeekday };
}

// ─── COMPONENT ─────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const vm = useAnalyticsViewModel();

  // Calendar day detail state
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const { daysInMonth, startWeekday } = useMemo(() => getMonthCalendar(year, month), [year, month]);

  const handleDayPress = useCallback(
    async (day: number) => {
      setSelectedDay(day);
      setDayModalVisible(true);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      await vm.loadDaySessions(dateStr);
    },
    [year, month, vm],
  );

  const maxBarCount = Math.max(...vm.workoutBars.map((b) => b.count), 1);
  const maxXP = Math.max(...vm.xpData, 1);
  const maxMuscleSessions = Math.max(...vm.muscleGroups.map((g) => g.sessions), 1);

  const s = styles(theme);

  if (vm.loadError && !vm.loading) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>
          {vm.loadError}
        </ThemedText>
        <GradientButton
          title={t('common.retry') ?? 'Retry'}
          onPress={() => {
            vm.loadData();
          }}
          style={{ marginTop: spacing[4] }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Analytics" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer scroll padded onRefresh={vm.handleRefresh} refreshing={vm.refreshing}>
        {/* ─── HERO HEADER ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).duration(200)}>
          <LinearGradient
            colors={
              theme.isDark
                ? ([theme.colors.accent + '12', theme.colors.purple + '08', 'transparent'] as [string, string, string])
                : ([theme.colors.accent + '0A', theme.colors.purple + '05', 'transparent'] as [string, string, string])
            }
            style={{ paddingTop: spacing[2], paddingBottom: spacing[5], borderRadius: 20, marginBottom: spacing[1] }}
          >
            <ThemedText style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
              {t('analytics.title')}
            </ThemedText>
            <ThemedText style={s.heroSub} numberOfLines={2}>
              {t('analytics.subtitle')}
            </ThemedText>

            {/* Quick Stats Summary */}
            {!vm.loading && (
              <View style={s.heroStatsRow}>
                <View style={s.heroStatItem}>
                  <View style={[s.heroStatIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                    <MaterialCommunityIcons name="fire" size={18} color={theme.colors.warning} />
                  </View>
                  <ThemedText style={[s.heroStatValue, { color: theme.colors.text }]}>
                    {vm.streakData.currentStreak}
                  </ThemedText>
                  <ThemedText
                    style={[s.heroStatLabel, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('analytics.dayStreak')}
                  </ThemedText>
                </View>
                <View style={s.heroStatItem}>
                  <View style={[s.heroStatIcon, { backgroundColor: theme.colors.accent + '20' }]}>
                    <MaterialCommunityIcons name="dumbbell" size={18} color={theme.colors.accent} />
                  </View>
                  <ThemedText style={[s.heroStatValue, { color: theme.colors.text }]}>
                    {vm.streakData.totalWorkouts}
                  </ThemedText>
                  <ThemedText
                    style={[s.heroStatLabel, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('analytics.totalWorkouts')}
                  </ThemedText>
                </View>
                <View style={s.heroStatItem}>
                  <View style={[s.heroStatIcon, { backgroundColor: theme.colors.purple + '20' }]}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color={theme.colors.purple} />
                  </View>
                  <ThemedText style={[s.heroStatValue, { color: theme.colors.text }]}>
                    {vm.xpData.reduce((a, b) => a + b, 0).toLocaleString()}
                  </ThemedText>
                  <ThemedText
                    style={[s.heroStatLabel, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('analytics.totalXP')}
                  </ThemedText>
                </View>
                <View style={s.heroStatItem}>
                  <View style={[s.heroStatIcon, { backgroundColor: theme.colors.blue + '20' }]}>
                    <MaterialCommunityIcons name="percent" size={18} color={theme.colors.blue} />
                  </View>
                  <ThemedText style={[s.heroStatValue, { color: theme.colors.text }]}>
                    {vm.streakData.consistencyPct}%
                  </ThemedText>
                  <ThemedText
                    style={[s.heroStatLabel, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('analytics.consistency')}
                  </ThemedText>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ─── RANGE TOGGLE ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)}>
          <View style={s.toggleRow}>
            {(['weekly', 'monthly'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                activeOpacity={0.7}
                onPress={() => vm.setRange(r)}
                accessibilityRole="button"
                accessibilityLabel={r === 'weekly' ? 'Weekly view' : 'Monthly view'}
                accessibilityState={{ selected: vm.range === r }}
                style={[
                  s.toggleBtn,
                  {
                    backgroundColor: vm.range === r ? theme.colors.accent : 'transparent',
                    borderColor: vm.range === r ? theme.colors.accent : theme.colors.border,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    s.toggleLabel,
                    {
                      color: vm.range === r ? theme.colors.onAccent : theme.colors.textMuted,
                      fontWeight: vm.range === r ? '700' : '600',
                    },
                  ]}
                >
                  {r === 'weekly' ? t('analytics.weekly') : t('analytics.monthly')}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {!!vm.loading && (
          <View style={{ alignItems: 'center', paddingVertical: spacing[8] }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        )}

        {!vm.loading && (
          <>
            {/* ─── WORKOUT FREQUENCY BAR CHART ─────── */}
            <SectionHeader title={t('analytics.workoutFrequency')} delay={150} />
            <Animated.View entering={FadeInDown.delay(200).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.accent} style={s.chartCard}>
                <View style={s.barRow}>
                  {vm.workoutBars.map((bar, i) => {
                    const pct = bar.count / maxBarCount;
                    return (
                      <View key={`${bar.day}-${i}`} style={s.barCol}>
                        <ThemedText
                          style={[s.barValue, { color: bar.count > 0 ? theme.colors.accent : theme.colors.textMuted }]}
                        >
                          {bar.count}
                        </ThemedText>
                        <View style={s.barTrack}>
                          <Animated.View entering={FadeInUp.delay(250 + i * 60).duration(200)}>
                            <LinearGradient
                              colors={[theme.colors.accent, theme.colors.accent + '60'] as [string, string]}
                              style={[
                                s.barFill,
                                {
                                  height: Math.max(pct * 100, bar.count > 0 ? 8 : 3),
                                  opacity: 0.5 + pct * 0.5,
                                },
                              ]}
                            />
                          </Animated.View>
                        </View>
                        <ThemedText style={[s.barLabel, { color: theme.colors.textMuted }]}>{bar.day}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── XP TREND LINE ──────────────────── */}
            <SectionHeader title={t('analytics.xpProgress')} delay={300} />
            <Animated.View entering={FadeInDown.delay(350).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.accent3} style={s.chartCard}>
                <View style={s.trendContainer}>
                  <View style={s.trendYAxis}>
                    <ThemedText style={[s.axisLabel, { color: theme.colors.textMuted }]}>{maxXP}</ThemedText>
                    <ThemedText style={[s.axisLabel, { color: theme.colors.textMuted }]}>
                      {Math.round(maxXP / 2)}
                    </ThemedText>
                    <ThemedText style={[s.axisLabel, { color: theme.colors.textMuted }]}>0</ThemedText>
                  </View>
                  <View style={s.trendChart}>
                    {[0, 1, 2].map((idx) => (
                      <View
                        key={idx}
                        style={[s.gridLine, { top: `${idx * 50}%`, backgroundColor: theme.colors.border }]}
                      />
                    ))}
                    <View style={s.trendPointsRow}>
                      {vm.xpData.map((val, i) => {
                        const pct = val / maxXP;
                        return (
                          <View key={i} style={s.trendCol}>
                            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                              <Animated.View
                                entering={ZoomIn.delay(400 + i * 80).duration(150)}
                                style={[
                                  s.trendDot,
                                  { marginBottom: `${pct * 85}%`, backgroundColor: theme.colors.accent3 },
                                ]}
                              />
                            </View>
                            <ThemedText style={[s.trendLabel, { color: theme.colors.textMuted }]}>
                              {vm.range === 'weekly'
                                ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'][
                                    new Date(Date.now() - (6 - i) * 86400000).getDay()
                                  ]
                                : `W${i + 1}`}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                    <View style={s.trendAreaRow} pointerEvents="none">
                      {vm.xpData.map((val, i) => {
                        const pct = val / maxXP;
                        return (
                          <View key={i} style={s.trendAreaCol}>
                            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                              <LinearGradient
                                colors={[theme.colors.accent3 + '40', theme.colors.accent3 + '05']}
                                style={{
                                  height: `${pct * 85}%`,
                                  borderTopLeftRadius: 4,
                                  borderTopRightRadius: 4,
                                }}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
                <View style={s.xpSummaryRow}>
                  <View style={s.xpSummaryItem}>
                    <ThemedText style={[s.xpSummaryValue, { color: theme.colors.accent3 }]}>
                      {vm.xpData.reduce((a, b) => a + b, 0).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>
                      {t('analytics.totalXP')}
                    </ThemedText>
                  </View>
                  <View style={s.xpSummaryItem}>
                    <ThemedText style={[s.xpSummaryValue, { color: theme.colors.accent3 }]}>
                      {vm.xpData.length > 0
                        ? Math.round(vm.xpData.reduce((a, b) => a + b, 0) / vm.xpData.length).toLocaleString()
                        : '0'}
                    </ThemedText>
                    <ThemedText style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>
                      {t('analytics.avgPerWorkout')}
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── MUSCLE GROUP HEATMAP ───────────── */}
            <SectionHeader title={t('analytics.muscleHeatmap')} delay={450} />
            <Animated.View entering={FadeInDown.delay(500).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.accent2} style={{ paddingVertical: spacing[4] }}>
                <View style={s.muscleGrid}>
                  {vm.muscleGroups.map((mg, i) => {
                    const intensity = maxMuscleSessions > 0 ? mg.sessions / maxMuscleSessions : 0;
                    const bgColor =
                      intensity >= 0.8
                        ? theme.colors.success
                        : intensity >= 0.5
                          ? theme.colors.accent3
                          : intensity >= 0.3
                            ? theme.colors.warning
                            : theme.colors.textMuted;
                    return (
                      <AnimatedListItem key={mg.name} index={i} style={s.muscleBadge}>
                        <LinearGradient
                          colors={[
                            bgColor +
                              Math.round(intensity * 200 + 55)
                                .toString(16)
                                .padStart(2, '0'),
                            bgColor + '20',
                          ]}
                          style={s.muscleBadgeInner}
                        >
                          <MaterialCommunityIcons
                            name={mg.icon as any}
                            size={22}
                            color={theme.colors.onAccent}
                            style={{ opacity: 0.5 + intensity * 0.5 }}
                          />
                          <ThemedText style={s.muscleName}>{mg.name}</ThemedText>
                          <ThemedText
                            style={[s.muscleCount, { color: theme.colors.onAccent, opacity: 0.7 + intensity * 0.3 }]}
                          >
                            {mg.sessions}×
                          </ThemedText>
                        </LinearGradient>
                      </AnimatedListItem>
                    );
                  })}
                </View>
                <View style={s.legendRow}>
                  {[
                    { label: t('analytics.low'), color: theme.colors.textMuted },
                    { label: t('analytics.med'), color: theme.colors.warning },
                    { label: t('analytics.high'), color: theme.colors.accent3 },
                    { label: t('analytics.max'), color: theme.colors.success },
                  ].map((l) => (
                    <View key={l.label} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: l.color }]} />
                      <ThemedText style={[s.legendLabel, { color: theme.colors.textMuted }]}>{l.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── STEP & JOG STATS ───────────────── */}
            <SectionHeader title={t('analytics.stepsJogging')} delay={550} />
            <Animated.View entering={FadeInDown.delay(600).duration(150)}>
              <View style={s.statsRow}>
                <GlassCard gradient glowColor={theme.colors.success} style={s.statCard}>
                  <MaterialCommunityIcons name="shoe-print" size={26} color={theme.colors.success} />
                  <ThemedText style={[s.statHero, { color: theme.colors.text }]}>
                    {vm.stepStats.steps.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[s.statLabel, { color: theme.colors.textMuted }]}>
                    {t('analytics.totalSteps')}
                  </ThemedText>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <ThemedText style={[s.miniStatVal, { color: theme.colors.success }]}>
                        {vm.stepStats.distance} km
                      </ThemedText>
                      <ThemedText style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>
                        {t('analytics.distance')}
                      </ThemedText>
                    </View>
                    <View style={s.miniStat}>
                      <ThemedText style={[s.miniStatVal, { color: theme.colors.accent2 }]}>
                        {vm.stepStats.calories.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>kcal</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    {t('analytics.avg')} {vm.stepStats.avgDaily.toLocaleString()} / {t('common.day')}
                  </ThemedText>
                </GlassCard>

                <GlassCard gradient glowColor={theme.colors.accent} style={s.statCard}>
                  <MaterialCommunityIcons name="run-fast" size={26} color={theme.colors.accent} />
                  <ThemedText style={[s.statHero, { color: theme.colors.text }]}>{vm.jogStats.runs}</ThemedText>
                  <ThemedText style={[s.statLabel, { color: theme.colors.textMuted }]}>
                    {t('analytics.runs')}
                  </ThemedText>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <ThemedText style={[s.miniStatVal, { color: theme.colors.accent }]}>
                        {vm.jogStats.totalKm} km
                      </ThemedText>
                      <ThemedText style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>Total</ThemedText>
                    </View>
                    <View style={s.miniStat}>
                      <ThemedText style={[s.miniStatVal, { color: theme.colors.accent3 }]}>
                        {vm.jogStats.avgPace}
                      </ThemedText>
                      <ThemedText style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>
                        {t('analytics.avgPace')}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    {t('analytics.longestRun')}: {vm.jogStats.longestRun} km
                  </ThemedText>
                </GlassCard>
              </View>
            </Animated.View>

            {/* ─── CALENDAR HEATMAP ───────────────── */}
            <SectionHeader
              title={`${[t('month.january'), t('month.february'), t('month.march'), t('month.april'), t('month.may'), t('month.june'), t('month.july'), t('month.august'), t('month.september'), t('month.october'), t('month.november'), t('month.december')][month]} ${year}`}
              delay={650}
            />
            <Animated.View entering={FadeInDown.delay(700).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.success} style={s.calendarCard}>
                <View style={s.calendarRow}>
                  {[
                    t('day.sun'),
                    t('day.mon'),
                    t('day.tue'),
                    t('day.wed'),
                    t('day.thu'),
                    t('day.fri'),
                    t('day.sat'),
                  ].map((d) => (
                    <View key={d} style={s.calendarCell}>
                      <ThemedText style={[s.calDayHeader, { color: theme.colors.textMuted }]}>{d}</ThemedText>
                    </View>
                  ))}
                </View>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let dayNum = 1;
                  const totalSlots = startWeekday + daysInMonth;
                  const numRows = Math.ceil(totalSlots / 7);
                  for (let row = 0; row < numRows; row++) {
                    const cells: React.ReactNode[] = [];
                    for (let col = 0; col < 7; col++) {
                      const slot = row * 7 + col;
                      if (slot < startWeekday || dayNum > daysInMonth) {
                        cells.push(<View key={col} style={s.calendarCell} />);
                      } else {
                        const d = dayNum;
                        const isActive = vm.activeDays.includes(d);
                        const isToday = d === today;
                        cells.push(
                          <TouchableOpacity
                            key={col}
                            style={s.calendarCell}
                            onPress={() => handleDayPress(d)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`Day ${d}${isActive ? ', workout completed' : ''}${isToday ? ', today' : ''}`}
                          >
                            <View
                              style={[
                                s.calDay,
                                {
                                  backgroundColor: isActive
                                    ? theme.colors.success + (isToday ? 'FF' : '90')
                                    : theme.isDark
                                      ? theme.colors.surfaceVariant
                                      : theme.colors.surfaceVariant,
                                  borderWidth: isToday ? 2 : 0,
                                  borderColor: isToday ? theme.colors.text : 'transparent',
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  s.calDayText,
                                  {
                                    color: isActive ? theme.colors.onAccent : theme.colors.textMuted,
                                    fontWeight: isToday ? '800' : '600',
                                  },
                                ]}
                              >
                                {d}
                              </ThemedText>
                            </View>
                          </TouchableOpacity>,
                        );
                        dayNum++;
                      }
                    }
                    rows.push(
                      <View key={row} style={s.calendarRow}>
                        {cells}
                      </View>,
                    );
                  }
                  return rows;
                })()}
                <View style={[s.legendRow, { marginTop: spacing[3] }]}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.surfaceVariant }]} />
                    <ThemedText style={[s.legendLabel, { color: theme.colors.textMuted }]}>
                      {t('analytics.rest')}
                    </ThemedText>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success + '90' }]} />
                    <ThemedText style={[s.legendLabel, { color: theme.colors.textMuted }]}>
                      {t('analytics.active')}
                    </ThemedText>
                  </View>
                  <View style={s.legendItem}>
                    <View
                      style={[
                        s.legendDot,
                        { backgroundColor: theme.colors.success, borderWidth: 2, borderColor: theme.colors.text },
                      ]}
                    />
                    <ThemedText style={[s.legendLabel, { color: theme.colors.textMuted }]}>
                      {t('common.today')}
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── PERSONAL RECORDS ───────────────── */}
            <SectionHeader title={t('analytics.personalRecords')} delay={750} />
            {vm.personalRecords.length === 0 && (
              <GlassCard style={{ paddingVertical: spacing[6], alignItems: 'center' }}>
                <MaterialCommunityIcons name="trophy-outline" size={32} color={theme.colors.textMuted} />
                <ThemedText
                  style={{
                    color: theme.colors.textMuted,
                    marginTop: spacing[2],
                    fontSize: typography.sizes.bodySmall,
                    fontWeight: '600',
                  }}
                >
                  {t('analytics.completeWorkoutsForRecords')}
                </ThemedText>
              </GlassCard>
            )}
            {vm.personalRecords.map((pr, i) => (
              <AnimatedListItem key={pr.exercise} index={i}>
                <GlassCard glowColor={i === 0 ? theme.colors.warning : undefined} style={s.prCard}>
                  <View style={s.prLeft}>
                    <View style={[s.prIconWrap, { backgroundColor: theme.colors.accent + '20' }]}>
                      <MaterialCommunityIcons name={pr.icon as any} size={22} color={theme.colors.accent} />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <ThemedText style={[s.prExercise, { color: theme.colors.text }]}>{pr.exercise}</ThemedText>
                      <ThemedText style={[s.prDate, { color: theme.colors.textMuted }]}>{pr.date}</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[s.prValue, { color: theme.colors.warning }]}>{pr.value}</ThemedText>
                </GlassCard>
              </AnimatedListItem>
            ))}

            {/* ─── STREAK & CONSISTENCY ───────────── */}
            <SectionHeader title={t('analytics.streakConsistency')} delay={850} />
            <Animated.View entering={FadeInDown.delay(900).duration(150)}>
              {/* Hero Streak Card */}
              <GlassCard
                gradient
                glowColor={theme.colors.warning}
                style={{ paddingVertical: spacing[7], paddingHorizontal: spacing[5] }}
              >
                {/* Top row: Streak fire + Consistency ring */}
                <View style={s.streakHeroRow}>
                  {/* Current Streak - Hero element with ring */}
                  <View style={s.streakHeroItem}>
                    <ProgressRing
                      progress={Math.min(vm.streakData.currentStreak / Math.max(vm.streakData.longestStreak, 7), 1)}
                      size={90}
                      color={theme.colors.warning}
                      strokeWidth={5}
                    >
                      <MaterialCommunityIcons name="fire" size={28} color={theme.colors.warning} />
                      <ThemedText style={[s.streakNumber, { color: theme.colors.text }]}>
                        {vm.streakData.currentStreak}
                      </ThemedText>
                    </ProgressRing>
                    <ThemedText style={[s.streakHeroLabel, { color: theme.colors.textSecondary }]}>
                      {t('analytics.dayStreak')}
                    </ThemedText>
                  </View>

                  {/* Divider */}
                  <View style={[s.streakDivider, { backgroundColor: theme.colors.border }]} />

                  {/* Consistency Ring */}
                  <View style={s.streakHeroItem}>
                    <ProgressRing
                      progress={vm.streakData.consistencyPct / 100}
                      size={80}
                      color={theme.colors.accent}
                      strokeWidth={6}
                    >
                      <ThemedText style={[s.ringValue, { color: theme.colors.accent }]}>
                        {vm.streakData.consistencyPct}%
                      </ThemedText>
                    </ProgressRing>
                    <ThemedText style={[s.streakHeroLabel, { color: theme.colors.textSecondary }]}>
                      {t('analytics.consistency')}
                    </ThemedText>
                  </View>
                </View>

                {/* Stats Grid */}
                <View
                  style={[
                    s.streakStatsGrid,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                  ]}
                >
                  {[
                    {
                      label: t('analytics.longest'),
                      value: vm.streakData.longestStreak,
                      unit: vm.streakData.longestStreak === 1 ? t('common.day') : t('common.days'),
                      icon: 'trophy' as const,
                      color: theme.colors.warning,
                    },
                    {
                      label: t('analytics.totalWorkouts'),
                      value: vm.streakData.totalWorkouts,
                      unit: '',
                      icon: 'dumbbell' as const,
                      color: theme.colors.accent,
                    },
                    {
                      label: t('analytics.thisWeek'),
                      value: vm.streakData.thisWeek,
                      unit: '',
                      icon: 'calendar-week' as const,
                      color: theme.colors.blue,
                    },
                    {
                      label: t('analytics.thisMonth'),
                      value: vm.streakData.thisMonth,
                      unit: '',
                      icon: 'calendar-month' as const,
                      color: theme.colors.purple,
                    },
                  ].map((stat, i) => (
                    <View
                      key={stat.label}
                      style={[
                        s.streakStatItem,
                        i < 2 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={[s.streakStatIcon, { backgroundColor: stat.color + '15' }]}>
                        <MaterialCommunityIcons name={stat.icon} size={16} color={stat.color} />
                      </View>
                      <View style={s.streakStatText}>
                        <ThemedText style={[s.tileLabel, { color: theme.colors.textMuted }]}>{stat.label}</ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[0.75] }}>
                          <ThemedText style={[s.tileValue, { color: theme.colors.text }]}>{stat.value}</ThemedText>
                          {!!stat.unit && (
                            <ThemedText style={[s.tileUnit, { color: theme.colors.textMuted }]}>{stat.unit}</ThemedText>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </Animated.View>
          </>
        )}

        {/* ─── DAY SESSION DETAIL MODAL ───────────────── */}
        <Modal
          visible={dayModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDayModalVisible(false)}
        >
          <View style={s.modalOverlay}>
            <View style={[s.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={s.modalHeader}>
                <ThemedText style={[s.modalTitle, { color: theme.colors.text }]}>
                  {selectedDay != null
                    ? `${selectedDay} ${[t('month.january'), t('month.february'), t('month.march'), t('month.april'), t('month.may'), t('month.june'), t('month.july'), t('month.august'), t('month.september'), t('month.october'), t('month.november'), t('month.december')][month]} ${year}`
                    : ''}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setDayModalVisible(false)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {vm.dayLoading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginVertical: spacing[8] }} />
              ) : vm.daySessions.length === 0 ? (
                <View style={s.modalEmpty}>
                  <MaterialCommunityIcons name="calendar-blank" size={48} color={theme.colors.textMuted} />
                  <ThemedText style={[s.modalEmptyText, { color: theme.colors.textMuted }]}>
                    {t('analytics.noWorkouts')}
                  </ThemedText>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                  {vm.daySessions.map((session) => (
                    <View key={session.id} style={[s.sessionCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <View style={s.sessionRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                          <MaterialCommunityIcons
                            name={session.success ? 'check-circle' : 'circle-outline'}
                            size={20}
                            color={session.success ? theme.colors.success : theme.colors.textMuted}
                          />
                          <ThemedText style={[s.sessionTime, { color: theme.colors.text }]}>
                            {new Date(session.started_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </ThemedText>
                        </View>
                        <ThemedText style={[s.sessionDuration, { color: theme.colors.textSecondary }]}>
                          {session.duration_minutes} {t('analytics.minAbbrev')}
                        </ThemedText>
                      </View>
                      <ThemedText style={[s.sessionExCount, { color: theme.colors.textSecondary }]}>
                        {session.completed_exercises}/{session.total_exercises} {t('analytics.exercises').toLowerCase()}
                      </ThemedText>
                      {session.exercises.length > 0 && (
                        <View style={s.sessionExList}>
                          {session.exercises.map((ex, i) => (
                            <ThemedText key={i} style={[s.sessionExName, { color: theme.colors.textMuted }]}>
                              • {ex}
                            </ThemedText>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

// ─── STYLES ────────────────────────────────────────────────────
const styles = (theme: any) =>
  StyleSheet.create({
    header: { marginTop: spacing[2], marginBottom: spacing[4] },
    heroTitle: { fontSize: typography.sizes.h1Sm, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
    heroSub: {
      fontSize: typography.sizes.bodySmall,
      fontWeight: '500',
      color: theme.colors.textMuted,
      marginTop: spacing[0.5],
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing[5],
      paddingHorizontal: spacing[1],
    },
    heroStatItem: { alignItems: 'center', flex: 1 },
    heroStatIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[1.5],
    },
    heroStatValue: { fontSize: typography.sizes.h4, fontWeight: '800', letterSpacing: -0.3 },
    heroStatLabel: { fontSize: typography.sizes.xs, fontWeight: '600', marginTop: spacing[0.5] },

    toggleRow: {
      flexDirection: 'row',
      padding: spacing[1],
      borderRadius: 14,
      marginBottom: spacing[2],
      gap: spacing[1.5],
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: spacing[2.5],
      borderRadius: radius.lg,
      alignItems: 'center',
      borderWidth: 1,
    },
    toggleLabel: { fontSize: typography.sizes.label, fontWeight: '600' },

    chartCard: { paddingVertical: spacing[4.5], paddingHorizontal: spacing[3.5] },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150 },
    barCol: { alignItems: 'center', flex: 1 },
    barValue: { fontSize: typography.sizes.label, fontWeight: '800', marginBottom: spacing[1.5] },
    barTrack: {
      width: 28,
      height: 110,
      borderRadius: 14,
      backgroundColor: theme.colors.border + '30',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: 14 },
    barLabel: { fontSize: typography.sizes.captionSm, fontWeight: '700', marginTop: spacing[2] },

    trendContainer: { flexDirection: 'row', height: 140 },
    trendYAxis: {
      width: 36,
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingRight: spacing[1.5],
      paddingVertical: spacing[0.5],
    },
    axisLabel: { fontSize: typography.sizes.micro, fontWeight: '600' },
    trendChart: { flex: 1, position: 'relative' },
    gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
    trendPointsRow: { flexDirection: 'row', flex: 1, zIndex: 2 },
    trendCol: { flex: 1, alignItems: 'center' },
    trendDot: { width: 10, height: 10, borderRadius: 5 },
    trendLabel: { fontSize: typography.sizes.captionSm, fontWeight: '600', marginTop: spacing[1] },
    trendAreaRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 1, paddingBottom: spacing[4.5] },
    trendAreaCol: { flex: 1, paddingHorizontal: spacing[0.5] },
    xpSummaryRow: { flexDirection: 'row', marginTop: spacing[3.5], justifyContent: 'space-around' },
    xpSummaryItem: { alignItems: 'center' },
    xpSummaryValue: { fontSize: typography.sizes.h4, fontWeight: '800' },
    xpSummaryLabel: { fontSize: typography.sizes.captionSm, fontWeight: '600', marginTop: spacing[0.5] },

    muscleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[2],
    },
    muscleBadge: { width: (SCREEN_W - 80) / 4, marginBottom: spacing[1] },
    muscleBadgeInner: { alignItems: 'center', paddingVertical: spacing[2.5], borderRadius: 14 },
    muscleName: {
      fontSize: typography.sizes.captionSm,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: spacing[1],
    },
    muscleCount: { fontSize: typography.sizes.caption, fontWeight: '800', marginTop: spacing[0.5] },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[4], marginTop: spacing[2] },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: typography.sizes.xs, fontWeight: '600' },

    statsRow: { flexDirection: 'row', gap: spacing[2.5] },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing[4] },
    statHero: { fontSize: typography.sizes.h2, fontWeight: '800', marginTop: spacing[2] },
    statLabel: { fontSize: typography.sizes.caption, fontWeight: '600', marginTop: spacing[0.5] },
    statDivider: {
      width: '60%',
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: spacing[2.5],
    },
    miniStatRow: { flexDirection: 'row', gap: spacing[3.5] },
    miniStat: { alignItems: 'center' },
    miniStatVal: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
    miniStatLbl: { fontSize: typography.sizes.xs, fontWeight: '600', marginTop: spacing['px'] },
    avgLabel: { fontSize: typography.sizes.captionSm, fontWeight: '500', marginTop: spacing[2] },

    calendarCard: { paddingVertical: spacing[3.5], paddingHorizontal: spacing[2] },
    calendarRow: { flexDirection: 'row' },
    calendarCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[0.75] },
    calDayHeader: { fontSize: typography.sizes.xs, fontWeight: '700', marginBottom: spacing[1] },
    calDay: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    calDayText: { fontSize: typography.sizes.caption },

    prCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[3.5],
      paddingHorizontal: spacing[3.5],
      marginBottom: spacing[1.5],
    },
    prLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    prIconWrap: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    prExercise: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
    prDate: { fontSize: typography.sizes.captionSm, fontWeight: '500', marginTop: spacing[0.5] },
    prValue: { fontSize: typography.sizes.h4, fontWeight: '800' },

    streakHeroRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: spacing[6],
    },
    streakHeroItem: { alignItems: 'center', flex: 1 },
    streakDivider: { width: StyleSheet.hairlineWidth, height: 60 },
    ringValue: { fontSize: typography.sizes.body, fontWeight: '800' },
    streakNumber: { fontSize: typography.sizes.h4, fontWeight: '800', marginTop: -4 },
    streakHeroLabel: { fontSize: typography.sizes.caption, fontWeight: '600', marginTop: spacing[2.5] },
    streakStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    streakStatItem: {
      width: '50%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3.5],
      paddingHorizontal: spacing[3.5],
      gap: spacing[2.5],
    },
    streakStatIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    streakStatText: { flex: 1 },
    tileValue: { fontSize: typography.sizes.h4, fontWeight: '800' },
    tileLabel: { fontSize: typography.sizes.xs, fontWeight: '600', textAlign: 'left' },
    tileUnit: { fontSize: typography.sizes.captionSm, fontWeight: '500' },

    // Day session detail modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[10],
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[5],
    },
    modalTitle: { fontSize: typography.sizes.h4, fontWeight: '800' },
    modalEmpty: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
    modalEmptyText: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
    sessionCard: { borderRadius: 14, padding: spacing[3.5], marginBottom: spacing[2.5] },
    sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionTime: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
    sessionDuration: { fontSize: typography.sizes.label, fontWeight: '600' },
    sessionExCount: { fontSize: typography.sizes.caption, fontWeight: '600', marginTop: spacing[1.5] },
    sessionExList: { marginTop: spacing[2], gap: spacing[0.5] },
    sessionExName: { fontSize: typography.sizes.caption, fontWeight: '500' },
  });
