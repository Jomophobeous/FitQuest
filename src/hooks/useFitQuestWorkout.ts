/**
 * FitQuest Workout Hook
 * Integrates all three engines for workout generation, progression, and recovery
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
  generateWorkoutSummary,
  generatePostWorkoutSummary,
  explainWorkoutSelection,
  type WorkoutExplanation,
} from '../engines/transparencyLayer';

import {
  getLastSessionImpact,
  getWorkoutDelta,
  getProgressionNarratives,
  type LastSessionImpact,
  type WorkoutDelta,
  type ExerciseProgressionNarrative,
} from '../engines/AdaptiveMemoryEngine';

import { validateWorkoutCanGenerate } from '../engines/edgeCaseGuards';

import {
  getExercisesByIds,
  completeWorkoutSession,
  updateStreak,
  getSessionExercises,
  getWorkoutSession,
} from '../database/service';

import { awardWorkoutXP } from '../services/xpService';
import { generateRichAudio } from '../services/audioService';
import { flushAnalyticsQueue, queueAnalyticsEvent } from '../services/analyticsIngestionService';
import { updateAdaptiveTrainingProfileFromSession } from '../services/adaptiveTrainingService';
import { notifyWorkoutCompleted } from '../services/dataSyncService';
import { invalidateReadinessCache } from '../engines/ReadinessEngine';
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

// ============================================
// RECOVERY REASON MAPPER
// ============================================

/** Map raw recovery engine reasons to user-friendly messages */
function mapRecoveryReasonToFriendly(reasons: string[], _severity: string): string {
  if (reasons.length === 0) return 'All systems healthy — ready to train';

  const friendly: string[] = [];
  for (const r of reasons) {
    if (/consecutive workout failures/i.test(r)) {
      friendly.push('Take a recovery day — your body needs rest');
    } else if (/muscle group.*critical fatigue/i.test(r)) {
      friendly.push('Some muscles need more recovery time');
    } else if (/average fatigue.*exceeds/i.test(r)) {
      friendly.push('Overall fatigue is high — a lighter session is recommended');
    } else if (/scheduled deload/i.test(r)) {
      friendly.push('Scheduled recovery week — time to recharge');
    } else {
      friendly.push(r);
    }
  }

  return friendly.join('. ');
}

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
  /** Per-exercise AI reasoning from transparency layer */
  aiInsight: WorkoutExplanation | null;
  /** Adaptive memory: last session impact */
  lastImpact: LastSessionImpact | null;
  /** Adaptive memory: what changed from last workout */
  workoutDelta: WorkoutDelta | null;
  /** Adaptive memory: per-exercise progression narrative */
  progressionNarratives: ExerciseProgressionNarrative[];
  /** P6: warm-up exercises shown before main workout */
  warmup: WorkoutExerciseDisplay[];
  /** P6: cool-down exercises shown after main workout */
  cooldown: WorkoutExerciseDisplay[];
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
  /** Phase of the workout this exercise belongs to */
  phase?: 'warmup' | 'main' | 'cooldown';
  // Audio instruction fields for TTS
  audioIntro: string;
  audioSetup: string;
  audioExecution: string;
  audioTransition: string;
  /** Mind exercise timeline (only set for focus/mindfulness exercises) */
  mindTimeline?: MindTimeline;
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
  /** Phase breakdown for summary display */
  phaseBreakdown?: {
    warmup: { total: number; completed: number };
    main: { total: number; completed: number };
    cooldown: { total: number; completed: number };
  };
}

// ============================================
// HOOK
// ============================================

