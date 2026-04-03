/**
 * SERVICE — Micro-Rewards
 *
 * Subtle success/completion feedback delivered through existing
 * feedback toast + haptic system. No confetti, no childish animations.
 *
 * Designed to be called from workout completion flows and
 * dashboard load (for streak acknowledgment).
 *
 * Uses:
 * - checkMilestone / checkStreakMilestone → celebratory toast
 * - Workout completion → brief success confirmation
 * - Goal completion → acknowledgment toast
 *
 * All delivery through FeedbackProvider (useFeedback hook).
 */

import {
  checkMilestone,
  checkStreakMilestone,
  getMilestoneMessage,
} from './engagementNotificationService';
import type { GoalProgress } from './goalTracker';

// ============================================
// TYPES
// ============================================

export interface MicroReward {
  type: 'MILESTONE' | 'STREAK_MILESTONE' | 'WORKOUT_DONE' | 'GOAL_COMPLETE' | 'NONE';
  message: string;
  /** 'success' | 'info' for feedback toast variant */
  variant: 'success' | 'info';
}

// ============================================
// CORE — Post-Workout Rewards
// ============================================

/**
 * Evaluate what micro-reward to show after a workout completes.
 * Returns the highest-priority reward. Call once per completion.
 *
 * @param completedWorkouts Total lifetime completed workouts (after this one)
 * @param currentStreak Current streak count (after this workout)
 * @param goalProgress Current goal progress snapshot (optional)
 */
export async function evaluatePostWorkoutReward(
  completedWorkouts: number,
  currentStreak: number,
  goalProgress?: GoalProgress | null,
): Promise<MicroReward> {
  // Priority 1: Workout milestone (5, 10, 25, 50, 100)
  const milestone = await checkMilestone(completedWorkouts).catch(() => null);
  if (milestone) {
    return {
      type: 'MILESTONE',
      message: getMilestoneMessage(milestone),
      variant: 'success',
    };
  }

  // Priority 2: Streak milestone (3, 7, 14, 30, 60, 100)
  const streakMilestone = await checkStreakMilestone(currentStreak).catch(() => null);
  if (streakMilestone) {
    return {
      type: 'STREAK_MILESTONE',
      message: `${streakMilestone}-day streak! Keep it up.`,
      variant: 'success',
    };
  }

  // Priority 3: Weekly goal just completed
  if (goalProgress && goalProgress.overallProgress >= 1) {
    return {
      type: 'GOAL_COMPLETE',
      message: 'Weekly goal complete — well done.',
      variant: 'success',
    };
  }

  // Default: simple completion acknowledgment
  return {
    type: 'WORKOUT_DONE',
    message: 'Workout logged.',
    variant: 'info',
  };
}

// ============================================
// DASHBOARD LOAD — Streak acknowledgment
// ============================================

/**
 * Get a streak acknowledgment message for dashboard load.
 * Only returns a message for notable streaks (3+).
 * Does not consume milestones — read-only.
 */
export function getStreakAcknowledgment(currentStreak: number): string | null {
  if (currentStreak >= 30) return `${currentStreak}-day streak — unstoppable.`;
  if (currentStreak >= 14) return `${currentStreak} days strong.`;
  if (currentStreak >= 7) return `${currentStreak}-day streak — solid consistency.`;
  if (currentStreak >= 3) return `${currentStreak}-day streak. Keep going.`;
  return null;
}
