/**
 * ENGINE — Adaptive Memory Engine
 *
 * Makes the system feel alive by comparing current state to history.
 * Produces three types of intelligence:
 *
 * 1. Last Session Impact — what happened last time and what it means
 * 2. Workout Delta — what changed from last workout and why
 * 3. Progression Narrative — per-exercise trend context
 *
 * Deterministic. No AI calls. No network. All math on-device.
 */

import {
  getRecentSessions,
  getSessionExercises,
  getStreak,
  getUserProfile,
} from '../database/service';
import {
  analyzeExerciseProgression,
  type ProgressionDecision,
} from './progressionEngine';
import type { TargetMuscle, WorkoutSession } from '../database/types';
import { t } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

export interface LastSessionImpact {
  /** Did the user complete a session recently? */
  hasHistory: boolean;
  /** One-liner: "Yesterday's session pushed 3 muscle groups forward." */
  headline: string;
  /** How many exercises were completed vs total */
  completionSummary: string;
  /** Time since last session in human terms */
  timeSince: string;
  /** Trend direction of recent performance */
  trend: 'improving' | 'steady' | 'declining' | 'unknown';
  /** Short decisive trend statement */
  trendStatement: string;
}

export interface WorkoutDelta {
  /** Were there changes from the last session? */
  hasChanges: boolean;
  /** One-liner: "3 exercises swapped — your chest recovered, legs needed focus." */
  headline: string;
  /** Exercises kept from last time */
  retained: string[];
  /** New exercises added */
  added: string[];
  /** Exercises removed from last time */
  removed: string[];
  /** Specific change reasons */
  changeReasons: DeltaReason[];
}

export interface DeltaReason {
  exerciseName: string;
  action: 'added' | 'removed' | 'retained';
  reason: string;
}

export interface ExerciseProgressionNarrative {
  exerciseId: string;
  exerciseName: string;
  /** "3 successful sessions → advancing reps" */
  narrative: string;
  trend: 'improving' | 'stagnant' | 'declining';
  /** 0-100 confidence in continued progress */
  momentum: number;
}

// ============================================
// LAST SESSION IMPACT
// ============================================

/**
 * Analyze the last completed session and produce a decisive summary.
 */
export async function getLastSessionImpact(userId: string): Promise<LastSessionImpact> {
  const sessions = await getRecentSessions(userId, 5);
  const completed = sessions.filter((s) => s.completed_at);

  if (completed.length === 0) {
    return {
      hasHistory: false,
      headline: t('memory.noHistory.headline'),
      completionSummary: '',
      timeSince: '',
      trend: 'unknown',
      trendStatement: t('memory.noHistory.trendStatement'),
    };
  }

  const last = completed[0]!;
  const completionRate = last.total_exercises > 0
    ? Math.round((last.completed_exercises / last.total_exercises) * 100)
    : 0;

  // Time since
  const timeSince = formatTimeSince(last.completed_at || last.started_at);

  // Headline — decisive, not passive
  let headline: string;
  if (completionRate >= 90) {
    headline = t('memory.lastSession.headline.crushed', {
      completed: String(last.completed_exercises),
      duration: String(last.duration_minutes || '?'),
    });
  } else if (completionRate >= 60) {
    headline = t('memory.lastSession.headline.adjusted', {
      completed: String(last.completed_exercises),
      total: String(last.total_exercises),
    });
  } else {
    headline = t('memory.lastSession.headline.tough', {
      completed: String(last.completed_exercises),
      total: String(last.total_exercises),
    });
  }

  // Trend from recent sessions
  const trend = analyzeTrend(completed);
  const trendStatement = buildTrendStatement(trend, completed.length);

  return {
    hasHistory: true,
    headline,
    completionSummary: `${last.completed_exercises}/${last.total_exercises} exercises (${completionRate}%)`,
    timeSince,
    trend,
    trendStatement,
  };
}

// ============================================
// WORKOUT DELTA
// ============================================

/**
 * Compare current workout exercises to last session.
 * Returns what changed and why.
 */
