/**
 * ENGINE 2 — Progression Engine
 *
 * Enforces Improvement: Double progression, volume tracking, intensity decisions
 *
 * Consumes: session_exercises (completed), progress_records
 * Produces: next-session volume/intensity decisions
 *
 * Core Principle: APPEND-ONLY. Never rewrite history.
 */

import { recordProgress, getProgressExerciseIds, getProgressHistory } from '../database/service';
import type { ProgressRecord, SessionExercise } from '../database/types';
import { formatRepRange, parseReps, parseRepRange } from './progressionParsing';
import { generateSecureId } from '../security/randomId';
import { getAdaptiveTrainingProfile } from '../services/adaptiveTrainingService';

// ============================================
// CONFIGURATION
// ============================================

/** Progression thresholds */
const PROGRESSION_CONFIG = {
  // Success = completed >= this % of prescribed
  success_threshold: 0.9,

  // Consecutive successes needed to progress
  successes_to_progress: 2,

  // Consecutive failures to regress
  failures_to_regress: 2,

  // Rep increase per progression
  rep_increment: 1,

  // Set increase (only after rep ceiling hit)
  set_increment: 1,

  // Rep ceilings by goal
  rep_ceilings: {
    strength: 8,
    hypertrophy: 12,
    endurance: 20,
    default: 15,
  },

  // Minimum reps before regression
  rep_floors: {
    strength: 3,
    hypertrophy: 6,
    endurance: 10,
    default: 5,
  },
};

// ============================================
// TYPES
// ============================================

export interface ProgressionDecision {
  exercise_id: string;
  action: 'progress' | 'maintain' | 'regress';
  reason: string;
  recommendation: {
    sets: number;
    reps: string;
    notes: string;
  };
}

export interface ExercisePerformance {
  exercise_id: string;
  prescribed_sets: number;
  prescribed_reps: string;
  completed_sets: number;
  completed_reps: string | null;
  success: boolean;
  difficulty_rating?: number;
}

