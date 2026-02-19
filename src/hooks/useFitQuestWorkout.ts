/**
 * FitQuest Workout Hook
 * Integrates all three engines for workout generation, progression, and recovery
 */

import { useState, useCallback } from 'react';
import { useDatabase, DEFAULT_USER_ID } from '../context/DatabaseContext';

// Engine imports
import {
  generateWorkout,
  recordSessionPerformance,
  getFatigueSnapshot,
  checkDeloadStatus,
  applyDailyRecoveryTick,
  needsRecoveryTick,
  accumulateFatigue,
  type ExercisePerformance,
  type ProgressionDecision,
} from '../engines';

import {
  generateWorkoutSummary,
  generatePostWorkoutSummary,
} from '../engines/transparencyLayer';

import {
  validateWorkoutCanGenerate,
} from '../engines/edgeCaseGuards';

import {
  getExerciseById,
  completeWorkoutSession,
  updateStreak,
} from '../database/service';

import { awardWorkoutXP } from '../services/xpService';
import { generateRichAudio } from '../services/audioService';
import { flushAnalyticsQueue, queueAnalyticsEvent } from '../services/analyticsIngestionService';
import { updateAdaptiveTrainingProfileFromSession } from '../services/adaptiveTrainingService';
import { evaluatePostWorkoutPolicyDecision } from '../services/autonomousPolicyRuntime';

import type { TargetMuscle, ExerciseWithDetails } from '../database/types';

// ============================================
// TYPES
// ============================================

export interface GeneratedWorkoutDisplay {
  id: string;
  exercises: WorkoutExerciseDisplay[];
  totalDuration: number;
  isDeload: boolean;
  explanation: string;
  warnings: string[];
}

export interface WorkoutExerciseDisplay {
  id: string;
  exerciseId: string;
  name: string;
  category: string;
  sets: number;
  reps: string;
  restSeconds: number;
  instructions: string[];
  completed: boolean;
  difficulty?: number;
  // Audio instruction fields for TTS
  audioIntro: string;
  audioSetup: string;
  audioExecution: string;
  audioTransition: string;
}

export interface WorkoutState {
  status: 'idle' | 'generating' | 'ready' | 'in_progress' | 'completed' | 'error';
  workout: GeneratedWorkoutDisplay | null;
  currentExerciseIndex: number;
  startTime: Date | null;
  error: string | null;
}

/** Rich completion data returned by finishWorkout() */
export interface WorkoutCompletionData {
  summary: string;
  streak: { current: number; longest: number };
  completedCount: number;
  totalCount: number;
  durationSeconds: number;
  xpEarned: number;
  level: number;
  levelUp: boolean;
  newLevel?: number;
  progressions: number;
  regressions: number;
  exerciseNames: string[];
  musclesWorked: string[];
}

// ============================================
// HOOK
// ============================================

