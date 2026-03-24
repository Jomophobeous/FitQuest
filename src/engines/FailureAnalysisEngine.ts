/**
 * ENGINE — Failure Analysis Engine
 *
 * Analyzes why sessions fail, not just that they fail.
 * Converts raw session data into actionable failure diagnosis.
 *
 * After each session, produces:
 * - Completion percentage
 * - Drop-off point (which exercise/set the user stopped)
 * - Time to fatigue (session duration vs expected)
 * - Adjustment recommendation for next session
 * - Human-readable insight
 *
 * The system becomes responsive to failure, not just success.
 *
 * Deterministic. No AI. No network.
 */

import {
  getRecentSessions,
  getSessionExercises,
} from '../database/service';
import type { WorkoutSession } from '../database/types';
import { t } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

/** Analysis of a single completed (or incomplete) session */
export interface SessionFailureAnalysis {
  sessionId: string;
  /** Percentage of exercises completed (0-100) */
  completionPercent: number;
  /** Which exercise number the user dropped off at (1-indexed, null if completed all) */
  dropOffPoint: number | null;
  /** Name of the exercise where drop-off occurred */
  dropOffExerciseName: string | null;
  /** Actual duration vs expected duration */
  durationMinutes: number;
  /** Whether this session was a failure (< 80% completion) */
  isFailure: boolean;
  /** Failure category */
  failureType: FailureType;
  /** What to adjust next time */
  adjustment: SessionAdjustment;
  /** Human-readable insight for the user */
  insight: string;
}

export type FailureType =
  | 'NONE'           // Completed successfully
  | 'EARLY_DROPOUT'  // Stopped in first 30% of exercises
  | 'MID_DROPOUT'    // Stopped in middle 30-70%
  | 'LATE_DROPOUT'   // Stopped after 70%
  | 'SKIP_HEAVY'     // Completed but skipped many exercises
  | 'LOW_VOLUME';    // Completed but with very few sets

/** Concrete adjustment for next session */
export interface SessionAdjustment {
  /** Reduce total exercises by this amount */
  reduceExercisesBy: number;
  /** Reduce sets per exercise by this amount */
  reduceSetsBy: number;
  /** Suggested session duration change in minutes (negative = shorter) */
  durationDeltaMinutes: number;
  /** Summary of what changes and why */
  reason: string;
}

/** Aggregate failure pattern across recent sessions */
export interface FailurePattern {
  /** Number of sessions analyzed */
  sessionsAnalyzed: number;
  /** Number of sessions that were failures */
  failureCount: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Most common failure type */
  dominantFailureType: FailureType;
  /** Average drop-off point (exercise number, null if no drop-offs) */
  avgDropOffPoint: number | null;
  /** Is the user's failure rate worsening? */
  trendWorsening: boolean;
  /** Aggregate recommendation */
  recommendation: string;
}

// ============================================
// CONSTANTS
// ============================================

/** Below this completion rate, session is a failure */
const FAILURE_THRESHOLD = 0.80;
/** Below this skip rate (exercises skipped / total) is acceptable */
const SKIP_THRESHOLD = 0.3;

// ============================================
// CORE ENGINE
// ============================================

/**
 * Analyze a specific completed session for failure patterns.
 */