interface ProgressionState {
  consecutive_successes: number;
  consecutive_failures: number;
  last_sets: number;
  last_reps_achieved: number;
  trend: 'improving' | 'stagnant' | 'declining';
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Analyze recent performance for an exercise
 */
export async function analyzeExerciseProgression(
  userId: string,
  exerciseId: string,
  lookbackDays = 30,
): Promise<ProgressionState> {
  const history = await getProgressHistory(userId, exerciseId, 10);

  if (history.length === 0) {
    return {
      consecutive_successes: 0,
      consecutive_failures: 0,
      last_sets: 0,
      last_reps_achieved: 0,
      trend: 'stagnant',
    };
  }

  // Count consecutive successes/failures from most recent
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;
  let lastOutcome: boolean | null = null;

  for (const record of history) {
    // Unrated exercises default to success (neutral outcome)
    const success = record.difficulty_rating === undefined || record.difficulty_rating <= 7;

    if (lastOutcome === null) {
      lastOutcome = success;
    }

    if (success && lastOutcome) {
      consecutiveSuccesses++;
    } else if (!success && !lastOutcome) {
      consecutiveFailures++;
    } else {
      break; // Streak broken
    }
  }

  // Determine trend
  let trend: 'improving' | 'stagnant' | 'declining' = 'stagnant';
  if (history.length >= 3) {
    const recentAvg = history.slice(0, 3).reduce((sum, r) => sum + parseReps(r.reps_achieved), 0) / 3;
    const olderAvg = history.slice(-3).reduce((sum, r) => sum + parseReps(r.reps_achieved), 0) / 3;

    if (recentAvg > olderAvg * 1.1) {
      trend = 'improving';
    } else if (recentAvg < olderAvg * 0.9) {
      trend = 'declining';
    }
  }

  const latest = history[0]!;
  return {
    consecutive_successes: consecutiveSuccesses,
    consecutive_failures: consecutiveFailures,
    last_sets: latest.sets_completed,
    last_reps_achieved: parseReps(latest.reps_achieved),
    trend,
  };
}

/**
 * Calculate progression decision for next session
 */
export async function calculateProgression(
  userId: string,
  exerciseId: string,
  currentSets: number,
  currentReps: string,
  goalType: 'strength' | 'hypertrophy' | 'endurance' | 'default' = 'default',
): Promise<ProgressionDecision> {
  const state = await analyzeExerciseProgression(userId, exerciseId);
  const adaptive = await getAdaptiveTrainingProfile(userId);

  const repCeiling = PROGRESSION_CONFIG.rep_ceilings[goalType];
  const repFloor = PROGRESSION_CONFIG.rep_floors[goalType];
  const currentRepTarget = parseRepRange(currentReps).max;
  const successesToProgress = Math.max(
    1,
    Math.round(PROGRESSION_CONFIG.successes_to_progress / adaptive.progressionAggressiveness),
  );
  const failuresToRegress = Math.max(
    1,
    Math.round(PROGRESSION_CONFIG.failures_to_regress / adaptive.fatigueSensitivity),
  );
  const repIncrement =
    adaptive.progressionAggressiveness >= 1.15
      ? PROGRESSION_CONFIG.rep_increment + 1
      : PROGRESSION_CONFIG.rep_increment;

  // Decision logic
  let action: 'progress' | 'maintain' | 'regress' = 'maintain';
  let reason = '';
  let newSets = currentSets;
  let newReps = currentReps;
  let notes = '';

  if (state.consecutive_successes >= successesToProgress) {
    // PROGRESS
    action = 'progress';

    if (currentRepTarget < repCeiling) {
      // Increase reps first
      const newMax = Math.min(currentRepTarget + repIncrement, repCeiling);
      newReps = formatRepRange(newMax - 2, newMax);
      reason = `${state.consecutive_successes} consecutive successes → +${repIncrement} reps (adaptive)`;
      notes = 'Focus on form as reps increase';
    } else {
      // Rep ceiling hit → increase sets
      newSets = currentSets + PROGRESSION_CONFIG.set_increment;
      const resetReps = Math.max(repFloor, repCeiling - 4);
      newReps = formatRepRange(resetReps, resetReps + 2);
      reason = `Rep ceiling (${repCeiling}) reached → +${PROGRESSION_CONFIG.set_increment} set, reset reps`;
      notes = 'New set added. Reduce reps to build back up.';
    }
  } else if (state.consecutive_failures >= failuresToRegress) {
    // REGRESS
    action = 'regress';

    if (currentRepTarget > repFloor + 2) {
      // Reduce reps first
      const newMax = Math.max(currentRepTarget - 2, repFloor);
      newReps = formatRepRange(newMax - 2, newMax);
      reason = `${state.consecutive_failures} consecutive failures → -2 reps (adaptive)`;
      notes = 'Reduce load to rebuild momentum';
    } else if (currentSets > 2) {
      // Rep floor hit → reduce sets
      newSets = currentSets - 1;
      reason = `Rep floor reached → -1 set`;
      notes = 'Reduce volume to allow recovery';
    } else {
      // Can't reduce further
      reason = 'At minimum volume. Consider deload week.';
      notes = 'Flag for deload assessment';
    }
  } else {
    // MAINTAIN
    action = 'maintain';
    reason = 'Insufficient data or mixed results → maintain current prescription';
    notes = state.trend === 'improving' ? 'Trend positive, stay consistent' : 'Focus on quality reps';
  }

  return {
    exercise_id: exerciseId,
    action,
    reason,
    recommendation: {
      sets: newSets,
      reps: newReps,
      notes,
    },
  };
}

/**
 * Record completed exercise performance
 */
export async function recordExercisePerformance(userId: string, performance: ExercisePerformance): Promise<void> {
  const record: ProgressRecord = {
    id: await generateSecureId('progress'),
    user_id: userId,
    exercise_id: performance.exercise_id,
    date: new Date().toISOString().split('T')[0]!,
    sets_completed: performance.completed_sets,
    reps_achieved: performance.completed_reps || performance.prescribed_reps,
    difficulty_rating: performance.difficulty_rating,
    notes: performance.success ? 'Completed as prescribed' : 'Did not complete full prescription',
  };

  await recordProgress(record);
}

/**
 * Batch record all exercises from a completed session
 */
export async function recordSessionPerformance(
  userId: string,
  sessionId: string,
  performances: ExercisePerformance[],
): Promise<ProgressionDecision[]> {
  const decisions: ProgressionDecision[] = [];

  for (const perf of performances) {
    // Record the performance
    await recordExercisePerformance(userId, perf);

    // Calculate next-time progression
    const decision = await calculateProgression(userId, perf.exercise_id, perf.prescribed_sets, perf.prescribed_reps);

    decisions.push(decision);
  }

  return decisions;
}

/**
 * Get progression summary for all exercises user has done
 */
export async function getProgressionSummary(userId: string): Promise<Map<string, ProgressionState>> {
  const exercises = await getProgressExerciseIds(userId);

  const summary = new Map<string, ProgressionState>();

  for (const exerciseId of exercises) {
    const state = await analyzeExerciseProgression(userId, exerciseId);
    summary.set(exerciseId, state);
  }

  return summary;
}

// ============================================
// EXPORTS
// ============================================

export { PROGRESSION_CONFIG, parseReps, parseRepRange, formatRepRange };
