/**
 * Exercise Selector
 *
 * Filters, scores, and selects exercises based on user context.
 * Extracted from monolithic workoutGenerator.ts
 */

import type { ExerciseWithDetails, Category, TargetMuscle, TrainingType, Difficulty } from '../../../database/types';
import {
  GOAL_TRAINING_PRIORITIES,
  MOVEMENT_PATTERNS,
  type WorkoutContext,
  type ScoredExercise,
  type ScoreBreakdown,
  type SelectionOptions,
} from '../types';

// ============================================
// SCORING WEIGHTS
// ============================================

const SCORE_WEIGHTS = {
  muscleFreshness: 0.35,
  goalAlignment: 0.25,
  patternBalance: 0.2,
  progressionPotential: 0.15,
  variety: 0.05,
};

// ============================================
// HARD FILTERS
// ============================================

/**
 * Apply hard filters to eliminate unsuitable exercises
 */
export function applyHardFilters(
  exercises: ExerciseWithDetails[],
  context: WorkoutContext,
  options: SelectionOptions,
): ExerciseWithDetails[] {
  return exercises.filter((exercise) => {
    // 1. Equipment check
    if (!checkEquipmentAvailable(exercise, context.equipment)) {
      return false;
    }

    // 2. Injury exclusion
    if (wouldAggravateInjury(exercise, context.injuries)) {
      return false;
    }

    // 3. Difficulty match
    if (!isDifficultyAppropriate(exercise, context.profile.experience)) {
      return false;
    }

    // 4. Excluded muscles
    if (options.excludeMuscles && targetsExcludedMuscle(exercise, options.excludeMuscles)) {
      return false;
    }

    // 5. Fatigue threshold (skip if ALL primary muscles are fatigued)
    if (allPrimaryMusclesFatigued(exercise, context.fatigue, 70)) {
      return false;
    }

    return true;
  });
}

function checkEquipmentAvailable(exercise: ExerciseWithDetails, userEquipment: Set<string>): boolean {
  // No equipment needed
  if (exercise.equipment_level === 'none') return true;

  // Check if user has the required equipment
  for (const eq of exercise.equipment_required || []) {
    if (!userEquipment.has(eq)) return false;
  }

  return true;
}

function wouldAggravateInjury(
  exercise: ExerciseWithDetails,
  injuries: Map<TargetMuscle, 'mild' | 'moderate' | 'severe'>,
): boolean {
  const targetMuscles = [...(exercise.primary_muscles || []), ...(exercise.secondary_muscles || [])];

  for (const muscle of targetMuscles) {
    const severity = injuries.get(muscle as TargetMuscle);
    if (severity === 'severe') return true;
    if (severity === 'moderate' && exercise.primary_muscles?.includes(muscle)) return true;
  }

  return false;
}

function isDifficultyAppropriate(exercise: ExerciseWithDetails, experience: Difficulty): boolean {
  const allowedDifficulties: Record<Difficulty, Difficulty[]> = {
    beginner: ['beginner'],
    intermediate: ['beginner', 'intermediate'],
    advanced: ['beginner', 'intermediate', 'advanced'],
  };

  return allowedDifficulties[experience].includes(exercise.difficulty);
}

function targetsExcludedMuscle(exercise: ExerciseWithDetails, excludedMuscles: TargetMuscle[]): boolean {
  for (const muscle of excludedMuscles) {
    if (exercise.primary_muscles?.includes(muscle)) return true;
  }
  return false;
}

function allPrimaryMusclesFatigued(
  exercise: ExerciseWithDetails,
  fatigueMap: Map<TargetMuscle, number>,
  threshold: number,
): boolean {
  const primaryMuscles = exercise.primary_muscles || [];
  if (primaryMuscles.length === 0) return false;

  return primaryMuscles.every((muscle) => {
    const fatigue = fatigueMap.get(muscle as TargetMuscle) || 0;
    return fatigue > threshold;
  });
}

// ============================================
// SCORING
// ============================================

/**
 * Score all exercises for ranking
 */
export function scoreExercises(
  exercises: ExerciseWithDetails[],
  context: WorkoutContext,
  selectedPatterns: Set<string>,
): ScoredExercise[] {
  return exercises.map((exercise) => {
    const breakdown = calculateScoreBreakdown(exercise, context, selectedPatterns);
    const score =
      breakdown.muscleFreshness * SCORE_WEIGHTS.muscleFreshness +
      breakdown.goalAlignment * SCORE_WEIGHTS.goalAlignment +
      breakdown.patternBalance * SCORE_WEIGHTS.patternBalance +
      breakdown.progressionPotential * SCORE_WEIGHTS.progressionPotential +
      breakdown.variety * SCORE_WEIGHTS.variety;

    return { exercise, score, breakdown };
  });
}

function calculateScoreBreakdown(
  exercise: ExerciseWithDetails,
  context: WorkoutContext,
  selectedPatterns: Set<string>,
): ScoreBreakdown {
  return {
    muscleFreshness: scoreMuscleFreshness(exercise, context.fatigue),
    goalAlignment: scoreGoalAlignment(exercise, context.profile.goal),
    patternBalance: scorePatternBalance(exercise, selectedPatterns),
    progressionPotential: scoreProgressionPotential(exercise, context),
    variety: scoreVariety(exercise, context.recentExerciseIds),
  };
}