export function useFitQuestWorkout() {
  const { userProfile, isReady } = useDatabase();
  const { t, language } = useLanguage();
  const finishingRef = useRef(false); // Prevent double-tap race condition on finish
  const generatingRef = useRef(false); // Prevent concurrent workout generation
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
          id: `ex_${i}_${Date.now()}`,
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
        warmupDisplays = wcResult.warmup.map((w, i) => ({
          id: `warmup_${i}_${Date.now()}`,
          exerciseId: w.exercise.id,
          name: w.exercise.name,
          category: w.exercise.category,
          sets: w.sets,
          reps: w.reps,
          restSeconds: 15,
          instructions: w.exercise.instructions || [],
          completed: false,
          phase: 'warmup' as const,
          audioIntro: w.exercise.audio_intro || '',
          audioSetup: w.exercise.audio_setup || '',
          audioExecution: w.exercise.audio_execution || '',
          audioTransition: w.exercise.audio_transition || '',
        }));
        cooldownDisplays = wcResult.cooldown.map((c, i) => ({
          id: `cooldown_${i}_${Date.now()}`,
          exerciseId: c.exercise.id,
          name: c.exercise.name,
          category: c.exercise.category,
          sets: c.sets,
          reps: c.reps,
          restSeconds: 15,
          instructions: c.exercise.instructions || [],
          completed: false,
          phase: 'cooldown' as const,
          audioIntro: c.exercise.audio_intro || '',
          audioSetup: c.exercise.audio_setup || '',
          audioExecution: c.exercise.audio_execution || '',
          audioTransition: c.exercise.audio_transition || '',
        }));
      } catch (wcErr) {
        if (__DEV__) console.warn('[FitQuest] Warmup/cooldown generation failed (non-fatal):', wcErr);
      }

      // Step 8: Generate explanation
      const summary = generateWorkoutSummary(
        exerciseDisplays.length,
        userProfile.goal,
        generated.total_duration_estimate,
        isDeload,
      );

      // Step 9: Generate per-exercise AI reasoning
      let aiInsight: WorkoutExplanation | null = null;
      try {
        const exercisesWithDetails = generated.exercises.map((e) => e.exercise);
        aiInsight = explainWorkoutSelection(exercisesWithDetails, userProfile.goal, fatigueMap, isDeload);
      } catch {
        if (__DEV__) console.warn('[FitQuest] AI insight generation failed (non-fatal)');
      }

      // Step 10: Adaptive Memory — last session impact + workout delta + progression narratives
      let lastImpact: LastSessionImpact | null = null;
      let workoutDelta: WorkoutDelta | null = null;
      let progressionNarratives: ExerciseProgressionNarrative[] = [];
      try {
        const mainExerciseIdList = exerciseDisplays.map((e) => e.exerciseId);
        const nameMap = new Map(exerciseDisplays.map((e) => [e.exerciseId, e.name]));
        const [impact, delta, narratives] = await Promise.all([
          getLastSessionImpact(DEFAULT_USER_ID),
          getWorkoutDelta(DEFAULT_USER_ID, mainExerciseIdList, fatigueMap),
          getProgressionNarratives(DEFAULT_USER_ID, mainExerciseIdList, nameMap),
        ]);
        lastImpact = impact;
        workoutDelta = delta;
        progressionNarratives = narratives;
      } catch {
        if (__DEV__) console.warn('[FitQuest] Adaptive memory generation failed (non-fatal)');
      }

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
          const overlayLocalization = (displays: WorkoutExerciseDisplay[]) => {
            for (let i = 0; i < displays.length; i++) {
              const loc = localized.get(displays[i]!.exerciseId);
              if (loc && !loc.isFallback) {
                displays[i] = {
                  ...displays[i]!,
                  name: loc.name,
                  instructions: loc.instructions,
                  audioIntro: loc.audioIntro || displays[i]!.audioIntro,
                  audioSetup: loc.audioSetup || displays[i]!.audioSetup,
                  audioExecution: loc.audioExecution || displays[i]!.audioExecution,
                  audioTransition: loc.audioTransition || displays[i]!.audioTransition,
                };
              }
            }
          };
          overlayLocalization(exerciseDisplays);
          overlayLocalization(warmupDisplays);
          overlayLocalization(cooldownDisplays);
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
        const safeParseInstructions = (raw: string | null): string[] => {
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [raw];
          } catch {
            return raw ? [raw] : [];
          }
        };

        const exerciseDisplays: WorkoutExerciseDisplay[] = sessionExercises.map((se, i) => {
          const richAudio = generateRichAudio(
            {
              name: se.name,
              category: se.category,
              instructions: safeParseInstructions(se.instructions),
              primaryMuscles: [],
              restSeconds: 60,
            },
            sessionExercises[i + 1]?.name,
            t,
          );

          return {
            id: se.id,
            exerciseId: se.exercise_id,
            name: se.name,
            category: se.category,
            sets: se.prescribed_sets,
            reps: se.prescribed_reps,
            restSeconds: 60,
            instructions: safeParseInstructions(se.instructions),
            completed: false,
            audioIntro: se.audio_intro || richAudio.intro,
            audioSetup: se.audio_setup || richAudio.setup,
            audioExecution: se.audio_execution || richAudio.execution,
            audioTransition: se.audio_transition || richAudio.transition,
          };
        });

        // Overlay localized exercise data for non-English users
        if (language !== 'en') {
          try {
            const allIds = exerciseDisplays.map((e) => e.exerciseId);
            const localized = await translationResolver.resolveBatch(allIds, language);
            for (let i = 0; i < exerciseDisplays.length; i++) {
              const loc = localized.get(exerciseDisplays[i]!.exerciseId);
              if (loc && !loc.isFallback) {
                exerciseDisplays[i] = {
                  ...exerciseDisplays[i]!,
                  name: loc.name,
                  instructions: loc.instructions,
                  audioIntro: loc.audioIntro || exerciseDisplays[i]!.audioIntro,
                  audioSetup: loc.audioSetup || exerciseDisplays[i]!.audioSetup,
                  audioExecution: loc.audioExecution || exerciseDisplays[i]!.audioExecution,
                  audioTransition: loc.audioTransition || exerciseDisplays[i]!.audioTransition,
                };
              }
            }
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
    },
    [state.workout],
  );

  /**
   * Skip current exercise
   */
  const skipExercise = useCallback(() => {
    if (!state.workout) return;

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
  }, [state.workout]);

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
      const summary = generatePostWorkoutSummary(completedCount, mainOnly.length, progressions, regressions) + xpLine;

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

      try {
        for (const ex of mainOnly) {
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
          success: mainOnly.length > 0 && completedCount >= mainOnly.length * 0.8,
          sets_completed: mainOnly.reduce((acc, ex) => acc + (ex.completed ? ex.sets : 0), 0),
          duration_seconds: durationSeconds,
        });

        await flushAnalyticsQueue(120);
      } catch (analyticsError) {
        if (__DEV__) console.warn('[FitQuest] Analytics queue/flush failed:', analyticsError);
      }

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

      // Collect muscles worked from completed main exercises (reuse batch-loaded data)
      const musclesWorkedSet = new Set<string>();
      for (const ex of completedMainExercises) {
        const exercise = exerciseMap.get(ex.exerciseId);
        if (exercise) {
          exercise.primary_muscles.forEach((m: string) => musclesWorkedSet.add(m));
        }
      }

      // Compute phase breakdown
      const allExercises = state.workout.exercises;
      const warmupExercises = allExercises.filter((e: WorkoutExerciseDisplay) => e.phase === 'warmup');
      const cooldownExercises = allExercises.filter((e: WorkoutExerciseDisplay) => e.phase === 'cooldown');
      const phaseBreakdown = {
        warmup: {
          total: warmupExercises.length,
          completed: warmupExercises.filter((e: WorkoutExerciseDisplay) => e.completed).length,
        },
        main: { total: mainOnly.length, completed: completedCount },
        cooldown: {
          total: cooldownExercises.length,
          completed: cooldownExercises.filter((e: WorkoutExerciseDisplay) => e.completed).length,
        },
      };

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
        musclesWorked: Array.from(musclesWorkedSet),
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
    startWorkout,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
  };
}
