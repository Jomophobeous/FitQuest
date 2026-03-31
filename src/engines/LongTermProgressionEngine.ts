/**
 * ENGINE — Long-Term Progression Engine
 *
 * Tracks per-user long-term progression across movement patterns.
 * Goes beyond session-to-session decisions — this is the evolution layer.
 *
 * Tracks:
 * - Strength trend per movement pattern (compound score, not just reps)
 * - Volume tolerance (can they handle more sets over time?)
 * - Recovery rate (how fast does fatigue drop between sessions?)
 * - Failure points (where do sessions break down?)
 *
 * Produces:
 * - Progressive overload recommendations
 * - Volume adjustment decisions
 * - Recovery-aware intensity modulation
 *
 * Formula:
 *   nextLoad = previousLoad + progressiveOverloadFactor - fatiguePenalty
 *
 * Deterministic. No AI. No network.
 */

import { getRecentSessions, getProgressHistory, getMuscleFatigue, getAllProgressRecords } from '../database/service';
import type { WorkoutSession, ProgressRecord, MuscleFatigue } from '../database/types';
import { parseReps } from './progressionParsing';

// ============================================
// TYPES
// ============================================

/** Movement pattern categories (exercises map to these) */
export type MovementPattern =
  | 'push_horizontal' // bench, push-up
  | 'push_vertical' // overhead press, pike push-up
  | 'pull_horizontal' // row
  | 'pull_vertical' // pull-up, lat pulldown
  | 'squat' // squat, lunge
  | 'hinge' // deadlift, hip thrust
  | 'carry' // farmer walk
  | 'core' // plank, crunch, rotation
  | 'mobility' // stretching, yoga
  | 'unknown';

/** Per-pattern strength trend over time */
export interface StrengthTrend {
  pattern: MovementPattern;
  /** Composite volume score: avg(sets × reps) over recent history */
  currentVolume: number;
  /** Same metric from older history window */
  previousVolume: number;
  /** Trend direction */
  direction: 'increasing' | 'stable' | 'decreasing';
  /** Percentage change */
  changePercent: number;
  /** Number of data points */
  dataPoints: number;
}

/** Volume tolerance assessment */
export interface VolumeTolerance {
  /** Current avg sets per session */
  avgSetsPerSession: number;
  /** Can the user handle more volume? */
  canIncreaseVolume: boolean;
  /** Completion rate of prescribed volume */
  volumeCompletionRate: number;
  /** Trend in volume tolerance */
  trend: 'expanding' | 'stable' | 'contracting';
}

/** Recovery rate assessment */
export interface RecoveryRate {
  /** Average fatigue level at session start */
  avgPreSessionFatigue: number;
  /** Average days between sessions */
  avgDaysBetweenSessions: number;
  /** Is recovery adequately fast? */
  recoveryAdequate: boolean;
  /** Recovery speed category */
  speed: 'fast' | 'normal' | 'slow';
}

/** Complete progression profile for a user */
export interface ProgressionProfile {
  /** Strength trends per movement pattern */
  strengthTrends: StrengthTrend[];
  /** Volume tolerance */
  volumeTolerance: VolumeTolerance;
  /** Recovery rate */
  recoveryRate: RecoveryRate;
  /** Progressive overload recommendation */
  overloadRecommendation: OverloadRecommendation;
  /** When this profile was computed */
  computedAt: number;
}

/** Concrete overload instruction for next session */
export interface OverloadRecommendation {
  /** Target volume multiplier (1.0 = same, 1.05 = +5%) */
  volumeMultiplier: number;
  /** Patterns that should progress */
  progressPatterns: MovementPattern[];
  /** Patterns that should deload or maintain */
  maintainPatterns: MovementPattern[];
  /** Human-readable summary */
  summary: string;
}

// ============================================
// CONSTANTS
// ============================================

/** How many days back to look for "recent" trends */
const RECENT_WINDOW_DAYS = 14;
/** How many days back for "previous" comparison */
const PREVIOUS_WINDOW_DAYS = 28;
/** Minimum data points to form a trend */
const MIN_DATA_POINTS = 3;
/** Maximum volume increase multiplier per cycle */
const MAX_OVERLOAD_MULTIPLIER = 1.1;
/** Minimum volume floor (never go below) */
const MIN_OVERLOAD_MULTIPLIER = 0.85;
/** Fatigue level that penalizes overload */
const FATIGUE_PENALTY_THRESHOLD = 50;

// ============================================
// CORE ENGINE
// ============================================

/**
 * Build complete long-term progression profile for a user.
 * Single entry point — UI calls this once.
 */
export async function getProgressionProfile(userId: string): Promise<ProgressionProfile> {
  const [records, sessions, fatigueData] = await Promise.all([
    getAllProgressRecords(userId, 200).catch(() => [] as ProgressRecord[]),
    getRecentSessions(userId, 30).catch(() => [] as WorkoutSession[]),
    getMuscleFatigue(userId).catch(() => [] as MuscleFatigue[]),
  ]);

  const strengthTrends = computeStrengthTrends(records);
  const volumeTolerance = computeVolumeTolerance(sessions);
  const recoveryRate = computeRecoveryRate(sessions, fatigueData);
  const overloadRecommendation = computeOverload(strengthTrends, volumeTolerance, recoveryRate, fatigueData);

  return {
    strengthTrends,
    volumeTolerance,
    recoveryRate,
    overloadRecommendation,
    computedAt: Date.now(),
  };
}

