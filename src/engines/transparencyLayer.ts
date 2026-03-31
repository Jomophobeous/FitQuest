/**
 * FitQuest Transparency Layer
 *
 * Provides human-readable explanations for every system decision.
 * Users should always know WHY something happened.
 *
 * "Trust > aesthetics" - One sentence each, no charts needed.
 */

import type { Exercise, TargetMuscle, Category, ExerciseWithDetails } from '../database/types';
import { formatMuscleName } from '../utils/formatMuscle';

// ============================================
// TYPES
// ============================================

export interface WorkoutExplanation {
  session_reason: string;
  exercise_reasons: ExerciseReason[];
  volume_reason: string;
  general_notes: string[];
}

export interface ExerciseReason {
  exercise_id: string;
  exercise_name: string;
  reason: string;
  score_breakdown?: {
    freshness: string;
    goal_alignment: string;
    pattern_balance: string;
    progression: string;
  };
}

export interface ProgressionExplanation {
  decision: 'progress' | 'maintain' | 'regress';
  reason: string;
  history_summary: string;
  next_target: string;
}

export interface DeloadExplanation {
  triggered: boolean;
  reason: string;
  trigger_factors: string[];
  duration: string;
  recommendations: string[];
}

export interface RecoveryExplanation {
  muscle: TargetMuscle;
  status: 'fresh' | 'moderate' | 'fatigued' | 'critical';
  reason: string;
  recovery_estimate: string;
}

// ============================================
// WORKOUT GENERATION EXPLANATIONS
// ============================================

/**
 * Explain why today's workout was chosen
 * Uses ExerciseWithDetails which has primary_muscles, secondary_muscles, training_types
 */
export function explainWorkoutSelection(
  selectedExercises: ExerciseWithDetails[],
  userGoal: Category,
  fatigueMap: Map<TargetMuscle, number>,
  isDeload: boolean,
  patternFocus?: string,
): WorkoutExplanation {
  const exercise_reasons: ExerciseReason[] = selectedExercises.map((ex) => {
    const primaryMuscle = ex.primary_muscles[0];
    const primaryFatigue = primaryMuscle ? fatigueMap.get(primaryMuscle) || 0 : 0;

    let reason: string;

    if (isDeload) {
      reason = `Low-intensity recovery movement targeting ${formatMuscles(ex.primary_muscles)}`;
    } else if (primaryFatigue < 30) {
      reason = `Fresh muscles (${Math.round(primaryFatigue)}% fatigue) ready for training`;
    } else if (primaryFatigue < 50) {
      reason = `Moderate fatigue (${Math.round(primaryFatigue)}%) – good for maintenance work`;
    } else {
      reason = `Included despite fatigue (${Math.round(primaryFatigue)}%) for pattern balance`;
    }

    const trainingType = ex.training_types[0]?.type || 'General';

    return {
      exercise_id: ex.id,
      exercise_name: ex.name,
      reason,
      score_breakdown: {
        freshness: primaryFatigue < 30 ? 'Excellent' : primaryFatigue < 50 ? 'Good' : 'Elevated',
        goal_alignment: ex.category === userGoal ? 'Direct match' : 'Supporting',
        pattern_balance: `${trainingType} movement`,
        progression: 'Based on recent performance',
      },
    };
  });

  let session_reason: string;
  if (isDeload) {
    session_reason = 'Deload session: Reduced volume to allow recovery and prevent burnout.';
  } else if (patternFocus) {
    session_reason = `Focus on ${patternFocus} movements – least trained pattern recently.`;
  } else {
    session_reason = `Balanced session targeting your ${formatGoal(userGoal)} goals.`;
  }

  const avgFatigue = Array.from(fatigueMap.values()).reduce((a, b) => a + b, 0) / Math.max(fatigueMap.size, 1);
  const volume_reason = isDeload
    ? 'Volume reduced by 40% for active recovery.'
    : avgFatigue > 50
      ? 'Moderate volume due to accumulated fatigue.'
      : 'Standard volume based on your experience level.';

  const general_notes: string[] = [];
  if (avgFatigue > 60) {
    general_notes.push('Consider extra rest between sets today.');
  }
  if (selectedExercises.length < 4) {
    general_notes.push('Shorter session due to recovery priorities.');
  }

  return {
    session_reason,
    exercise_reasons,
    volume_reason,
    general_notes,
  };
}

