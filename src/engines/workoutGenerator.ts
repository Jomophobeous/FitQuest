/**
 * ENGINE 1 — Workout Generator
 * 
 * The Brain: Deterministic, rule-based workout generation
 * 
 * Consumes: exercises, user_profile, muscle_fatigue, workout_sessions
 * Produces: workout_sessions (planned), session_exercises (prescribed)
 */

import {
  getExercises,
  getUserProfile,
  getMuscleFatigue,
  getRecentSessions,
  getUserEquipment,
  getUserInjuries,
  createWorkoutSession,
  addSessionExercise,
  getRecentExerciseIds,
  getRecentlyTrainedMuscles,
  getProgressHistory,
} from '../database/service';
import { generateSecureId } from '../security/randomId';
import { getAdaptiveTrainingProfile, type AdaptiveTrainingProfile } from '../services/adaptiveTrainingService';
import type {
  ExerciseWithDetails,
  UserProfile,
  MuscleFatigue,
  WorkoutSession,
  SessionExercise,
  Category,
  TargetMuscle,
  TrainingType,
  ExerciseFilter,
} from '../database/types';

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

const FATIGUE_THRESHOLD = 70; // Skip muscle if fatigue > this
const FATIGUE_SOFT_PENALTY_START = 50; // Begin scoring penalty at this level
const MIN_EXERCISES = 4;
const MAX_EXERCISES = 6;
const RECENCY_PENALTY_HOURS = 48;

/** Scoring weights (must sum to 1.0) */
const SCORE_WEIGHTS = {
  muscle_freshness: 0.35,
  goal_alignment: 0.25,
  pattern_balance: 0.20,
  progression_potential: 0.15,
  variety: 0.05,
};

/** Movement pattern requirements */
const PATTERN_REQUIREMENTS: Record<string, TargetMuscle[]> = {
  push: ['chest_mid', 'chest_upper', 'chest_lower', 'deltoids_front', 'triceps'],
  pull: ['lats', 'rhomboids', 'biceps', 'deltoids_rear', 'traps_mid'],
  legs: ['quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius'],
  core: ['abs', 'obliques', 'core_deep', 'lower_back'],
};

/** Goal to training type mapping */
const GOAL_TRAINING_TYPES: Record<Category, TrainingType[]> = {
  body_control: ['strength', 'hypertrophy', 'endurance'],
  posture: ['decompression', 'mobility', 'posture'],
  speed: ['speed_power', 'endurance', 'coordination'],
  mobility: ['mobility', 'recovery'],
  focus: ['mindfulness', 'recovery', 'balance'],
  strength: ['hypertrophy', 'strength'],
};

/** Volume presets by goal and experience */
const VOLUME_PRESETS: Record<Category, Record<string, { sets: number; reps: string }>> = {
  body_control: {
    beginner: { sets: 3, reps: '8-12' },
    intermediate: { sets: 4, reps: '8-15' },
    advanced: { sets: 4, reps: '10-20' },
  },
  strength: {
    beginner: { sets: 3, reps: '8-12' },
    intermediate: { sets: 4, reps: '8-12' },
    advanced: { sets: 5, reps: '6-12' },
  },
  posture: {
    beginner: { sets: 2, reps: '30s hold' },
    intermediate: { sets: 3, reps: '45s hold' },
    advanced: { sets: 3, reps: '60s hold' },
  },
  speed: {
    beginner: { sets: 3, reps: '10-15' },
    intermediate: { sets: 4, reps: '12-20' },
    advanced: { sets: 5, reps: '15-25' },
  },
  mobility: {
    beginner: { sets: 2, reps: '30s hold' },
    intermediate: { sets: 2, reps: '45s hold' },
    advanced: { sets: 3, reps: '60s hold' },
  },
  focus: {
    beginner: { sets: 2, reps: '60s hold' },
    intermediate: { sets: 3, reps: '90s hold' },
    advanced: { sets: 3, reps: '120s hold' },
  },
};

// ============================================
// TYPES
// ============================================

interface SessionIntent {
  focus_muscles: TargetMuscle[];
  focus_pattern: keyof typeof PATTERN_REQUIREMENTS | null;
  training_types: TrainingType[];
  is_deload: boolean;
}

