/**
 * FitQuest Edge-Case Guards
 * 
 * Ensures the system never produces empty/broken workouts
 * by gracefully relaxing constraints when filter pool is depleted.
 */

import { getExercises, getMuscleFatigue, getUserProfile } from '../database/service';
import type { Exercise, ExerciseFilter, UserProfile, MuscleFatigue, TargetMuscle, ExerciseWithDetails } from '../database/types';
import { RECOVERY_CONFIG } from './recoveryEngine';

// ============================================
// CONFIGURATION
// ============================================

export const GUARD_CONFIG = {
  // Minimum exercises required for a valid workout
  minimum_exercises: 3,
  
  // Minimum exercises per pattern before relaxing
  minimum_per_pattern: 1,
  
  // Constraint relaxation order (lowest priority first)
  relaxation_order: [
    'variety_filter',      // First: allow repeats from recent sessions
    'fatigue_threshold',   // Second: raise fatigue tolerance
    'difficulty_match',    // Third: allow off-difficulty exercises
    'equipment_strict',    // Fourth: suggest bodyweight alternatives
    'goal_alignment',      // Last resort: cross-goal exercises
  ] as const,
  
  // Fatigue relaxation steps (percentage points)
  fatigue_relaxation_steps: [10, 20, 30],
  
  // Deload minimum exercises (should still feel like a workout)
  deload_minimum_exercises: 3,
};

// ============================================
// TYPES
// ============================================

export interface GuardResult {
  success: boolean;
  exercises: Exercise[];
  relaxations_applied: string[];
  warnings: string[];
}

export interface ConstraintState {
  variety_filter: boolean;
  fatigue_threshold: number;
  difficulty_match: boolean;
  equipment_strict: boolean;
  goal_alignment: boolean;
}

// ============================================
// MAIN GUARD FUNCTION
// ============================================

/**
 * Attempts to find valid exercises, progressively relaxing constraints
 * if the pool is too small.
 */
export async function findValidExercisesWithGuards(
  userId: string,
  baseFilter: ExerciseFilter,
  isDeload: boolean = false
): Promise<GuardResult> {
  const relaxations_applied: string[] = [];
  const warnings: string[] = [];
  
  const minRequired = isDeload 
    ? GUARD_CONFIG.deload_minimum_exercises 
    : GUARD_CONFIG.minimum_exercises;

  // Start with strictest constraints
  let currentFilter = { ...baseFilter };
  let exercises = await getExercises(currentFilter);

  // If we have enough, return immediately
  if (exercises.length >= minRequired) {
    return {
      success: true,
      exercises,
      relaxations_applied,
      warnings,
    };
  }

  // Progressive relaxation
  for (const relaxation of GUARD_CONFIG.relaxation_order) {
    switch (relaxation) {
      case 'variety_filter':
        // Allow exercises from recent sessions
        relaxations_applied.push('variety_filter');
        warnings.push('Some exercises may repeat from recent sessions');
        // Variety is handled at selection level, not filter level
        break;

      case 'fatigue_threshold':
        // Raise fatigue tolerance in steps
        for (const step of GUARD_CONFIG.fatigue_relaxation_steps) {
          const newThreshold = RECOVERY_CONFIG.fatigue_soft_threshold + step;
          relaxations_applied.push(`fatigue_threshold_+${step}`);
          warnings.push(`Fatigue tolerance raised by ${step}%`);
          
          // Re-query with relaxed mental model (actual filtering is separate)
          exercises = await getExercises(currentFilter);
          if (exercises.length >= minRequired) {
            return { success: true, exercises, relaxations_applied, warnings };
          }
        }
        break;

      case 'difficulty_match':
        // Allow adjacent difficulty levels
        currentFilter = {
          ...currentFilter,
          difficulties: undefined, // Remove difficulty constraint
        };
        relaxations_applied.push('difficulty_match');
        warnings.push('Difficulty constraints relaxed');
        exercises = await getExercises(currentFilter);
        if (exercises.length >= minRequired) {
          return { success: true, exercises, relaxations_applied, warnings };
        }
        break;

      case 'equipment_strict':
        // Fall back to bodyweight exercises
        currentFilter = {
          ...currentFilter,
          equipment_levels: ['none'],
        };
        relaxations_applied.push('equipment_strict');
        warnings.push('Falling back to bodyweight exercises');
        exercises = await getExercises(currentFilter);
        if (exercises.length >= minRequired) {
          return { success: true, exercises, relaxations_applied, warnings };
        }
        break;

      case 'goal_alignment':
        // Remove category filter as last resort
        currentFilter = {
          ...currentFilter,
          categories: undefined,
        };
        relaxations_applied.push('goal_alignment');
        warnings.push('Using cross-category exercises');
        exercises = await getExercises(currentFilter);
        if (exercises.length >= minRequired) {
          return { success: true, exercises, relaxations_applied, warnings };
        }
        break;
    }
  }

  // If still not enough, return what we have with failure flag
  return {
    success: exercises.length > 0,
    exercises,
    relaxations_applied,
    warnings: [
      ...warnings,
      exercises.length === 0 
        ? 'No valid exercises found. Please adjust your profile settings.'
        : `Only ${exercises.length} exercises available. Workout may be shorter than usual.`,
    ],
  };
}

