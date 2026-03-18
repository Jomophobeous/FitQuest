/**
 * FitQuest Workout Generation Pipeline
 * 7-step deterministic algorithm
 */

import {
  UserProfile,
  Goal,
  Experience,
  ExerciseRecord,
  GeneratedWorkout,
  ExerciseWithPrescription,
  SessionIntent,
  Muscle,
  MovementPattern,
  WorkoutGeneratorState,
  SessionRecord,
  CompletedExercise,
  GOAL_CONFIGURATIONS,
  FATIGUE_CONSTANTS,
  MINIMUM_EXERCISE_REQUIREMENTS,
  SESSION_EXERCISE_COUNT,
} from './types';

// ============================================================================
// STEP 1: SESSION INTENT DETERMINATION
// ============================================================================

export function determineSessionIntent(
  state: WorkoutGeneratorState,
  exerciseDatabase: ExerciseRecord[]
): SessionIntent {
  const { deload_flag, muscle_fatigue_map, last_7_sessions, user_profile } = state;

  // If deload, prioritize recovery
  if (deload_flag) {
    return {
      focus_muscle: 'abs' as Muscle, // Core work
      focus_pattern: 'core' as MovementPattern,
      recovery_priority: true,
      deload: true,
    };
  }

  // Determine which muscles were trained recently
  const musclesByLastTrained = getMusclesByLastTrained(last_7_sessions);

  // Rotate to least recently trained muscle that fits goal
  const focusMuscle = selectFocusMuscle(
    user_profile.goal,
    musclesByLastTrained,
    muscle_fatigue_map
  );

  const focusPattern = mapMuscleToPattern(focusMuscle);

  return {
    focus_muscle: focusMuscle,
    focus_pattern: focusPattern,
    recovery_priority: false,
    deload: false,
  };
}

function getMusclesByLastTrained(sessions: SessionRecord[]): Muscle[] {
  const muscleMap = new Map<string, number>();

  sessions.forEach((session, index) => {
    const daysSince = (Date.now() - new Date(session.date).getTime()) / (1000 * 60 * 60 * 24);
    session.exercises.forEach((ex) => {
      // We don't have muscle info here in CompletedExercise, so we track globally
      // In practice, you'd join with exercise database
      muscleMap.set(String(index), daysSince);
    });
  });

  return Array.from(muscleMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([muscle]) => muscle as Muscle);
}

function selectFocusMuscle(
  goal: Goal,
  musclesByLastTrained: Muscle[],
  fatigue: Record<string, number>
): Muscle {
  const goalPriority: Record<Goal, Muscle[]> = {
    strength: ['quads', 'hamstrings', 'back', 'chest'],
    hypertrophy: ['chest', 'back', 'shoulders', 'quads'],
    fat_loss: ['quads', 'hamstrings', 'back', 'chest'],
    endurance: ['glutes', 'quads', 'hamstrings', 'back'],
    mobility: ['shoulders', 'hips', 'spine'],
  };

  const priorityList = goalPriority[goal] || goalPriority.strength;

  // Pick first muscle in priority list that isn't overworked
  for (const muscle of priorityList) {
    if ((fatigue[muscle] || 0) < FATIGUE_CONSTANTS.FATIGUE_THRESHOLD_FOR_EXERCISE_SKIP) {
      return muscle as Muscle;
    }
  }

  return priorityList[0] as Muscle;
}

function mapMuscleToPattern(muscle: Muscle): MovementPattern {
  const patternMap: Record<Muscle, MovementPattern> = {
    chest: 'push',
    shoulders: 'push',
    triceps: 'push',
    quads: 'leg',
    hamstrings: 'leg',
    glutes: 'leg',
    calves: 'leg',
    back: 'pull',
    biceps: 'pull',
    forearms: 'pull',
    abs: 'core',
    obliques: 'core',
    lower_back: 'core',
    hips: 'mobility',
    spine: 'mobility',
    upper_back: 'pull',
    arms: 'push',
    legs: 'leg',
    all: 'core',
  };

  return patternMap[muscle] || 'push';
}

// ============================================================================
// STEP 2: HARD FILTER (DATABASE)
// ============================================================================