/**
 * Simplified version for basic Exercise type (without details)
 */
export function explainWorkoutSelectionBasic(
  selectedExercises: Exercise[],
  userGoal: Category,
  isDeload: boolean,
): WorkoutExplanation {
  const exercise_reasons: ExerciseReason[] = selectedExercises.map((ex) => {
    const reason = isDeload ? `Low-intensity recovery movement` : `Selected for ${ex.category} training`;

    return {
      exercise_id: ex.id,
      exercise_name: ex.name,
      reason,
    };
  });

  const session_reason = isDeload
    ? 'Deload session: Reduced volume to allow recovery and prevent burnout.'
    : `Balanced session targeting your ${formatGoal(userGoal)} goals.`;

  return {
    session_reason,
    exercise_reasons,
    volume_reason: isDeload ? 'Volume reduced by 40% for active recovery.' : 'Standard volume.',
    general_notes: [],
  };
}

// ============================================
// PROGRESSION EXPLANATIONS
// ============================================

/**
 * Explain why progression did or didn't happen
 */
export function explainProgressionDecision(
  exerciseName: string,
  decision: 'progress' | 'maintain' | 'regress',
  consecutiveSuccesses: number,
  consecutiveFailures: number,
  currentSets: number,
  currentReps: string,
  newSets?: number,
  newReps?: string,
): ProgressionExplanation {
  let reason: string;
  let history_summary: string;
  let next_target: string;

  switch (decision) {
    case 'progress':
      reason = `You completed ${exerciseName} successfully ${consecutiveSuccesses} times in a row. Time to increase the challenge!`;
      history_summary = `${consecutiveSuccesses} consecutive successful sessions`;
      next_target = newReps
        ? `Target: ${newSets || currentSets} sets × ${newReps}`
        : `Target: ${(newSets || currentSets) + 1} sets × ${currentReps}`;
      break;

    case 'regress':
      reason = `${exerciseName} was too challenging recently (${consecutiveFailures} incomplete sessions). Stepping back to build strength.`;
      history_summary = `${consecutiveFailures} consecutive incomplete sessions`;
      next_target = `Target: ${newSets || currentSets} sets × ${newReps || currentReps} (reduced)`;
      break;

    case 'maintain':
    default:
      reason = `Keep working at current level for ${exerciseName}. Consistency builds strength.`;
      history_summary =
        consecutiveSuccesses > 0
          ? `${consecutiveSuccesses} successful session(s) – one more to progress!`
          : 'Mixed recent results';
      next_target = `Target: ${currentSets} sets × ${currentReps}`;
      break;
  }

  return {
    decision,
    reason,
    history_summary,
    next_target,
  };
}

// ============================================
// DELOAD EXPLANATIONS
// ============================================

/**
 * Explain why deload was triggered (or not)
 */
export function explainDeloadStatus(
  triggered: boolean,
  averageFatigue: number,
  criticalMuscleCount: number,
  consecutiveFailures: number,
  weeksSinceLastDeload: number,
  scheduledDeloadWeek: number,
): DeloadExplanation {
  const trigger_factors: string[] = [];
  const recommendations: string[] = [];

  if (averageFatigue > 75) {
    trigger_factors.push(`High system fatigue (${Math.round(averageFatigue)}%)`);
  }
  if (criticalMuscleCount >= 3) {
    trigger_factors.push(`${criticalMuscleCount} muscle groups at critical fatigue`);
  }
  if (consecutiveFailures >= 3) {
    trigger_factors.push(`${consecutiveFailures} consecutive incomplete workouts`);
  }
  if (weeksSinceLastDeload >= scheduledDeloadWeek) {
    trigger_factors.push(`Scheduled deload (${weeksSinceLastDeload} weeks since last)`);
  }

  let reason: string;
  if (triggered) {
    if (trigger_factors.length === 1) {
      reason = trigger_factors[0]!;
    } else {
      reason = 'Multiple recovery indicators triggered deload.';
    }
    recommendations.push('Focus on sleep and nutrition this week.');
    recommendations.push('Light movement is encouraged – avoid complete rest.');
    recommendations.push('Sessions will be 40% reduced volume.');
  } else {
    reason = 'Recovery metrics within normal range.';
    if (averageFatigue > 60) {
      recommendations.push('Fatigue building – prioritize sleep.');
    }
    if (weeksSinceLastDeload > scheduledDeloadWeek - 1) {
      recommendations.push(`Scheduled deload in ${scheduledDeloadWeek - weeksSinceLastDeload} week(s).`);
    }
  }

  return {
    triggered,
    reason,
    trigger_factors,
    duration: triggered ? '7 days of reduced volume' : 'N/A',
    recommendations,
  };
}