export async function analyzeSession(sessionId: string): Promise<SessionFailureAnalysis> {
  const exercises = await getSessionExercises(sessionId).catch(() => []);

  const total = exercises.length;
  if (total === 0) {
    return buildEmptyAnalysis(sessionId);
  }

  const completed = exercises.filter(e => !e.skipped && e.completed_sets > 0);
  const skipped = exercises.filter(e => e.skipped);
  const completionPercent = Math.round((completed.length / total) * 100);
  const isFailure = completionPercent / 100 < FAILURE_THRESHOLD;

  // Find drop-off point: first exercise that was skipped or had 0 completed sets
  let dropOffPoint: number | null = null;
  let dropOffExerciseName: string | null = null;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]!;
    if (ex.skipped || ex.completed_sets === 0) {
      dropOffPoint = i + 1; // 1-indexed
      dropOffExerciseName = ex.name || `Exercise ${i + 1}`;
      break;
    }
  }

  // Classify failure type
  const failureType = classifyFailure(completionPercent, dropOffPoint, total, skipped.length);

  // Build adjustment
  const adjustment = buildAdjustment(failureType, dropOffPoint, total);

  // Build insight
  const insight = buildInsight(failureType, completionPercent, dropOffPoint, dropOffExerciseName);

  return {
    sessionId,
    completionPercent,
    dropOffPoint,
    dropOffExerciseName,
    durationMinutes: 0, // Will be filled from session record if available
    isFailure,
    failureType,
    adjustment,
    insight,
  };
}

/**
 * Analyze failure patterns across recent sessions.
 * Detects recurring problems and builds aggregate recommendations.
 */
export async function getFailurePattern(userId: string): Promise<FailurePattern> {
  const sessions = await getRecentSessions(userId, 10).catch(() => [] as WorkoutSession[]);
  const completedSessions = sessions.filter(s => s.completed_at);

  if (completedSessions.length === 0) {
    return {
      sessionsAnalyzed: 0,
      failureCount: 0,
      failureRate: 0,
      dominantFailureType: 'NONE',
      avgDropOffPoint: null,
      trendWorsening: false,
      recommendation: t('failure.pattern.noData'),
    };
  }

  const analyses: SessionFailureAnalysis[] = [];
  for (const session of completedSessions) {
    const analysis = await analyzeSession(session.id);
    analysis.durationMinutes = session.duration_minutes;
    analyses.push(analysis);
  }

  const failures = analyses.filter(a => a.isFailure);
  const failureRate = failures.length / analyses.length;

  // Dominant failure type
  const typeCounts = new Map<FailureType, number>();
  for (const f of failures) {
    typeCounts.set(f.failureType, (typeCounts.get(f.failureType) ?? 0) + 1);
  }
  let dominantType: FailureType = 'NONE';
  let maxCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > maxCount) {
      dominantType = type;
      maxCount = count;
    }
  }

  // Average drop-off point
  const dropOffs = analyses.filter(a => a.dropOffPoint !== null).map(a => a.dropOffPoint!);
  const avgDropOffPoint = dropOffs.length > 0 ? dropOffs.reduce((s, d) => s + d, 0) / dropOffs.length : null;

  // Trend: compare first half vs second half failure rates
  const mid = Math.floor(analyses.length / 2);
  const olderFailures = analyses.slice(mid).filter(a => a.isFailure).length;
  const newerFailures = analyses.slice(0, mid).filter(a => a.isFailure).length;
  const olderHalfLen = analyses.length - mid;
  const newerHalfLen = mid;
  const trendWorsening = newerHalfLen > 0 && olderHalfLen > 0
    ? (newerFailures / newerHalfLen) > (olderFailures / olderHalfLen) + 0.1
    : false;

  // Recommendation
  let recommendation: string;
  if (failureRate === 0) {
    recommendation = t('failure.pattern.noFailures');
  } else if (failureRate < 0.3) {
    recommendation = t('failure.pattern.occasional');
  } else if (dominantType === 'EARLY_DROPOUT') {
    recommendation = t('failure.pattern.earlyDropoffs');
  } else if (dominantType === 'SKIP_HEAVY') {
    recommendation = t('failure.pattern.highSkips');
  } else if (trendWorsening) {
    recommendation = t('failure.pattern.worsening');
  } else {
    recommendation = t('failure.pattern.general', { rate: String(Math.round(failureRate * 100)) });
  }

  return {
    sessionsAnalyzed: analyses.length,
    failureCount: failures.length,
    failureRate,
    dominantFailureType: dominantType,
    avgDropOffPoint,
    trendWorsening,
    recommendation,
  };
}