export function applyHardFilter(
  allExercises: ExerciseRecord[],
  userProfile: UserProfile,
  fatigue: Record<string, number>,
  injury_constraints: string[]
): ExerciseRecord[] {
  return allExercises.filter((exercise) => {
    // Equipment mismatch
    if (!exercise.equipment_required.some((eq) => userProfile.equipment_available.includes(eq))) {
      return false;
    }

    // Difficulty > experience
    if (getDifficultyRank(exercise.difficulty) > getDifficultyRank(userProfile.experience)) {
      return false;
    }

    // Goal mismatch
    if (!exercise.goal_alignment.includes(userProfile.goal)) {
      return false;
    }

    // Injury constraint
    for (const inj of injury_constraints) {
      if (exercise.primary_muscle === inj) {
        // Check if exercise is safe to do with this injury
        if (!exercise.injury_safe_for.includes(inj as Muscle) && !exercise.injury_safe_for.includes('all')) {
          return false;
        }
      }
    }

    // Fatigue threshold
    if ((fatigue[exercise.primary_muscle] || 0) > FATIGUE_CONSTANTS.FATIGUE_THRESHOLD_FOR_EXERCISE_SKIP) {
      return false;
    }

    return true;
  });
}

function getDifficultyRank(exp: Experience): number {
  return { beginner: 0, intermediate: 1, advanced: 2 }[exp];
}

// ============================================================================
// STEP 3: SCORING (SOFT FILTER)
// ============================================================================

export interface ScoredExercise {
  exercise: ExerciseRecord;
  score: number;
}

export function scoreExercises(
  candidates: ExerciseRecord[],
  sessionIntent: SessionIntent,
  state: WorkoutGeneratorState,
  userProfile: UserProfile
): ScoredExercise[] {
  return candidates
    .map((exercise) => ({
      exercise,
      score: calculateExerciseScore(exercise, sessionIntent, state, userProfile),
    }))
    .sort((a, b) => b.score - a.score);
}

function calculateExerciseScore(
  exercise: ExerciseRecord,
  intent: SessionIntent,
  state: WorkoutGeneratorState,
  profile: UserProfile
): number {
  let score = 0;

  // Muscle freshness weight (CRITICAL)
  const muscleFatigue = state.muscle_fatigue_map[exercise.primary_muscle] || 0;
  const freshness = 100 - muscleFatigue;
  score += freshness * 0.35; // 35% weight

  // Goal alignment weight
  const goalAlignment = exercise.goal_alignment.includes(profile.goal) ? 1 : 0;
  score += goalAlignment * 100 * 0.25; // 25% weight

  // Movement pattern balance weight
  const patternBonus = exercise.movement_pattern === intent.focus_pattern ? 1 : 0.5;
  score += patternBonus * 50 * 0.20; // 20% weight

  // Progression compatibility
  const lastUse = getLastUseOfExercise(state.last_7_sessions, exercise.id);
  const progressionBonus = lastUse && lastUse.success ? 1 : 0.5;
  score += progressionBonus * 50 * 0.15; // 15% weight

  // Recency penalty (don't use same exercise twice in 48h)
  if (lastUse && daysSince(lastUse) < 2) {
    score -= 200; // Strong penalty
  }

  // Variety bonus (avoid overuse)
  const usageIn7Days = countUsageInDays(state.last_7_sessions, exercise.id, 7);
  if (usageIn7Days > 2) {
    score -= 100; // Penalty for overuse
  }

  return score;
}

function getLastUseOfExercise(sessions: SessionRecord[], exerciseId: string): CompletedExercise | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const ex = sessions[i]!.exercises.find((e) => e.exercise_id === exerciseId);
    if (ex) return ex;
  }
  return null;
}

function daysSince(exercise: CompletedExercise): number {
  // In practice, you'd need the date; stub here
  return 3;
}

function countUsageInDays(sessions: SessionRecord[], exerciseId: string, days: number): number {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return sessions.filter((s) => new Date(s.date) > cutoffDate).filter((s) =>
    s.exercises.some((e) => e.exercise_id === exerciseId)
  ).length;
}

// ============================================================================
// STEP 4: SELECTION
// ============================================================================

