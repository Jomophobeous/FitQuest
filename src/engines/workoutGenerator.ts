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
  getUserEquipment,
  getUserInjuries,
  createWorkoutSession,
  addSessionExercise,
  getRecentExerciseIds,
  getRecentlyTrainedMuscles,
  getAllProgressRecords,
  getAppState,
} from '../database/service';
import { generateSecureId } from '../security/randomId';
import { getAdaptiveTrainingProfile, type AdaptiveTrainingProfile } from '../services/adaptiveTrainingService';
import { getCachedReadiness, type ReadinessSnapshot } from './ReadinessEngine';
import { calculateProgression, type ProgressionDecision } from './progressionEngine';
import type {
  ExerciseWithDetails,
  UserProfile,
  MuscleFatigue,
  WorkoutSession,
  SessionExercise,
  Category,
  ProgressRecord,
  TargetMuscle,
  TrainingType,
  ExerciseFilter,
  EquipmentLevel,
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

export interface WorkoutGenerationDiagnostics {
  user_id: string;
  target_count: number;
  candidate_count: number;
  selected_count: number;
  intent: SessionIntent;
  candidate_categories: Record<string, number>;
  top_scored: Array<{
    id: string;
    name: string;
    category: Category;
    score: number;
    primary_muscles: TargetMuscle[];
    matches_focus_pattern: boolean;
  }>;
  selected: Array<{
    id: string;
    name: string;
    category: Category;
    order: number;
    score: number;
    primary_muscles: TargetMuscle[];
    matches_focus_pattern: boolean;
  }>;
  warnings: string[];
}

interface WorkoutPreparation {
  profile: UserProfile;
  adaptive: AdaptiveTrainingProfile;
  intent: SessionIntent;
  candidates: ExerciseWithDetails[];
  scored: ScoredExercise[];
  selected: ScoredExercise[];
  targetCount: number;
}

// ============================================
// STEP 1: DETERMINE SESSION INTENT
// ============================================

async function determineSessionIntent(
  userId: string,
  profile: UserProfile,
  fatigueMap: Map<TargetMuscle, number>,
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
    ? (PATTERN_REQUIREMENTS[bestPattern] ?? []).filter(m => (fatigueMap.get(m) || 0) < FATIGUE_THRESHOLD)
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

  // Get user's equipment level preference
  const equipmentLevelPref = await getAppState('user.equipment_level') as EquipmentLevel | null;
  
  // Build equipment levels array based on preference (inclusive downward)
  // 'none' -> only none, 'minimal' -> none + minimal, 'playground' -> all
  const getEquipmentLevels = (level: EquipmentLevel | null): EquipmentLevel[] => {
    switch (level) {
      case 'none': return ['none'];
      case 'minimal': return ['none', 'minimal'];
      case 'playground': return ['none', 'minimal', 'playground'];
      default: return ['none', 'minimal', 'playground']; // No preference = show all
    }
  };
  const equipmentLevels = getEquipmentLevels(equipmentLevelPref);
  if (__DEV__) console.log(`[WorkoutGen] Equipment level pref: ${equipmentLevelPref || 'none set'} -> filtering to: ${equipmentLevels.join(', ')}`);

  // Build filter for primary goal
  const filter: ExerciseFilter = {
    categories: [profile.goal],
    difficulties: getDifficultyRange(profile.experience),
    training_types: intent.training_types,
    equipment_levels: equipmentLevels,
  };

  if (__DEV__) console.log(`[WorkoutGen] Hard filter: goal="${profile.goal}", difficulties=${JSON.stringify(getDifficultyRange(profile.experience))}, training_types=${JSON.stringify(intent.training_types)}`);

  // Hard filters that need post-processing
  // FIX: Run fallback logic on the FILTERED candidates, not the raw DB result
  // If we have candidates but they all get filtered out by equipment/injuries, we need more candidates!
  
  const filterCandidates = (candList: ExerciseWithDetails[]) => {
    const isBodyweightOnly = equipmentLevels.length === 1 && equipmentLevels[0] === 'none';

    return candList.filter(ex => {
      // Equipment check
      if (ex.equipment_required.length > 0) {
        const hasAllRequired = ex.equipment_required.every(eq => userEquipment.includes(eq));
        if (!hasAllRequired) return false;
      }

      // Name-based safety net: if user is bodyweight-only, exclude exercises
      // whose names clearly indicate gym equipment (catches mis-tagged external exercises)
      if (isBodyweightOnly) {
        const nameLower = ex.name.toLowerCase();
        const gymKeywords = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine',
          'smith', 'ez-bar', 'e-z curl', 'lat pulldown', 'leg press', 'hack squat',
          'pec deck', 'bench press', 'incline press', 'decline press'];
        if (gymKeywords.some(kw => nameLower.includes(kw))) return false;
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
      equipment_levels: equipmentLevels,
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
      equipment_levels: equipmentLevels,
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
      equipment_levels: equipmentLevels,
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
  const progressHistoryByExercise = await buildProgressHistoryMap(userId, candidates, 6);
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
      const patternMuscles = PATTERN_REQUIREMENTS[intent.focus_pattern] ?? [];
      const matchesPattern = exercise.primary_muscles.some(m => patternMuscles.includes(m));
      patternScore = matchesPattern ? 100 : 30;
    }

    // 4. Progression potential (0-100)
    const progressHistory = progressHistoryByExercise.get(exercise.id) || [];
    const progressionScore = (() => {
      if (progressHistory.length < 2) return 65;
      const newest = progressHistory[0]!;
      const oldest = progressHistory[progressHistory.length - 1]!;
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

async function buildProgressHistoryMap(
  userId: string,
  candidates: ExerciseWithDetails[],
  perExerciseLimit: number
): Promise<Map<string, ProgressRecord[]>> {
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const maxRecords = Math.max(300, candidates.length * perExerciseLimit * 4);
  const allProgress = await getAllProgressRecords(userId, maxRecords);
  const progressHistoryByExercise = new Map<string, ProgressRecord[]>();

  for (const record of allProgress) {
    if (!candidateIds.has(record.exercise_id)) continue;

    const history = progressHistoryByExercise.get(record.exercise_id) || [];
    if (history.length >= perExerciseLimit) continue;

    history.push(record);
    progressHistoryByExercise.set(record.exercise_id, history);
  }

  return progressHistoryByExercise;
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

  const getMatchingPatterns = (exercise: ExerciseWithDetails): string[] => {
    return Object.entries(PATTERN_REQUIREMENTS)
      .filter(([, muscles]) => exercise.primary_muscles.some(muscle => muscles.includes(muscle)))
      .map(([pattern]) => pattern);
  };

  const overlapsTooMuch = (exercise: ExerciseWithDetails): boolean => {
    if (selected.length === 0) return false;

    return selected.some((entry) => {
      const overlapCount = entry.exercise.primary_muscles.filter(muscle => exercise.primary_muscles.includes(muscle)).length;
      return overlapCount >= Math.min(2, exercise.primary_muscles.length);
    });
  };

  const trySelect = (candidate: ScoredExercise | undefined, pattern?: string): boolean => {
    if (!candidate) return false;
    if (usedExercises.has(candidate.exercise.id)) return false;

    selected.push(candidate);
    usedExercises.add(candidate.exercise.id);

    for (const matchedPattern of getMatchingPatterns(candidate.exercise)) {
      coveredPatterns.add(matchedPattern);
    }
    if (pattern) coveredPatterns.add(pattern);
    return true;
  };

  const focusPattern = intent.focus_pattern;
  if (focusPattern) {
    const focusMuscles = PATTERN_REQUIREMENTS[focusPattern] ?? [];
    const focusQuota = Math.min(2, Math.max(1, Math.floor(targetCount / 2)));
    const focusCandidates = scored.filter((entry) =>
      entry.exercise.primary_muscles.some((muscle) => focusMuscles.includes(muscle))
    );

    for (const candidate of focusCandidates) {
      if (selected.length >= focusQuota) break;
      if (overlapsTooMuch(candidate.exercise) && focusCandidates.length > focusQuota) continue;
      trySelect(candidate, focusPattern);
    }
  }

  const orderedPatterns = Object.keys(PATTERN_REQUIREMENTS).sort((left, right) => {
    if (left === focusPattern) return -1;
    if (right === focusPattern) return 1;

    const bestScore = (pattern: string) =>
      scored.find((entry) => entry.exercise.primary_muscles.some((muscle) => (PATTERN_REQUIREMENTS[pattern] ?? []).includes(muscle)))?.score || -1;

    return bestScore(right) - bestScore(left);
  });

  // Second pass: broaden pattern coverage after honoring the focus pattern.
  for (const pattern of orderedPatterns) {
    const muscles = PATTERN_REQUIREMENTS[pattern] ?? [];
    if (coveredPatterns.has(pattern)) continue;
    if (selected.length >= targetCount) break;

    const patternExercise = scored.find(s =>
      !usedExercises.has(s.exercise.id) &&
      s.exercise.primary_muscles.some(m => muscles.includes(m)) &&
      !overlapsTooMuch(s.exercise)
    );

    trySelect(patternExercise, pattern);
  }

  // Final pass: fill remaining slots with highest scoring options, preferring muscle diversity first.
  for (const allowOverlap of [false, true]) {
    for (const candidate of scored) {
      if (selected.length >= targetCount) break;
      if (usedExercises.has(candidate.exercise.id)) continue;
      if (!allowOverlap && overlapsTooMuch(candidate.exercise)) continue;
      trySelect(candidate);
    }
  }

  return selected;
}

// ============================================
// STEP 5: VOLUME PRESCRIPTION
// ============================================

/** Map Category goal to progression engine goal type */
function mapGoalToProgressionType(goal: Category): 'strength' | 'hypertrophy' | 'endurance' | 'default' {
  switch (goal) {
    case 'strength': return 'strength';
    case 'body_control': return 'hypertrophy';
    case 'speed': return 'endurance';
    case 'posture':
    case 'mobility':
    case 'focus':
    default:
      return 'default';
  }
}

function prescribeVolume(
  exercise: ExerciseWithDetails,
  profile: UserProfile,
  isDeload: boolean,
  adaptive: AdaptiveTrainingProfile,
  readinessScore?: number,
  progressionDecision?: ProgressionDecision
): { sets: number; reps: string } {
  // Use progression-based recommendation if available, otherwise fall back to static preset
  let sets: number;
  let reps: string;

  if (progressionDecision && progressionDecision.action !== 'maintain') {
    // Progressive prescription: use the engine's per-exercise recommendation
    sets = progressionDecision.recommendation.sets;
    reps = progressionDecision.recommendation.reps;
    if (__DEV__) console.log(`[WorkoutGen] Progressive Rx for ${exercise.name}: ${progressionDecision.action} → ${sets}×${reps}`);
  } else if (progressionDecision && progressionDecision.action === 'maintain') {
    // Maintain: use last known volume from the progression engine (keeps the user's actual level)
    sets = progressionDecision.recommendation.sets;
    reps = progressionDecision.recommendation.reps;
    if (__DEV__) console.log(`[WorkoutGen] Maintain Rx for ${exercise.name}: ${sets}×${reps}`);
  } else {
    // No history: fall back to static preset for new exercises
    const preset = VOLUME_PRESETS[profile.goal]?.[profile.experience] ??
      VOLUME_PRESETS.body_control['beginner']!;
    sets = preset.sets;
    reps = preset.reps;
  }

  // Apply adaptive volume tolerance modifier
  sets = Math.max(2, Math.round(sets * adaptive.volumeTolerance));

  // Readiness-based volume adjustment
  if (readinessScore !== undefined && readinessScore < 50) {
    const readinessFactor = 0.7 + (readinessScore / 50) * 0.3;
    sets = Math.max(2, Math.round(sets * readinessFactor));
  }

  // Deload reduction
  if (isDeload) {
    sets = Math.max(2, Math.floor(sets * 0.6));
  }

  // Time-based exercises keep hold-time reps from preset (progression doesn't apply to holds)
  if (exercise.category === 'posture' || exercise.category === 'mobility') {
    const preset = VOLUME_PRESETS[profile.goal]?.[profile.experience] ??
      VOLUME_PRESETS.body_control['beginner']!;
    reps = preset.reps;
  }

  return { sets, reps };
}

// ============================================
// MAIN GENERATOR FUNCTION
// ============================================

async function prepareWorkout(
  userId: string,
  deloadFlag = false
): Promise<WorkoutPreparation | null> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('User profile not found');
  }

  const adaptive = await getAdaptiveTrainingProfile(userId);

  const fatigueRecords = await getMuscleFatigue(userId);
  const fatigueMap = new Map<TargetMuscle, number>(
    fatigueRecords.map(f => [f.muscle as TargetMuscle, f.fatigue_level])
  );

  // Get recently used exercise IDs
  const recentExerciseIds = new Set(
    await getRecentExerciseIds(
      userId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    )
  );

  // 2. Determine intent
  const intent = await determineSessionIntent(userId, profile, fatigueMap, deloadFlag);

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

  return {
    profile,
    adaptive,
    intent,
    candidates,
    scored,
    selected,
    targetCount,
  };
}

export async function analyzeWorkoutGeneration(
  userId: string,
  deloadFlag = false
): Promise<WorkoutGenerationDiagnostics | null> {
  const prepared = await prepareWorkout(userId, deloadFlag);
  if (!prepared) return null;

  const candidateCategories: Record<string, number> = {};
  prepared.candidates.forEach((exercise) => {
    candidateCategories[exercise.category] = (candidateCategories[exercise.category] || 0) + 1;
  });

  const focusMuscles = prepared.intent.focus_pattern
    ? (PATTERN_REQUIREMENTS[prepared.intent.focus_pattern] ?? [])
    : [];

  return {
    user_id: userId,
    target_count: prepared.targetCount,
    candidate_count: prepared.candidates.length,
    selected_count: prepared.selected.length,
    intent: prepared.intent,
    candidate_categories: candidateCategories,
    top_scored: prepared.scored.slice(0, 8).map((entry) => ({
      id: entry.exercise.id,
      name: entry.exercise.name,
      category: entry.exercise.category,
      score: Math.round(entry.score * 100) / 100,
      primary_muscles: entry.exercise.primary_muscles,
      matches_focus_pattern: entry.exercise.primary_muscles.some((muscle) => focusMuscles.includes(muscle)),
    })),
    selected: prepared.selected.map((entry, index) => ({
      id: entry.exercise.id,
      name: entry.exercise.name,
      category: entry.exercise.category,
      order: index + 1,
      score: Math.round(entry.score * 100) / 100,
      primary_muscles: entry.exercise.primary_muscles,
      matches_focus_pattern: entry.exercise.primary_muscles.some((muscle) => focusMuscles.includes(muscle)),
    })),
    warnings: prepared.selected.length < prepared.targetCount ? ['Generator returned fewer exercises than target count'] : [],
  };
}

export async function generateWorkout(
  userId: string,
  deloadFlag = false
): Promise<GeneratedWorkout | null> {
  const prepared = await prepareWorkout(userId, deloadFlag);
  if (!prepared) return null;

  // Get readiness score for volume adjustment
  let readinessScore: number | undefined;
  try {
    const readiness = await getCachedReadiness(userId);
    readinessScore = readiness.score;
  } catch { /* readiness is optional, generator works without it */ }

  // 6. Progressive analysis: batch-query progression decisions for all selected exercises
  const progressionGoalType = mapGoalToProgressionType(prepared.profile.goal);
  const progressionMap = new Map<string, ProgressionDecision>();

  // Get the static fallback to use as "current" volume when querying progression
  const fallbackPreset = VOLUME_PRESETS[prepared.profile.goal]?.[prepared.profile.experience] ??
    VOLUME_PRESETS.body_control['beginner']!;

  for (const s of prepared.selected) {
    try {
      const decision = await calculateProgression(
        userId,
        s.exercise.id,
        fallbackPreset.sets,
        fallbackPreset.reps,
        progressionGoalType
      );
      // Only use progression if the engine had actual history to work with
      if (decision.action !== 'maintain' || decision.reason !== 'Insufficient data or mixed results → maintain current prescription') {
        progressionMap.set(s.exercise.id, decision);
      }
    } catch {
      // Progression lookup failed for this exercise — fall back to static preset
    }
  }

  if (__DEV__ && progressionMap.size > 0) {
    console.log(`[WorkoutGen] Progressive Rx applied to ${progressionMap.size}/${prepared.selected.length} exercises`);
  }

  // 7. Prescribe volume (progression-aware)
  const sessionId = await generateSecureId('session');
  const exercises = prepared.selected.map((s, index) => {
    const decision = progressionMap.get(s.exercise.id);
    const volume = prescribeVolume(s.exercise, prepared.profile, prepared.intent.is_deload, prepared.adaptive, readinessScore, decision);
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
    intent: prepared.intent,
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
