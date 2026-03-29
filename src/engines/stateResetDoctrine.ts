/**
 * FitQuest State Reset Doctrine
 *
 * Defines EXACTLY what happens when user modifies their profile.
 * Ambiguity causes silent corruption. This prevents it.
 *
 * RULES:
 * 1. Immutable data NEVER changes (exercises, completed sessions)
 * 2. Profile changes trigger explicit state transitions
 * 3. History is preserved but may be "archived" (not invalidated)
 */

import { getAppState, setAppState } from '../database/service';
import type { UserProfile, Category } from '../database/types';

// ============================================
// DOCTRINE DEFINITIONS
// ============================================

/**
 * What data belongs to which lifecycle
 */
export const STATE_LIFECYCLE = {
  // IMMUTABLE: Never changes after creation
  immutable: [
    'exercise_catalogue', // Core exercise database
    'completed_sessions', // Historical workout records
    'progress_records', // Append-only progression log
    'subscription_receipts', // Payment history
  ],

  // PROFILE_BOUND: Resets or archives when profile changes significantly
  profile_bound: [
    'muscle_fatigue_map', // Current fatigue state
    'workout_streak', // Consecutive workout count
    'current_week_counter', // Deload cycle position
    'deload_state', // Active deload flag
  ],

  // PREFERENCE_BOUND: Updates with profile but preserves history
  preference_bound: [
    'user_equipment', // Available equipment list
    'user_injuries', // Active injury constraints
    'time_preference', // Session duration preference
  ],

  // TRANSIENT: Can be safely cleared anytime
  transient: [
    'cached_workout', // Uncommitted workout plan
    'ui_state', // Screen position, filters
    'notification_queue', // Pending reminders
  ],
} as const;

// ============================================
// RESET TRIGGERS
// ============================================

export type ProfileChangeType =
  | 'goal_change' // User changes primary goal (e.g., body_control → strength)
  | 'experience_change' // User changes experience level
  | 'equipment_change' // User adds/removes equipment
  | 'injury_change' // User adds/removes injury
  | 'time_change' // User changes session duration
  | 'profile_unlock'; // User unlocks profile for editing

/**
 * Maps profile changes to their consequences
 */
export const RESET_CONSEQUENCES: Record<
  ProfileChangeType,
  {
    description: string;
    resets: string[];
    preserves: string[];
    archives: string[];
    user_warning: string;
  }
> = {
  goal_change: {
    description: 'Changing your fitness goal',
    resets: [
      'muscle_fatigue_map', // Different muscles matter now
      'current_week_counter', // Deload cycle restarts
      'workout_streak', // New journey begins
    ],
    preserves: [
      'completed_sessions', // History stays
      'progress_records', // All progress kept
      'user_equipment', // Equipment unchanged
    ],
    archives: [
      'progression_targets', // Old targets archived, new ones created
    ],
    user_warning:
      'Changing your goal will reset your current streak and fatigue tracking. Your workout history will be preserved.',
  },

  experience_change: {
    description: 'Updating your experience level',
    resets: [
      'current_week_counter', // Deload timing may differ
    ],
    preserves: [
      'muscle_fatigue_map', // Fatigue is physical, not skill
      'workout_streak', // Effort counts
      'progress_records', // All history kept
    ],
    archives: [],
    user_warning: 'Your workout intensity will adjust to match your new experience level.',
  },

  equipment_change: {
    description: 'Modifying available equipment',
    resets: [],
    preserves: ['muscle_fatigue_map', 'workout_streak', 'progress_records', 'current_week_counter'],
    archives: [],
    user_warning: 'Exercise selection will update based on your equipment. Progress is preserved.',
  },

  injury_change: {
    description: 'Updating injury constraints',
    resets: [],
    preserves: ['workout_streak', 'progress_records', 'current_week_counter'],
    archives: [],
    user_warning: 'Exercises targeting injured areas will be filtered out. Your progress remains intact.',
  },

  time_change: {
    description: 'Changing session duration preference',
    resets: [],
    preserves: ['muscle_fatigue_map', 'workout_streak', 'progress_records', 'current_week_counter'],
    archives: [],
    user_warning: 'Workout volume will adjust to fit your available time.',
  },

  profile_unlock: {
    description: 'Unlocking profile for editing',
    resets: [],
    preserves: ['muscle_fatigue_map', 'workout_streak', 'progress_records', 'current_week_counter'],
    archives: [],
    user_warning: 'You can now edit your profile. Changes will take effect after re-locking.',
  },
};

// ============================================
// STATE RESET FUNCTIONS
// ============================================

/**
 * Build a user-scoped app state key
 */
function userKey(userId: string, key: string): string {
  return `${userId}:${key}`;
}

/**
 * Execute state reset based on profile change type
 */
export async function executeStateReset(
  userId: string,
  changeType: ProfileChangeType,
): Promise<{
  success: boolean;
  changes_made: string[];
  data_preserved: string[];
}> {
  const consequence = RESET_CONSEQUENCES[changeType];
  const changes_made: string[] = [];
  const data_preserved: string[] = [...consequence.preserves];

  for (const field of consequence.resets) {
    switch (field) {
      case 'muscle_fatigue_map':
        await resetMuscleFatigue(userId);
        changes_made.push('Muscle fatigue reset to baseline');
        break;

      case 'current_week_counter':
        await setAppState(userKey(userId, 'current_week'), '1');
        changes_made.push('Deload cycle counter reset');
        break;

      case 'workout_streak':
        await setAppState(userKey(userId, 'workout_streak'), '0');
        changes_made.push('Workout streak reset');
        break;

      case 'deload_state':
        await setAppState(userKey(userId, 'in_deload'), 'false');
        await setAppState(userKey(userId, 'deload_end_date'), '');
        changes_made.push('Deload state cleared');
        break;
    }
  }

  // Log the reset event
  await setAppState(
    userKey(userId, 'last_profile_change'),
    JSON.stringify({
      type: changeType,
      timestamp: new Date().toISOString(),
      resets: consequence.resets,
    }),
  );

  return {
    success: true,
    changes_made,
    data_preserved,
  };
}