export function selectExercises(
  scored: ScoredExercise[],
  sessionIntent: SessionIntent,
  allExercises: ExerciseRecord[]
): ExerciseRecord[] {
  const selected: ExerciseRecord[] = [];
  const patternCounts: Record<MovementPattern, number> = {
    push: 0,
    pull: 0,
    leg: 0,
    core: 0,
    mobility: 0,
  };

  // First, ensure minimum requirements
  const sortedByPattern = scored.reduce<Record<MovementPattern, ScoredExercise[]>>(
    (acc, item) => {
      acc[item.exercise.movement_pattern].push(item);
      return acc;
    },
    { push: [], pull: [], leg: [], core: [], mobility: [] }
  );

  // Mandatory minimums
  for (const [pattern, requirement] of Object.entries(MINIMUM_EXERCISE_REQUIREMENTS)) {
    for (let i = 0; i < requirement; i++) {
      if (sortedByPattern[pattern as MovementPattern].length > 0) {
        const ex = sortedByPattern[pattern as MovementPattern].shift();
        if (ex && !selected.find((s) => s.id === ex.exercise.id)) {
          selected.push(ex.exercise);
          patternCounts[pattern as MovementPattern]++;
        }
      }
    }
  }

  // Fill remaining slots with best scores
  const targetCount = SESSION_EXERCISE_COUNT.min + Math.floor(Math.random() * (SESSION_EXERCISE_COUNT.max - SESSION_EXERCISE_COUNT.min));
  for (const scored_item of scored) {
    if (selected.length >= targetCount) break;
    if (!selected.find((s) => s.id === scored_item.exercise.id)) {
      selected.push(scored_item.exercise);
    }
  }

  return selected;
}

// ============================================================================
// STEP 5: VOLUME & INTENSITY
// ============================================================================

export function prescribeVolume(
  exercise: ExerciseRecord,
  userProfile: UserProfile,
  lastCompletion: CompletedExercise | null
): Omit<ExerciseWithPrescription, 'exercise'> {
  const config = GOAL_CONFIGURATIONS[userProfile.goal];
  const baseSets = config.base_sets[userProfile.experience];
  const [minReps, maxReps] = config.rep_range[userProfile.experience];

  // Adjust by body metrics (simplified)
  let intensityModifier = 1.0;
  if (userProfile.weight < 60) intensityModifier -= 0.1;
  if (userProfile.weight > 100) intensityModifier += 0.1;

  // Progression rule
  let sets = baseSets;
  let finalMaxReps = maxReps;
  let progressionRecommendation: string | undefined;

  if (lastCompletion) {
    if (lastCompletion.success) {
      // Try harder: +1 rep or harder variation
      finalMaxReps = Math.min(maxReps + 1, 20);
      progressionRecommendation = `Last time successful. Try +1 rep or harder variation.`;
    } else {
      // Regress slightly
      sets = Math.max(baseSets - 1, 2);
      finalMaxReps = Math.max(minReps - 1, 3);
      progressionRecommendation = `Last attempt struggled. Reduce volume slightly.`;
    }
  }

  const restSeconds = calculateRestTime(userProfile.goal);

  return {
    sets,
    rep_range: [minReps, finalMaxReps],
    intensity_modifier: intensityModifier,
    rest_seconds: restSeconds,
    progression_recommendation: progressionRecommendation,
  };
}

function calculateRestTime(goal: Goal): number {
  const restMap: Record<Goal, number> = {
    strength: 180,
    hypertrophy: 90,
    fat_loss: 45,
    endurance: 30,
    mobility: 60,
  };
  return restMap[goal];
}

// ============================================================================
// STEP 6: FATIGUE UPDATE (POST-WORKOUT)
// ============================================================================

export function updateFatiguePostWorkout(
  fatigueMap: Record<string, number>,
  completedExercises: ExerciseWithPrescription[],
  sessionSuccess: boolean
): Record<string, number> {
  const updated = { ...fatigueMap };

  completedExercises.forEach((ex) => {
    const intensityFactor = ex.intensity_modifier * FATIGUE_CONSTANTS.SET_INTENSITY_FACTOR;
    const fatigueAdded = ex.sets * intensityFactor;

    updated[ex.exercise.primary_muscle] = (updated[ex.exercise.primary_muscle] || 0) + fatigueAdded;

    // Secondary muscles accumulate less
    ex.exercise.secondary_muscles.forEach((muscle) => {
      updated[muscle] = (updated[muscle] || 0) + fatigueAdded * 0.5;
    });
  });

  // Clamp 0-100
  Object.keys(updated).forEach((muscle) => {
    updated[muscle] = Math.max(0, Math.min(100, updated[muscle]!));
  });

  return updated;
}