interface ScoredExercise {
  exercise: ExerciseWithDetails;
  score: number;
  breakdown: {
    freshness: number;
    goal: number;
    pattern: number;
    progression: number;
    variety: number;
  };
}

interface GeneratedWorkout {
  session_id: string;
  exercises: {
    exercise: ExerciseWithDetails;
    sets: number;
    reps: string;
    order: number;
  }[];
  total_duration_estimate: number;
  intent: SessionIntent;
}

// ============================================
// STEP 1: DETERMINE SESSION INTENT
// ============================================

async function determineSessionIntent(
  userId: string,
  profile: UserProfile,
  fatigueMap: Map<TargetMuscle, number>,
  recentSessions: WorkoutSession[],
  deloadFlag: boolean
): Promise<SessionIntent> {
  // Get recently trained muscles from last 48h
  const recentlyTrained = new Set<TargetMuscle>();
  const cutoff = new Date(Date.now() - RECENCY_PENALTY_HOURS * 3600 * 1000).toISOString();
  const recentMuscles = await getRecentlyTrainedMuscles(userId, cutoff);
  recentMuscles.forEach((muscle) => recentlyTrained.add(muscle as TargetMuscle));

  // Find freshest pattern (lowest avg fatigue, not recently trained)
  let bestPattern: keyof typeof PATTERN_REQUIREMENTS | null = null;
  let lowestFatigue = Infinity;

  for (const [pattern, muscles] of Object.entries(PATTERN_REQUIREMENTS)) {
    const patternMuscles = muscles.filter(m => !recentlyTrained.has(m));
    if (patternMuscles.length === 0) continue;

    const avgFatigue = patternMuscles.reduce((sum, m) => sum + (fatigueMap.get(m) || 0), 0) / patternMuscles.length;
    if (avgFatigue < lowestFatigue) {
      lowestFatigue = avgFatigue;
      bestPattern = pattern as keyof typeof PATTERN_REQUIREMENTS;
    }
  }

  // Focus muscles = pattern muscles that aren't fatigued
  const focusMuscles = bestPattern
    ? PATTERN_REQUIREMENTS[bestPattern].filter(m => (fatigueMap.get(m) || 0) < FATIGUE_THRESHOLD)
    : [];

  return {
    focus_muscles: focusMuscles,
    focus_pattern: bestPattern,
    training_types: GOAL_TRAINING_TYPES[profile.goal],
    is_deload: deloadFlag,
  };
}

// ============================================
// STEP 2: HARD FILTER (DATABASE QUERY)
// ============================================

