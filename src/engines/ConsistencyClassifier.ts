/**
 * ENGINE — Consistency Classifier
 *
 * Classifies user behavioral mode from observed workout data.
 * Two modes: INCONSISTENT (stabilization) vs DISCIPLINED (optimization).
 *
 * No ML. No AI. Pure deterministic rule engine from real data.
 *
 * The system adapts to the user — the user doesn't adapt to the system.
 */

import { getRecentSessions, getStreak, getUserProfile } from '../database/service';
import type { WorkoutSession } from '../database/types';

// ============================================
// TYPES
// ============================================

export type BehavioralMode = 'INCONSISTENT' | 'DISCIPLINED';

export interface ConsistencyProfile {
  /** Current behavioral mode */
  mode: BehavioralMode;
  /** Score from 0–1 (0 = no consistency, 1 = perfect) */
  consistencyScore: number;
  /** Sessions completed in evaluation window */
  sessionsCompleted: number;
  /** Sessions expected based on user plan */
  sessionsExpected: number;
  /** Average completion rate across sessions */
  avgCompletionRate: number;
  /** Current streak vs longest streak ratio */
  streakRatio: number;
  /** Was the user previously in a different mode? */
  transitionDetected: boolean;
  /** If transition detected, what direction? */
  transitionDirection: 'stabilizing' | 'advancing' | null;
  /** Human-readable status */
  statusLine: string;
}

// ============================================
// CONSTANTS
// ============================================

const EVALUATION_WINDOW_DAYS = 14;
const MODE_THRESHOLD = 0.5;
const COMPLETION_WEIGHT = 0.6;
const STREAK_WEIGHT = 0.4;

// ============================================
// CORE CLASSIFIER
// ============================================

/**
 * Classify user's current behavioral mode from workout history.
 * Uses a 14-day evaluation window to determine consistency.
 */
export async function classifyConsistency(userId: string): Promise<ConsistencyProfile> {
  const [sessions, streakData, profile] = await Promise.all([
    getRecentSessions(userId, 30).catch(() => [] as WorkoutSession[]),
    getStreak(userId).catch(() => ({ current: 0, longest: 0 })),
    getUserProfile(userId).catch(() => null),
  ]);

  const trainingDays = profile?.training_days_per_week ?? 3;
  const windowStart = Date.now() - EVALUATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Filter sessions within evaluation window
  const recentSessions = sessions.filter((s) => {
    const startedAt = new Date(s.started_at).getTime();
    return startedAt >= windowStart;
  });

  // Calculate sessions expected in window
  const sessionsExpected = Math.round((trainingDays / 7) * EVALUATION_WINDOW_DAYS);
  const sessionsCompleted = recentSessions.filter((s) => s.completed_at).length;

  // Completion ratio (capped at 1.0)
  const completionRatio =
    sessionsExpected > 0 ? Math.min(1, sessionsCompleted / sessionsExpected) : sessionsCompleted > 0 ? 1 : 0;

  // Average exercise completion rate within sessions
  const avgCompletionRate = calculateAvgCompletionRate(recentSessions);

  // Streak ratio
  const streak = streakData.current;
  const longestStreak = Math.max(streakData.longest, 1);
  const streakRatio = Math.min(1, streak / longestStreak);

  // Composite score
  const consistencyScore = completionRatio * COMPLETION_WEIGHT + streakRatio * STREAK_WEIGHT;

  // Mode classification
  const mode: BehavioralMode = consistencyScore >= MODE_THRESHOLD ? 'DISCIPLINED' : 'INCONSISTENT';

  // Transition detection: check if recent trajectory differs from overall
  const { transitionDetected, transitionDirection } = detectTransition(recentSessions, sessionsExpected, mode);

  // Status line — precise, honest, non-coercive
  const statusLine = buildStatusLine(mode, consistencyScore, transitionDetected, transitionDirection);

  return {
    mode,
    consistencyScore,
    sessionsCompleted,
    sessionsExpected,
    avgCompletionRate,
    streakRatio,
    transitionDetected,
    transitionDirection,
    statusLine,
  };
}

// ============================================
// HELPERS
// ============================================

function calculateAvgCompletionRate(sessions: WorkoutSession[]): number {
  const completed = sessions.filter((s) => s.completed_at && s.total_exercises > 0);
  if (completed.length === 0) return 0;
  const rates = completed.map((s) => s.completed_exercises / s.total_exercises);
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}

/**
 * Detect if user is transitioning between modes.
 * Compares first half vs second half of evaluation window.
 */
function detectTransition(
  sessions: WorkoutSession[],
  sessionsExpected: number,
  currentMode: BehavioralMode,
): { transitionDetected: boolean; transitionDirection: 'stabilizing' | 'advancing' | null } {
  if (sessions.length < 4) {
    return { transitionDetected: false, transitionDirection: null };
  }

  const midpoint = Date.now() - (EVALUATION_WINDOW_DAYS / 2) * 24 * 60 * 60 * 1000;

  const firstHalf = sessions.filter((s) => new Date(s.started_at).getTime() < midpoint);
  const secondHalf = sessions.filter((s) => new Date(s.started_at).getTime() >= midpoint);

  const halfExpected = Math.max(1, Math.round(sessionsExpected / 2));
  const firstRate = firstHalf.filter((s) => s.completed_at).length / halfExpected;
  const secondRate = secondHalf.filter((s) => s.completed_at).length / halfExpected;

  const delta = secondRate - firstRate;

  // Significant change = >0.3 difference between halves
  if (Math.abs(delta) < 0.3) {
    return { transitionDetected: false, transitionDirection: null };
  }

  if (delta > 0) {
    return { transitionDetected: true, transitionDirection: 'advancing' };
  }

  return { transitionDetected: true, transitionDirection: 'stabilizing' };
}

/**
 * Build a precise, honest status line. No pressure. No manipulation.
 * Reflects reality and supports growth.
 */
function buildStatusLine(
  mode: BehavioralMode,
  score: number,
  transitionDetected: boolean,
  direction: 'stabilizing' | 'advancing' | null,
): string {
  if (transitionDetected && direction === 'advancing') {
    return 'Consistency restored. System advancing intensity.';
  }

  if (transitionDetected && direction === 'stabilizing') {
    return 'Consistency has dipped. System adjusting for re-entry.';
  }

  if (mode === 'DISCIPLINED') {
    if (score >= 0.85) return 'High consistency. System optimizing for progression.';
    return 'Stable pattern detected. System maintaining challenge.';
  }

  // INCONSISTENT
  if (score < 0.2) return 'Getting started. System set to low resistance.';
  return 'Building rhythm. System adjusted for easier re-entry.';
}
