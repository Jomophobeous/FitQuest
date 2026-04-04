/**
 * Workout Hook Types
 * Extracted from useFitQuestWorkout for single-responsibility
 */

import type { MindTimeline } from '../../engines/MindSessionEngine';

// ============================================
// DISPLAY TYPES
// ============================================

export interface ExerciseReason {
  exercise_id: string;
  exercise_name: string;
  reason: string;
  score_breakdown?: { freshness: string; goal_alignment: string; pattern_balance: string };
}

export interface AIInsight {
  session_reason: string;
  volume_reason: string;
  exercise_reasons: ExerciseReason[];
  general_notes: string[];
}

export interface LastImpactDisplay {
  hasHistory: boolean;
  headline: string;
  trend: string;
  trendStatement: string;
  timeSince: string;
}

export interface WorkoutDelta {
  hasChanges: boolean;
  headline: string;
  removed: string[];
  added: string[];
}

export interface ProgressionNarrative {
  exerciseId: string;
  exerciseName: string;
  trend: string;
  narrative: string;
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

export interface GeneratedWorkoutDisplay {
  id: string;
  exercises: WorkoutExerciseDisplay[];
  totalDuration: number;
  isDeload: boolean;
  explanation: string;
  warnings: string[];
  aiInsight: AIInsight | null;
  lastImpact: LastImpactDisplay | null;
  workoutDelta: WorkoutDelta | null;
  progressionNarratives: ProgressionNarrative[];
  warmup: WorkoutExerciseDisplay[];
  cooldown: WorkoutExerciseDisplay[];
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