async function applyHardFilter(
  userId: string,
  profile: UserProfile,
  fatigueMap: Map<TargetMuscle, number>,
  intent: SessionIntent,
  adaptive: AdaptiveTrainingProfile
): Promise<ExerciseWithDetails[]> {
  // Get user's available equipment
  const userEquipment = await getUserEquipment(userId);
  const injuries = await getUserInjuries(userId);
  const injuredMuscles = new Set(injuries.filter(i => i.severity !== 'mild').map(i => i.muscle));

  // Build filter for primary goal
  const filter: ExerciseFilter = {
    categories: [profile.goal],
    difficulties: getDifficultyRange(profile.experience),
    training_types: intent.training_types,
  };

  if (__DEV__) console.log(`[WorkoutGen] Hard filter: goal="${profile.goal}", difficulties=${JSON.stringify(getDifficultyRange(profile.experience))}, training_types=${JSON.stringify(intent.training_types)}`);

  // Hard filters that need post-processing
  // FIX: Run fallback logic on the FILTERED candidates, not the raw DB result
  // If we have candidates but they all get filtered out by equipment/injuries, we need more candidates!
  
  const filterCandidates = (candList: ExerciseWithDetails[]) => {
    return candList.filter(ex => {
      // Equipment check
      if (ex.equipment_required.length > 0) {
        const hasAllRequired = ex.equipment_required.every(eq => userEquipment.includes(eq));
        if (!hasAllRequired) return false;
      }

      // Injury check - exclude if primary muscle is injured
      for (const muscle of ex.primary_muscles) {
        if (injuredMuscles.has(muscle)) return false;
      }

      // Fatigue check - skip if ANY primary muscle is over threshold
      const fatigueThreshold = Math.round(
        FATIGUE_THRESHOLD - (adaptive.fatigueSensitivity - 1) * 20
      );
      for (const muscle of ex.primary_muscles) {
        const fatigue = fatigueMap.get(muscle) || 0;
        if (fatigue > fatigueThreshold) return false;
      }

      return true;
    });
  };

  // 1. Try Primary Filter
  let rawCandidates = await getExercises(filter);
  let validCandidates = filterCandidates(rawCandidates);
  if (__DEV__) console.log(`[WorkoutGen] Primary filter: ${rawCandidates.length} found, ${validCandidates.length} valid`);

  // 2. Fallback: Category Only
  if (validCandidates.length < 4) {
    if (__DEV__) console.log(`[WorkoutGen] Only ${validCandidates.length} valid candidates. Expanding to category...`);
    const expandedFilter: ExerciseFilter = {
      categories: [profile.goal],
      difficulties: getDifficultyRange(profile.experience),
    };
    rawCandidates = await getExercises(expandedFilter);
    validCandidates = filterCandidates(rawCandidates); // Re-filter
    if (__DEV__) console.log(`[WorkoutGen] Category fallback: ${rawCandidates.length} found, ${validCandidates.length} valid`);
  }

  // 3. Fallback: Cross-Category (Training Type match)
  if (validCandidates.length < 4) {
    if (__DEV__) console.log(`[WorkoutGen] Still only ${validCandidates.length} valid. Expanding to cross-category...`);
    const crossCategoryFilter: ExerciseFilter = {
      difficulties: getDifficultyRange(profile.experience),
      training_types: intent.training_types,
    };
    rawCandidates = await getExercises(crossCategoryFilter);
    validCandidates = filterCandidates(rawCandidates);
    if (__DEV__) console.log(`[WorkoutGen] Cross-category fallback: ${rawCandidates.length} found, ${validCandidates.length} valid`);
  }

  // 4. Fallback: Difficulty Only (Universal)
  if (validCandidates.length < 4) {
    if (__DEV__) console.log(`[WorkoutGen] Still only ${validCandidates.length} valid. Universal fallback...`);
    const fallbackFilter: ExerciseFilter = {
      difficulties: getDifficultyRange(profile.experience),
    };
    rawCandidates = await getExercises(fallbackFilter);
    validCandidates = filterCandidates(rawCandidates);
    if (__DEV__) console.log(`[WorkoutGen] Universal fallback: ${rawCandidates.length} found, ${validCandidates.length} valid`);
  }

  if (validCandidates.length > 0) {
    const catCounts: Record<string, number> = {};
    validCandidates.forEach(ex => { catCounts[ex.category] = (catCounts[ex.category] || 0) + 1; });
    if (__DEV__) console.log(`[WorkoutGen] FINAL CANDIDATES by category:`, JSON.stringify(catCounts));
  }

  return validCandidates;
}

function getDifficultyRange(experience: string): ('beginner' | 'intermediate' | 'advanced')[] {
  switch (experience) {
    case 'beginner':
      return ['beginner'];
    case 'intermediate':
      return ['beginner', 'intermediate'];
    case 'advanced':
      return ['beginner', 'intermediate', 'advanced'];
    default:
      return ['beginner'];
  }
}

// ============================================
// STEP 3: SOFT SCORING
// ============================================

