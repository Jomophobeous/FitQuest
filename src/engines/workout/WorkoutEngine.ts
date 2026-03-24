/**
 * Workout Engine
 *
 * Main orchestrator for the modular workout generation system.
 * Combines selectors, algorithms, and templates to generate workouts.
 */

import { generateSecureId } from '../../security/randomId';
import {
  getExercises,
  getUserProfile,
  getMuscleFatigue,
  getRecentSessions,
  getUserEquipment,
  getUserInjuries,
  getRecentExerciseIds,
} from '../../database/service';
import type { ExerciseWithDetails, UserProfile, Category, TargetMuscle, Difficulty } from '../../database/types';

// Selectors
import { applyHardFilters, scoreExercises, selectExercises } from './selectors/ExerciseSelector';
import { analyzeBalance, analyzePatternBalance, optimizeExerciseOrder } from './selectors/MuscleBalancer';

// Algorithms
import { applyFatigueDecay, getMuscleRecoveryStatus, shouldRecommendDeload } from './algorithms/FatigueAlgorithm';
import {
  recommendSetsForMuscle,
  recommendReps,
  recommendRestSeconds,
  estimateSessionDuration,
} from './algorithms/VolumeAlgorithm';

// Templates
import {
  suggestTemplate,
  getTemplateById,
  generateSlotsFromTemplate,
  FULL_BODY_TEMPLATE,
} from './templates/WorkoutTemplates';

// Types
import type { WorkoutContext, WorkoutPlan, PrescribedExercise, SelectionOptions, WorkoutEngineFlags } from './types';
import { DEFAULT_FLAGS } from './types';

// ============================================
// MAIN ENGINE CLASS
// ============================================

export class WorkoutEngine {
  private flags: WorkoutEngineFlags;

  constructor(flags: Partial<WorkoutEngineFlags> = {}) {
    this.flags = { ...DEFAULT_FLAGS, ...flags };
  }

  /**
   * Generate a complete workout plan
   */
  async generateWorkout(
    userId: string = 'user_local_001',
    options: Partial<SelectionOptions> = {},
  ): Promise<WorkoutPlan> {
    // Build context
    const context = await this.buildContext(userId);

    // Check for deload recommendation
    const sessionCount = (await getRecentSessions(userId, 28)).length;
    const needsDeload = shouldRecommendDeload(context.fatigue, sessionCount);

    if (needsDeload) {
      return this.generateDeloadWorkout(context, userId);
    }

    // Get appropriate template
    const sessionsThisWeek = (await getRecentSessions(userId, 7)).length;
    const template = suggestTemplate(context.profile.goal, context.profile.training_days_per_week, sessionsThisWeek);

    // Load and filter exercises
    const allExercises = await getExercises({
      categories: [context.profile.goal],
    });

    const selectionOptions: SelectionOptions = {
      minExercises: options.minExercises ?? 4,
      maxExercises: options.maxExercises ?? 6,
      targetDuration: options.targetDuration ?? context.profile.time_per_session_minutes,
      focusMuscles: options.focusMuscles,
      excludeMuscles: options.excludeMuscles,
      requirePatternBalance: options.requirePatternBalance ?? true,
    };

    // Apply hard filters
    const filtered = applyHardFilters(allExercises, context, selectionOptions);

    // Score and select
    const scored = scoreExercises(filtered, context, new Set());
    const selected = selectExercises(scored, selectionOptions);

    // Optimize order
    const ordered = this.flags.useMuscleBalancer ? optimizeExerciseOrder(selected) : selected;

    // Prescribe volume
    const prescribed = this.prescribeVolume(ordered, context, template.id);

    // Estimate duration
    const estimatedDuration = estimateSessionDuration(
      prescribed.map((p) => ({
        sets: p.sets,
        restSeconds: p.restSeconds,
        timePerSetSeconds: p.exercise.time_per_set_seconds,
      })),
    );

    // Collect metadata
    const targetMuscles = new Set<TargetMuscle>();
    const trainingTypes = new Set<string>();

    for (const p of prescribed) {
      (p.exercise.primary_muscles || []).forEach((m) => targetMuscles.add(m as TargetMuscle));
      (p.exercise.training_types || []).forEach((t) => trainingTypes.add(t.type));
    }

    return {
      id: await generateSecureId('workout'),
      userId,
      exercises: prescribed,
      estimatedDuration,
      targetMuscles: Array.from(targetMuscles),
      trainingTypes: Array.from(trainingTypes) as any[],
      generatedAt: new Date(),
      templateUsed: template.id,
    };
  }

  /**
   * Build workout context from database
   */
  private async buildContext(userId: string): Promise<WorkoutContext> {
    const profile = await getUserProfile(userId);
    if (!profile) {
      throw new Error(`User profile not found: ${userId}`);
    }

    // Get fatigue with decay applied
    const rawFatigue = await getMuscleFatigue(userId);
    const fatigue = this.flags.useNewFatigueModel ? applyFatigueDecay(rawFatigue) : this.legacyFatigueMap(rawFatigue);

    // Get injuries
    const injuryRecords = await getUserInjuries(userId);
    const injuries = new Map<TargetMuscle, 'mild' | 'moderate' | 'severe'>();
    for (const injury of injuryRecords) {
      injuries.set(injury.muscle as TargetMuscle, injury.severity);
    }

    // Get equipment
    const equipmentRecords = await getUserEquipment(userId);
    const equipment = new Set(equipmentRecords);

    // Get recent exercise IDs (last 48 hours)
    const recentSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recentIds = await getRecentExerciseIds(userId, recentSince);
    const recentExerciseIds = new Set(recentIds);

    // Weekly volume tracking (placeholder - would need actual tracking)
    const weeklyVolume = new Map<TargetMuscle, number>();

    return {
      profile,
      fatigue,
      injuries,
      equipment,
      recentExerciseIds,
      recentlyTrainedMuscles: new Set(),
      weeklyVolume,
    };
  }

