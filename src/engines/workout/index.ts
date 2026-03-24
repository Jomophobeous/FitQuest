/**
 * Workout Engine Module
 *
 * Modular workout generation system with:
 * - Configurable selectors for exercise filtering/scoring
 * - Advanced algorithms for fatigue and volume
 * - Template system for different training splits
 * - Feature flags for A/B testing
 *
 * Usage:
 * ```typescript
 * import { getWorkoutEngine } from './workout';
 *
 * const engine = getWorkoutEngine();
 * const workout = await engine.generateWorkout('user_local_001');
 * ```
 */

export { WorkoutEngine, getWorkoutEngine } from './WorkoutEngine';

export type {
  WorkoutContext,
  WorkoutPlan,
  PrescribedExercise,
  SelectionOptions,
  ScoredExercise,
  ScoreBreakdown,
  VolumeLandmarks,
  FatigueParams,
  MuscleRecoveryStatus,
  WorkoutTemplate,
  TemplateSlot,
  WorkoutEngineFlags,
  AdaptiveTrainingProfile,
} from './types';

export { DEFAULT_FLAGS } from './types';

// Selectors
export { applyHardFilters, scoreExercises, selectExercises, selectByFocusMuscles } from './selectors/ExerciseSelector';

export {
  analyzeBalance,
  analyzePatternBalance,
  isPatternBalanced,
  getMissingPatterns,
  optimizeExerciseOrder,
  suggestTrainingSplit,
  calculateMuscleOverlap,
} from './selectors/MuscleBalancer';

// Algorithms
export {
  calculateCurrentFatigue,
  calculateTrainingFatigue,
  estimateRecoveryTime,
  getMuscleRecoveryStatus,
  applyFatigueDecay,
  calculateLegacyFatigue,
  shouldRecommendDeload,
} from './algorithms/FatigueAlgorithm';

export {
  getVolumeLandmarks,
  recommendSetsForMuscle,
  recommendReps,
  recommendRestSeconds,
  estimateSessionDuration,
  recommendVolumeAdjustment,
  checkVolumeLimits,
} from './algorithms/VolumeAlgorithm';

// Templates
export {
  FULL_BODY_TEMPLATE,
  PUSH_TEMPLATE,
  PULL_TEMPLATE,
  LEGS_TEMPLATE,
  UPPER_TEMPLATE,
  LOWER_TEMPLATE,
  MOBILITY_TEMPLATE,
  CORE_TEMPLATE,
  ALL_TEMPLATES,
  getTemplateById,
  getTemplatesForGoal,
  generateSlotsFromTemplate,
  suggestTemplate,
} from './templates/WorkoutTemplates';

// Legacy Adapter (for backward compatibility)
export {
  generateWorkoutUnified,
  getRecoveryOverviewUnified,
  adaptWorkoutPlanToLegacy,
  shouldUseNewEngine,
  setUseNewEngine,
  type LegacyGeneratedWorkout,
  type LegacySessionIntent,
} from './legacyAdapter';
