/**
 * Legacy Adapter
 * 
 * Provides backward compatibility between the new modular WorkoutEngine
 * and the legacy GeneratedWorkout format used by useFitQuestWorkout hook.
 * 
 * Migration Guide:
 * 1. Use USE_NEW_ENGINE flag to A/B test
 * 2. When confident, update hook to use new types directly
 * 3. Remove this adapter
 */

import { getWorkoutEngine, WorkoutPlan, PrescribedExercise, WorkoutEngineFlags, MuscleRecoveryStatus } from './index';
import type { ExerciseWithDetails, TargetMuscle, Category } from '../../database/types';
import { getAppState, setAppState } from '../../database/service';

// ============================================
// LEGACY TYPES (from workoutGenerator.ts)
// ============================================

export interface LegacySessionIntent {
  muscle_focus: TargetMuscle[];
  training_style: 'strength' | 'hypertrophy' | 'endurance' | 'mixed';
  is_deload: boolean;
  category: Category;
}

export interface LegacyGeneratedWorkout {
  session_id: string;
  exercises: {
    exercise: ExerciseWithDetails;
    sets: number;
    reps: string;
    order: number;
  }[];
  total_duration_estimate: number;
  intent: LegacySessionIntent;
}

// ============================================
// FEATURE FLAG
// ============================================

const FEATURE_FLAG_KEY = 'feature_use_new_workout_engine';

/**
 * Check if new workout engine should be used
 */
export async function shouldUseNewEngine(): Promise<boolean> {
  try {
    const value = await getAppState(FEATURE_FLAG_KEY);
    return value === 'true';
  } catch {
    return false; // Default to legacy
  }
}

/**
 * Enable/disable new workout engine
 */
export async function setUseNewEngine(enabled: boolean): Promise<void> {
  await setAppState(FEATURE_FLAG_KEY, enabled ? 'true' : 'false');
}

// ============================================
// ADAPTER FUNCTIONS
// ============================================

/**
 * Convert new WorkoutPlan to legacy GeneratedWorkout format
 */
export function adaptWorkoutPlanToLegacy(plan: WorkoutPlan): LegacyGeneratedWorkout {
  return {
    session_id: plan.id,
    exercises: plan.exercises.map((pe, index) => ({
      exercise: pe.exercise,
      sets: pe.sets,
      reps: pe.reps,
      order: index + 1,
    })),
    total_duration_estimate: plan.estimatedDuration,
    intent: {
      muscle_focus: plan.targetMuscles,
      training_style: determineTrainingStyle(plan),
      is_deload: plan.templateUsed === 'deload',
      category: plan.exercises[0]?.exercise.category ?? 'body_control',
    },
  };
}

/**
 * Determine training style from workout plan
 */
function determineTrainingStyle(
  plan: WorkoutPlan
): 'strength' | 'hypertrophy' | 'endurance' | 'mixed' {
  const avgSets = plan.exercises.reduce((sum, e) => sum + e.sets, 0) / plan.exercises.length;
  const avgRepsLow = plan.exercises.reduce((sum, e) => {
    const match = e.reps.match(/^(\d+)/);
    return sum + (match ? parseInt(match[1], 10) : 8);
  }, 0) / plan.exercises.length;
  
  if (avgSets >= 4 && avgRepsLow <= 6) return 'strength';
  if (avgSets >= 3 && avgRepsLow >= 8 && avgRepsLow <= 12) return 'hypertrophy';
  if (avgRepsLow >= 12) return 'endurance';
  return 'mixed';
}

/**
 * Determine training style from training types array
 */
function determineStyleFromTypes(
  types: string[] = []
): 'strength' | 'hypertrophy' | 'endurance' | 'mixed' {
  if (types.includes('strength')) return 'strength';
  if (types.includes('hypertrophy')) return 'hypertrophy';
  if (types.includes('endurance')) return 'endurance';
  return 'mixed';
}

// ============================================
// UNIFIED GENERATE FUNCTION
// ============================================

/**
 * Generate workout using either new or legacy engine based on feature flag
 * 
 * @param userId User ID (defaults to 'user_local_001')
 * @param deloadFlag Force deload workout
 * @param forceNewEngine Override feature flag to use new engine
 */
export async function generateWorkoutUnified(
  userId: string = 'user_local_001',
  deloadFlag: boolean = false,
  forceNewEngine?: boolean
): Promise<LegacyGeneratedWorkout | null> {
  const useNew = forceNewEngine ?? (await shouldUseNewEngine());
  
  if (useNew) {
    try {
      const engine = getWorkoutEngine();
      const plan = await engine.generateWorkout(userId, {});
      return adaptWorkoutPlanToLegacy(plan);
    } catch (error) {
      console.warn('[LegacyAdapter] New engine failed, falling back to legacy:', error);
      // Fall through to legacy
    }
  }
  
  // Use legacy generator
  const { generateWorkout } = await import('../workoutGenerator');
  const legacyResult = await generateWorkout(userId, deloadFlag);
  if (!legacyResult) return null;
  
  // Adapt legacy result to our unified type
  return {
    session_id: legacyResult.session_id,
    exercises: legacyResult.exercises,
    total_duration_estimate: legacyResult.total_duration_estimate,
    intent: {
      muscle_focus: legacyResult.intent.focus_muscles || [],
      training_style: determineStyleFromTypes(legacyResult.intent.training_types),
      is_deload: legacyResult.intent.is_deload,
      category: legacyResult.exercises[0]?.exercise.category || 'body_control',
    },
  };
}

/**
 * Get recovery overview using new engine
 */
export async function getRecoveryOverviewUnified(
  userId: string = 'user_local_001'
): Promise<{
  muscles: MuscleRecoveryStatus[];
  overallReadiness: number;
  recommendation: string;
}> {
  const engine = getWorkoutEngine();
  return engine.getRecoveryOverview(userId);
}
