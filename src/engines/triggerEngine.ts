/**
 * ENGINE — Behavioral Trigger Engine
 *
 * Lightweight trigger check that evaluates user state and returns
 * actionable nudges. Runs on dashboard load via UserStateEngine cache.
 *
 * No scheduling. No timers. Pure function evaluation.
 * All inputs from UserStateEngine + goalTracker (existing data).
 */

import { type UserState, getCachedUserState, getUserState } from './UserStateEngine';
import { getGoalProgress, type GoalProgress } from '../services/goalTracker';

// ============================================
// TYPES
// ============================================

export type TriggerType =
  | 'COMEBACK_CTA'
  | 'STREAK_AT_RISK'
  | 'GOAL_ALMOST_DONE'
  | 'DELOAD_SUGGESTION'
  | 'NONE';

export interface TriggerResult {
  type: TriggerType;
  /** Short headline for UI */
  headline: string;
  /** Supporting detail */
  subtext: string;
  /** Suggested route to navigate to (optional) */
  actionRoute?: string;
  /** Priority 1-5, higher = more important */
  priority: number;
}

// ============================================
// CORE
// ============================================

/**
 * Evaluate behavioral triggers for the current user.
 * Returns the highest-priority trigger, or NONE.
 *
 * Uses cached UserState when available (no async in hot path).
 * Falls back to async fetch if cache is cold.
 */
export async function evaluateTriggers(
  userId: string,
  isSubscribed = false,
): Promise<TriggerResult> {
  const state = getCachedUserState() ?? await getUserState(userId, isSubscribed).catch(() => null);
  if (!state) return NONE_TRIGGER;

  const goalProgress = await getGoalProgress(userId).catch(() => null);

  const triggers: TriggerResult[] = [];

  // 1. Comeback CTA — 2+ days inactive
  if (state.daysSinceLastWorkout !== null && state.daysSinceLastWorkout >= 2) {
    triggers.push({
      type: 'COMEBACK_CTA',
      headline: state.daysSinceLastWorkout >= 5
        ? 'Time to get back on track'
        : "You haven't trained in a while",
      subtext: `${state.daysSinceLastWorkout} days since your last workout`,
      actionRoute: '/fitquest?autostart=1',
      priority: state.daysSinceLastWorkout >= 5 ? 5 : 3,
    });
  }

  // 2. Streak at risk — has streak > 1 but no workout today
  if (state.streak > 1 && state.daysSinceLastWorkout !== null && state.daysSinceLastWorkout >= 1) {
    triggers.push({
      type: 'STREAK_AT_RISK',
      headline: `${state.streak}-day streak at risk`,
      subtext: 'Train today to keep your streak alive',
      actionRoute: '/fitquest?autostart=1',
      priority: 4,
    });
  }

  // 3. Goal almost done — >75% weekly goal
  if (goalProgress && goalProgress.overallProgress >= 0.75 && goalProgress.overallProgress < 1) {
    const remaining = Math.max(0, goalProgress.goals.workoutsTarget - goalProgress.workoutsDone);
    triggers.push({
      type: 'GOAL_ALMOST_DONE',
      headline: 'Almost there!',
      subtext: remaining > 0
        ? `${remaining} more workout${remaining > 1 ? 's' : ''} to hit your weekly goal`
        : 'Just a bit more effort to complete your goal',
      actionRoute: '/fitquest?autostart=1',
      priority: 3,
    });
  }

  // 4. Deload suggestion — high fatigue tier
  if (state.fatigueTier === 'HIGH' && state.deloadStatus.should_deload) {
    triggers.push({
      type: 'DELOAD_SUGGESTION',
      headline: 'Recovery week recommended',
      subtext: 'Your body needs lighter training to recover',
      priority: 2,
    });
  }

  // Return highest priority or NONE
  if (triggers.length === 0) return NONE_TRIGGER;
  triggers.sort((a, b) => b.priority - a.priority);
  return triggers[0]!;
}

// ============================================
// CONSTANTS
// ============================================

const NONE_TRIGGER: TriggerResult = {
  type: 'NONE',
  headline: '',
  subtext: '',
  priority: 0,
};