/**
 * Compute next-session load for a specific exercise.
 *
 * nextLoad = previousLoad + progressiveOverloadFactor - fatiguePenalty
 */
export async function getNextLoad(
  userId: string,
  exerciseId: string,
): Promise<{ sets: number; reps: number; multiplier: number; reason: string }> {
  const [history, fatigueData] = await Promise.all([
    getProgressHistory(userId, exerciseId, 10).catch(() => [] as ProgressRecord[]),
    getMuscleFatigue(userId).catch(() => [] as MuscleFatigue[]),
  ]);

  if (history.length === 0) {
    return { sets: 3, reps: 10, multiplier: 1.0, reason: 'No history. Starting at baseline.' };
  }

  const latest = history[0]!;
  const previousSets = latest.sets_completed;
  const previousReps = parseReps(latest.reps_achieved);

  // Progressive overload factor: based on recent success streak
  const recentSuccessRate = computeRecentSuccessRate(history.slice(0, 5));
  const overloadFactor = recentSuccessRate >= 0.8 ? 0.05 : recentSuccessRate >= 0.6 ? 0.02 : 0;

  // Fatigue penalty: based on average fatigue level
  const avgFatigue =
    fatigueData.length > 0 ? fatigueData.reduce((sum, f) => sum + f.fatigue_level, 0) / fatigueData.length : 0;
  const fatiguePenalty =
    avgFatigue > FATIGUE_PENALTY_THRESHOLD
      ? (avgFatigue - FATIGUE_PENALTY_THRESHOLD) / 200 // 0 to 0.25 range
      : 0;

  const multiplier = Math.max(
    MIN_OVERLOAD_MULTIPLIER,
    Math.min(MAX_OVERLOAD_MULTIPLIER, 1 + overloadFactor - fatiguePenalty),
  );

  // Apply multiplier to reps first, then sets if rep ceiling hit
  const REP_CEILING = 15;
  let nextReps = Math.round(previousReps * multiplier);
  let nextSets = previousSets;

  if (nextReps > REP_CEILING) {
    nextReps = Math.max(8, REP_CEILING - 4);
    nextSets = previousSets + 1;
  }
  nextReps = Math.max(1, nextReps);
  nextSets = Math.max(1, nextSets);

  const reason =
    fatiguePenalty > 0
      ? `Overload +${(overloadFactor * 100).toFixed(0)}%, fatigue penalty -${(fatiguePenalty * 100).toFixed(0)}%`
      : overloadFactor > 0
        ? `Progressive overload: +${(overloadFactor * 100).toFixed(0)}%`
        : 'Maintaining current load.';

  return { sets: nextSets, reps: nextReps, multiplier, reason };
}

// ============================================
// COMPUTATION HELPERS
// ============================================

function computeStrengthTrends(records: ProgressRecord[]): StrengthTrend[] {
  if (records.length < MIN_DATA_POINTS) return [];

  const now = Date.now();
  const recentCutoff = now - RECENT_WINDOW_DAYS * 86400000;
  const previousCutoff = now - PREVIOUS_WINDOW_DAYS * 86400000;

  // Group records by exercise (as proxy for pattern — exercise_id is what we have)
  const byExercise = new Map<string, ProgressRecord[]>();
  for (const r of records) {
    const list = byExercise.get(r.exercise_id) ?? [];
    list.push(r);
    byExercise.set(r.exercise_id, list);
  }

  const trends: StrengthTrend[] = [];

  for (const [, exerciseRecords] of byExercise) {
    if (exerciseRecords.length < MIN_DATA_POINTS) continue;

    const recent = exerciseRecords.filter((r) => new Date(r.date).getTime() >= recentCutoff);
    const previous = exerciseRecords.filter((r) => {
      const t = new Date(r.date).getTime();
      return t >= previousCutoff && t < recentCutoff;
    });

    if (recent.length === 0) continue;

    const recentVolume = avgVolume(recent);
    const previousVolume = previous.length > 0 ? avgVolume(previous) : recentVolume;
    const changePercent = previousVolume > 0 ? ((recentVolume - previousVolume) / previousVolume) * 100 : 0;

    let direction: StrengthTrend['direction'] = 'stable';
    if (changePercent > 5) direction = 'increasing';
    else if (changePercent < -5) direction = 'decreasing';

    trends.push({
      pattern: 'unknown', // Could be enriched with exercise→pattern mapping
      currentVolume: recentVolume,
      previousVolume,
      direction,
      changePercent,
      dataPoints: exerciseRecords.length,
    });
  }

  return trends;
}