/**
 * Reset muscle fatigue to baseline (0%)
 */
async function resetMuscleFatigue(userId: string): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { updateMuscleFatigue } = await import('../database/service');

  const muscles = [
    'chest',
    'upper_back',
    'lats',
    'lower_back',
    'front_delts',
    'side_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'forearms',
    'abs',
    'obliques',
    'hip_flexors',
    'quads',
    'hamstrings',
    'glutes',
    'adductors',
    'abductors',
    'calves',
    'tibialis',
    'neck',
    'traps',
  ] as const;

  for (const muscle of muscles) {
    await updateMuscleFatigue(userId, muscle as any, 0);
  }
}

// ============================================
// VALIDATION & SAFETY
// ============================================

/**
 * Check if a profile change is safe to make
 */
export function validateProfileChange(
  currentProfile: UserProfile,
  proposedChanges: Partial<UserProfile>,
): {
  safe: boolean;
  change_type: ProfileChangeType | null;
  warnings: string[];
  requires_confirmation: boolean;
} {
  const warnings: string[] = [];
  let change_type: ProfileChangeType | null = null;
  let requires_confirmation = false;

  // Goal change is most significant
  if (proposedChanges.goal && proposedChanges.goal !== currentProfile.goal) {
    change_type = 'goal_change';
    warnings.push(RESET_CONSEQUENCES.goal_change.user_warning);
    requires_confirmation = true;
  }

  // Experience change
  if (proposedChanges.experience && proposedChanges.experience !== currentProfile.experience) {
    change_type = change_type || 'experience_change';
    warnings.push(RESET_CONSEQUENCES.experience_change.user_warning);
  }

  // Time change
  if (
    proposedChanges.time_per_session_minutes &&
    proposedChanges.time_per_session_minutes !== currentProfile.time_per_session_minutes
  ) {
    change_type = change_type || 'time_change';
    warnings.push(RESET_CONSEQUENCES.time_change.user_warning);
  }

  return {
    safe: true, // All changes are technically safe, just have consequences
    change_type,
    warnings,
    requires_confirmation,
  };
}

/**
 * Get user-facing summary of what will happen
 */
export function getResetSummary(changeType: ProfileChangeType): {
  title: string;
  description: string;
  will_reset: string[];
  will_preserve: string[];
  confirmation_message: string;
} {
  const consequence = RESET_CONSEQUENCES[changeType];

  return {
    title: consequence.description,
    description: consequence.user_warning,
    will_reset: consequence.resets.map(formatFieldName),
    will_preserve: consequence.preserves.map(formatFieldName),
    confirmation_message: `Are you sure you want to proceed? ${consequence.user_warning}`,
  };
}

function formatFieldName(field: string): string {
  const names: Record<string, string> = {
    muscle_fatigue_map: 'Current muscle fatigue levels',
    current_week_counter: 'Training week counter',
    workout_streak: 'Consecutive workout streak',
    deload_state: 'Active deload period',
    completed_sessions: 'Workout history',
    progress_records: 'Exercise progression data',
    user_equipment: 'Equipment settings',
    progression_targets: 'Current exercise targets',
  };
  return names[field] || field;
}

// ============================================
// HISTORY PRESERVATION
// ============================================

/**
 * Archive old progression data when goal changes
 * (Data is preserved but tagged as "previous goal")
 */
export async function archiveProgressionForGoalChange(
  userId: string,
  oldGoal: Category,
  newGoal: Category,
): Promise<void> {
  const archive = {
    archived_at: new Date().toISOString(),
    previous_goal: oldGoal,
    new_goal: newGoal,
    reason: 'goal_change',
  };

  // Store archive marker in app state
  const existingArchives = await getAppState(userKey(userId, 'progression_archives'));
  let archives: any[] = [];
  if (existingArchives) {
    try {
      archives = JSON.parse(existingArchives);
    } catch {
      /* corrupted, reset */
    }
  }
  archives.push(archive);

  await setAppState(userKey(userId, 'progression_archives'), JSON.stringify(archives));
}

/**
 * Check if user has historical data from a previous goal
 */
export async function hasArchivedData(userId: string): Promise<boolean> {
  const archives = await getAppState(userKey(userId, 'progression_archives'));
  if (!archives) return false;
  try {
    return JSON.parse(archives).length > 0;
  } catch {
    return false;
  }
}

// ============================================
// EXPORT DOCTRINE FOR DOCUMENTATION
// ============================================

export const STATE_RESET_DOCTRINE = {
  version: '1.0.0',
  last_updated: '2026-02-05',
  principles: [
    'Immutable data (exercises, completed sessions) NEVER changes',
    'Profile-bound state resets when user changes fundamental goals',
    'History is preserved but may be archived, not deleted',
    'Users receive explicit warnings before consequential changes',
    'All resets are logged for debugging and support',
  ],
  lifecycle: STATE_LIFECYCLE,
  consequences: RESET_CONSEQUENCES,
};
