/**
 * FitQuest Workout Generation Algorithm - Type Definitions
 * Deterministic, rule-based, 100% offline
 */

// ============================================================================
// USER PROFILE VECTOR (LOCKED AFTER SETUP)
// ============================================================================

export type Goal = 'strength' | 'hypertrophy' | 'fat_loss' | 'endurance' | 'mobility';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'resistance_band' | 'bodyweight' | 'medicine_ball';
export type Muscle = 
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' 
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'obliques' | 'lower_back'
  | 'hips' | 'spine' | 'upper_back' | 'arms' | 'legs' | 'all';
export type MovementPattern = 'push' | 'pull' | 'leg' | 'core' | 'mobility';

export interface UserProfile {
  id: string;
  sex?: 'male' | 'female' | 'other';
  weight: number; // kg
  height?: number; // cm
  goal: Goal;
  experience: Experience;
  equipment_available: Equipment[];
  time_per_session: number; // minutes
  training_days_per_week: number; // 1-7
  injury_constraints: string[]; // e.g. ['lower_back', 'shoulder']
  created_at: string;
}

// ============================================================================
// CORE STATE (LOCAL, MUTABLE)
// ============================================================================

export interface SessionRecord {
  id: string;
  date: string; // ISO 8601
  exercises: CompletedExercise[];
  duration_minutes: number;
  notes?: string;
  completed: boolean;
  fatigue_post_workout?: number; // 0-100
}

export interface CompletedExercise {
  exercise_id: string;
  sets_completed: number;
  reps_completed: number[];
  weight_used?: number;
  difficulty_felt?: number; // 1-10
  success: boolean;
}

export interface MuscleFatigueMap {
  [muscle: string]: number; // 0-100
}

export interface WorkoutGeneratorState {
  user_profile: UserProfile;
  last_7_sessions: SessionRecord[];
  muscle_fatigue_map: MuscleFatigueMap;
  current_week: number;
  streak: number; // consecutive workouts completed
  deload_flag: boolean;
  last_updated: string;
}

// ============================================================================
// EXERCISE DATABASE
// ============================================================================

export interface ExerciseRecord {
  id: string;
  name: string;
  primary_muscle: Muscle;
  secondary_muscles: Muscle[];
  movement_pattern: MovementPattern;
  equipment_required: Equipment[];
  difficulty: Experience;
  goal_alignment: Goal[]; // which goals is this good for?
  time_to_perform_sec: number; // per set
  rep_profile: RepProfile;
  injury_safe_for: Muscle[]; // if user injured here, can still do this
  instructions?: string;
  image_url?: string;
}

export interface RepProfile {
  min_reps: number;
  max_reps: number;
  ideal_reps: number;
  tempo?: string; // e.g. "4-0-2-0"
}

// ============================================================================
// GENERATED WORKOUT
// ============================================================================

export interface GeneratedWorkout {
  id: string;
  date: string;
  session_intent: SessionIntent;
  exercises: ExerciseWithPrescription[];
  total_estimated_duration: number; // minutes
  fatigue_estimate_post: number; // 0-100
  subscription_required: boolean;
}

export interface SessionIntent {
  focus_muscle: Muscle;
  focus_pattern: MovementPattern;
  recovery_priority: boolean;
  deload: boolean;
}

export interface ExerciseWithPrescription {
  exercise: ExerciseRecord;
  sets: number;
  rep_range: [number, number]; // min-max
  intensity_modifier: number; // 0.8-1.2
  rest_seconds: number;
  notes?: string;
  progression_recommendation?: string;
}

// ============================================================================
// SUBSCRIPTION GATING
// ============================================================================

export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  active: boolean;
  expires_at?: string;
  grace_period_remaining: number; // days, 0-7
}

export type FeatureGate = 
  | 'workout_generation'
  | 'progression'
  | 'history_tracking'
  | 'fatigue_analytics'
  | 'deload_suggestion';

// ============================================================================
// CONFIGURATION TABLES
// ============================================================================

export interface GoalConfig {
  base_sets: {
    [key in Experience]: number;
  };
  rep_range: {
    [key in Experience]: [number, number];
  };
  frequency_per_week: number;
  deload_every_weeks: number;
}

export const GOAL_CONFIGURATIONS: Record<Goal, GoalConfig> = {
  strength: {
    base_sets: { beginner: 3, intermediate: 4, advanced: 5 },
    rep_range: { beginner: [6, 8], intermediate: [4, 6], advanced: [3, 5] },
    frequency_per_week: 4,
    deload_every_weeks: 4,
  },
  hypertrophy: {
    base_sets: { beginner: 3, intermediate: 4, advanced: 5 },
    rep_range: { beginner: [8, 12], intermediate: [8, 12], advanced: [6, 12] },
    frequency_per_week: 4,
    deload_every_weeks: 6,
  },
  fat_loss: {
    base_sets: { beginner: 2, intermediate: 3, advanced: 4 },
    rep_range: { beginner: [12, 15], intermediate: [10, 15], advanced: [8, 15] },
    frequency_per_week: 5,
    deload_every_weeks: 8,
  },
  endurance: {
    base_sets: { beginner: 2, intermediate: 3, advanced: 3 },
    rep_range: { beginner: [15, 20], intermediate: [12, 20], advanced: [10, 20] },
    frequency_per_week: 4,
    deload_every_weeks: 6,
  },
  mobility: {
    base_sets: { beginner: 2, intermediate: 2, advanced: 2 },
    rep_range: { beginner: [10, 15], intermediate: [10, 15], advanced: [10, 15] },
    frequency_per_week: 2,
    deload_every_weeks: 8,
  },
};

export const FATIGUE_CONSTANTS = {
  DAILY_RECOVERY_RATE: 8, // % per day
  FATIGUE_THRESHOLD_FOR_EXERCISE_SKIP: 70,
  FATIGUE_THRESHOLD_FOR_DELOAD: 75,
  SET_INTENSITY_FACTOR: 15, // per set
  FAILURE_THRESHOLD: 3, // consecutive failures trigger deload
  GRACE_PERIOD_DAYS: 7, // offline grace period for subscriptions
};

export const MINIMUM_EXERCISE_REQUIREMENTS = {
  push: 1,
  pull: 1,
  leg: 1,
  core: 1,
};

export const SESSION_EXERCISE_COUNT = {
  min: 4,
  max: 6,
};
