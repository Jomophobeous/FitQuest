/**
 * Muscle Balancer
 *
 * Ensures balanced muscle targeting across workouts.
 * Tracks weekly volume per muscle and recommends focus areas.
 */

import type { TargetMuscle, Category, ExerciseWithDetails } from '../../../database/types';
import { MOVEMENT_PATTERNS, DEFAULT_VOLUME_LANDMARKS, getMuscleSize } from '../types';

// ============================================
// MUSCLE GROUP DEFINITIONS
// ============================================

/**
 * Agonist-Antagonist pairs for balance
 */
const ANTAGONIST_PAIRS: [TargetMuscle, TargetMuscle][] = [
  ['chest_mid', 'rhomboids'],
  ['chest_upper', 'traps_mid'],
  ['biceps', 'triceps'],
  ['quads', 'hamstrings'],
  ['deltoids_front', 'deltoids_rear'],
  ['abs', 'lower_back'],
  ['hip_flexors', 'glutes_max'],
];

/**
 * Synergist groups (muscles that work together)
 */
const SYNERGIST_GROUPS: Record<string, TargetMuscle[]> = {
  push_upper: ['chest_mid', 'chest_upper', 'deltoids_front', 'triceps'],
  pull_upper: ['lats', 'rhomboids', 'biceps', 'deltoids_rear', 'traps_mid'],
  quad_dominant: ['quads', 'glutes_max', 'core_deep'],
  hip_dominant: ['hamstrings', 'glutes_max', 'lower_back'],
  core: ['abs', 'obliques', 'core_deep', 'lower_back'],
};

// ============================================
// BALANCE ANALYSIS
// ============================================

export interface BalanceAnalysis {
  overworkedMuscles: TargetMuscle[];
  underworkedMuscles: TargetMuscle[];
  imbalancedPairs: Array<{ strong: TargetMuscle; weak: TargetMuscle; ratio: number }>;
  recommendedFocus: TargetMuscle[];
  overallBalance: number; // 0-100
}

/**
 * Analyze muscle balance based on weekly volume
 */
export function analyzeBalance(weeklyVolume: Map<TargetMuscle, number>, goal: Category): BalanceAnalysis {
  const overworked: TargetMuscle[] = [];
  const underworked: TargetMuscle[] = [];
  const imbalanced: Array<{ strong: TargetMuscle; weak: TargetMuscle; ratio: number }> = [];

  // Check each muscle against landmarks
  for (const [muscle, volume] of weeklyVolume) {
    const size = getMuscleSize(muscle);
    const landmarks = DEFAULT_VOLUME_LANDMARKS[size];
    if (!landmarks) continue;

    if (volume > landmarks.MAV) {
      overworked.push(muscle);
    } else if (volume < landmarks.MEV) {
      underworked.push(muscle);
    }
  }

  // Check agonist-antagonist balance
  for (const [agonist, antagonist] of ANTAGONIST_PAIRS) {
    const agonistVol = weeklyVolume.get(agonist) || 0;
    const antagonistVol = weeklyVolume.get(antagonist) || 0;

    if (agonistVol === 0 && antagonistVol === 0) continue;

    // Calculate ratio (should be close to 1.0 for balance)
    const ratio = agonistVol / Math.max(1, antagonistVol);

    if (ratio > 1.5) {
      imbalanced.push({ strong: agonist, weak: antagonist, ratio });
    } else if (ratio < 0.67) {
      imbalanced.push({ strong: antagonist, weak: agonist, ratio: 1 / ratio });
    }
  }

  // Recommend focus areas
  const recommendedFocus: TargetMuscle[] = [...underworked.slice(0, 3), ...imbalanced.map((i) => i.weak).slice(0, 2)];

  // Calculate overall balance score
  const overallBalance = calculateBalanceScore(weeklyVolume, overworked, underworked, imbalanced);

  return {
    overworkedMuscles: overworked,
    underworkedMuscles: underworked,
    imbalancedPairs: imbalanced,
    recommendedFocus: [...new Set(recommendedFocus)],
    overallBalance,
  };
}

