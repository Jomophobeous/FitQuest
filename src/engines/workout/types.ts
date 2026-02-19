/**
 * Workout Engine Types
 * 
 * Shared interfaces for the modular workout generation system.
 */

import type {
  ExerciseWithDetails,
  UserProfile,
  MuscleFatigue,
  Category,
  TargetMuscle,
  TrainingType,
  Difficulty,
} from '../../database/types';

// ============================================
// CORE ENGINE TYPES
// ============================================

/**
 * User context for workout generation
 */
export interface WorkoutContext {
  profile: UserProfile;
  fatigue: Map<TargetMuscle, number>;
  injuries: Map<TargetMuscle, 'mild' | 'moderate' | 'severe'>;
  equipment: Set<string>;
  recentExerciseIds: Set<string>;
  recentlyTrainedMuscles: Set<TargetMuscle>;
  weeklyVolume: Map<TargetMuscle, number>;
  adaptiveProfile?: AdaptiveTrainingProfile;
}

/**
 * Adaptive training profile from recent history
 */
export interface AdaptiveTrainingProfile {
  preferredDifficulty: Difficulty;
  averageSessionDuration: number;
  completionRate: number;
  strengthTrend: 'improving' | 'maintaining' | 'declining';
  recommendedDeload: boolean;
}

/**
 * Exercise selection options
 */
export interface SelectionOptions {
  minExercises: number;
  maxExercises: number;
  targetDuration?: number;
  focusMuscles?: TargetMuscle[];
  excludeMuscles?: TargetMuscle[];
  preferredTrainingTypes?: TrainingType[];
  requirePatternBalance?: boolean;
}

/**
 * Scored exercise candidate
 */