async function scoreExercises(
  userId: string,
  candidates: ExerciseWithDetails[],
  fatigueMap: Map<TargetMuscle, number>,
  intent: SessionIntent,
  recentExerciseIds: Set<string>
): Promise<ScoredExercise[]> {
  const scored: ScoredExercise[] = [];

  for (const exercise of candidates) {
    // 1. Muscle freshness (0-100) - higher = fresher
    const primaryFatigue = exercise.primary_muscles.reduce(
      (sum, m) => sum + (fatigueMap.get(m) || 0),
      0
    ) / Math.max(exercise.primary_muscles.length, 1);
    const freshness = Math.max(0, 100 - primaryFatigue);

    // 2. Goal alignment (0-100)
    const goalScore = exercise.training_types.reduce((max, tt) => {
      if (intent.training_types.includes(tt.type)) {
        return Math.max(max, tt.effectiveness * 10);
      }
      return max;
    }, 0);

    // 3. Pattern balance (0-100) - bonus if matches focus pattern
    let patternScore = 50; // neutral
    if (intent.focus_pattern) {
      const patternMuscles = PATTERN_REQUIREMENTS[intent.focus_pattern];
      const matchesPattern = exercise.primary_muscles.some(m => patternMuscles.includes(m));
      patternScore = matchesPattern ? 100 : 30;
    }

    // 4. Progression potential (0-100)
    const progressHistory = await getProgressHistory(userId, exercise.id, 6);
    const progressionScore = (() => {
      if (progressHistory.length < 2) return 65;
      const newest = progressHistory[0];
      const oldest = progressHistory[progressHistory.length - 1];
      const newestSets = newest.sets_completed || 0;
      const oldestSets = oldest.sets_completed || 0;
      const newestReps = parseInt(String(newest.reps_achieved || '').match(/\d+/)?.[0] || '0', 10);
      const oldestReps = parseInt(String(oldest.reps_achieved || '').match(/\d+/)?.[0] || '0', 10);

      const setDelta = newestSets - oldestSets;
      const repsDelta = newestReps - oldestReps;
      const trend = setDelta * 12 + repsDelta * 4;

      if (trend >= 16) return 92;
      if (trend >= 8) return 84;
      if (trend >= 0) return 74;
      if (trend >= -6) return 58;
      return 45;
    })();

    // 5. Variety bonus (0-100) - penalty if recently used
    const varietyScore = recentExerciseIds.has(exercise.id) ? 20 : 80;

    // Calculate weighted score
    const breakdown = {
      freshness,
      goal: goalScore,
      pattern: patternScore,
      progression: progressionScore,
      variety: varietyScore,
    };

    const score =
      breakdown.freshness * SCORE_WEIGHTS.muscle_freshness +
      breakdown.goal * SCORE_WEIGHTS.goal_alignment +
      breakdown.pattern * SCORE_WEIGHTS.pattern_balance +
      breakdown.progression * SCORE_WEIGHTS.progression_potential +
      breakdown.variety * SCORE_WEIGHTS.variety;

    scored.push({ exercise, score, breakdown });
  }

  // Sort by score descending, then by ID for determinism
  return scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.01) {
      return a.exercise.id.localeCompare(b.exercise.id);
    }
    return b.score - a.score;
  });
}

// ============================================
// STEP 4: SELECTION
// ============================================

function selectExercises(
  scored: ScoredExercise[],
  intent: SessionIntent,
  targetCount: number
): ScoredExercise[] {
  const selected: ScoredExercise[] = [];
  const coveredPatterns = new Set<string>();
  const usedExercises = new Set<string>();

  // First pass: ensure pattern coverage
  for (const [pattern, muscles] of Object.entries(PATTERN_REQUIREMENTS)) {
    if (coveredPatterns.has(pattern)) continue;

    const patternExercise = scored.find(s =>
      !usedExercises.has(s.exercise.id) &&
      s.exercise.primary_muscles.some(m => muscles.includes(m))
    );

    if (patternExercise) {
      selected.push(patternExercise);
      usedExercises.add(patternExercise.exercise.id);
      coveredPatterns.add(pattern);
    }
  }

  // Second pass: fill remaining slots with highest scoring
  for (const s of scored) {
    if (selected.length >= targetCount) break;
    if (usedExercises.has(s.exercise.id)) continue;

    selected.push(s);
    usedExercises.add(s.exercise.id);
  }

  return selected;
}

// ============================================
// STEP 5: VOLUME PRESCRIPTION
// ============================================

