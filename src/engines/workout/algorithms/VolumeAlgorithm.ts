/**
 * Volume Algorithm
 * 
 * Prescribes sets/reps based on volume landmarks and progressive overload.
 * Tracks weekly volume per muscle to optimize gains while preventing overtraining.
 */

import type { TargetMuscle, Category, Difficulty } from '../../../database/types';
import {
  DEFAULT_VOLUME_LANDMARKS,
  getMuscleSize,
  type VolumeLandmarks,
  type WorkoutContext,
} from '../types';

// ============================================
// VOLUME PRESCRIPTION
// ============================================

/**
 * Get volume landmarks for a specific muscle
 */
export function getVolumeLandmarks(muscle: TargetMuscle): VolumeLandmarks {
  const size = getMuscleSize(muscle);
  return DEFAULT_VOLUME_LANDMARKS[size];
}

/**
 * Calculate recommended sets for a muscle based on weekly volume
 */
export function recommendSetsForMuscle(
  muscle: TargetMuscle,
  currentWeeklyVolume: number,
  sessionsRemainingThisWeek: number,
  goal: Category,
  experience: Difficulty
): number {
  const landmarks = getVolumeLandmarks(muscle);
  
  // Target MAV (Maximum Adaptive Volume) for most goals
  let targetVolume = landmarks.MAV;
  
  // Adjust target based on goal
  if (goal === 'focus' || goal === 'mobility') {
    targetVolume = landmarks.MEV; // Lower volume for recovery-focused goals
  } else if (goal === 'strength') {
    // Push towards upper end for hypertrophy
    targetVolume = (landmarks.MAV + landmarks.MRV) / 2;
  }
  
  // Adjust for experience
  if (experience === 'beginner') {
    targetVolume = Math.min(targetVolume, landmarks.MEV * 1.5);
  } else if (experience === 'advanced') {
    targetVolume = Math.min(landmarks.MRV, targetVolume * 1.2);
  }
  
  // Calculate remaining volume needed
  const remainingVolume = Math.max(0, targetVolume - currentWeeklyVolume);
  
  // Distribute evenly across remaining sessions
  if (sessionsRemainingThisWeek <= 0) {
    return 0; // Already exceeded weekly target
  }
  
  const setsPerSession = Math.ceil(remainingVolume / sessionsRemainingThisWeek);
  
  // Clamp to reasonable per-session range
  return Math.max(2, Math.min(6, setsPerSession));
}

/**
 * Calculate reps based on training type and goal
 */
export function recommendReps(
  goal: Category,
  experience: Difficulty,
  mechanicType?: 'compound' | 'isolation' | null
): string {
  // Rep ranges by goal
  const repRanges: Record<Category, Record<Difficulty, string>> = {
    strength: {
      beginner: '8-12',
      intermediate: '8-12',
      advanced: '6-12',
    },
    body_control: {
      beginner: '8-12',
      intermediate: '8-15',
      advanced: '10-20',
    },
    speed: {
      beginner: '10-15',
      intermediate: '12-20',
      advanced: '15-25',
    },
    mobility: {
      beginner: '30s hold',
      intermediate: '45s hold',
      advanced: '60s hold',
    },
    posture: {
      beginner: '30s hold',
      intermediate: '45s hold',
      advanced: '60s hold',
    },
    focus: {
      beginner: '30s hold',
      intermediate: '45s hold',
      advanced: '60s hold',
    },
  };
  
  let baseReps = repRanges[goal]?.[experience] || '8-12';
  
  // Adjust for mechanic type
  if (mechanicType === 'compound' && !baseReps.includes('hold')) {
    // Slightly lower reps for compound movements
    if (baseReps === '8-12') baseReps = '6-10';
    if (baseReps === '10-15') baseReps = '8-12';
  }
  
  return baseReps;
}

/**
 * Calculate rest period between sets
 */
export function recommendRestSeconds(
  goal: Category,
  mechanicType?: 'compound' | 'isolation' | null,
  exerciseDifficulty?: Difficulty
): number {
  // Base rest by goal (seconds)
  const baseRest: Record<Category, number> = {
    strength: 90,
    body_control: 60,
    speed: 45,
    mobility: 30,
    posture: 30,
    focus: 30,
  };
  
  let rest = baseRest[goal] || 60;
  
  // Add rest for compound movements
  if (mechanicType === 'compound') {
    rest += 30;
  }
  
  // Add rest for advanced exercises
  if (exerciseDifficulty === 'advanced') {
    rest += 15;
  }
  
  return rest;
}

/**
 * Estimate session duration based on exercises and volume
 */
export function estimateSessionDuration(
  exercises: Array<{ sets: number; restSeconds: number; timePerSetSeconds: number }>
): number {
  let totalSeconds = 0;
  
  for (const ex of exercises) {
    // Time per exercise = (sets * time_per_set) + (sets - 1) * rest
    const exerciseTime = (ex.sets * ex.timePerSetSeconds) + ((ex.sets - 1) * ex.restSeconds);
    totalSeconds += exerciseTime;
    
    // Add 60s transition between exercises
    totalSeconds += 60;
  }
  
  // Add warm-up (5 min) and cool-down (3 min)
  totalSeconds += 8 * 60;
  
  return Math.round(totalSeconds / 60); // Return minutes
}

/**
 * Progressive overload: recommend volume adjustment
 */
export function recommendVolumeAdjustment(
  recentPerformance: Array<{ completed: boolean; reps: number; difficulty: number }>,
  currentSets: number
): { newSets: number; reason: string } {
  if (recentPerformance.length < 3) {
    return { newSets: currentSets, reason: 'Need more data' };
  }
  
  // Calculate completion rate and average difficulty rating
  const completionRate = recentPerformance.filter(p => p.completed).length / recentPerformance.length;
  const avgDifficulty = recentPerformance.reduce((a, p) => a + p.difficulty, 0) / recentPerformance.length;
  
  // If crushing it (>90% completion, difficulty < 6), add volume
  if (completionRate > 0.9 && avgDifficulty < 6) {
    return { newSets: currentSets + 1, reason: 'Progressive overload - ready for more' };
  }
  
  // If struggling (<70% completion or difficulty > 8), reduce volume
  if (completionRate < 0.7 || avgDifficulty > 8) {
    return { newSets: Math.max(2, currentSets - 1), reason: 'Reduce to manage fatigue' };
  }
  
  // In the sweet spot - maintain
  return { newSets: currentSets, reason: 'Maintaining current volume' };
}

/**
 * Check if weekly volume limit would be exceeded
 */
export function checkVolumeLimits(
  muscle: TargetMuscle,
  currentWeeklyVolume: number,
  proposedSets: number
): { allowed: boolean; maxSets: number; reason?: string } {
  const landmarks = getVolumeLandmarks(muscle);
  
  const projectedVolume = currentWeeklyVolume + proposedSets;
  
  if (projectedVolume > landmarks.MRV) {
    const maxAllowed = Math.max(0, landmarks.MRV - currentWeeklyVolume);
    return {
      allowed: false,
      maxSets: maxAllowed,
      reason: `Would exceed MRV (${landmarks.MRV} sets/week) for ${muscle}`,
    };
  }
  
  if (projectedVolume > landmarks.MAV && currentWeeklyVolume < landmarks.MAV) {
    return {
      allowed: true,
      maxSets: proposedSets,
      reason: `Approaching MAV (${landmarks.MAV} sets/week) for ${muscle}`,
    };
  }
  
  return { allowed: true, maxSets: proposedSets };
}
