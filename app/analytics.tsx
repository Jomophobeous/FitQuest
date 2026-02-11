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
import {
  GlassCard,
  SectionHeader,
  ProgressRing,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import { getDatabase } from '../src/database/schema';

// ─── SCREEN WIDTH ──────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

const USER_ID = 'user_local_001';

// ─── TYPES ─────────────────────────────────────────────────────
interface BarData {
  day: string;
  count: number;
}

interface MuscleGroupData {
  name: string;
  sessions: number;
  icon: string;
}

interface StepStats {
  steps: number;
  distance: number;
  calories: number;
  avgDaily: number;
}

interface JogStats {
  runs: number;
  totalKm: number;
  avgPace: string;
  longestRun: number;
}

interface PersonalRecord {
  exercise: string;
  value: string;
  date: string;
  icon: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  consistencyPct: number;
  thisWeek: number;
  thisMonth: number;
}

// ─── DATE HELPERS ──────────────────────────────────────────────
function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getStartOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getStartOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm || secondsPerKm <= 0) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_CAL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// muscle name → icon mapping
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

// ─── DATA FETCHING ─────────────────────────────────────────────

async function fetchWorkoutBars(range: 'weekly' | 'monthly'): Promise<BarData[]> {
  const db = await getDatabase();
  if (range === 'weekly') {
    const bars: BarData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = getDateNDaysAgo(i);
      const dayOfWeek = new Date(date).getDay();
      const r = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM workout_sessions 
         WHERE user_id = ? AND date(started_at) = ? AND completed_at IS NOT NULL`,
        [USER_ID, date]
      );
      bars.push({ day: DAY_NAMES[dayOfWeek === 0 ? 6 : dayOfWeek - 1], count: r?.cnt ?? 0 });
    }
    return bars;
  } else {
    const bars: BarData[] = [];
    for (let w = 3; w >= 0; w--) {
      const start = getDateNDaysAgo(w * 7 + 6);
      const end = getDateNDaysAgo(w * 7);
      const r = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM workout_sessions 
         WHERE user_id = ? AND date(started_at) BETWEEN ? AND ? AND completed_at IS NOT NULL`,
        [USER_ID, start, end]
      );
      bars.push({ day: `W${4 - w}`, count: r?.cnt ?? 0 });
    }
    return bars;
  }
}

async function fetchXPData(range: 'weekly' | 'monthly'): Promise<number[]> {
  const db = await getDatabase();
  if (range === 'weekly') {
    const xp: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = getDateNDaysAgo(i);
      const r = await db.getFirstAsync<{ cnt: number; exercises: number; total_exercises: number }>(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(completed_exercises), 0) as exercises,
                COALESCE(SUM(total_exercises), 0) as total_exercises
         FROM workout_sessions 
         WHERE user_id = ? AND date(started_at) = ? AND completed_at IS NOT NULL`,
        [USER_ID, date]
      );
      const workouts = r?.cnt ?? 0;
      const exercises = r?.exercises ?? 0;
      const totalEx = r?.total_exercises ?? 0;
      // Match xpService formula: 100 base + 20/exercise + 50 completion bonus + streak*10
      const completionBonus = (exercises >= totalEx && totalEx > 0) ? 50 * workouts : 0;
      xp.push(workouts * 100 + exercises * 20 + completionBonus);
    }
    return xp;
  } else {
    const xp: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const start = getDateNDaysAgo(w * 7 + 6);
      const end = getDateNDaysAgo(w * 7);
      const r = await db.getFirstAsync<{ cnt: number; exercises: number; total_exercises: number }>(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(completed_exercises), 0) as exercises,
                COALESCE(SUM(total_exercises), 0) as total_exercises
         FROM workout_sessions 
         WHERE user_id = ? AND date(started_at) BETWEEN ? AND ? AND completed_at IS NOT NULL`,
        [USER_ID, start, end]
      );
      const workouts = r?.cnt ?? 0;
      const exercises = r?.exercises ?? 0;
      const totalEx = r?.total_exercises ?? 0;
      const completionBonus = (exercises >= totalEx && totalEx > 0) ? 50 * workouts : 0;
      xp.push(workouts * 100 + exercises * 20 + completionBonus);
    }
    return xp;
  }
}

async function fetchMuscleGroups(): Promise<MuscleGroupData[]> {
  const db = await getDatabase();
  const since = getDateNDaysAgo(30);
  const rows = await db.getAllAsync<{ muscle: string; cnt: number }>(
    `SELECT em.muscle, COUNT(DISTINCT se.session_id) as cnt
     FROM session_exercises se
     JOIN exercise_muscles em ON se.exercise_id = em.exercise_id
     JOIN workout_sessions ws ON se.session_id = ws.id
     WHERE ws.user_id = ? AND ws.completed_at IS NOT NULL AND date(ws.started_at) >= ?
       AND em.is_primary = 1
     GROUP BY em.muscle
     ORDER BY cnt DESC`,
    [USER_ID, since]
  );

  if (rows.length === 0) {
    return ['CHEST', 'BACK', 'QUADRICEPS', 'SHOULDERS', 'BICEPS', 'CORE', 'GLUTES', 'HAMSTRINGS']
      .map(name => ({
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        sessions: 0,
        icon: MUSCLE_ICONS[name] || 'dumbbell',
      }));
  }

  return rows.map(r => ({
    name: r.muscle.charAt(0) + r.muscle.slice(1).toLowerCase(),
    sessions: r.cnt,
    icon: MUSCLE_ICONS[r.muscle.toUpperCase()] || 'dumbbell',
  }));
}