export async function getWorkoutDelta(
  userId: string,
  currentExerciseIds: string[],
  fatigueMap: Map<TargetMuscle, number>,
): Promise<WorkoutDelta> {
  const sessions = await getRecentSessions(userId, 3);
  const lastCompleted = sessions.find((s) => s.completed_at);

  if (!lastCompleted) {
    return {
      hasChanges: false,
      headline: t('memory.delta.firstWorkout'),
      retained: [],
      added: currentExerciseIds.map(() => 'new'),
      removed: [],
      changeReasons: [],
    };
  }

  const lastExercises = await getSessionExercises(lastCompleted.id);
  const lastExIds = new Set(lastExercises.map((e) => e.exercise_id));
  const currentSet = new Set(currentExerciseIds);

  const retained: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const changeReasons: DeltaReason[] = [];

  // What was kept
  for (const ex of lastExercises) {
    if (currentSet.has(ex.exercise_id)) {
      retained.push(ex.name);
      changeReasons.push({
        exerciseName: ex.name,
        action: 'retained',
        reason: t('memory.reason.retained'),
      });
    } else {
      removed.push(ex.name);
      // Why removed?
      const reason = inferRemovalReason(ex.exercise_id, ex.name, fatigueMap);
      changeReasons.push({
        exerciseName: ex.name,
        action: 'removed',
        reason,
      });
    }
  }

  // What's new
  for (const id of currentExerciseIds) {
    if (!lastExIds.has(id)) {
      added.push(id); // We only have IDs for new ones
      changeReasons.push({
        exerciseName: id, // Will be replaced at display time
        action: 'added',
        reason: t('memory.reason.addedBalance'),
      });
    }
  }

  const totalChanges = added.length + removed.length;

  let headline: string;
  if (totalChanges === 0) {
    headline = t('memory.delta.same');
  } else if (added.length > 0 && removed.length > 0) {
    headline = t('memory.delta.mixed', {
      total: String(totalChanges),
      removed: String(removed.length),
      added: String(added.length),
    });
  } else if (added.length > 0) {
    headline = t('memory.delta.added', {
      count: String(added.length),
      plural: added.length > 1 ? 's' : '',
    });
  } else {
    headline = t('memory.delta.removed', {
      count: String(removed.length),
      plural: removed.length > 1 ? 's' : '',
    });
  }

  return {
    hasChanges: totalChanges > 0,
    headline,
    retained,
    added,
    removed,
    changeReasons,
  };
}

// ============================================
// PROGRESSION NARRATIVE
// ============================================

/**
 * For each exercise in the current workout, generate a one-line
 * progression narrative based on history.
 */
export async function getProgressionNarratives(
  userId: string,
  exerciseIds: string[],
  exerciseNames: Map<string, string>,
): Promise<ExerciseProgressionNarrative[]> {
  const narratives: ExerciseProgressionNarrative[] = [];

  for (const id of exerciseIds) {
    const state = await analyzeExerciseProgression(userId, id);
    const name = exerciseNames.get(id) || id;

    let narrative: string;
    let momentum: number;

    if (state.last_sets === 0) {
      narrative = t('memory.progression.firstTime');
      momentum = 50;
    } else if (state.trend === 'improving') {
      narrative = t('memory.progression.improving', { wins: String(state.consecutive_successes) });
      momentum = Math.min(95, 60 + state.consecutive_successes * 10);
    } else if (state.trend === 'declining') {
      narrative = t('memory.progression.declining');
      momentum = Math.max(15, 40 - state.consecutive_failures * 10);
    } else {
      if (state.consecutive_successes > 0) {
        narrative = t('memory.progression.nearGate', {
          successes: String(state.consecutive_successes),
          plural: state.consecutive_successes > 1 ? 's' : '',
        });
        momentum = 50 + state.consecutive_successes * 8;
      } else {
        narrative = t('memory.progression.steady');
        momentum = 45;
      }
    }

    narratives.push({
      exerciseId: id,
      exerciseName: name,
      narrative,
      trend: state.trend,
      momentum: Math.min(100, Math.max(0, momentum)),
    });
  }

  return narratives;
}

// ============================================
// HELPERS
// ============================================

function formatTimeSince(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return t('memory.timeSince.minutes', { minutes: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('memory.timeSince.hours', { hours: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('memory.timeSince.yesterday');
  return t('memory.timeSince.days', { days: String(days) });
}

function analyzeTrend(
  sessions: WorkoutSession[],
): 'improving' | 'steady' | 'declining' {
  if (sessions.length < 2) return 'steady';

  // Compare completion rates of recent vs older
  const recent = sessions.slice(0, Math.ceil(sessions.length / 2));
  const older = sessions.slice(Math.ceil(sessions.length / 2));

  const recentRate = avgCompletionRate(recent);
  const olderRate = avgCompletionRate(older);

  if (recentRate > olderRate + 10) return 'improving';
  if (recentRate < olderRate - 10) return 'declining';
  return 'steady';
}

function avgCompletionRate(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 0;
  return (
    sessions.reduce((sum, s) => {
      return sum + (s.total_exercises > 0 ? (s.completed_exercises / s.total_exercises) * 100 : 0);
    }, 0) / sessions.length
  );
}

function buildTrendStatement(
  trend: 'improving' | 'steady' | 'declining' | 'unknown',
  sessionCount: number,
): string {
  switch (trend) {
    case 'improving':
      return t('memory.trend.improving');
    case 'declining':
      return t('memory.trend.declining');
    case 'steady':
      return sessionCount >= 3
        ? t('memory.trend.steady.data')
        : t('memory.trend.steady.building');
    case 'unknown':
      return t('memory.noHistory.trendStatement');
  }
}

function inferRemovalReason(
  exerciseId: string,
  exerciseName: string,
  fatigueMap: Map<TargetMuscle, number>,
): string {
  const avgFatigue = fatigueMap.size > 0
    ? Array.from(fatigueMap.values()).reduce((a, b) => a + b, 0) / fatigueMap.size
    : 0;

  if (avgFatigue > 60) {
    return t('memory.reason.removedFatigue');
  }
  return t('memory.reason.removedVariety');
}