export function applyDailyRecovery(fatigueMap: Record<string, number>): Record<string, number> {
  const updated = { ...fatigueMap };

  Object.keys(updated).forEach((muscle) => {
    updated[muscle] = Math.max(0, updated[muscle]! - FATIGUE_CONSTANTS.DAILY_RECOVERY_RATE);
  });

  return updated;
}

// ============================================================================
// STEP 7: DELOAD LOGIC
// ============================================================================

export function shouldTriggerDeload(state: WorkoutGeneratorState): boolean {
  // Consecutive failures
  const consecutiveFailures = countConsecutiveFailures(state.last_7_sessions);
  if (consecutiveFailures >= FATIGUE_CONSTANTS.FAILURE_THRESHOLD) {
    return true;
  }

  // Average fatigue > threshold
  const avgFatigue =
    Object.values(state.muscle_fatigue_map).reduce((a, b) => a + b, 0) /
    Object.keys(state.muscle_fatigue_map).length;
  if (avgFatigue > FATIGUE_CONSTANTS.FATIGUE_THRESHOLD_FOR_DELOAD) {
    return true;
  }

  // Weekly cycle (every 4th week)
  if (state.current_week % 4 === 0) {
    return true;
  }

  return false;
}

function countConsecutiveFailures(sessions: SessionRecord[]): number {
  let count = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const failed = sessions[i]!.exercises.some((ex) => !ex.success);
    if (failed) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function applyDeloadReduction(prescription: ExerciseWithPrescription): ExerciseWithPrescription {
  return {
    ...prescription,
    sets: Math.max(1, Math.floor(prescription.sets * 0.6)), // -40% volume
    intensity_modifier: prescription.intensity_modifier * 0.7, // -30% intensity
    notes: 'DELOAD WEEK - Focus on form and recovery',
  };
}

// ============================================================================
// FULL PIPELINE ORCHESTRATION
// ============================================================================

export function generateWorkout(
  state: WorkoutGeneratorState,
  exerciseDatabase: ExerciseRecord[]
): GeneratedWorkout {
  const { user_profile, last_7_sessions, muscle_fatigue_map } = state;

  // STEP 1: Determine session intent
  const sessionIntent = determineSessionIntent(state, exerciseDatabase);

  // STEP 2: Apply hard filters
  const candidates = applyHardFilter(
    exerciseDatabase,
    user_profile,
    muscle_fatigue_map,
    user_profile.injury_constraints
  );

  // STEP 3: Score exercises
  const scored = scoreExercises(candidates, sessionIntent, state, user_profile);

  // STEP 4: Select exercises
  const selectedExercises = selectExercises(scored, sessionIntent, exerciseDatabase);

  // STEP 5: Prescribe volume & intensity
  const prescriptions: ExerciseWithPrescription[] = selectedExercises.map((exercise) => {
    const lastCompletion = getLastUseOfExercise(last_7_sessions, exercise.id);
    const volumePrescription = prescribeVolume(exercise, user_profile, lastCompletion);

    let prescription: ExerciseWithPrescription = {
      exercise,
      ...volumePrescription,
    };

    // STEP 7: Apply deload if needed
    if (state.deload_flag) {
      prescription = applyDeloadReduction(prescription);
    }

    return prescription;
  });

  // Estimate fatigue post-workout
  const estimatedFatiguePost = prescriptions.reduce((acc, p) => {
    const fatigue = p.sets * p.intensity_modifier * FATIGUE_CONSTANTS.SET_INTENSITY_FACTOR;
    return acc + fatigue;
  }, 0);

  const totalDuration = prescriptions.reduce((acc, p) => {
    const exerciseDuration =
      p.sets * p.rep_range[1] * (p.exercise.time_to_perform_sec / 60) + (p.sets - 1) * (p.rest_seconds / 60);
    return acc + exerciseDuration;
  }, 5); // +5 min for warmup

  return {
    id: `workout-${Date.now()}`,
    date: new Date().toISOString(),
    session_intent: sessionIntent,
    exercises: prescriptions,
    total_estimated_duration: Math.round(totalDuration),
    fatigue_estimate_post: Math.min(100, Math.round(estimatedFatiguePost)),
    subscription_required: false,
  };
}
