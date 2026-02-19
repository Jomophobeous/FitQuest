/**
 * Analytics Data Service
 *
 * Centralized data fetching for analytics screen.
 * All database queries for analytics metrics live here,
 * keeping raw SQL out of UI components per architecture rules.
 */

import { getDatabase } from '../database/schema';

const USER_ID = 'user_local_001';

// ============================================
// TYPES
// ============================================

export interface BarData {
  day: string;
  count: number;
}

export interface MuscleGroupData {
  name: string;
  sessions: number;
  icon: string;
}

export interface StepStats {
  steps: number;
  distance: number;
  calories: number;
  avgDaily: number;
}

export interface JogStats {
  runs: number;
  totalKm: number;
  avgPace: string;
  longestRun: number;
}

export interface PersonalRecord {
  exercise: string;
  value: string;
  date: string;
  icon: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  consistencyPct: number;
  thisWeek: number;
  thisMonth: number;
}

// ============================================
// HELPERS
// ============================================

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

// ============================================
// DATA FETCHING
// ============================================

export async function fetchWorkoutBars(range: 'weekly' | 'monthly'): Promise<BarData[]> {
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

export async function fetchXPData(range: 'weekly' | 'monthly'): Promise<number[]> {
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
      // Match xpService formula: 100 base + 20/exercise + 50 completion bonus
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

export async function fetchMuscleGroups(): Promise<MuscleGroupData[]> {
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

export async function fetchStepStats(range: 'weekly' | 'monthly'): Promise<StepStats> {
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

export async function fetchJogStats(range: 'weekly' | 'monthly'): Promise<JogStats> {
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

export async function fetchActiveDays(): Promise<number[]> {
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

export async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
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

export async function fetchStreakData(): Promise<StreakData> {
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
