/**
 * FitQuest Analytics Screen
 *
 * Wired to REAL SQLite data — workout_sessions, daily_steps, jog_sessions,
 * workout_streaks, session_exercises, app_state (XP), daily_health_summaries.
 * Falls back to zero states when no data is present.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDataSync } from '../src/services/dataSyncService';
import {
  GlassCard,
  SectionHeader,
  ProgressRing,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import {
  BarData,
  MuscleGroupData,
  StepStats,
  JogStats,
  PersonalRecord,
  StreakData,
  fetchWorkoutBars,
  fetchXPData,
  fetchMuscleGroups,
  fetchStepStats,
  fetchJogStats,
  fetchActiveDays,
  fetchPersonalRecords,
  fetchStreakData,
} from '../src/services/analyticsDataService';

// ─── SCREEN WIDTH ──────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

const DAY_LABELS_CAL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// muscle name → icon mapping (kept for UI only)
const MUSCLE_ICONS: Record<string, string> = {
  CHEST: 'arm-flex',
  BACK: 'human-handsup',
  QUADRICEPS: 'walk',
  HAMSTRINGS: 'walk',
  GLUTES: 'run-fast',
  SHOULDERS: 'weight-lifter',
  BICEPS: 'arm-flex-outline',
  TRICEPS: 'arm-flex-outline',
  CORE: 'meditation',
  ABS: 'meditation',
  CALVES: 'shoe-print',
  FOREARMS: 'hand-back-right',
  TRAPS: 'human-handsup',
  LATS: 'human-handsup',
};

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
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [workoutBars, setWorkoutBars] = useState<BarData[]>([]);
  const [xpData, setXPData] = useState<number[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupData[]>([]);
  const [stepStats, setStepStats] = useState<StepStats>({ steps: 0, distance: 0, calories: 0, avgDaily: 0 });
  const [jogStats, setJogStats] = useState<JogStats>({ runs: 0, totalKm: 0, avgPace: '--:--', longestRun: 0 });
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, totalWorkouts: 0, consistencyPct: 0, thisWeek: 0, thisMonth: 0,
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const { daysInMonth, startWeekday } = useMemo(
    () => getMonthCalendar(year, month),
    [year, month],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bars, xp, muscles, steps, jogs, active, prs, streak] = await Promise.all([
        fetchWorkoutBars(range),
        fetchXPData(range),
        fetchMuscleGroups(),
        fetchStepStats(range),
        fetchJogStats(range),
        fetchActiveDays(),
        fetchPersonalRecords(),
        fetchStreakData(),
      ]);
      setWorkoutBars(bars);
      setXPData(xp);
      setMuscleGroups(muscles);
      setStepStats(steps);
      setJogStats(jogs);
      setActiveDays(active);
      setPersonalRecords(prs);
      setStreakData(streak);
    } catch (e) {
      console.warn('[Analytics] Data load error:', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data when screen gains focus (e.g. after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [range])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Subscribe to data sync events for real-time updates
  useDataSync(
    ['workout_completed', 'xp_awarded', 'jog_completed', 'steps_updated', 'streak_updated'],
    () => loadData()
  );

  const maxBarCount = Math.max(...workoutBars.map((b) => b.count), 1);
  const maxXP = Math.max(...xpData, 1);
  const maxMuscleSessions = Math.max(...muscleGroups.map((g) => g.sessions), 1);

  const s = styles(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* ─── HEADER ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).duration(150)} style={s.header}>
          <Text style={s.heroTitle}>{t('analytics.title')}</Text>
          <Text style={s.heroSub}>{t('analytics.subtitle')}</Text>
        </Animated.View>

        {/* ─── RANGE TOGGLE ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)}>
          <GlassCard style={s.toggleRow}>
            {(['weekly', 'monthly'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                activeOpacity={0.7}
                onPress={() => setRange(r)}
                style={[
                  s.toggleBtn,
                  range === r && { backgroundColor: theme.colors.accent + '30' },
                ]}
              >
                <Text
                  style={[
                    s.toggleLabel,
                    range === r && { color: theme.colors.accent, fontWeight: '700' },
                  ]}
                >
                  {r === 'weekly' ? t('analytics.weekly') : t('analytics.monthly')}
                </Text>
              </TouchableOpacity>
            ))}
          </GlassCard>
        </Animated.View>

        {!!loading && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        )}

        {!loading && (
          <>
            {/* ─── WORKOUT FREQUENCY BAR CHART ─────── */}
            <SectionHeader title={t('analytics.workoutFrequency')} delay={150} />
            <Animated.View entering={FadeInDown.delay(200).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.accent} style={s.chartCard}>
                <View style={s.barRow}>
                  {workoutBars.map((bar, i) => {
                    const pct = bar.count / maxBarCount;
                    return (
                      <View key={`${bar.day}-${i}`} style={s.barCol}>
                        <Text style={[s.barValue, { color: theme.colors.text }]}>{bar.count}</Text>
                        <View style={s.barTrack}>
                          <Animated.View
                            entering={FadeInUp.delay(250 + i * 60).duration(150)}
                            style={[
                              s.barFill,
                              {
                                height: `${Math.max(pct * 100, 4)}%`,
                                backgroundColor: theme.colors.accent,
                                opacity: 0.5 + pct * 0.5,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[s.barLabel, { color: theme.colors.textMuted }]}>{bar.day}</Text>
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
                    <Text style={[s.axisLabel, { color: theme.colors.textMuted }]}>{maxXP}</Text>
                    <Text style={[s.axisLabel, { color: theme.colors.textMuted }]}>{Math.round(maxXP / 2)}</Text>
                    <Text style={[s.axisLabel, { color: theme.colors.textMuted }]}>0</Text>
                  </View>
                  <View style={s.trendChart}>
                    {[0, 1, 2].map((idx) => (
                      <View
                        key={idx}
                        style={[
                          s.gridLine,
                          { top: `${idx * 50}%`, backgroundColor: theme.colors.border },
                        ]}
                      />
                    ))}
                    <View style={s.trendPointsRow}>
                      {xpData.map((val, i) => {
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
                            <Text style={[s.trendLabel, { color: theme.colors.textMuted }]}>
                              {range === 'weekly'
                                ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(Date.now() - (6 - i) * 86400000).getDay()]
                                : `W${i + 1}`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={s.trendAreaRow} pointerEvents="none">
                      {xpData.map((val, i) => {
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
                    <Text style={[s.xpSummaryValue, { color: theme.colors.accent3 }]}>
                      {xpData.reduce((a, b) => a + b, 0).toLocaleString()}
                    </Text>
                    <Text style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>{t('analytics.totalXP')}</Text>
                  </View>
                  <View style={s.xpSummaryItem}>
                    <Text style={[s.xpSummaryValue, { color: theme.colors.accent3 }]}>
                      {xpData.length > 0
                        ? Math.round(xpData.reduce((a, b) => a + b, 0) / xpData.length).toLocaleString()
                        : '0'}
                    </Text>
                    <Text style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>{t('analytics.avgPerWorkout')}</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── MUSCLE GROUP HEATMAP ───────────── */}
            <SectionHeader title={t('analytics.muscleHeatmap')} delay={450} />
            <Animated.View entering={FadeInDown.delay(500).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.accent2} style={{ paddingVertical: 16 }}>
                <View style={s.muscleGrid}>
                  {muscleGroups.map((mg, i) => {
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
                          colors={[bgColor + Math.round(intensity * 200 + 55).toString(16).padStart(2, '0'), bgColor + '20']}
                          style={s.muscleBadgeInner}
                        >
                          <MaterialCommunityIcons
                            name={mg.icon as any}
                            size={22}
                            color="#fff"
                            style={{ opacity: 0.5 + intensity * 0.5 }}
                          />
                          <Text style={s.muscleName}>{mg.name}</Text>
                          <Text style={[s.muscleCount, { color: '#fff', opacity: 0.7 + intensity * 0.3 }]}>
                            {mg.sessions}×
                          </Text>
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
                      <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>{l.label}</Text>
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
                  <Text style={[s.statHero, { color: theme.colors.text }]}>
                    {stepStats.steps.toLocaleString()}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.colors.textMuted }]}>{t('analytics.totalSteps')}</Text>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.success }]}>{stepStats.distance} km</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>{t('analytics.distance')}</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent2 }]}>
                        {stepStats.calories.toLocaleString()}
                      </Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>kcal</Text>
                    </View>
                  </View>
                  <Text style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    {t('analytics.avg')} {stepStats.avgDaily.toLocaleString()} / {t('common.day')}
                  </Text>
                </GlassCard>

                <GlassCard gradient glowColor={theme.colors.accent} style={s.statCard}>
                  <MaterialCommunityIcons name="run-fast" size={26} color={theme.colors.accent} />
                  <Text style={[s.statHero, { color: theme.colors.text }]}>{jogStats.runs}</Text>
                  <Text style={[s.statLabel, { color: theme.colors.textMuted }]}>{t('analytics.runs')}</Text>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent }]}>{jogStats.totalKm} km</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>Total</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent3 }]}>{jogStats.avgPace}</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>{t('analytics.avgPace')}</Text>
                    </View>
                  </View>
                  <Text style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    {t('analytics.longestRun')}: {jogStats.longestRun} km
                  </Text>
                </GlassCard>
              </View>
            </Animated.View>

            {/* ─── CALENDAR HEATMAP ───────────────── */}
            <SectionHeader title={`${[t('month.january'), t('month.february'), t('month.march'), t('month.april'), t('month.may'), t('month.june'), t('month.july'), t('month.august'), t('month.september'), t('month.october'), t('month.november'), t('month.december')][month]} ${year}`} delay={650} />
            <Animated.View entering={FadeInDown.delay(700).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.success} style={s.calendarCard}>
                <View style={s.calendarRow}>
                  {[t('day.sun'), t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'), t('day.fri'), t('day.sat')].map((d) => (
                    <View key={d} style={s.calendarCell}>
                      <Text style={[s.calDayHeader, { color: theme.colors.textMuted }]}>{d}</Text>
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
                        const isActive = activeDays.includes(d);
                        const isToday = d === today;
                        cells.push(
                          <View key={col} style={s.calendarCell}>
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
                              <Text
                                style={[
                                  s.calDayText,
                                  {
                                    color: isActive ? '#fff' : theme.colors.textMuted,
                                    fontWeight: isToday ? '800' : '600',
                                  },
                                ]}
                              >
                                {d}
                              </Text>
                            </View>
                          </View>,
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
                <View style={[s.legendRow, { marginTop: 12 }]}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.surfaceVariant }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>{t('analytics.rest')}</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success + '90' }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>{t('analytics.active')}</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success, borderWidth: 2, borderColor: theme.colors.text }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>{t('common.today')}</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── PERSONAL RECORDS ───────────────── */}
            <SectionHeader title={t('analytics.personalRecords')} delay={750} />
            {personalRecords.length === 0 && (
              <GlassCard style={{ paddingVertical: 24, alignItems: 'center' }}>
                <MaterialCommunityIcons name="trophy-outline" size={32} color={theme.colors.textMuted} />
                <Text style={{ color: theme.colors.textMuted, marginTop: 8, fontSize: 14, fontWeight: '600' }}>
                  {t('analytics.completeWorkoutsForRecords')}
                </Text>
              </GlassCard>
            )}
            {personalRecords.map((pr, i) => (
              <AnimatedListItem key={pr.exercise} index={i}>
                <GlassCard
                  glowColor={i === 0 ? theme.colors.warning : undefined}
                  style={s.prCard}
                >
                  <View style={s.prLeft}>
                    <View style={[s.prIconWrap, { backgroundColor: theme.colors.accent + '20' }]}>
                      <MaterialCommunityIcons name={pr.icon as any} size={22} color={theme.colors.accent} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[s.prExercise, { color: theme.colors.text }]}>{pr.exercise}</Text>
                      <Text style={[s.prDate, { color: theme.colors.textMuted }]}>{pr.date}</Text>
                    </View>
                  </View>
                  <Text style={[s.prValue, { color: theme.colors.warning }]}>{pr.value}</Text>
                </GlassCard>
              </AnimatedListItem>
            ))}

            {/* ─── STREAK & CONSISTENCY ───────────── */}
            <SectionHeader title={t('analytics.streakConsistency')} delay={850} />
            <Animated.View entering={FadeInDown.delay(900).duration(150)}>
              {/* Hero Streak Card */}
              <GlassCard gradient glowColor={theme.colors.warning} style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
                {/* Top row: Streak fire + Consistency ring */}
                <View style={s.streakHeroRow}>
                  {/* Current Streak - Hero element */}
                  <View style={s.streakHeroItem}>
                    <LinearGradient
                      colors={[theme.colors.warning + '20', theme.colors.warning + '08'] as [string, string]}
                      style={s.streakFireCircle}
                    >
                      <MaterialCommunityIcons name="fire" size={32} color={theme.colors.warning} />
                      <Text style={[s.streakNumber, { color: theme.colors.text }]}>
                        {streakData.currentStreak}
                      </Text>
                    </LinearGradient>
                    <Text style={[s.streakHeroLabel, { color: theme.colors.textSecondary }]}>{t('analytics.dayStreak')}</Text>
                  </View>

                  {/* Divider */}
                  <View style={[s.streakDivider, { backgroundColor: theme.colors.border }]} />

                  {/* Consistency Ring */}
                  <View style={s.streakHeroItem}>
                    <ProgressRing progress={streakData.consistencyPct / 100} size={80} color={theme.colors.accent} strokeWidth={6}>
                      <Text style={[s.ringValue, { color: theme.colors.accent }]}>
                        {streakData.consistencyPct}%
                      </Text>
                    </ProgressRing>
                    <Text style={[s.streakHeroLabel, { color: theme.colors.textSecondary }]}>{t('analytics.consistency')}</Text>
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={[s.streakStatsGrid, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}>
                  {[
                    { label: t('analytics.longest'), value: streakData.longestStreak, unit: t('common.days'), icon: 'trophy' as const, color: theme.colors.warning },
                    { label: t('analytics.totalWorkouts'), value: streakData.totalWorkouts, unit: '', icon: 'dumbbell' as const, color: theme.colors.accent },
                    { label: t('analytics.thisWeek'), value: streakData.thisWeek, unit: '', icon: 'calendar-week' as const, color: theme.colors.blue },
                    { label: t('analytics.thisMonth'), value: streakData.thisMonth, unit: '', icon: 'calendar-month' as const, color: theme.colors.purple },
                  ].map((stat, i) => (
                    <View key={stat.label} style={[s.streakStatItem, i < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
                      <View style={[s.streakStatIcon, { backgroundColor: stat.color + '15' }]}>
                        <MaterialCommunityIcons name={stat.icon} size={16} color={stat.color} />
                      </View>
                      <View style={s.streakStatText}>
                        <Text style={[s.tileLabel, { color: theme.colors.textMuted }]}>{stat.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                          <Text style={[s.tileValue, { color: theme.colors.text }]}>{stat.value}</Text>
                          {!!stat.unit && <Text style={[s.tileUnit, { color: theme.colors.textMuted }]}>{stat.unit}</Text>}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────
const styles = (theme: any) =>
  StyleSheet.create({
    header: { marginTop: 8, marginBottom: 16 },
    heroTitle: { fontSize: 30, fontWeight: '800', color: theme.colors.text },
    heroSub: { fontSize: 14, fontWeight: '500', color: theme.colors.textMuted, marginTop: 2 },

    toggleRow: { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 8 },
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    toggleLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted },

    chartCard: { paddingVertical: 16, paddingHorizontal: 12 },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
    barCol: { alignItems: 'center', flex: 1 },
    barValue: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    barTrack: {
      width: 22,
      height: 100,
      borderRadius: 11,
      backgroundColor: theme.colors.border + '40',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: 11 },
    barLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },

    trendContainer: { flexDirection: 'row', height: 140 },
    trendYAxis: { width: 36, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, paddingVertical: 2 },
    axisLabel: { fontSize: 9, fontWeight: '600' },
    trendChart: { flex: 1, position: 'relative' },
    gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
    trendPointsRow: { flexDirection: 'row', flex: 1, zIndex: 2 },
    trendCol: { flex: 1, alignItems: 'center' },
    trendDot: { width: 10, height: 10, borderRadius: 5 },
    trendLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
    trendAreaRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 1, paddingBottom: 18 },
    trendAreaCol: { flex: 1, paddingHorizontal: 2 },
    xpSummaryRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-around' },
    xpSummaryItem: { alignItems: 'center' },
    xpSummaryValue: { fontSize: 18, fontWeight: '800' },
    xpSummaryLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
    muscleBadge: { width: (SCREEN_W - 80) / 4, marginBottom: 4 },
    muscleBadgeInner: { alignItems: 'center', paddingVertical: 10, borderRadius: 14 },
    muscleName: { fontSize: 11, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
    muscleCount: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 10, fontWeight: '600' },

    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
    statHero: { fontSize: 24, fontWeight: '800', marginTop: 8 },
    statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    statDivider: { width: '60%', height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 10 },
    miniStatRow: { flexDirection: 'row', gap: 14 },
    miniStat: { alignItems: 'center' },
    miniStatVal: { fontSize: 14, fontWeight: '700' },
    miniStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    avgLabel: { fontSize: 11, fontWeight: '500', marginTop: 8 },

    calendarCard: { paddingVertical: 14, paddingHorizontal: 8 },
    calendarRow: { flexDirection: 'row' },
    calendarCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
    calDayHeader: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
    calDay: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    calDayText: { fontSize: 12 },

    prCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6 },
    prLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    prIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    prExercise: { fontSize: 14, fontWeight: '700' },
    prDate: { fontSize: 11, fontWeight: '500', marginTop: 2 },
    prValue: { fontSize: 18, fontWeight: '800' },

    streakHeroRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 },
    streakHeroItem: { alignItems: 'center', flex: 1 },
    streakFireCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.warning + '30' },
    streakDivider: { width: StyleSheet.hairlineWidth, height: 60 },
    ringValue: { fontSize: 16, fontWeight: '800' },
    streakNumber: { fontSize: 22, fontWeight: '800', marginTop: -2 },
    streakHeroLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
    streakStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    streakStatItem: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 10 },
    streakStatIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    streakStatText: { flex: 1 },
    tileValue: { fontSize: 18, fontWeight: '800' },
    tileLabel: { fontSize: 10, fontWeight: '600', textAlign: 'left' },
    tileUnit: { fontSize: 11, fontWeight: '500' },
  });