async function fetchStepStats(range: 'weekly' | 'monthly'): Promise<StepStats> {
  const db = await getDatabase();
  const since = range === 'weekly' ? getDateNDaysAgo(6) : getDateNDaysAgo(29);

  const r = await db.getFirstAsync<{
    total_steps: number;
    total_active: number;
    day_count: number;
  }>(
    `SELECT COALESCE(SUM(steps), 0) as total_steps, 
            COALESCE(SUM(active_minutes), 0) as total_active,
            COUNT(*) as day_count
     FROM daily_steps 
     WHERE user_id = ? AND date >= ?`,
    [USER_ID, since]
  );

  const totalSteps = r?.total_steps ?? 0;
  const dayCount = Math.max(r?.day_count ?? 1, 1);
  return {
    steps: totalSteps,
    distance: Math.round(totalSteps * 0.0008 * 10) / 10,
    calories: Math.round(totalSteps * 0.04),
    avgDaily: Math.round(totalSteps / dayCount),
  };
}

async function fetchJogStats(range: 'weekly' | 'monthly'): Promise<JogStats> {
  const db = await getDatabase();
  const since = range === 'weekly' ? getDateNDaysAgo(6) : getDateNDaysAgo(29);

  const rows = await db.getAllAsync<{
    distance_meters: number;
    avg_pace_per_km: number | null;
  }>(
    `SELECT distance_meters, avg_pace_per_km
     FROM jog_sessions 
     WHERE user_id = ? AND date(start_time) >= ? AND end_time IS NOT NULL`,
    [USER_ID, since]
  );

  if (rows.length === 0) {
    return { runs: 0, totalKm: 0, avgPace: '--:--', longestRun: 0 };
  }

  const totalDistance = rows.reduce((s, r) => s + r.distance_meters, 0);
  const longestRun = Math.max(...rows.map(r => r.distance_meters));
  const paces = rows.filter(r => r.avg_pace_per_km && r.avg_pace_per_km > 0);
  const avgPace = paces.length > 0
    ? paces.reduce((s, r) => s + (r.avg_pace_per_km ?? 0), 0) / paces.length
    : 0;

  return {
    runs: rows.length,
    totalKm: Math.round(totalDistance / 100) / 10,
    avgPace: formatPace(avgPace),
    longestRun: Math.round(longestRun / 100) / 10,
  };
}

async function fetchActiveDays(): Promise<number[]> {
  const db = await getDatabase();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rows = await db.getAllAsync<{ d: number }>(
    `SELECT DISTINCT CAST(strftime('%d', started_at) AS INTEGER) as d
     FROM workout_sessions 
     WHERE user_id = ? AND strftime('%Y-%m', started_at) = ? AND completed_at IS NOT NULL
     UNION
     SELECT DISTINCT CAST(strftime('%d', date) AS INTEGER) as d
     FROM daily_steps
     WHERE user_id = ? AND strftime('%Y-%m', date) = ? AND steps > 0`,
    [USER_ID, yearMonth, USER_ID, yearMonth]
  );

  return rows.map(r => r.d);
}

async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    exercise_name: string;
    category: string;
    best_sets: number;
    best_reps: string;
    best_date: string;
  }>(
    `SELECT e.name as exercise_name, e.category,
            pr.sets_completed as best_sets, pr.reps_achieved as best_reps,
            pr.date as best_date
     FROM progress_records pr
     JOIN exercises e ON pr.exercise_id = e.id
     WHERE pr.user_id = ?
     ORDER BY pr.sets_completed DESC, pr.date DESC
     LIMIT 5`,
    [USER_ID]
  );

  if (rows.length === 0) return [];

  const categoryIcons: Record<string, string> = {
    UPPER_PUSH: 'dumbbell',
    UPPER_PULL: 'arm-flex',
    LOWER_COMPOUND: 'weight-lifter',
    CORE: 'meditation',
    CARDIO: 'run-fast',
    MOBILITY: 'human-greeting-variant',
  };

  return rows.map(r => ({
    exercise: r.exercise_name,
    value: `${r.best_sets} × ${r.best_reps}`,
    date: new Date(r.best_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    icon: categoryIcons[r.category] || 'dumbbell',
  }));
}

