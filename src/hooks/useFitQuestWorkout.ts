/**
 * FitQuest Workout Hook — Orchestrator
 * Composes workout generation, progression, recovery, and persistence.
 * Types, helpers, and persistence extracted to ./workout/ modules.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDatabase, DEFAULT_USER_ID } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import { translationResolver } from '../i18n/TranslationResolver';

// Engine imports
import {
  createWorkout,
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
  getExercisesByIds,
  completeWorkoutSession,
  updateStreak,
  getSessionExercises,
  getWorkoutSession,
  getActiveWorkoutSession,
} from '../database/service';

import { awardWorkoutXP } from '../services/xpService';
import { generateRichAudio } from '../services/audioService';
import { updateAdaptiveTrainingProfileFromSession } from '../services/adaptiveTrainingService';
import { notifyWorkoutCompleted } from '../services/dataSyncService';
import { invalidateReadinessCache } from '../engines/ReadinessEngine';
import { recordWorkoutPattern } from '../services/smartDefaults';
import { logEvent } from '../services/telemetry';

import type { TargetMuscle } from '../database/types';
import { generateWarmupCooldown } from '../engines/warmupCooldownGenerator';
import {
  isMindExercise,
  generateMindTimeline,
  getMindDuration,
  formatMindDuration,
  type MindTimeline,
} from '../engines/MindSessionEngine';

// Extracted modules
import {
  type WorkoutState,
  type WorkoutExerciseDisplay,
  type WorkoutCompletionData,
  type GeneratedWorkoutDisplay,
  type ProgressionNarrative,
} from './workout/types';
import {
  persistWorkoutProgress,
  persistExerciseCompletion,
  clearActiveWorkout,
  readActiveWorkout,
} from './workout/persistence';
import {
  mapRecoveryReasonToFriendly,
  buildDisplaysFromSessionRows,
  overlayLocalization,
  buildPhaseDisplays,
  collectMusclesWorked,
  computePhaseBreakdown,
} from './workout/helpers';

// Re-export types for consumers
export type {
  WorkoutExerciseDisplay,
  WorkoutCompletionData,
  GeneratedWorkoutDisplay,
  WorkoutState,
  AIInsight,
  LastImpactDisplay,
  WorkoutDelta,
  ProgressionNarrative,
} from './workout/types';

// ============================================
// HOOK
// ============================================

export function useFitQuestWorkout() {
  const { userProfile, isReady } = useDatabase();
  const { t, language } = useLanguage();
  const finishingRef = useRef(false); // Prevent double-tap race condition on finish
  const generatingRef = useRef(false); // Prevent concurrent workout generation
  const completingRef = useRef(false); // Prevent rapid-tap double-advance on exercise complete
  const mountedRef = useRef(true); // Guard async setState after unmount
  const [state, setState] = useState<WorkoutState>({
    status: 'idle',
    workout: null,
    currentExerciseIndex: 0,
    startTime: null,
    error: null,
  });

  // Track mount/unmount for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [fatigueSnapshot, setFatigueSnapshot] = useState<Map<TargetMuscle, number>>(new Map());
  const [deloadStatus, setDeloadStatus] = useState<{ needed: boolean; reason: string } | null>(null);
  const recoveryAttemptedRef = useRef(false);

  // ── Session Recovery ──
  // On mount, check for an in-progress workout that was interrupted (app crash/kill).
  // If found, rebuild the display from DB and restore position.
  const recoverActiveSession = useCallback(async () => {
    if (recoveryAttemptedRef.current) return false;
    recoveryAttemptedRef.current = true;
    try {
      const saved = await readActiveWorkout();
      if (!saved) return false;

      const session = await getActiveWorkoutSession(DEFAULT_USER_ID);
      if (!session || session.id !== saved.sessionId) {
        clearActiveWorkout();
        return false;
      }

      const sessionExercises = await getSessionExercises(saved.sessionId);
      if (!sessionExercises || sessionExercises.length === 0) {
        clearActiveWorkout();
        return false;
      }

      const exerciseDisplays = buildDisplaysFromSessionRows(sessionExercises, t, { markCompleted: true });

      const workout: GeneratedWorkoutDisplay = {
        id: saved.sessionId,
        exercises: exerciseDisplays,
        totalDuration: session.duration_minutes || Math.round(sessionExercises.length * 3),
        isDeload: false,
        explanation: 'Recovered in-progress workout',
        aiInsight: null,
        lastImpact: null,
        workoutDelta: null,
        progressionNarratives: [],
        warnings: [],
        warmup: [],
        cooldown: [],
      };

      const restoredIndex = Math.min(saved.exerciseIndex, exerciseDisplays.length - 1);
      const allComplete = restoredIndex >= exerciseDisplays.length;

      if (!mountedRef.current) return false;

      setState({
        status: allComplete ? 'completed' : 'in_progress',
        workout,
        currentExerciseIndex: Math.max(0, restoredIndex),
        startTime: saved.startTime ? new Date(saved.startTime) : new Date(),
        error: null,
      });

      if (__DEV__) console.warn('[FitQuest] Recovered active session:', saved.sessionId, 'at exercise', restoredIndex);
      return true;
    } catch (err) {
      if (__DEV__) console.warn('[FitQuest] Session recovery failed (non-fatal):', err);
      clearActiveWorkout();
      return false;
    }
  }, [t]);

  /**
   * Generate a new workout using ENGINE 1
   */
  const generateNewWorkout = useCallback(async () => {
    // Prevent concurrent generation (double-tap protection)
    if (generatingRef.current) {
      if (__DEV__) console.warn('[FitQuest] Already generating workout, ignoring duplicate call');
      return;
    }
    generatingRef.current = true;

    if (!isReady || !userProfile) {
      generatingRef.current = false;
      const detail = !isReady ? 'Database is still initializing' : 'User profile not loaded';
      if (__DEV__) console.warn('[FitQuest] generateNewWorkout blocked:', detail);
      if (mountedRef.current) setState((prev: WorkoutState) => ({ ...prev, status: 'error', error: detail }));
      return;
    }

    if (mountedRef.current) setState((prev: WorkoutState) => ({ ...prev, status: 'generating', error: null }));

    // Timeout to prevent infinite loading on weak devices
    const GENERATION_TIMEOUT_MS = 20_000;
    const timeoutId = setTimeout(() => {
      // deferred-cleanup
      if (generatingRef.current && mountedRef.current) {
        generatingRef.current = false;
        setState((prev: WorkoutState) => ({
          ...prev,
          status: 'error',
          error: 'Workout generation timed out. Please try again.',
        }));
      }
    }, GENERATION_TIMEOUT_MS);

    try {
      // Step 1: Apply daily recovery if needed
      if (await needsRecoveryTick(DEFAULT_USER_ID)) {
        await applyDailyRecoveryTick(DEFAULT_USER_ID);
        if (__DEV__) console.warn('[FitQuest] Applied daily recovery tick');
      }

      // Step 2: Check deload status
      const deload = await checkDeloadStatus(DEFAULT_USER_ID);
      setDeloadStatus({
        needed: deload.severity === 'required' || deload.severity === 'recommended',
        reason: mapRecoveryReasonToFriendly(deload.reasons, deload.severity),
      });

      // Step 3: Validate generation is possible
      const validation = { canGenerate: true, blockers: [] as string[], recommendations: [] as string[] };
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

      // Step 5: Generate AND PERSIST workout using ENGINE 1
      const isDeload = deload.severity === 'required';
      const generated = await createWorkout(DEFAULT_USER_ID, isDeload);

      if (!generated || generated.exercises.length === 0) {
        throw new Error('Could not generate workout. Try adjusting your profile settings.');
      }

      // Step 6: Build display model
      const exerciseDisplays: WorkoutExerciseDisplay[] = [];
      for (let i = 0; i < generated.exercises.length; i++) {
        const ex = generated.exercises[i];
        if (!ex) continue;
        const nextEx = generated.exercises[i + 1];

        // Mind exercises: generate guided timeline instead of reps/sets
        const isMind = isMindExercise(ex.exercise.category);
        let mindTimeline: MindTimeline | undefined;
        if (isMind) {
          const duration = getMindDuration(ex.exercise.name, userProfile.experience);
          mindTimeline = generateMindTimeline(ex.exercise.name, ex.exercise.category, duration);
        }

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
          t,
        );

        exerciseDisplays.push({
          id: `${generated.session_id}_ex_${ex.order}`,
          exerciseId: ex.exercise.id,
          name: ex.exercise.name,
          category: ex.exercise.category,
          sets: isMind ? 1 : ex.sets,
          reps: isMind ? formatMindDuration(mindTimeline!.totalDuration) : ex.reps,
          restSeconds: isMind ? 0 : 60,
          instructions: ex.exercise.instructions || [],
          completed: false,
          phase: 'main',
          // Audio: prefer DB-stored custom audio, fall back to rich generated audio
          audioIntro: ex.exercise.audio_intro || richAudio.intro,
          audioSetup: ex.exercise.audio_setup || richAudio.setup,
          audioExecution: ex.exercise.audio_execution || richAudio.execution,
          audioTransition: ex.exercise.audio_transition || richAudio.transition,
          mindTimeline,
        });
      }

      // Step 7: Generate warm-up & cool-down (P6)
      const mainExerciseIds = new Set(generated.exercises.map((e) => e.exercise.id));
      let warmupDisplays: WorkoutExerciseDisplay[] = [];
      let cooldownDisplays: WorkoutExerciseDisplay[] = [];
      try {
        const wcResult = await generateWarmupCooldown(generated.exercises, mainExerciseIds);
        warmupDisplays = buildPhaseDisplays(wcResult.warmup, 'warmup');
        cooldownDisplays = buildPhaseDisplays(wcResult.cooldown, 'cooldown');
      } catch (wcErr) {
        if (__DEV__) console.warn('[FitQuest] Warmup/cooldown generation failed (non-fatal):', wcErr);
      }

      // Step 8: Generate explanation
      const summary = `${exerciseDisplays.length} exercises • ${generated.total_duration_estimate}min${isDeload ? ' (Recovery session)' : ''}`;

      // Step 9: AI insight + adaptive memory removed (modules pending rebuild)
      const aiInsight = null;
      const lastImpact = null;
      const workoutDelta = null;
      const progressionNarratives: ProgressionNarrative[] = [];

      // Combine warmup → main → cooldown into a single exercises array
      // so the progression naturally flows through all phases

      // Step 10.5: Overlay localized exercise data (name, instructions, audio)
      if (language !== 'en') {
        try {
          const allIds = [
            ...exerciseDisplays.map((e) => e.exerciseId),
            ...warmupDisplays.map((e) => e.exerciseId),
            ...cooldownDisplays.map((e) => e.exerciseId),
          ];
          const localized = await translationResolver.resolveBatch(allIds, language);
          overlayLocalization(exerciseDisplays, localized);
          overlayLocalization(warmupDisplays, localized);
          overlayLocalization(cooldownDisplays, localized);
        } catch (locErr) {
          if (__DEV__) console.warn('[FitQuest] Exercise localization overlay failed (non-fatal):', locErr);
        }
      }

      const allExercises = [...warmupDisplays, ...exerciseDisplays, ...cooldownDisplays];

      const workout: GeneratedWorkoutDisplay = {
        id: generated.session_id,
        exercises: allExercises,
        totalDuration: generated.total_duration_estimate,
        isDeload,
        explanation: summary,
        aiInsight,
        lastImpact,
        workoutDelta,
        progressionNarratives,
        warnings: validation.recommendations,
        warmup: warmupDisplays,
        cooldown: cooldownDisplays,
      };

      if (!mountedRef.current) return;

      setState({
        status: 'ready',
        workout,
        currentExerciseIndex: 0,
        startTime: null,
        error: null,
      });

      if (__DEV__) console.warn('[FitQuest] Workout generated:', workout.id);
    } catch (err) {
      if (__DEV__) console.error('[FitQuest] Workout generation failed:', err);
      if (mountedRef.current) {
        setState((prev: WorkoutState) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to generate workout',
        }));
      }
    } finally {
      clearTimeout(timeoutId);
      generatingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language change during workout generation would disrupt flow
  }, [isReady, userProfile, language]);

  /**
   * Load a custom (user-created) workout session from the database.
   * Used when launching workouts from saved-workouts or create-workout screens.
   */
  const loadCustomWorkout = useCallback(
    async (sessionId: string) => {
      if (mountedRef.current) setState((prev: WorkoutState) => ({ ...prev, status: 'generating', error: null }));

      try {
        const session = await getWorkoutSession(sessionId);
        if (!session) throw new Error('Workout session not found');

        const sessionExercises = await getSessionExercises(sessionId);
        if (!sessionExercises || sessionExercises.length === 0) {
          throw new Error('No exercises found in this workout');
        }

        // Parse instructions safely (may be JSON array or plain text)
        const exerciseDisplays = buildDisplaysFromSessionRows(sessionExercises, t);

        // Overlay localized exercise data for non-English users
        if (language !== 'en') {
          try {
            const allIds = exerciseDisplays.map((e) => e.exerciseId);
            const localized = await translationResolver.resolveBatch(allIds, language);
            overlayLocalization(exerciseDisplays, localized);
          } catch (locErr) {
            if (__DEV__) console.warn('[FitQuest] Custom workout localization failed (non-fatal):', locErr);
          }
        }

        const workout: GeneratedWorkoutDisplay = {
          id: sessionId,
          exercises: exerciseDisplays,
          totalDuration: session.duration_minutes || Math.round(sessionExercises.length * 3),
          isDeload: false,
          explanation: `Custom workout: ${session.notes?.replace('Custom: ', '') || sessionExercises.length + ' exercises'}`,
          aiInsight: null,
          lastImpact: null,
          workoutDelta: null,
          progressionNarratives: [],
          warnings: [],
          warmup: [],
          cooldown: [],
        };

        if (!mountedRef.current) return;

        setState({
          status: 'ready',
          workout,
          currentExerciseIndex: 0,
          startTime: null,
          error: null,
        });

        if (__DEV__) console.warn('[FitQuest] Custom workout loaded:', sessionId, exerciseDisplays.length, 'exercises');
      } catch (err) {
        if (__DEV__) console.error('[FitQuest] Failed to load custom workout:', err);
        if (mountedRef.current) {
          setState((prev: WorkoutState) => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to load custom workout',
          }));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language change during custom workout load would cause stale closures
    [language],
  );
  /**
   * Start the current workout
   */
  const startWorkout = useCallback(() => {
    if (state.workout) {
      void logEvent('workout_started', {
        exercise_count: state.workout.exercises.length,
      });
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
  const completeExercise = useCallback(
    (difficulty: number = 5) => {
      if (!state.workout) return;
      if (completingRef.current) return;
      completingRef.current = true;

      // Capture current exercise for persistence BEFORE state update
      const currentEx = state.workout.exercises[state.currentExerciseIndex];
      const nextIdx = state.currentExerciseIndex + 1;

      setState((prev: WorkoutState) => {
        if (!prev.workout) return prev;

        const updatedExercises = [...prev.workout.exercises];
        const current = updatedExercises[prev.currentExerciseIndex];
        if (current && prev.currentExerciseIndex < updatedExercises.length) {
          updatedExercises[prev.currentExerciseIndex] = {
            ...current,
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

      // Persist exercise completion + progress index (fire-and-forget)
      if (currentEx) {
        persistExerciseCompletion(currentEx.id, currentEx.sets, false);
        persistWorkoutProgress(state.workout.id, nextIdx, state.startTime?.toISOString() ?? '');
      }

      // Release guard after state update commits — queueMicrotask runs after
      // React\u2019s synchronous batch, before the next frame. Zero race window.
      queueMicrotask(() => {
        completingRef.current = false;
      });
    },
    [state.workout, state.currentExerciseIndex, state.startTime],
  );

  /**
   * Skip current exercise
   */
  const skipExercise = useCallback(() => {
    if (!state.workout) return;

    // Capture for persistence before state update
    const skippedEx = state.workout.exercises[state.currentExerciseIndex];
    const nextIdx = state.currentExerciseIndex + 1;

    setState((prev: WorkoutState) => {
      if (!prev.workout) return prev;

      const skippedExercise = prev.workout.exercises[prev.currentExerciseIndex];
      void logEvent('exercise_skipped', {
        exercise_id: skippedExercise?.exerciseId,
        exercise_index: prev.currentExerciseIndex,
      });

      const nextIndex = prev.currentExerciseIndex + 1;
      const allComplete = nextIndex >= prev.workout.exercises.length;

      return {
        ...prev,
        currentExerciseIndex: allComplete ? prev.currentExerciseIndex : nextIndex,
        status: allComplete ? 'completed' : 'in_progress',
      };
    });

    // Persist skip + progress index (fire-and-forget)
    if (skippedEx) {
      persistExerciseCompletion(skippedEx.id, 0, true);
      persistWorkoutProgress(state.workout.id, nextIdx, state.startTime?.toISOString() ?? '');
    }
  }, [state.workout, state.currentExerciseIndex, state.startTime]);

  /**
   * Finish and record the workout using ENGINE 2 & 3
   * Supports both full completion and early finish (partial completion)
   */
  const finishWorkout = useCallback(async (): Promise<WorkoutCompletionData | null> => {
    // Prevent double-tap race condition
    if (finishingRef.current) {
      if (__DEV__) console.warn('[FitQuest] finishWorkout already in progress, ignoring duplicate call');
      return null;
    }

    // Allow finishing if we have a workout and are either completed OR in_progress (early finish)
    if (!state.workout || (state.status !== 'completed' && state.status !== 'in_progress')) return null;

    finishingRef.current = true;

    try {
      // Only track performance and fatigue for main exercises (not warmup/cooldown)
      const mainOnly = state.workout.exercises.filter((ex: WorkoutExerciseDisplay) => ex.phase === 'main' || !ex.phase);

      // Build performance records
      const performances: ExercisePerformance[] = mainOnly.map((ex: WorkoutExerciseDisplay) => ({
        exercise_id: ex.exerciseId,
        prescribed_sets: ex.sets,
        prescribed_reps: ex.reps,
        completed_sets: ex.completed ? ex.sets : 0,
        completed_reps: ex.completed ? ex.reps : null,
        success: ex.completed,
        difficulty_rating: ex.difficulty,
      }));

      // Record with ENGINE 2 (Progression)
      const progressionDecisions = await recordSessionPerformance(DEFAULT_USER_ID, state.workout.id, performances);

      // Update fatigue with ENGINE 3 (Recovery)
      // Batch-load all completed exercises in one query instead of N+1
      const completedMainExercises = mainOnly.filter((ex: WorkoutExerciseDisplay) => ex.completed);
      const completedIds = completedMainExercises.map((ex: WorkoutExerciseDisplay) => ex.exerciseId);
      const exerciseMap = await getExercisesByIds(completedIds);

      for (const ex of completedMainExercises) {
        const exercise = exerciseMap.get(ex.exerciseId);
        if (exercise) {
          // Accumulate fatigue for trained muscles using actual exercise data
          await accumulateFatigue(DEFAULT_USER_ID, exercise.primary_muscles, exercise.secondary_muscles, ex.sets);
        }
      }

      // Mark session complete (based on main exercises only)
      const completedCount = mainOnly.filter((e: WorkoutExerciseDisplay) => e.completed).length;
      const isSuccess = mainOnly.length > 0 && completedCount >= mainOnly.length * 0.8;
      await completeWorkoutSession(state.workout.id, completedCount, isSuccess);

      // Clear active workout marker — session is finalized
      clearActiveWorkout();

      // Update streak
      const streak = await updateStreak(DEFAULT_USER_ID);

      // Award XP
      const xpResult = await awardWorkoutXP(completedCount, mainOnly.length, streak.current);
      if (__DEV__) console.warn(`[FitQuest] XP earned: ${xpResult.xpEarned} (Level ${xpResult.data.level})`);

      // Generate summary
      const progressions = progressionDecisions.filter((p: ProgressionDecision) => p.action === 'progress').length;
      const regressions = progressionDecisions.filter((p: ProgressionDecision) => p.action === 'regress').length;
      const xpLine = xpResult.levelUp
        ? `\n🎉 LEVEL UP! You reached Level ${xpResult.newLevel}!`
        : `\n⭐ +${xpResult.xpEarned} XP (Level ${xpResult.data.level})`;
      const summary =
        `Completed ${completedCount}/${mainOnly.length} exercises` +
        (progressions > 0 ? ` • ${progressions} progressed` : '') +
        (regressions > 0 ? ` • ${regressions} regressed` : '') +
        xpLine;

      const difficultyValues = mainOnly
        .map((exercise) => exercise.difficulty)
        .filter((value): value is number => typeof value === 'number');
      const averageDifficulty = difficultyValues.length
        ? difficultyValues.reduce((sum, value) => sum + value, 0) / difficultyValues.length
        : 5;

      const adaptive = await updateAdaptiveTrainingProfileFromSession(DEFAULT_USER_ID, {
        completedCount,
        totalCount: mainOnly.length,
        averageDifficulty,
      });

      const adaptiveLine = `\n🧠 Adaptive profile: fatigue ${adaptive.fatigueSensitivity.toFixed(2)} · progression ${adaptive.progressionAggressiveness.toFixed(2)} · volume ${adaptive.volumeTolerance.toFixed(2)}`;
      const finalSummary = summary + adaptiveLine;

      if (__DEV__) console.warn('[FitQuest] Workout completed:', finalSummary);

      const durationSeconds = state.startTime
        ? Math.max(0, Math.floor((Date.now() - state.startTime.getTime()) / 1000))
        : 0;

      // Analytics ingestion removed (service deleted)

      // Keep status as 'completed' — the component will reset when user taps "New Workout"
      // DO NOT reset to 'idle' here — it triggers auto-generate before completionResult is set
      if (__DEV__) console.warn('[FitQuest] Workout finished successfully, keeping completed state');

      // Notify all subscribed screens that workout data changed
      notifyWorkoutCompleted({
        sessionId: state.workout.id,
        exercisesCompleted: completedCount,
        totalExercises: mainOnly.length,
        durationMinutes: Math.round(durationSeconds / 60),
        xpEarned: xpResult.xpEarned,
      });

      // Refresh readiness score immediately after workout completion
      invalidateReadinessCache();

      // Record pattern for smart defaults (non-blocking)
      recordWorkoutPattern({
        category: userProfile?.goal,
        durationMinutes: Math.round(durationSeconds / 60),
      }).catch(() => {});

      // Collect muscles worked + phase breakdown
      const musclesWorked = collectMusclesWorked(completedMainExercises, exerciseMap);
      const phaseBreakdown = computePhaseBreakdown(state.workout.exercises, completedCount);

      return {
        summary: finalSummary,
        streak,
        completedCount,
        totalCount: mainOnly.length,
        durationSeconds,
        xpEarned: xpResult.xpEarned,
        level: xpResult.data.level,
        levelUp: xpResult.levelUp ?? false,
        newLevel: xpResult.newLevel,
        progressions,
        regressions,
        exerciseNames: mainOnly.filter((e: WorkoutExerciseDisplay) => e.completed).map((e) => e.name),
        musclesWorked,
        phaseBreakdown,
      };
    } catch (err) {
      if (__DEV__) console.error('[FitQuest] Failed to finish workout:', err);
      if (mountedRef.current) {
        setState({
          status: 'error',
          workout: null,
          currentExerciseIndex: 0,
          startTime: null,
          error: err instanceof Error ? err.message : 'Failed to finish workout',
        });
      }
      return null;
    } finally {
      finishingRef.current = false;
    }
  }, [state.workout, state.status, state.startTime, userProfile?.goal, userProfile?.experience]);

  /**
   * Cancel the current workout
   */
  const cancelWorkout = useCallback(() => {
    // Cancel any in-flight async operations
    generatingRef.current = false;
    finishingRef.current = false;
    clearActiveWorkout();
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
   * Get progress percentage (based on main exercises only)
   */
  const mainExercises = state.workout
    ? state.workout.exercises.filter((e: WorkoutExerciseDisplay) => e.phase === 'main' || !e.phase)
    : [];
  const progressPercentage =
    mainExercises.length > 0
      ? (mainExercises.filter((e: WorkoutExerciseDisplay) => e.completed).length / mainExercises.length) * 100
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
    loadCustomWorkout,
    recoverActiveSession,
    startWorkout,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
  };
}
