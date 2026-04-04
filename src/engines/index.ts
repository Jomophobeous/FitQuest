/**
 * FitQuest Engines Module
 *
 * Three engines that power the app:
 * - Workout Generator (brain)
 * - Progression Engine (improvement)
 * - Recovery Engine (burnout prevention)
 *
 * Plus critical supporting systems:
 * - Edge-Case Guards (graceful degradation)
 * - Transparency Layer (explainability)
 * - State Reset Doctrine (data integrity)
 */

// ENGINE 1: Workout Generator
export { generateWorkout, persistWorkout, createWorkout } from './workoutGenerator';

// ENGINE 2: Progression Engine
export {
  analyzeExerciseProgression,
  calculateProgression,
  recordExercisePerformance,
  recordSessionPerformance,
  getProgressionSummary,
  PROGRESSION_CONFIG,
  type ProgressionDecision,
  type ExercisePerformance,
} from './progressionEngine';

// ENGINE 3: Recovery & Deload Engine
export {
  getFatigueSnapshot,
  getAverageFatigue,
  accumulateFatigue,
  applyDailyRecoveryTick,
  needsRecoveryTick,
  checkDeloadStatus,
  incrementWeekCounter,
  startDeload,
  endDeload,
  isInDeload,
  generateRecoveryPlan,
  RECOVERY_CONFIG,
  type DeloadStatus,
  type FatigueSnapshot,
  type RecoveryPlan,
} from './recoveryEngine';

// NOTE: edgeCaseGuards, transparencyLayer, AdaptiveMemoryEngine, BehavioralSignalEngine,
// ConsistencyClassifier, TrialProgressionEngine, LongTermProgressionEngine, FailureAnalysisEngine,
// UserStateEngine, StateSimulationEngine, ComputationCache, stateResetDoctrine
// were removed in the FitQ2 core extraction. Re-add exports here when modules are rebuilt.

// ============================================
// UNIFIED SESSION FLOW
// ============================================

import { generateWorkout, persistWorkout } from './workoutGenerator';
import { recordSessionPerformance, type ExercisePerformance } from './progressionEngine';
import {
  accumulateFatigue,
  checkDeloadStatus,
  applyDailyRecoveryTick,
  needsRecoveryTick,
  isInDeload,
} from './recoveryEngine';
import { completeWorkoutSession, updateStreak } from '../database/service';
import { getExercisesByIds } from '../database/service';

/**
 * Complete workflow: Generate → User completes → Record → Update fatigue → Check deload
 */
export async function startWorkoutSession(userId: string) {
  // Check if recovery tick needed
  if (await needsRecoveryTick(userId)) {
    await applyDailyRecoveryTick(userId);
  }

  // Check deload status
  const deloadStatus = await checkDeloadStatus(userId);
  const inDeload = await isInDeload(userId);

  // Generate workout
  const workout = await generateWorkout(userId, inDeload || deloadStatus.severity === 'required');

  if (!workout) {
    return {
      success: false,
      error: 'Could not generate workout. Too many muscles fatigued.',
      deload_status: deloadStatus,
    };
  }

  // Persist the planned session
  await persistWorkout(userId, workout);

  return {
    success: true,
    workout,
    deload_status: deloadStatus,
  };
}

/**
 * Complete a workout session with performance data
 */
export async function completeSession(
  userId: string,
  sessionId: string,
  performances: ExercisePerformance[],
): Promise<{
  streak: { current: number; longest: number };
  progressionDecisions: Awaited<ReturnType<typeof recordSessionPerformance>>;
  deloadStatus: Awaited<ReturnType<typeof checkDeloadStatus>>;
}> {
  // 1. Record performances and get progression decisions
  const progressionDecisions = await recordSessionPerformance(userId, sessionId, performances);

  // 2. Update fatigue for each exercise (batch-load to avoid N+1)
  const exerciseIds = performances.map((p) => p.exercise_id);
  const exerciseMap = await getExercisesByIds(exerciseIds);

  for (const perf of performances) {
    const exercise = exerciseMap.get(perf.exercise_id);
    if (exercise) {
      await accumulateFatigue(userId, exercise.primary_muscles, exercise.secondary_muscles, perf.completed_sets);
    }
  }

  // 3. Mark session complete
  const completedCount = performances.filter((p) => p.success).length;
  const overallSuccess = completedCount >= performances.length * 0.8;
  await completeWorkoutSession(sessionId, completedCount, overallSuccess);

  // 4. Update streak
  const streak = await updateStreak(userId);

  // 5. Check if deload is now needed
  const deloadStatus = await checkDeloadStatus(userId);

  return {
    streak,
    progressionDecisions,
    deloadStatus,
  };
}