// ============================================
// RECOVERY EXPLANATIONS
// ============================================

/**
 * Explain a muscle's recovery status
 */
export function explainMuscleRecovery(
  muscle: TargetMuscle,
  fatigueLevel: number,
  daysSinceTraining: number,
  _lastTrainingIntensity: 'light' | 'moderate' | 'heavy',
): RecoveryExplanation {
  let status: 'fresh' | 'moderate' | 'fatigued' | 'critical';
  let reason: string;
  let recovery_estimate: string;

  if (fatigueLevel < 30) {
    status = 'fresh';
    reason = `${formatMuscleName(muscle)} is fully recovered and ready for training.`;
    recovery_estimate = 'Ready now';
  } else if (fatigueLevel < 50) {
    status = 'moderate';
    reason = `${formatMuscleName(muscle)} has some residual fatigue from recent training.`;
    recovery_estimate = `~${Math.ceil((fatigueLevel - 30) / 8)} day(s) to full recovery`;
  } else if (fatigueLevel < 70) {
    status = 'fatigued';
    reason = `${formatMuscleName(muscle)} is fatigued. Training possible but not optimal.`;
    recovery_estimate = `~${Math.ceil((fatigueLevel - 30) / 8)} day(s) to full recovery`;
  } else {
    status = 'critical';
    reason = `${formatMuscleName(muscle)} needs rest. Training now risks overuse.`;
    recovery_estimate = `${Math.ceil((fatigueLevel - 30) / 8)}+ days recommended`;
  }

  if (daysSinceTraining === 0) {
    reason += ' Just trained today.';
  } else if (daysSinceTraining === 1) {
    reason += ' Trained yesterday.';
  }

  return {
    muscle,
    status,
    reason,
    recovery_estimate,
  };
}

// ============================================
// HELPER FORMATTERS
// ============================================

function formatMuscles(muscles: string[]): string {
  if (muscles.length === 0) return 'general muscles';
  if (muscles.length === 1) return formatMuscleName(muscles[0]!);
  if (muscles.length === 2) {
    return `${formatMuscleName(muscles[0]!)} and ${formatMuscleName(muscles[1]!)}`;
  }
  return `${formatMuscleName(muscles[0]!)}, ${formatMuscleName(muscles[1]!)}, and others`;
}

function formatGoal(goal: Category): string {
  const goalNames: Record<Category, string> = {
    body_control: 'bodyweight strength',
    posture: 'posture & height optimization',
    speed: 'speed & agility',
    mobility: 'flexibility & mobility',
    focus: 'mind-body wellness',
    strength: 'muscle building',
  };
  return goalNames[goal] || goal;
}

// ============================================
// SUMMARY GENERATORS
// ============================================

/**
 * Generate a one-sentence summary of today's workout
 */
export function generateWorkoutSummary(
  exerciseCount: number,
  primaryFocus: string,
  estimatedDuration: number,
  isDeload: boolean,
): string {
  if (isDeload) {
    return `Recovery session: ${exerciseCount} light exercises, ~${estimatedDuration} minutes.`;
  }
  return `${exerciseCount} exercises focusing on ${primaryFocus}, ~${estimatedDuration} minutes.`;
}

/**
 * Generate post-workout summary with progression notes
 */
export function generatePostWorkoutSummary(
  completedCount: number,
  totalCount: number,
  progressions: number,
  regressions: number,
): string {
  const completionRate = Math.round((completedCount / totalCount) * 100);

  let summary = `Completed ${completedCount}/${totalCount} exercises (${completionRate}%).`;

  if (progressions > 0) {
    summary += ` 🎯 ${progressions} exercise(s) ready to progress!`;
  }
  if (regressions > 0) {
    summary += ` Adjusted ${regressions} exercise(s) for next session.`;
  }

  return summary;
}