function computeVolumeTolerance(sessions: WorkoutSession[]): VolumeTolerance {
  const completed = sessions.filter((s) => s.completed_at);
  if (completed.length === 0) {
    return { avgSetsPerSession: 0, canIncreaseVolume: false, volumeCompletionRate: 0, trend: 'stable' };
  }

  const avgSetsPerSession = completed.reduce((sum, s) => sum + s.total_exercises, 0) / completed.length;
  const volumeCompletionRate =
    completed.reduce((sum, s) => sum + (s.total_exercises > 0 ? s.completed_exercises / s.total_exercises : 0), 0) /
    completed.length;

  // Check trend: compare first half vs second half
  const mid = Math.floor(completed.length / 2);
  const firstHalf = completed.slice(mid); // older (sessions are newest-first)
  const secondHalf = completed.slice(0, mid); // newer

  const firstRate =
    firstHalf.length > 0
      ? firstHalf.reduce((s, c) => s + (c.total_exercises > 0 ? c.completed_exercises / c.total_exercises : 0), 0) /
        firstHalf.length
      : 0;
  const secondRate =
    secondHalf.length > 0
      ? secondHalf.reduce((s, c) => s + (c.total_exercises > 0 ? c.completed_exercises / c.total_exercises : 0), 0) /
        secondHalf.length
      : 0;

  let trend: VolumeTolerance['trend'] = 'stable';
  if (secondRate > firstRate + 0.05) trend = 'expanding';
  else if (secondRate < firstRate - 0.05) trend = 'contracting';

  const canIncreaseVolume = volumeCompletionRate >= 0.85 && trend !== 'contracting';

  return { avgSetsPerSession, canIncreaseVolume, volumeCompletionRate, trend };
}

function computeRecoveryRate(sessions: WorkoutSession[], fatigueData: MuscleFatigue[]): RecoveryRate {
  const completed = sessions
    .filter((s) => s.completed_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

  const avgFatigue =
    fatigueData.length > 0 ? fatigueData.reduce((sum, f) => sum + f.fatigue_level, 0) / fatigueData.length : 0;

  // Average days between sessions
  let avgDays = 2;
  if (completed.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < completed.length; i++) {
      const diff = new Date(completed[i]!.started_at).getTime() - new Date(completed[i - 1]!.started_at).getTime();
      gaps.push(diff / 86400000);
    }
    avgDays = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }

  let speed: RecoveryRate['speed'] = 'normal';
  if (avgFatigue < 30 && avgDays <= 2) speed = 'fast';
  else if (avgFatigue > 50 || avgDays > 3) speed = 'slow';

  const recoveryAdequate = avgFatigue < FATIGUE_PENALTY_THRESHOLD;

  return { avgPreSessionFatigue: avgFatigue, avgDaysBetweenSessions: avgDays, recoveryAdequate, speed };
}

function computeOverload(
  trends: StrengthTrend[],
  volume: VolumeTolerance,
  recovery: RecoveryRate,
  fatigueData: MuscleFatigue[],
): OverloadRecommendation {
  const avgFatigue =
    fatigueData.length > 0 ? fatigueData.reduce((sum, f) => sum + f.fatigue_level, 0) / fatigueData.length : 0;

  // Base multiplier: neutral
  let multiplier = 1.0;

  // Recovery adequate + high completion rate → increase
  if (recovery.recoveryAdequate && volume.canIncreaseVolume) {
    multiplier = 1.05;
  }

  // Fatigue penalty
  if (avgFatigue > FATIGUE_PENALTY_THRESHOLD) {
    multiplier -= (avgFatigue - FATIGUE_PENALTY_THRESHOLD) / 200;
  }

  // Volume contracting → don't overload
  if (volume.trend === 'contracting') {
    multiplier = Math.min(multiplier, 1.0);
  }

  multiplier = Math.max(MIN_OVERLOAD_MULTIPLIER, Math.min(MAX_OVERLOAD_MULTIPLIER, multiplier));

  const progressPatterns = trends
    .filter((t) => t.direction === 'increasing' || t.direction === 'stable')
    .map((t) => t.pattern);
  const maintainPatterns = trends.filter((t) => t.direction === 'decreasing').map((t) => t.pattern);

  let summary: string;
  if (multiplier > 1.02) {
    summary = `Progressive overload: +${((multiplier - 1) * 100).toFixed(0)}% volume. Recovery and tolerance support increase.`;
  } else if (multiplier < 0.98) {
    summary = `Volume reduction: ${((1 - multiplier) * 100).toFixed(0)}% decrease. Fatigue or tolerance requires pullback.`;
  } else {
    summary = 'Maintaining current volume. Conditions stable.';
  }

  return { volumeMultiplier: multiplier, progressPatterns, maintainPatterns, summary };
}

// ============================================
// UTILITY
// ============================================

function avgVolume(records: ProgressRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, r) => sum + r.sets_completed * parseReps(r.reps_achieved), 0) / records.length;
}

function computeRecentSuccessRate(records: ProgressRecord[]): number {
  if (records.length === 0) return 0;
  const successes = records.filter((r) => !r.difficulty_rating || r.difficulty_rating <= 7).length;
  return successes / records.length;
}