export interface ScoredExercise {
  exercise: ExerciseWithDetails;
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Score component breakdown
 */
export interface ScoreBreakdown {
  muscleFreshness: number;
  goalAlignment: number;
  patternBalance: number;
  progressionPotential: number;
  variety: number;
}

/**
 * Selected exercise with prescribed volume
 */
export interface PrescribedExercise {
  exercise: ExerciseWithDetails;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

/**
 * Generated workout plan
 */
export interface WorkoutPlan {
  id: string;
  userId: string;
  exercises: PrescribedExercise[];
  estimatedDuration: number;
  targetMuscles: TargetMuscle[];
  trainingTypes: TrainingType[];
  generatedAt: Date;
  templateUsed?: string;
}

// ============================================
// ALGORITHM TYPES
// ============================================

/**
 * Volume landmarks per muscle group (sets per week)
 */
export interface VolumeLandmarks {
  MV: number;   // Maintenance Volume - minimum to maintain gains
  MEV: number;  // Minimum Effective Volume - minimum to make progress
  MAV: number;  // Maximum Adaptive Volume - optimal for most people
  MRV: number;  // Maximum Recoverable Volume - upper limit
}

/**
 * Fatigue decay parameters per muscle
 */
export interface FatigueParams {
  decayRate: number;      // λ in exponential decay (higher = faster recovery)
  sensitivityFactor: number;  // How much a single session adds
}

/**
 * Recovery status for a muscle
 */
export interface MuscleRecoveryStatus {
  muscle: TargetMuscle;
  currentFatigue: number;
  projectedRecoveryHours: number;
  readyToTrain: boolean;
  recommendedIntensity: 'light' | 'moderate' | 'heavy';
}

// ============================================
// TEMPLATE TYPES
// ============================================

/**
 * Workout template definition
 */
export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  targetGoals: Category[];
  muscleGroups: TargetMuscle[][];  // Groups to hit each session
  sessionsPerWeek: number;
  estimatedDuration: number;
  volumeMultiplier: number;
}

/**
 * Template slot for exercise selection
 */
export interface TemplateSlot {
  muscleTargets: TargetMuscle[];
  trainingTypes: TrainingType[];
  minSets: number;
  maxSets: number;
  isRequired: boolean;
}

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Feature flags for A/B testing
 */
export interface WorkoutEngineFlags {
  useNewFatigueModel: boolean;
  useVolumeLandmarks: boolean;
  useAdaptiveProgression: boolean;
  useMuscleBalancer: boolean;
  legacyFallback: boolean;
}

/**
 * Default feature flags (conservative - legacy behavior)
 */
export const DEFAULT_FLAGS: WorkoutEngineFlags = {
  useNewFatigueModel: false,
  useVolumeLandmarks: false,
  useAdaptiveProgression: false,
  useMuscleBalancer: true,
  legacyFallback: true,
};

// ============================================
// CONSTANTS
// ============================================

/**
 * Movement pattern to muscle mapping
 */
export const MOVEMENT_PATTERNS: Record<string, TargetMuscle[]> = {
  push: ['chest_mid', 'chest_upper', 'chest_lower', 'deltoids_front', 'triceps'],
  pull: ['lats', 'rhomboids', 'biceps', 'deltoids_rear', 'traps_mid'],
  legs: ['quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius'],
  core: ['abs', 'obliques', 'core_deep', 'lower_back'],
  hinge: ['lower_back', 'glutes_max', 'hamstrings'],
  squat: ['quads', 'glutes_max', 'adductors'],
};

/**
 * Goal to training type priority mapping
 */
export const GOAL_TRAINING_PRIORITIES: Record<Category, TrainingType[]> = {
  body_control: ['strength', 'hypertrophy', 'endurance'],
  posture: ['decompression', 'mobility', 'posture'],
  speed: ['speed_power', 'endurance', 'coordination'],
  mobility: ['mobility', 'recovery'],
  focus: ['mindfulness', 'recovery', 'balance'],
  strength: ['hypertrophy', 'strength'],
};

/**
 * Default volume landmarks by muscle (sets per week)
 */
export const DEFAULT_VOLUME_LANDMARKS: Record<string, VolumeLandmarks> = {
  large: { MV: 6, MEV: 10, MAV: 18, MRV: 22 },   // chest, back, quads
  medium: { MV: 4, MEV: 8, MAV: 14, MRV: 18 },   // shoulders, glutes, hamstrings
  small: { MV: 2, MEV: 4, MAV: 10, MRV: 14 },    // biceps, triceps, calves
  core: { MV: 4, MEV: 6, MAV: 16, MRV: 20 },     // abs, obliques
};

/**
 * Fatigue decay rates by muscle size (larger muscles recover slower)
 */
export const FATIGUE_DECAY_RATES: Record<string, FatigueParams> = {
  large: { decayRate: 0.02, sensitivityFactor: 1.2 },   // ~35 hrs half-life
  medium: { decayRate: 0.03, sensitivityFactor: 1.0 },  // ~23 hrs half-life
  small: { decayRate: 0.04, sensitivityFactor: 0.8 },   // ~17 hrs half-life
  core: { decayRate: 0.05, sensitivityFactor: 0.6 },    // ~14 hrs half-life
};

/**
 * Muscle size classification
 * Uses Partial since not all muscles may be classified
 */
export const MUSCLE_SIZE_MAP: Partial<Record<TargetMuscle, 'large' | 'medium' | 'small' | 'core'>> = {
  // Large muscles
  chest_upper: 'large',
  chest_mid: 'large',
  chest_lower: 'large',
  lats: 'large',
  quads: 'large',
  
  // Medium muscles
  shoulders: 'medium',
  deltoids_front: 'medium',
  deltoids_rear: 'medium',
  glutes_max: 'medium',
  glutes_med: 'medium',
  hamstrings: 'medium',
  rhomboids: 'medium',
  traps_upper: 'medium',
  traps_mid: 'medium',
  
  // Small muscles
  biceps: 'small',
  triceps: 'small',
  forearms: 'small',
  calves_gastrocnemius: 'small',
  calves_soleus: 'small',
  adductors: 'small',
  hip_flexors: 'small',
  rotator_cuff: 'small',
  serratus: 'small',
  
  // Core muscles
  abs: 'core',
  obliques: 'core',
  core_deep: 'core',
  lower_back: 'core',
  neck: 'core',
  pecs: 'large',
  // Additional muscles with defaults
  ankle: 'small',
  brachialis: 'small',
  deltoids_lateral: 'medium',
  erector_spinae: 'medium',
  glutes_min: 'medium',
  scapular_stabilisers: 'small',
  shin_tibialis: 'small',
  spinal_erectors: 'medium',
  vagus_nerve: 'small',
  whole_body: 'large',
};

/**
 * Helper to get muscle size with fallback
 */
export function getMuscleSize(muscle: TargetMuscle): 'large' | 'medium' | 'small' | 'core' {
  return MUSCLE_SIZE_MAP[muscle] ?? 'medium';
}