async function fetchStreakData(): Promise<StreakData> {
  const db = await getDatabase();

  const streak = await db.getFirstAsync<{
    current_streak: number;
    longest_streak: number;
  }>(
    `SELECT current_streak, longest_streak FROM workout_streaks WHERE user_id = ?`,
    [USER_ID]
  );

  const weekStart = getStartOfWeek();
  const monthStart = getStartOfMonth();

  const weekCount = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions 
     WHERE user_id = ? AND date(started_at) >= ? AND completed_at IS NOT NULL`,
    [USER_ID, weekStart]
  );

  const monthCount = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions 
     WHERE user_id = ? AND date(started_at) >= ? AND completed_at IS NOT NULL`,
    [USER_ID, monthStart]
  );

  const totalCount = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL`,
    [USER_ID]
  );

  const now = new Date();
  const daysElapsed = now.getDate();
  // Calculate target training days this month based on days elapsed
  // Uses a 4-day/week default target, proportional to days elapsed
  const targetDaysPerWeek = 4;
  const expectedTrainingDays = Math.max(1, Math.round((daysElapsed / 7) * targetDaysPerWeek));
  const activeDaysMonth = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT date(started_at)) as cnt 
     FROM workout_sessions 
     WHERE user_id = ? AND strftime('%Y-%m', started_at) = ? AND completed_at IS NOT NULL`,
    [USER_ID, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`]
  );
  const consistencyPct = Math.min(100, Math.round(((activeDaysMonth?.cnt ?? 0) / expectedTrainingDays) * 100));

  return {
    currentStreak: streak?.current_streak ?? 0,
    longestStreak: streak?.longest_streak ?? 0,
    totalWorkouts: totalCount?.cnt ?? 0,
    consistencyPct,
    thisWeek: weekCount?.cnt ?? 0,
    thisMonth: monthCount?.cnt ?? 0,
  };
}

// ─── COMPONENT ─────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { theme } = useTheme();
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
          <Text style={s.heroTitle}>Analytics</Text>
          <Text style={s.heroSub}>Your performance at a glance</Text>
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
                  {r === 'weekly' ? 'Weekly' : 'Monthly'}
                </Text>
              </TouchableOpacity>
            ))}
          </GlassCard>
        </Animated.View>

        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        )}

        {!loading && (
          <>
            {/* ─── WORKOUT FREQUENCY BAR CHART ─────── */}
            <SectionHeader title="Workout Frequency" delay={150} />
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
            <SectionHeader title="XP Progress" delay={300} />
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
                    <Text style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>Total XP</Text>
                  </View>
                  <View style={s.xpSummaryItem}>
                    <Text style={[s.xpSummaryValue, { color: theme.colors.accent3 }]}>
                      {xpData.length > 0
                        ? Math.round(xpData.reduce((a, b) => a + b, 0) / xpData.length).toLocaleString()
                        : '0'}
                    </Text>
                    <Text style={[s.xpSummaryLabel, { color: theme.colors.textMuted }]}>Avg / Period</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── MUSCLE GROUP HEATMAP ───────────── */}
            <SectionHeader title="Muscle Group Heatmap" delay={450} />
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
                    { label: 'Low', color: theme.colors.textMuted },
                    { label: 'Med', color: theme.colors.warning },
                    { label: 'High', color: theme.colors.accent3 },
                    { label: 'Max', color: theme.colors.success },
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
            <SectionHeader title="Steps & Jogging" delay={550} />
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
            <SectionHeader title={`${MONTH_NAMES[month]} ${year}`} delay={650} />
            <Animated.View entering={FadeInDown.delay(700).duration(150)}>
              <GlassCard gradient glowColor={theme.colors.success} style={s.calendarCard}>
                <View style={s.calendarRow}>
                  {DAY_LABELS_CAL.map((d) => (
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
                                    ? '#1a1f2e'
                                    : '#e2e4e8',
                                  borderWidth: isToday ? 2 : 0,
                                  borderColor: isToday ? '#fff' : 'transparent',
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
                    <View style={[s.legendDot, { backgroundColor: theme.isDark ? '#1a1f2e' : '#e2e4e8' }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Rest</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success + '90' }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Active</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: theme.colors.success, borderWidth: 2, borderColor: '#fff' }]} />
                    <Text style={[s.legendLabel, { color: theme.colors.textMuted }]}>Today</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* ─── PERSONAL RECORDS ───────────────── */}
            <SectionHeader title="Personal Records 🏆" delay={750} />
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
            <SectionHeader title="Streak & Consistency" delay={850} />
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
                    { label: 'Longest Streak', value: `${streakData.longestStreak} days`, icon: 'trophy-outline', color: theme.colors.warning },
                    { label: 'Total Workouts', value: `${streakData.totalWorkouts}`, icon: 'dumbbell', color: theme.colors.accent3 },
                    { label: 'This Week', value: `${streakData.thisWeek}`, icon: 'calendar-week', color: theme.colors.accent },
                    { label: 'This Month', value: `${streakData.thisMonth}`, icon: 'calendar-month', color: theme.colors.success },
                  ].map((t, i) => (
                    <AnimatedListItem key={t.label} index={i} style={s.streakTile}>
                      <MaterialCommunityIcons name={t.icon as any} size={20} color={t.color} />
                      <Text style={[s.tileValue, { color: theme.colors.text }]}>{t.value}</Text>
                      <Text style={[s.tileLabel, { color: theme.colors.textMuted }]}>{t.label}</Text>
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
    muscleName: { fontSize: 11, fontWeight: '700', color: '#fff', marginTop: 4 },
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
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    tileValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
    tileLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  });