export function useFitQuestWorkout() {
  const { userProfile, isReady } = useDatabase();
  const [state, setState] = useState<WorkoutState>({
    status: 'idle',
    workout: null,
    currentExerciseIndex: 0,
    startTime: null,
    error: null,
  });

  const [fatigueSnapshot, setFatigueSnapshot] = useState<Map<TargetMuscle, number>>(new Map());
  const [deloadStatus, setDeloadStatus] = useState<{ needed: boolean; reason: string } | null>(null);

  /**
   * Generate a new workout using ENGINE 1
   */
  const generateNewWorkout = useCallback(async () => {
    if (!isReady || !userProfile) {
      setState((prev: WorkoutState) => ({ ...prev, status: 'error', error: 'Database not ready' }));
      return;
    }

    setState((prev: WorkoutState) => ({ ...prev, status: 'generating', error: null }));

    try {
      // Step 1: Apply daily recovery if needed
      if (await needsRecoveryTick(DEFAULT_USER_ID)) {
        await applyDailyRecoveryTick(DEFAULT_USER_ID);
        console.log('[FitQuest] Applied daily recovery tick');
      }

      // Step 2: Check deload status
      const deload = await checkDeloadStatus(DEFAULT_USER_ID);
      setDeloadStatus({
        needed: deload.severity === 'required' || deload.severity === 'recommended',
        reason: deload.reasons.join('; ') || 'System healthy',
      });

      // Step 3: Validate generation is possible
      const validation = await validateWorkoutCanGenerate(DEFAULT_USER_ID);
      if (!validation.canGenerate) {
        throw new Error(validation.blockers.join('. '));
      }

      // Step 4: Get fatigue snapshot for explanations
      const fatigue = await getFatigueSnapshot(DEFAULT_USER_ID);
      const fatigueMap = new Map<TargetMuscle, number>();
      for (const f of fatigue) {
        fatigueMap.set(f.muscle, f.level);
      }
      setFatigueSnapshot(fatigueMap);

      // Step 5: Generate workout using ENGINE 1
      const isDeload = deload.severity === 'required';
      const generated = await generateWorkout(DEFAULT_USER_ID, isDeload);

      if (!generated || generated.exercises.length === 0) {
        throw new Error('Could not generate workout. Try adjusting your profile settings.');
      }

      // Step 6: Build display model
      const exerciseDisplays: WorkoutExerciseDisplay[] = [];
      for (let i = 0; i < generated.exercises.length; i++) {
        const ex = generated.exercises[i];
        const nextEx = generated.exercises[i + 1];

        // Build rich audio narration from exercise instructions + muscles
        const richAudio = generateRichAudio(
          {
            name: ex.exercise.name,
            category: ex.exercise.category,
            instructions: ex.exercise.instructions || [],
            primaryMuscles: ex.exercise.primary_muscles || [],
            restSeconds: 60,
          },
          nextEx?.exercise?.name,
        );

        exerciseDisplays.push({
          id: `ex_${i}_${Date.now()}`,
          exerciseId: ex.exercise.id,
          name: ex.exercise.name,
          category: ex.exercise.category,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: 60, // Default rest time
          instructions: ex.exercise.instructions || [],
          completed: false,
          // Audio: prefer DB-stored custom audio, fall back to rich generated audio
          audioIntro: ex.exercise.audio_intro || richAudio.intro,
          audioSetup: ex.exercise.audio_setup || richAudio.setup,
          audioExecution: ex.exercise.audio_execution || richAudio.execution,
          audioTransition: ex.exercise.audio_transition || richAudio.transition,
        });
      }

      // Step 7: Generate explanation
      const summary = generateWorkoutSummary(
        exerciseDisplays.length,
        userProfile.goal,
        generated.total_duration_estimate,
        isDeload
      );

      const workout: GeneratedWorkoutDisplay = {
        id: generated.session_id,
        exercises: exerciseDisplays,
        totalDuration: generated.total_duration_estimate,
        isDeload,
        explanation: summary,
        warnings: validation.recommendations,
      };

      setState({
        status: 'ready',
        workout,
        currentExerciseIndex: 0,
        startTime: null,
        error: null,
      });

      console.log('[FitQuest] Workout generated:', workout.id);
    } catch (err) {
      console.error('[FitQuest] Workout generation failed:', err);
      setState((prev: WorkoutState) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to generate workout',
      }));
    }
  }, [isReady, userProfile]);

  /**
   * Start the current workout
   */
  const startWorkout = useCallback(() => {
    if (state.workout) {
      setState((prev: WorkoutState) => ({
        ...prev,
        status: 'in_progress',
        startTime: new Date(),
        currentExerciseIndex: 0,
      }));
    }
  }, [state.workout]);

  /**
   * Mark current exercise as complete
   */
  const completeExercise = useCallback((difficulty: number = 5) => {
    if (!state.workout) return;

    setState((prev: WorkoutState) => {
      if (!prev.workout) return prev;

      const updatedExercises = [...prev.workout.exercises];
      if (prev.currentExerciseIndex < updatedExercises.length) {
        updatedExercises[prev.currentExerciseIndex] = {
          ...updatedExercises[prev.currentExerciseIndex],
          completed: true,
          difficulty,
        };
      }

      const nextIndex = prev.currentExerciseIndex + 1;
      const allComplete = nextIndex >= updatedExercises.length;

      return {
        ...prev,
        workout: { ...prev.workout, exercises: updatedExercises },
        currentExerciseIndex: allComplete ? prev.currentExerciseIndex : nextIndex,
        status: allComplete ? 'completed' : 'in_progress',
      };
    });
  }, [state.workout]);

  /**
   * Skip current exercise
   */
  const skipExercise = useCallback(() => {
    if (!state.workout) return;

    setState((prev: WorkoutState) => {
      if (!prev.workout) return prev;

      const nextIndex = prev.currentExerciseIndex + 1;
      const allComplete = nextIndex >= prev.workout.exercises.length;

      return {
        ...prev,
        currentExerciseIndex: allComplete ? prev.currentExerciseIndex : nextIndex,
        status: allComplete ? 'completed' : 'in_progress',
      };
    });
  }, [state.workout]);

  /**
   * Finish and record the workout using ENGINE 2 & 3
   */
  const finishWorkout = useCallback(async (): Promise<WorkoutCompletionData | null> => {
    if (!state.workout || state.status !== 'completed') return null;

    try {
      // Build performance records
      const performances: ExercisePerformance[] = state.workout.exercises.map((ex: WorkoutExerciseDisplay) => ({
        exercise_id: ex.exerciseId,
        prescribed_sets: ex.sets,
        prescribed_reps: ex.reps,
        completed_sets: ex.completed ? ex.sets : 0,
        completed_reps: ex.completed ? ex.reps : null,
        success: ex.completed,
        difficulty_rating: ex.difficulty,
      }));

      // Record with ENGINE 2 (Progression)
      const progressionDecisions = await recordSessionPerformance(
        DEFAULT_USER_ID,
        state.workout.id,
        performances
      );

      // Update fatigue with ENGINE 3 (Recovery)
      for (const ex of state.workout.exercises) {
        if (ex.completed) {
          const exercise = await getExerciseById(ex.exerciseId);
          if (exercise) {
            // Accumulate fatigue for trained muscles using actual exercise data
            await accumulateFatigue(
              DEFAULT_USER_ID,
              exercise.primary_muscles,
              exercise.secondary_muscles,
              ex.sets
            );
          }
        }
      }

      // Mark session complete
      const completedCount = state.workout.exercises.filter((e: WorkoutExerciseDisplay) => e.completed).length;
      await completeWorkoutSession(
        state.workout.id,
        completedCount,
        completedCount >= state.workout.exercises.length * 0.8
      );

      // Update streak
      const streak = await updateStreak(DEFAULT_USER_ID);

      // Award XP
      const xpResult = await awardWorkoutXP(
        completedCount,
        state.workout.exercises.length,
        streak.current
      );
      console.log(`[FitQuest] XP earned: ${xpResult.xpEarned} (Level ${xpResult.data.level})`);

      // Generate summary
      const progressions = progressionDecisions.filter((p: ProgressionDecision) => p.action === 'progress').length;
      const regressions = progressionDecisions.filter((p: ProgressionDecision) => p.action === 'regress').length;
      const xpLine = xpResult.levelUp
        ? `\n🎉 LEVEL UP! You reached Level ${xpResult.newLevel}!`
        : `\n⭐ +${xpResult.xpEarned} XP (Level ${xpResult.data.level})`;
      const summary = generatePostWorkoutSummary(
        completedCount,
        state.workout.exercises.length,
        progressions,
        regressions
      ) + xpLine;

      const difficultyValues = state.workout.exercises
        .map((exercise) => exercise.difficulty)
        .filter((value): value is number => typeof value === 'number');
      const averageDifficulty = difficultyValues.length
        ? difficultyValues.reduce((sum, value) => sum + value, 0) / difficultyValues.length
        : 5;

      const adaptive = await updateAdaptiveTrainingProfileFromSession(
        DEFAULT_USER_ID,
        {
          completedCount,
          totalCount: state.workout.exercises.length,
          averageDifficulty,
        }
      );

      const adaptiveLine = `\n🧠 Adaptive profile: fatigue ${adaptive.fatigueSensitivity.toFixed(2)} · progression ${adaptive.progressionAggressiveness.toFixed(2)} · volume ${adaptive.volumeTolerance.toFixed(2)}`;
      const completionRatio = state.workout.exercises.length > 0
        ? completedCount / state.workout.exercises.length
        : 0;

      const policyDecision = await evaluatePostWorkoutPolicyDecision(DEFAULT_USER_ID, {
        completionRatio,
        averageDifficulty,
        isDeload: state.workout.isDeload,
      });

      const policyLine = `\n🤖 Policy decision: ${policyDecision.decision.action} (${Math.round(policyDecision.decision.confidence * 100)}%)`;
      const finalSummary = summary + adaptiveLine + policyLine;

      console.log('[FitQuest] Workout completed:', finalSummary);

      try {
        const durationSeconds = state.startTime
          ? Math.max(0, Math.floor((Date.now() - state.startTime.getTime()) / 1000))
          : 0;

        for (const ex of state.workout.exercises) {
          await queueAnalyticsEvent({
            event_type: 'exercise_outcome',
            goal: userProfile?.goal || 'unknown',
            experience: userProfile?.experience || 'unknown',
            exercise_id: ex.exerciseId,
            success: ex.completed,
            sets_completed: ex.completed ? ex.sets : 0,
            duration_seconds: 0,
          });
        }

        await queueAnalyticsEvent({
          event_type: 'workout_session_completed',
          goal: userProfile?.goal || 'unknown',
          experience: userProfile?.experience || 'unknown',
          exercise_id: 'all',
          success: completedCount >= state.workout.exercises.length * 0.8,
          sets_completed: state.workout.exercises.reduce((acc, ex) => acc + (ex.completed ? ex.sets : 0), 0),
          duration_seconds: durationSeconds,
        });

        await flushAnalyticsQueue(120);
      } catch (analyticsError) {
        console.warn('[FitQuest] Analytics queue/flush failed:', analyticsError);
      }

      // Keep status as 'completed' — the component will reset when user taps "New Workout"
      // DO NOT reset to 'idle' here — it triggers auto-generate before completionResult is set
      console.log('[FitQuest] Workout finished successfully, keeping completed state');

      // Collect muscles worked from completed exercises
      const musclesWorkedSet = new Set<string>();
      for (const ex of state.workout.exercises) {
        if (ex.completed) {
          const exercise = await getExerciseById(ex.exerciseId);
          if (exercise) {
            exercise.primary_muscles.forEach((m: string) => musclesWorkedSet.add(m));
          }
        }
      }

      return {
        summary: finalSummary,
        streak,
        completedCount,
        totalCount: state.workout.exercises.length,
        durationSeconds,
        xpEarned: xpResult.xpEarned,
        level: xpResult.data.level,
        levelUp: xpResult.levelUp ?? false,
        newLevel: xpResult.newLevel,
        progressions,
        regressions,
        exerciseNames: state.workout.exercises.filter((e: WorkoutExerciseDisplay) => e.completed).map(e => e.name),
        musclesWorked: Array.from(musclesWorkedSet),
      };
    } catch (err) {
      console.error('[FitQuest] Failed to finish workout:', err);
      setState({
        status: 'error',
        workout: null,
        currentExerciseIndex: 0,
        startTime: null,
        error: err instanceof Error ? err.message : 'Failed to finish workout',
      });
      return null;
    }
  }, [state.workout, state.status, state.startTime, userProfile?.goal, userProfile?.experience]);

  /**
   * Cancel the current workout
   */
  const cancelWorkout = useCallback(() => {
    setState({
      status: 'idle',
      workout: null,
      currentExerciseIndex: 0,
      startTime: null,
      error: null,
    });
  }, []);

  /**
   * Get current exercise
   */
  const currentExercise = state.workout?.exercises[state.currentExerciseIndex] || null;

  /**
   * Get progress percentage
   */
  const progressPercentage = state.workout
    ? (state.workout.exercises.filter((e: WorkoutExerciseDisplay) => e.completed).length / state.workout.exercises.length) * 100
    : 0;

  return {
    // State
    status: state.status,
    workout: state.workout,
    currentExercise,
    currentExerciseIndex: state.currentExerciseIndex,
    progressPercentage,
    error: state.error,
    fatigueSnapshot,
    deloadStatus,

    // Actions
    generateNewWorkout,
    startWorkout,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
  };
}
