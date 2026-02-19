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
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
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

  const maxBarCount = Math.max(...workoutBars.map((b) => b.count), 1);
  const maxXP = Math.max(...xpData, 1);
  const maxMuscleSessions = Math.max(...muscleGroups.map((g) => g.sessions), 1);

  const s = styles(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
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
                                ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]
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
                  <Text style={[s.statLabel, { color: theme.colors.textMuted }]}>Total Steps</Text>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.success }]}>{stepStats.distance} km</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>Distance</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent2 }]}>
                        {stepStats.calories.toLocaleString()}
                      </Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>kcal</Text>
                    </View>
                  </View>
                  <Text style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    Avg {stepStats.avgDaily.toLocaleString()} / day
                  </Text>
                </GlassCard>

                <GlassCard gradient glowColor={theme.colors.accent} style={s.statCard}>
                  <MaterialCommunityIcons name="run-fast" size={26} color={theme.colors.accent} />
                  <Text style={[s.statHero, { color: theme.colors.text }]}>{jogStats.runs}</Text>
                  <Text style={[s.statLabel, { color: theme.colors.textMuted }]}>Runs</Text>
                  <View style={s.statDivider} />
                  <View style={s.miniStatRow}>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent }]}>{jogStats.totalKm} km</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>Total</Text>
                    </View>
                    <View style={s.miniStat}>
                      <Text style={[s.miniStatVal, { color: theme.colors.accent3 }]}>{jogStats.avgPace}</Text>
                      <Text style={[s.miniStatLbl, { color: theme.colors.textMuted }]}>Avg Pace</Text>
                    </View>
                  </View>
                  <Text style={[s.avgLabel, { color: theme.colors.textSecondary }]}>
                    Longest: {jogStats.longestRun} km
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
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Rest</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success + '90' }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Active</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success, borderWidth: 2, borderColor: theme.colors.text }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Today</Text>
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
                  Complete workouts to set records
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
              <GlassCard gradient glowColor={theme.colors.accent2} style={{ paddingVertical: 20 }}>
                <View style={s.streakHeroRow}>
                  <View style={s.streakHeroItem}>
                    <ProgressRing progress={streakData.consistencyPct / 100} size={90} color={theme.colors.accent} strokeWidth={8}>
                      <Text style={[s.ringValue, { color: theme.colors.accent }]}>
                        {streakData.consistencyPct}%
                      </Text>
                    </ProgressRing>
                    <Text style={[s.streakHeroLabel, { color: theme.colors.textMuted }]}>Consistency</Text>
                  </View>
                  <View style={s.streakHeroItem}>
                    <View style={s.streakFireWrap}>
                      <MaterialCommunityIcons name="fire" size={44} color={theme.colors.accent2} />
                      <Text style={[s.streakNumber, { color: theme.colors.text }]}>
                        {streakData.currentStreak}
                      </Text>
                    </View>
                    <Text style={[s.streakHeroLabel, { color: theme.colors.textMuted }]}>Day Streak</Text>
                  </View>
                </View>

                <View style={s.streakTilesRow}>
                  {[
                    { label: t('analytics.longest'), value: `${streakData.longestStreak} ${t('common.days')}`, icon: 'trophy-outline', color: theme.colors.warning },
                    { label: t('analytics.totalWorkouts'), value: `${streakData.totalWorkouts}`, icon: 'dumbbell', color: theme.colors.accent3 },
                    { label: t('analytics.thisWeek'), value: `${streakData.thisWeek}`, icon: 'calendar-week', color: theme.colors.accent },
                    { label: t('analytics.thisMonth'), value: `${streakData.thisMonth}`, icon: 'calendar-month', color: theme.colors.success },
                  ].map((tile, i) => (
                    <AnimatedListItem key={tile.label} index={i} style={s.streakTile}>
                      <MaterialCommunityIcons name={tile.icon as any} size={20} color={tile.color} />
                      <Text style={[s.tileValue, { color: theme.colors.text }]}>{tile.value}</Text>
                      <Text style={[s.tileLabel, { color: theme.colors.textMuted }]}>{tile.label}</Text>
                    </AnimatedListItem>
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

    streakHeroRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    streakHeroItem: { alignItems: 'center' },
    ringValue: { fontSize: 16, fontWeight: '800' },
    streakFireWrap: { alignItems: 'center', justifyContent: 'center', height: 90 },
    streakNumber: { fontSize: 28, fontWeight: '800', marginTop: -4 },
    streakHeroLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
    streakTilesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingHorizontal: 8 },
    streakTile: {
      width: '47%' as any,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    tileValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
    tileLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  });