function scoreMuscleFreshness(exercise: ExerciseWithDetails, fatigueMap: Map<TargetMuscle, number>): number {
  const primaryMuscles = exercise.primary_muscles || [];
  if (primaryMuscles.length === 0) return 0.5;

  // Average freshness of primary muscles (100 - fatigue)
  const freshnessScores = primaryMuscles.map((muscle) => {
    const fatigue = fatigueMap.get(muscle as TargetMuscle) || 0;
    return (100 - fatigue) / 100;
  });

  return freshnessScores.reduce((a, b) => a + b, 0) / freshnessScores.length;
}

function scoreGoalAlignment(exercise: ExerciseWithDetails, goal: Category): number {
  const priorityTypes = GOAL_TRAINING_PRIORITIES[goal] || [];
  const exerciseTypes = exercise.training_types?.map((t) => t.type) || [];

  // Score based on overlap with priority training types
  let matchScore = 0;
  for (let i = 0; i < priorityTypes.length; i++) {
    if (exerciseTypes.includes(priorityTypes[i]!)) {
      // Higher score for higher priority match (earlier in list)
      matchScore += (priorityTypes.length - i) / priorityTypes.length;
    }
  }

  return Math.min(1, matchScore / 2); // Normalize
}

function scorePatternBalance(exercise: ExerciseWithDetails, selectedPatterns: Set<string>): number {
  // Identify which pattern this exercise serves
  const exercisePattern = identifyPattern(exercise);

  if (!exercisePattern) return 0.5; // Neutral if no clear pattern

  // Prefer patterns not yet selected
  if (selectedPatterns.has(exercisePattern)) {
    return 0.3; // Already have this pattern
  }

  // Bonus for filling missing patterns
  const missingPatterns = ['push', 'pull', 'legs', 'core'].filter((p) => !selectedPatterns.has(p));
  if (missingPatterns.includes(exercisePattern)) {
    return 1.0;
  }

  return 0.7;
}

function identifyPattern(exercise: ExerciseWithDetails): string | null {
  const primaryMuscles = new Set(exercise.primary_muscles || []);

  for (const [pattern, muscles] of Object.entries(MOVEMENT_PATTERNS)) {
    const overlap = muscles.filter((m) => primaryMuscles.has(m));
    if (overlap.length >= 1) {
      return pattern;
    }
  }

  return null;
}

function scoreProgressionPotential(exercise: ExerciseWithDetails, context: WorkoutContext): number {
  // Higher score for exercises user can progress on
  // Base on difficulty relative to experience
  if (exercise.difficulty === 'beginner' && context.profile.experience === 'advanced') {
    return 0.3; // Too easy
  }
  if (exercise.difficulty === 'advanced' && context.profile.experience === 'beginner') {
    return 0.2; // Too hard (shouldn't pass filter, but just in case)
  }
  if (exercise.difficulty === context.profile.experience) {
    return 0.9; // Good match
  }

  return 0.7; // Slightly below/above current level
}

function scoreVariety(exercise: ExerciseWithDetails, recentExerciseIds: Set<string>): number {
  if (recentExerciseIds.has(exercise.id)) {
    return 0.0; // Recently done
  }
  return 1.0;
}

// ============================================
// SELECTION
// ============================================

/**
 * Select exercises using greedy algorithm with constraints
 */
export function selectExercises(scoredExercises: ScoredExercise[], options: SelectionOptions): ExerciseWithDetails[] {
  // Sort by score descending
  const sorted = [...scoredExercises].sort((a, b) => b.score - a.score);

  const selected: ExerciseWithDetails[] = [];
  const selectedPatterns = new Set<string>();
  const targetedMuscles = new Set<TargetMuscle>();

  for (const { exercise } of sorted) {
    if (selected.length >= options.maxExercises) break;

    // Skip if we'd over-target a muscle
    const primaryMuscles = exercise.primary_muscles || [];
    const wouldOverTarget = primaryMuscles.some((m) => {
      return Array.from(targetedMuscles).filter((tm) => tm === m).length >= 2;
    });
    if (wouldOverTarget) continue;

    // Add to selection
    selected.push(exercise);

    // Track pattern
    const pattern = identifyPattern(exercise);
    if (pattern) selectedPatterns.add(pattern);

    // Track muscles
    primaryMuscles.forEach((m) => targetedMuscles.add(m as TargetMuscle));
  }

  // Ensure minimum
  while (selected.length < options.minExercises && sorted.length > selected.length) {
    const next = sorted.find((s) => !selected.includes(s.exercise));
    if (next) selected.push(next.exercise);
    else break;
  }

  return selected;
}

/**
 * Get exercises targeting specific focus muscles
 */
export function selectByFocusMuscles(
  exercises: ExerciseWithDetails[],
  focusMuscles: TargetMuscle[],
  maxPerMuscle: number = 2,
): ExerciseWithDetails[] {
  const result: ExerciseWithDetails[] = [];
  const muscleCount = new Map<TargetMuscle, number>();

  for (const exercise of exercises) {
    const primaryMuscles = exercise.primary_muscles || [];
    const relevantMuscles = primaryMuscles.filter((m) => focusMuscles.includes(m as TargetMuscle));

    if (relevantMuscles.length === 0) continue;

    // Check if we've hit the limit for any relevant muscle
    const canAdd = relevantMuscles.every((m) => {
      const count = muscleCount.get(m as TargetMuscle) || 0;
      return count < maxPerMuscle;
    });

    if (canAdd) {
      result.push(exercise);
      relevantMuscles.forEach((m) => {
        muscleCount.set(m as TargetMuscle, (muscleCount.get(m as TargetMuscle) || 0) + 1);
      });
    }
  }

  return result;
}