  /**
   * Legacy fatigue map (simple pass-through)
   */
  private legacyFatigueMap(records: { muscle: string; fatigue_level: number }[]): Map<TargetMuscle, number> {
    const map = new Map<TargetMuscle, number>();
    for (const r of records) {
      map.set(r.muscle as TargetMuscle, r.fatigue_level);
    }
    return map;
  }

  /**
   * Prescribe volume for selected exercises
   */
  private prescribeVolume(
    exercises: ExerciseWithDetails[],
    context: WorkoutContext,
    templateId: string,
  ): PrescribedExercise[] {
    return exercises.map((exercise) => {
      const primaryMuscle = (exercise.primary_muscles || [])[0] as TargetMuscle;

      // Get sets recommendation
      let sets: number;
      if (this.flags.useVolumeLandmarks && primaryMuscle) {
        const currentVolume = context.weeklyVolume.get(primaryMuscle) || 0;
        sets = recommendSetsForMuscle(
          primaryMuscle,
          currentVolume,
          context.profile.training_days_per_week,
          context.profile.goal,
          context.profile.experience,
        );
      } else {
        // Legacy: fixed sets based on experience
        const setsMap: Record<Difficulty, number> = {
          beginner: 3,
          intermediate: 4,
          advanced: 4,
        };
        sets = setsMap[context.profile.experience];
      }

      // Get reps
      const reps = recommendReps(
        context.profile.goal,
        context.profile.experience,
        exercise.mechanic as 'compound' | 'isolation' | null,
      );

      // Get rest
      const restSeconds = recommendRestSeconds(
        context.profile.goal,
        exercise.mechanic as 'compound' | 'isolation' | null,
        exercise.difficulty,
      );

      return {
        exercise,
        sets,
        reps,
        restSeconds,
      };
    });
  }

  /**
   * Generate a reduced-intensity deload workout
   */
  private async generateDeloadWorkout(context: WorkoutContext, userId: string): Promise<WorkoutPlan> {
    const allExercises = await getExercises({
      categories: [context.profile.goal],
      difficulties: ['beginner'], // Easier exercises for deload
    });

    const options: SelectionOptions = {
      minExercises: 3,
      maxExercises: 4,
      requirePatternBalance: true,
    };

    const filtered = applyHardFilters(allExercises, context, options);
    const scored = scoreExercises(filtered, context, new Set());
    const selected = selectExercises(scored, options);

    // Reduced volume for deload
    const prescribed = selected.map((exercise) => ({
      exercise,
      sets: 2,
      reps: recommendReps(context.profile.goal, 'beginner'),
      restSeconds: 90,
      notes: 'Deload week - focus on form and recovery',
    }));

    const targetMuscles = new Set<TargetMuscle>();
    prescribed.forEach((p) => {
      (p.exercise.primary_muscles || []).forEach((m) => targetMuscles.add(m as TargetMuscle));
    });

    return {
      id: await generateSecureId('deload'),
      userId,
      exercises: prescribed,
      estimatedDuration: 25,
      targetMuscles: Array.from(targetMuscles),
      trainingTypes: ['recovery'],
      generatedAt: new Date(),
      templateUsed: 'deload',
    };
  }

  /**
   * Get recovery status for all muscles
   */
  async getRecoveryOverview(userId: string = 'user_local_001'): Promise<{
    muscles: ReturnType<typeof getMuscleRecoveryStatus>[];
    overallReadiness: number;
    recommendation: string;
  }> {
    const rawFatigue = await getMuscleFatigue(userId);
    const fatigueMap = applyFatigueDecay(rawFatigue);

    const muscles = Array.from(fatigueMap.entries()).map(([muscle, fatigue]) =>
      getMuscleRecoveryStatus(muscle, fatigue),
    );

    const readyCount = muscles.filter((m) => m.readyToTrain).length;
    const overallReadiness = Math.round((readyCount / Math.max(1, muscles.length)) * 100);

    let recommendation: string;
    if (overallReadiness >= 80) {
      recommendation = 'Great recovery! Ready for a challenging workout.';
    } else if (overallReadiness >= 50) {
      recommendation = 'Moderate recovery. Consider a moderate intensity workout.';
    } else {
      recommendation = 'Low recovery. Consider a light workout or rest day.';
    }

    return { muscles, overallReadiness, recommendation };
  }

  /**
   * Analyze balance for the week
   */
  async getWeeklyBalance(userId: string = 'user_local_001') {
    // Get sessions from this week
    const sessions = await getRecentSessions(userId, 7);

    // Aggregate volume per muscle (simplified)
    const weeklyVolume = new Map<TargetMuscle, number>();

    // Note: Would need to query session_exercises for actual volume
    // This is a placeholder implementation

    const profile = await getUserProfile(userId);
    const goal = profile?.goal || 'body_control';

    return analyzeBalance(weeklyVolume, goal);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let engineInstance: WorkoutEngine | null = null;

export function getWorkoutEngine(flags?: Partial<WorkoutEngineFlags>): WorkoutEngine {
  if (!engineInstance || flags) {
    engineInstance = new WorkoutEngine(flags);
  }
  return engineInstance;
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export * from './types';
export * from './selectors/ExerciseSelector';
export * from './selectors/MuscleBalancer';
export * from './algorithms/FatigueAlgorithm';
export * from './algorithms/VolumeAlgorithm';
export * from './templates/WorkoutTemplates';