function calculateBalanceScore(
  weeklyVolume: Map<TargetMuscle, number>,
  overworked: TargetMuscle[],
  underworked: TargetMuscle[],
  imbalanced: Array<{ strong: TargetMuscle; weak: TargetMuscle; ratio: number }>,
): number {
  let score = 100;

  // Deduct for overworked muscles
  score -= overworked.length * 5;

  // Deduct for underworked muscles
  score -= underworked.length * 3;

  // Deduct for imbalances (more severe deduction)
  for (const pair of imbalanced) {
    const severity = Math.min(20, (pair.ratio - 1.5) * 10);
    score -= severity;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================
// PATTERN BALANCE
// ============================================

export interface PatternBalance {
  push: number;
  pull: number;
  legs: number;
  core: number;
}

/**
 * Analyze movement pattern balance for a workout
 */
export function analyzePatternBalance(exercises: ExerciseWithDetails[]): PatternBalance {
  const balance: PatternBalance = {
    push: 0,
    pull: 0,
    legs: 0,
    core: 0,
  };

  for (const exercise of exercises) {
    const primaryMuscles = new Set(exercise.primary_muscles || []);

    for (const [pattern, muscles] of Object.entries(MOVEMENT_PATTERNS)) {
      const overlap = muscles.filter((m) => primaryMuscles.has(m)).length;
      if (overlap > 0 && pattern in balance) {
        const key = pattern as keyof PatternBalance;
        balance[key] += overlap;
      }
    }
  }

  return balance;
}

/**
 * Check if a workout is reasonably balanced
 */
export function isPatternBalanced(balance: PatternBalance, minPatterns: number = 2): boolean {
  const patterns = Object.values(balance).filter((v) => v > 0);
  return patterns.length >= minPatterns;
}

/**
 * Get recommended pattern to add
 */
export function getMissingPatterns(balance: PatternBalance): string[] {
  return Object.entries(balance)
    .filter(([_, count]) => count === 0)
    .map(([pattern]) => pattern);
}

// ============================================
// RECOVERY OPTIMIZATION
// ============================================

/**
 * Suggest optimal training splits based on balance
 */
export function suggestTrainingSplit(weeklyVolume: Map<TargetMuscle, number>, sessionsPerWeek: number): string[] {
  const analysis = analyzeBalance(weeklyVolume, 'body_control');

  if (sessionsPerWeek <= 2) {
    return ['Full Body', 'Full Body'];
  }

  if (sessionsPerWeek === 3) {
    if (analysis.imbalancedPairs.length > 0) {
      return ['Push', 'Pull', 'Legs + Focus'];
    }
    return ['Full Body A', 'Full Body B', 'Full Body C'];
  }

  if (sessionsPerWeek === 4) {
    return ['Upper Push', 'Lower', 'Upper Pull', 'Full Body'];
  }

  // 5+ sessions
  return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
}

/**
 * Calculate muscle overlap between two exercises
 */
export function calculateMuscleOverlap(exercise1: ExerciseWithDetails, exercise2: ExerciseWithDetails): number {
  const muscles1 = new Set(exercise1.primary_muscles || []);
  const muscles2 = new Set(exercise2.primary_muscles || []);

  const intersection = [...muscles1].filter((m) => muscles2.has(m));
  const union = new Set([...muscles1, ...muscles2]);

  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/**
 * Order exercises to minimize consecutive same-muscle stress
 */
export function optimizeExerciseOrder(exercises: ExerciseWithDetails[]): ExerciseWithDetails[] {
  if (exercises.length <= 2) return exercises;

  const ordered: ExerciseWithDetails[] = [exercises[0]!];
  const remaining = exercises.slice(1);

  while (remaining.length > 0) {
    const lastExercise = ordered[ordered.length - 1]!;

    // Find exercise with least overlap to last one
    let bestIndex = 0;
    let bestOverlap = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const overlap = calculateMuscleOverlap(lastExercise, remaining[i]!);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestIndex = i;
      }
    }

    ordered.push(remaining[bestIndex]!);
    remaining.splice(bestIndex, 1);
  }

  return ordered;
}
