/**
 * Fatigue Algorithm
 *
 * Improved fatigue tracking with exponential decay based on muscle size.
 * Larger muscles take longer to recover; small muscles recover faster.
 */

import type { TargetMuscle, MuscleFatigue } from '../../../database/types';
import { FATIGUE_DECAY_RATES, getMuscleSize, type MuscleRecoveryStatus } from '../types';

// ============================================
// FATIGUE ALGORITHM
// ============================================

/**
 * Calculate current fatigue from last training
 * Uses exponential decay: fatigue(t) = initial * e^(-λ * t)
 */
export function calculateCurrentFatigue(
  initialFatigue: number,
  hoursSinceTraining: number,
  muscle: TargetMuscle,
): number {
  const size = getMuscleSize(muscle);
  const params = FATIGUE_DECAY_RATES[size]!;

  // Exponential decay
  const currentFatigue = initialFatigue * Math.exp(-params.decayRate * hoursSinceTraining);

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(currentFatigue)));
}

/**
 * Calculate fatigue to add after training
 * Based on volume (sets) and intensity (relative difficulty)
 */
export function calculateTrainingFatigue(
  currentFatigue: number,
  setsPerformed: number,
  intensityFactor: number, // 0.5 = light, 1.0 = moderate, 1.5 = heavy
  muscle: TargetMuscle,
): number {
  const size = getMuscleSize(muscle);
  const params = FATIGUE_DECAY_RATES[size]!;

  // Base fatigue per set (higher for larger muscles)
  const fatiguePerSet = 5 * params.sensitivityFactor * intensityFactor;

  // Add fatigue with diminishing returns after ~6 sets
  const addedFatigue = fatiguePerSet * setsPerformed * Math.pow(0.95, Math.max(0, setsPerformed - 6));

  // Total fatigue capped at 100
  return Math.min(100, currentFatigue + addedFatigue);
}

/**
 * Estimate hours until muscle is ready for training
 * "Ready" = fatigue below threshold (default 30%)
 */
export function estimateRecoveryTime(currentFatigue: number, muscle: TargetMuscle, targetFatigue: number = 30): number {
  if (currentFatigue <= targetFatigue) return 0;

  const size = getMuscleSize(muscle);
  const params = FATIGUE_DECAY_RATES[size]!;

  // Solve: target = current * e^(-λ * t)
  // t = -ln(target/current) / λ
  const hours = -Math.log(targetFatigue / currentFatigue) / params.decayRate;

  return Math.max(0, Math.round(hours));
}

/**
 * Get detailed recovery status for a muscle
 */
export function getMuscleRecoveryStatus(muscle: TargetMuscle, currentFatigue: number): MuscleRecoveryStatus {
  const recoveryHours = estimateRecoveryTime(currentFatigue, muscle);

  let recommendedIntensity: 'light' | 'moderate' | 'heavy';
  if (currentFatigue > 60) {
    recommendedIntensity = 'light';
  } else if (currentFatigue > 40) {
    recommendedIntensity = 'moderate';
  } else {
    recommendedIntensity = 'heavy';
  }

  return {
    muscle,
    currentFatigue,
    projectedRecoveryHours: recoveryHours,
    readyToTrain: currentFatigue < 50,
    recommendedIntensity,
  };
}

/**
 * Batch update fatigue map with decay
 * Call this when loading current fatigue state
 */
export function applyFatigueDecay(
  fatigueRecords: Pick<MuscleFatigue, 'muscle' | 'fatigue_level' | 'last_trained_at'>[],
  currentTime: Date = new Date(),
): Map<TargetMuscle, number> {
  const result = new Map<TargetMuscle, number>();

  for (const record of fatigueRecords) {
    if (!record.last_trained_at) {
      result.set(record.muscle as TargetMuscle, 0);
      continue;
    }

    const lastTrained = new Date(record.last_trained_at);
    const hoursSince = (currentTime.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);

    const currentFatigue = calculateCurrentFatigue(record.fatigue_level, hoursSince, record.muscle as TargetMuscle);

    result.set(record.muscle as TargetMuscle, currentFatigue);
  }

  return result;
}

/**
 * Legacy fatigue calculation (simple linear decay)
 * Keep for backwards compatibility / A/B testing
 */
export function calculateLegacyFatigue(initialFatigue: number, hoursSinceTraining: number): number {
  // Original: decay 10% per day (roughly)
  const decayPerHour = 0.004; // ~10% per 24 hours
  const decayed = initialFatigue * (1 - decayPerHour * hoursSinceTraining);
  return Math.max(0, Math.round(decayed));
}

/**
 * Determine if a deload is recommended based on systemic fatigue
 */
export function shouldRecommendDeload(
  fatigueMap: Map<TargetMuscle, number>,
  recentSessionCount: number,
  weekCount: number = 4,
): boolean {
  // Calculate average fatigue across all tracked muscles
  const fatigueValues = Array.from(fatigueMap.values());
  if (fatigueValues.length === 0) return false;

  const avgFatigue = fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length;

  // Deload conditions:
  // 1. Average fatigue > 60% across all muscles
  // 2. More than 12 sessions in last 4 weeks (high frequency)
  // 3. Multiple muscles at >80% fatigue

  const highFatigueMuscles = fatigueValues.filter((f) => f > 80).length;
  const sessionsPerWeek = recentSessionCount / weekCount;

  if (avgFatigue > 60 && sessionsPerWeek > 3) return true;
  if (highFatigueMuscles >= 4) return true;
  if (avgFatigue > 70) return true;

  return false;
}
