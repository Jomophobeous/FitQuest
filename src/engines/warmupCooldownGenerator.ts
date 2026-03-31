/**
 * P6 — Warm-up & Cool-down Generator
 *
 * Selects 2-3 dynamic warm-up exercises before the main workout and
 * 2-3 static cool-down/recovery exercises after it. Choices are
 * influenced by the muscles that will be (or were) trained.
 *
 * Selection rules:
 *   Warm-up  → training_types: mobility, coordination, balance | 2-3 exercises
 *   Cool-down → training_types: recovery, decompression, mobility | 2-3 exercises
 *   Both prefer exercises targeting the workout's primary muscles.
 *   Both cap at beginner/intermediate difficulty.
 *   Volume: 1 set, 30-45 seconds per exercise.
 */

import { getExercises } from '../database/service';
import type { ExerciseWithDetails, TrainingType } from '../database/types';

// ============================================
// TYPES
// ============================================

export interface WarmupCooldownExercise {
  exercise: ExerciseWithDetails;
  sets: number;
  reps: string;
  order: number;
  /** 'warmup' | 'cooldown' — used by UI to show section headers */
  phase: 'warmup' | 'cooldown';
}

export interface WarmupCooldownResult {
  warmup: WarmupCooldownExercise[];
  cooldown: WarmupCooldownExercise[];
  warmupDurationEstimate: number; // seconds
  cooldownDurationEstimate: number; // seconds
}

// ============================================
// CONFIGURATION
// ============================================

const WARMUP_COUNT = { min: 2, max: 3 };
const COOLDOWN_COUNT = { min: 2, max: 3 };

const WARMUP_TRAINING_TYPES: TrainingType[] = ['mobility', 'coordination', 'balance'];
const COOLDOWN_TRAINING_TYPES: TrainingType[] = ['recovery', 'decompression', 'mobility'];

/** How long we budget per warm-up/cool-down exercise (seconds) */
const PER_EXERCISE_SECONDS = 45;

// ============================================
// HELPERS
// ============================================

/**
 * Score an exercise candidate for warm-up or cool-down selection.
 * Higher = better fit.
 */
function scoreCandidate(exercise: ExerciseWithDetails, targetMuscles: Set<string>, usedIds: Set<string>): number {
  let score = 0;

  // Muscle overlap — exercises that target workout muscles are more useful
  const primaryOverlap = exercise.primary_muscles.filter((m) => targetMuscles.has(m)).length;
  const secondaryOverlap = exercise.secondary_muscles.filter((m) => targetMuscles.has(m)).length;
  score += primaryOverlap * 10 + secondaryOverlap * 4;

  // Prefer beginner difficulty (gentler movement)
  if (exercise.difficulty === 'beginner') score += 5;
  else if (exercise.difficulty === 'intermediate') score += 2;

  // Prefer lower impact for warm-up/cool-down
  if (exercise.impact_level === 'no_impact') score += 4;
  else if (exercise.impact_level === 'low_impact') score += 2;

  // Prefer smaller space requirement
  if (exercise.space_required === 'mat_only_1x1') score += 3;
  else if (exercise.space_required === 'small_bedroom_2x2') score += 1;

  // Prefer no equipment
  if (exercise.equipment_level === 'none') score += 3;

  // Variety penalty — don't repeat exercises
  if (usedIds.has(exercise.id)) score -= 100;

  // Slight randomness to avoid staleness (deterministic but workout-varying)
  score += (exercise.id.charCodeAt(0) % 5) + (Date.now() % 3);

  return score;
}

/**
 * Select N exercises from candidates, scored by relevance.
 */
function selectBest(
  candidates: ExerciseWithDetails[],
  targetMuscles: Set<string>,
  count: number,
  excludeIds: Set<string>,
): ExerciseWithDetails[] {
  const scored = candidates
    .map((ex) => ({ ex, score: scoreCandidate(ex, targetMuscles, excludeIds) }))
    .sort((a, b) => b.score - a.score);

  const selected: ExerciseWithDetails[] = [];
  const usedMuscleGroups = new Set<string>();

  for (const { ex } of scored) {
    if (selected.length >= count) break;
    if (excludeIds.has(ex.id)) continue;

    // Try for muscle diversity — skip if all its primary muscles are already covered
    const newMuscle = ex.primary_muscles.some((m) => !usedMuscleGroups.has(m));
    if (selected.length >= 1 && !newMuscle && scored.length > count * 2) continue;

    selected.push(ex);
    excludeIds.add(ex.id);
    ex.primary_muscles.forEach((m) => usedMuscleGroups.add(m));
  }

  return selected;
}

// ============================================
// MAIN API
// ============================================

/**
 * Generate warm-up and cool-down exercises for a workout session.
 *
 * @param mainExercises The main workout exercises (used to determine target muscles)
 * @param mainExerciseIds IDs of main exercises (excluded from warm-up/cool-down selection)
 */
export async function generateWarmupCooldown(
  mainExercises: { exercise: ExerciseWithDetails }[],
  mainExerciseIds: Set<string>,
): Promise<WarmupCooldownResult> {
  // Collect target muscles from main workout
  const targetMuscles = new Set<string>();
  for (const { exercise } of mainExercises) {
    exercise.primary_muscles.forEach((m) => targetMuscles.add(m));
    exercise.secondary_muscles.forEach((m) => targetMuscles.add(m));
  }

  // Fetch candidates from DB
  const [warmupCandidates, cooldownCandidates] = await Promise.all([
    fetchCandidates(WARMUP_TRAINING_TYPES),
    fetchCandidates(COOLDOWN_TRAINING_TYPES),
  ]);

  // Select exercises
  const excludeIds = new Set(mainExerciseIds);

  const warmupCount =
    warmupCandidates.length >= WARMUP_COUNT.max
      ? WARMUP_COUNT.max
      : Math.max(WARMUP_COUNT.min, warmupCandidates.length);

  const warmupExercises = selectBest(warmupCandidates, targetMuscles, warmupCount, excludeIds);

  const cooldownCount =
    cooldownCandidates.length >= COOLDOWN_COUNT.max
      ? COOLDOWN_COUNT.max
      : Math.max(COOLDOWN_COUNT.min, cooldownCandidates.length);

  const cooldownExercises = selectBest(cooldownCandidates, targetMuscles, cooldownCount, excludeIds);

  // Build results
  const warmup: WarmupCooldownExercise[] = warmupExercises.map((ex, i) => ({
    exercise: ex,
    sets: 1,
    reps: '30s',
    order: i + 1,
    phase: 'warmup' as const,
  }));

  const cooldown: WarmupCooldownExercise[] = cooldownExercises.map((ex, i) => ({
    exercise: ex,
    sets: 1,
    reps: '30s',
    order: i + 1,
    phase: 'cooldown' as const,
  }));

  return {
    warmup,
    cooldown,
    warmupDurationEstimate: warmup.length * PER_EXERCISE_SECONDS,
    cooldownDurationEstimate: cooldown.length * PER_EXERCISE_SECONDS,
  };
}

/**
 * Fetch exercises matching the given training types, limited to
 * beginner/intermediate difficulty and no/minimal equipment.
 */
async function fetchCandidates(trainingTypes: TrainingType[]): Promise<ExerciseWithDetails[]> {
  try {
    const exercises = await getExercises({
      difficulties: ['beginner', 'intermediate'],
      equipment_levels: ['none', 'minimal'],
      training_types: trainingTypes,
    });
    return exercises;
  } catch (e) {
    if (__DEV__) console.warn('[WarmupCooldown] Failed to fetch candidates:', e);
    return [];
  }
}
