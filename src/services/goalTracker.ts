/**
 * SERVICE — Goal Tracker
 *
 * Persists and tracks weekly fitness goals using app_state KV store.
 * No new tables. Derives progress from existing workout data.
 *
 * Goals:
 * - Weekly workout count target
 * - Weekly active minutes target
 * - Weekly steps target
 *
 * Progress computed from existing workout_sessions + daily_steps tables.
 */

import { getAppState, setAppState, getRecentSessions, getStepHistory } from '../database/service';

const PREFIX = 'goals.';

// ============================================
// TYPES
// ============================================

export interface WeeklyGoals {
  workoutsTarget: number;
  activeMinutesTarget: number;
  stepsTarget: number;
}

export interface GoalProgress {
  goals: WeeklyGoals;
  workoutsDone: number;
  activeMinutesDone: number;
  stepsDone: number;
  /** Overall goal completion 0–1 */
  overallProgress: number;
  /** ISO date string of week start (Monday) */
  weekStart: string;
}

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_GOALS: WeeklyGoals = {
  workoutsTarget: 3,
  activeMinutesTarget: 150,
  stepsTarget: 50000,
};

// ============================================
// READ / WRITE GOALS
// ============================================

export async function getWeeklyGoals(): Promise<WeeklyGoals> {
  const raw = await getAppState(`${PREFIX}weekly`).catch(() => null);
  if (!raw) return { ...DEFAULT_GOALS };
  try {
    const parsed = JSON.parse(raw);
    return {
      workoutsTarget: parsed.workoutsTarget ?? DEFAULT_GOALS.workoutsTarget,
      activeMinutesTarget: parsed.activeMinutesTarget ?? DEFAULT_GOALS.activeMinutesTarget,
      stepsTarget: parsed.stepsTarget ?? DEFAULT_GOALS.stepsTarget,
    };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

export async function setWeeklyGoals(goals: Partial<WeeklyGoals>): Promise<void> {
  const current = await getWeeklyGoals();
  const merged = { ...current, ...goals };
  await setAppState(`${PREFIX}weekly`, JSON.stringify(merged));
}

// ============================================
// PROGRESS COMPUTATION
// ============================================

export async function getGoalProgress(userId: string): Promise<GoalProgress> {
  const goals = await getWeeklyGoals();
  const weekStart = getWeekStartDate();
  const weekEnd = getWeekEndDate();

  // Get sessions this week
  const sessions = await getRecentSessions(userId, 20).catch(() => []);
  const weekSessions = sessions.filter((s) => {
    const d = s.started_at;
    return d >= weekStart && d <= weekEnd && s.completed_at;
  });

  const workoutsDone = weekSessions.length;
  const activeMinutesDone = weekSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Get steps this week (from step history, last 7 days)
  let stepsDone = 0;
  try {
    const stepsData = await getStepHistory(userId, 7);
    const weekStartDate = weekStart.split('T')[0]!;
    stepsDone = stepsData
      .filter((d) => d.date >= weekStartDate)
      .reduce((sum, d) => sum + (d.steps || 0), 0);
  } catch {
    stepsDone = 0;
  }

  // Overall progress: weighted average of three goals
  const workoutProgress = Math.min(1, workoutsDone / Math.max(1, goals.workoutsTarget));
  const minuteProgress = Math.min(1, activeMinutesDone / Math.max(1, goals.activeMinutesTarget));
  const stepProgress = Math.min(1, stepsDone / Math.max(1, goals.stepsTarget));
  const overallProgress = workoutProgress * 0.5 + minuteProgress * 0.3 + stepProgress * 0.2;

  return {
    goals,
    workoutsDone,
    activeMinutesDone,
    stepsDone,
    overallProgress: Math.round(overallProgress * 100) / 100,
    weekStart,
  };
}

// ============================================
// HELPERS
// ============================================

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function getWeekEndDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day; // Sunday = end
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString();
}