// ============================================
// DELOAD WORKOUT GUARDS
// ============================================

/**
 * Ensures deload sessions don't feel "empty"
 * by guaranteeing meaningful movement patterns.
 */
export async function ensureDeloadQuality(
  exercises: Exercise[],
  userId: string
): Promise<{
  exercises: Exercise[];
  adjustments: string[];
}> {
  const adjustments: string[] = [];
  
  if (exercises.length < GUARD_CONFIG.deload_minimum_exercises) {
    // Try to add low-intensity mobility work
    const mobilityExercises = await getExercises({
      categories: ['mobility'],
      difficulties: ['beginner'],
    });
    
    const needed = GUARD_CONFIG.deload_minimum_exercises - exercises.length;
    const additions = mobilityExercises
      .filter(m => !exercises.find(e => e.id === m.id))
      .slice(0, needed);
    
    if (additions.length > 0) {
      exercises = [...exercises, ...additions];
      adjustments.push(`Added ${additions.length} mobility exercise(s) to fill deload session`);
    }
  }

  // Ensure at least one movement is present
  if (exercises.length > 0) {
    adjustments.push('Deload includes recovery-focused movement');
  }

  return { exercises, adjustments };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Pre-flight check before workout generation
 */
export async function validateWorkoutCanGenerate(
  userId: string
): Promise<{
  canGenerate: boolean;
  blockers: string[];
  recommendations: string[];
}> {
  const blockers: string[] = [];
  const recommendations: string[] = [];

  // Check user profile exists
  const profile = await getUserProfile(userId);
  if (!profile) {
    blockers.push('User profile not found. Please complete onboarding.');
    return { canGenerate: false, blockers, recommendations };
  }

  // Check if profile is locked (required for workout generation)
  if (!profile.locked) {
    blockers.push('Profile must be locked before generating workouts.');
    return { canGenerate: false, blockers, recommendations };
  }

  // Check exercise availability for user's category
  const exercises = await getExercises({ categories: [profile.goal] });
  if (exercises.length === 0) {
    blockers.push(`No exercises available for goal: ${profile.goal}`);
    return { canGenerate: false, blockers, recommendations };
  }

  if (exercises.length < GUARD_CONFIG.minimum_exercises) {
    recommendations.push(
      `Limited exercise variety for ${profile.goal}. Consider expanding equipment options.`
    );
  }

  // Check fatigue levels
  const fatigue = await getMuscleFatigue(userId);
  const criticalFatigue = fatigue.filter(
    f => f.fatigue_level >= RECOVERY_CONFIG.fatigue_critical_threshold
  );
  
  if (criticalFatigue.length > 3) {
    recommendations.push(
      'Multiple muscle groups at critical fatigue. Consider a rest day or deload.'
    );
  }

  return {
    canGenerate: blockers.length === 0,
    blockers,
    recommendations,
  };
}

/**
 * Ensure at least one valid exercise exists at all times
 * This is the absolute minimum fallback.
 */
export async function getEmergencyFallbackExercise(): Promise<Exercise | null> {
  // Try bodyweight, beginner, any category
  const fallbacks = await getExercises({
    equipment_levels: ['none'],
    difficulties: ['beginner'],
  });

  if (fallbacks.length > 0) {
    return fallbacks[0];
  }

  // Absolute fallback: any exercise
  const any = await getExercises({});
  return any.length > 0 ? any[0] : null;
}
