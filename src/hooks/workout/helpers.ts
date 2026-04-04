/**
 * Workout Hook Helpers
 * Pure functions extracted from useFitQuestWorkout for deduplication.
 */

import { generateRichAudio } from '../../services/audioService';
import type { WorkoutExerciseDisplay } from './types';

// ============================================
// RECOVERY REASON MAPPER
// ============================================

/** Map raw recovery engine reasons to user-friendly messages */
export function mapRecoveryReasonToFriendly(reasons: string[], _severity: string): string {
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
// INSTRUCTION PARSER
// ============================================

/** Safely parse instructions that may be JSON array, plain text, or null */
export function safeParseInstructions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return raw ? [raw] : [];
  }
}

// ============================================
// EXERCISE DISPLAY BUILDER
// ============================================

interface SessionExerciseRow {
  id: string;
  exercise_id: string;
  name: string;
  category: string;
  prescribed_sets: number;
  prescribed_reps: string;
  completed_sets: number;
  skipped?: boolean;
  instructions: string | null;
  audio_intro?: string;
  audio_setup?: string;
  audio_execution?: string;
  audio_transition?: string;
}

/**
 * Build WorkoutExerciseDisplay[] from raw session exercise rows.
 * Used by both recoverActiveSession and loadCustomWorkout to deduplicate mapping.
 */
export function buildDisplaysFromSessionRows(
  rows: SessionExerciseRow[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  options?: { markCompleted?: boolean },
): WorkoutExerciseDisplay[] {
  return rows.map((se, i) => {
    const instructions = safeParseInstructions(se.instructions);
    const richAudio = generateRichAudio(
      {
        name: se.name,
        category: se.category,
        instructions,
        primaryMuscles: [],
        restSeconds: 60,
      },
      rows[i + 1]?.name,
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
      instructions,
      completed: options?.markCompleted ? se.completed_sets > 0 || (se.skipped ? true : false) : false,
      phase: 'main' as const,
      audioIntro: se.audio_intro || richAudio.intro,
      audioSetup: se.audio_setup || richAudio.setup,
      audioExecution: se.audio_execution || richAudio.execution,
      audioTransition: se.audio_transition || richAudio.transition,
    };
  });
}

/**
 * Build warmup/cooldown exercise displays from generator output.
 */
export function buildPhaseDisplays(
  exercises: Array<{
    exercise: {
      id: string;
      name: string;
      category: string;
      instructions?: string[];
      audio_intro?: string;
      audio_setup?: string;
      audio_execution?: string;
      audio_transition?: string;
    };
    sets: number;
    reps: string;
  }>,
  phase: 'warmup' | 'cooldown',
): WorkoutExerciseDisplay[] {
  return exercises.map((item, i) => ({
    id: `${phase}_${i}_${Date.now()}`,
    exerciseId: item.exercise.id,
    name: item.exercise.name,
    category: item.exercise.category,
    sets: item.sets,
    reps: item.reps,
    restSeconds: 15,
    instructions: item.exercise.instructions || [],
    completed: false,
    phase,
    audioIntro: item.exercise.audio_intro || '',
    audioSetup: item.exercise.audio_setup || '',
    audioExecution: item.exercise.audio_execution || '',
    audioTransition: item.exercise.audio_transition || '',
  }));
}

/**
 * Collect muscles worked from completed exercises using a pre-loaded exercise map.
 */
export function collectMusclesWorked(
  completedExercises: WorkoutExerciseDisplay[],
  exerciseMap: Map<string, { primary_muscles: string[] }>,
): string[] {
  const musclesSet = new Set<string>();
  for (const ex of completedExercises) {
    const exercise = exerciseMap.get(ex.exerciseId);
    if (exercise) {
      exercise.primary_muscles.forEach((m: string) => musclesSet.add(m));
    }
  }
  return Array.from(musclesSet);
}

/**
 * Compute phase breakdown for workout summary.
 */
export function computePhaseBreakdown(
  exercises: WorkoutExerciseDisplay[],
  mainCompletedCount: number,
): {
  warmup: { total: number; completed: number };
  main: { total: number; completed: number };
  cooldown: { total: number; completed: number };
} {
  const warmupExercises = exercises.filter((e) => e.phase === 'warmup');
  const mainExercises = exercises.filter((e) => e.phase === 'main' || !e.phase);
  const cooldownExercises = exercises.filter((e) => e.phase === 'cooldown');
  return {
    warmup: { total: warmupExercises.length, completed: warmupExercises.filter((e) => e.completed).length },
    main: { total: mainExercises.length, completed: mainCompletedCount },
    cooldown: { total: cooldownExercises.length, completed: cooldownExercises.filter((e) => e.completed).length },
  };
}

// ============================================
// LOCALIZATION OVERLAY
// ============================================

interface LocalizedExercise {
  isFallback: boolean;
  name: string;
  instructions: string[];
  audioIntro?: string;
  audioSetup?: string;
  audioExecution?: string;
  audioTransition?: string;
}

/**
 * Overlay localized names/instructions/audio onto exercise displays.
 * Mutates the array in-place for performance.
 */
export function overlayLocalization(
  displays: WorkoutExerciseDisplay[],
  localizedMap: Map<string, LocalizedExercise>,
): void {
  for (let i = 0; i < displays.length; i++) {
    const loc = localizedMap.get(displays[i]!.exerciseId);
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
}