// ============================================
// HELPERS
// ============================================

function classifyFailure(
  completionPercent: number,
  dropOffPoint: number | null,
  totalExercises: number,
  skippedCount: number,
): FailureType {
  if (completionPercent >= 80 && skippedCount / totalExercises < SKIP_THRESHOLD) {
    return 'NONE';
  }

  if (skippedCount / totalExercises >= SKIP_THRESHOLD && completionPercent >= 50) {
    return 'SKIP_HEAVY';
  }

  if (dropOffPoint !== null) {
    const ratio = dropOffPoint / totalExercises;
    if (ratio <= 0.3) return 'EARLY_DROPOUT';
    if (ratio <= 0.7) return 'MID_DROPOUT';
    return 'LATE_DROPOUT';
  }

  return 'LOW_VOLUME';
}

function buildAdjustment(failureType: FailureType, dropOffPoint: number | null, totalExercises: number): SessionAdjustment {
  switch (failureType) {
    case 'NONE':
      return { reduceExercisesBy: 0, reduceSetsBy: 0, durationDeltaMinutes: 0, reason: t('failure.adjustment.none') };

    case 'EARLY_DROPOUT':
      return {
        reduceExercisesBy: Math.max(1, Math.floor(totalExercises * 0.3)),
        reduceSetsBy: 1,
        durationDeltaMinutes: -10,
        reason: t('failure.adjustment.earlyDropout'),
      };

    case 'MID_DROPOUT':
      return {
        reduceExercisesBy: Math.max(1, Math.floor(totalExercises * 0.2)),
        reduceSetsBy: 0,
        durationDeltaMinutes: -5,
        reason: t('failure.adjustment.midDropout', { index: String(dropOffPoint) }),
      };

    case 'LATE_DROPOUT':
      return {
        reduceExercisesBy: 1,
        reduceSetsBy: 0,
        durationDeltaMinutes: 0,
        reason: t('failure.adjustment.lateDropout'),
      };

    case 'SKIP_HEAVY':
      return {
        reduceExercisesBy: 0,
        reduceSetsBy: 0,
        durationDeltaMinutes: 0,
        reason: t('failure.adjustment.skipHeavy'),
      };

    case 'LOW_VOLUME':
      return {
        reduceExercisesBy: 0,
        reduceSetsBy: 1,
        durationDeltaMinutes: -5,
        reason: t('failure.adjustment.lowVolume'),
      };
  }
}

function buildInsight(
  failureType: FailureType,
  completionPercent: number,
  dropOffPoint: number | null,
  dropOffExerciseName: string | null,
): string {
  switch (failureType) {
    case 'NONE':
      return t('failure.insight.none', { percent: String(completionPercent) });

    case 'EARLY_DROPOUT':
      return t('failure.insight.earlyDropout', {
        index: String(dropOffPoint),
        name: dropOffExerciseName || '',
      });

    case 'MID_DROPOUT':
      return t('failure.insight.midDropout', {
        index: String(dropOffPoint),
        name: dropOffExerciseName || '',
      });

    case 'LATE_DROPOUT':
      return t('failure.insight.lateDropout', { percent: String(completionPercent) });

    case 'SKIP_HEAVY':
      return t('failure.insight.skipHeavy', { percent: String(100 - completionPercent) });

    case 'LOW_VOLUME':
      return t('failure.insight.lowVolume', { percent: String(completionPercent) });
  }
}

function buildEmptyAnalysis(sessionId: string): SessionFailureAnalysis {
  return {
    sessionId,
    completionPercent: 0,
    dropOffPoint: null,
    dropOffExerciseName: null,
    durationMinutes: 0,
    isFailure: true,
    failureType: 'EARLY_DROPOUT',
    adjustment: { reduceExercisesBy: 2, reduceSetsBy: 1, durationDeltaMinutes: -10, reason: t('failure.adjustment.empty') },
    insight: t('failure.insight.empty'),
  };
}