function prescribeVolume(
  exercise: ExerciseWithDetails,
  profile: UserProfile,
  isDeload: boolean,
  adaptive: AdaptiveTrainingProfile
): { sets: number; reps: string } {
  const preset = VOLUME_PRESETS[profile.goal]?.[profile.experience] ||
    VOLUME_PRESETS.body_control.beginner;

  let sets = preset.sets;
  let reps = preset.reps;

  sets = Math.max(2, Math.round(sets * adaptive.volumeTolerance));

  // Deload reduction
  if (isDeload) {
    sets = Math.max(2, Math.floor(sets * 0.6));
    // Keep reps the same but intensity lower (user responsibility)
  }

  // Time-based exercises get hold times
  if (exercise.category === 'posture' || exercise.category === 'mobility') {
    reps = preset.reps; // Already holds
  }

  return { sets, reps };
}

// ============================================
// MAIN GENERATOR FUNCTION
// ============================================

export async function generateWorkout(
  userId: string,
  deloadFlag = false
): Promise<GeneratedWorkout | null> {
  // 1. Load user state
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('User profile not found');
  }

  const adaptive = await getAdaptiveTrainingProfile(userId);

  const fatigueRecords = await getMuscleFatigue(userId);
  const fatigueMap = new Map<TargetMuscle, number>(
    fatigueRecords.map(f => [f.muscle as TargetMuscle, f.fatigue_level])
  );

  const recentSessions = await getRecentSessions(userId, 7);

  // Get recently used exercise IDs
  const recentExerciseIds = new Set(
    await getRecentExerciseIds(
      userId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    )
  );

  // 2. Determine intent
  const intent = await determineSessionIntent(
    userId,
    profile,
    fatigueMap,
    recentSessions,
    deloadFlag
  );

  // 3. Hard filter
  const candidates = await applyHardFilter(userId, profile, fatigueMap, intent, adaptive);

  if (candidates.length < MIN_EXERCISES) {
    console.warn('Not enough exercises pass hard filter');
    return null;
  }

  // 4. Score
  const scored = await scoreExercises(userId, candidates, fatigueMap, intent, recentExerciseIds);

  // 5. Select
  const targetCount = Math.min(
    MAX_EXERCISES,
    Math.max(MIN_EXERCISES, Math.floor(profile.time_per_session_minutes / 8))
  );
  const selected = selectExercises(scored, intent, targetCount);

  // 6. Prescribe volume
  const sessionId = await generateSecureId('session');
  const exercises = selected.map((s, index) => {
    const volume = prescribeVolume(s.exercise, profile, intent.is_deload, adaptive);
    return {
      exercise: s.exercise,
      sets: volume.sets,
      reps: volume.reps,
      order: index + 1,
    };
  });

  // Estimate duration
  const totalDuration = exercises.reduce((sum, ex) => {
    const setsTime = ex.sets * (ex.exercise.time_per_set_seconds + 60); // +60s rest
    return sum + setsTime;
  }, 0) / 60; // Convert to minutes

  return {
    session_id: sessionId,
    exercises,
    total_duration_estimate: Math.round(totalDuration),
    intent,
  };
}

// ============================================
// PERSIST GENERATED WORKOUT
// ============================================

export async function persistWorkout(
  userId: string,
  workout: GeneratedWorkout
): Promise<string> {
  // Create session record
  await createWorkoutSession({
    id: workout.session_id,
    user_id: userId,
    duration_minutes: workout.total_duration_estimate,
    total_exercises: workout.exercises.length,
    completed_exercises: 0,
    success: false,
  });

  // Create session exercise records
  for (const ex of workout.exercises) {
    const exerciseId = `${workout.session_id}_ex_${ex.order}`;
    await addSessionExercise({
      id: exerciseId,
      session_id: workout.session_id,
      exercise_id: ex.exercise.id,
      order_in_session: ex.order,
      prescribed_sets: ex.sets,
      prescribed_reps: ex.reps,
      completed_sets: 0,
      skipped: false,
    });
  }

  return workout.session_id;
}

// ============================================
// QUICK WORKOUT (GENERATE + PERSIST)
// ============================================

export async function createWorkout(
  userId: string,
  deloadFlag = false
): Promise<GeneratedWorkout | null> {
  const workout = await generateWorkout(userId, deloadFlag);
  if (workout) {
    await persistWorkout(userId, workout);
  }
  return workout;
}
