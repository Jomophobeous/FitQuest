/**
 * AI Workout Service — Lets the AI coach create custom workouts
 *
 * Flow:
 *   1. User asks "Create a core workout" / "Upper body focus" / etc.
 *   2. Coach screen detects workout intent → calls buildAIWorkoutPrompt()
 *   3. AI generates structured JSON response with exercise selections
 *   4. parseAIWorkoutResponse() converts AI output → real DB workout session
 *   5. User is navigated to the workout screen to start
 */

import {
  getExercises,
  getUserProfile,
  getMuscleFatigue,
  createWorkoutSession,
  addSessionExercise,
} from '../database/service';
import type {
  ExerciseWithDetails,
  Category,
  TargetMuscle,
} from '../database/types';
import { generateSecureId } from '../security/randomId';

// ============================================
// TYPES
// ============================================

export interface AIWorkoutRequest {
  userInput: string;
  focusArea?: string;       // "upper body", "legs", "core", etc.
  duration?: number;        // minutes
  difficulty?: string;      // "easy", "moderate", "hard"
  equipment?: string;       // "none", "minimal", "playground"
  category?: Category;
}

export interface AIWorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
}

export interface AIWorkoutResult {
  sessionId: string;
  name: string;
  exerciseCount: number;
  durationEstimate: number;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    category: string;
    muscles: string[];
  }>;
}

// ============================================
// INTENT DETECTION
// ============================================

const WORKOUT_CREATE_PATTERNS = /\b(create|make|build|design|generate|give me|plan|set up|put together|suggest)\b.*\b(workout|routine|session|training|exercises?|program)\b/i;
const WORKOUT_FOCUS_PATTERNS = /\b(upper\s*body|lower\s*body|full\s*body|legs?|arms?|chest|back|core|abs|shoulders?|glutes?|cardio|push|pull|hiit)\b/i;
const DURATION_PATTERNS = /\b(\d+)\s*(min(ute)?s?|hour)\b/i;
const DIFFICULTY_PATTERNS = /\b(easy|beginner|light|gentle|moderate|medium|hard|intense|advanced|challenging|brutal)\b/i;

export function isWorkoutCreationIntent(input: string): boolean {
  return WORKOUT_CREATE_PATTERNS.test(input);
}

export function extractWorkoutParams(input: string): Partial<AIWorkoutRequest> {
  const params: Partial<AIWorkoutRequest> = { userInput: input };

  const focusMatch = input.match(WORKOUT_FOCUS_PATTERNS);
  if (focusMatch) params.focusArea = focusMatch[1]!.toLowerCase();

  const durationMatch = input.match(DURATION_PATTERNS);
  if (durationMatch) {
    params.duration = parseInt(durationMatch[1]!, 10);
    if (durationMatch[2]?.startsWith('hour')) params.duration *= 60;
  }

  const difficultyMatch = input.match(DIFFICULTY_PATTERNS);
  if (difficultyMatch) params.difficulty = difficultyMatch[1]!.toLowerCase();

  // Map focus areas to categories
  const focusToCategory: Record<string, Category> = {
    core: 'body_control', abs: 'body_control',
    posture: 'posture', back: 'posture',
    speed: 'speed', cardio: 'speed', hiit: 'speed',
    mobility: 'mobility',
    focus: 'focus',
    strength: 'strength', chest: 'strength', arms: 'strength',
    shoulders: 'strength', 'upper body': 'strength',
    legs: 'strength', 'lower body': 'strength', glutes: 'strength',
    push: 'strength', pull: 'strength',
  };
  if (params.focusArea && focusToCategory[params.focusArea]) {
    params.category = focusToCategory[params.focusArea];
  }

  return params;
}

// ============================================
// CONTEXT BUILDER — Feeds exercises to AI
// ============================================

/** Map natural-language focus areas to target muscles */
const FOCUS_TO_MUSCLES: Record<string, TargetMuscle[]> = {
  'upper body': ['chest_mid', 'chest_upper', 'deltoids_front', 'deltoids_rear', 'biceps', 'triceps', 'lats'],
  'lower body': ['quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius', 'hip_flexors'],
  legs: ['quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius'],
  core: ['abs', 'obliques', 'lower_back'],
  abs: ['abs', 'obliques'],
  chest: ['chest_mid', 'chest_upper'],
  back: ['lats', 'rhomboids', 'lower_back', 'traps_mid'],
  shoulders: ['deltoids_front', 'deltoids_rear', 'traps_upper'],
  arms: ['biceps', 'triceps', 'forearms'],
  glutes: ['glutes_max', 'glutes_med'],
  push: ['chest_mid', 'chest_upper', 'deltoids_front', 'triceps'],
  pull: ['lats', 'rhomboids', 'biceps', 'deltoids_rear'],
  'full body': [],
};

export async function buildAIWorkoutContext(
  params: Partial<AIWorkoutRequest>,
): Promise<string> {
  const userId = 'user_local_001';
  const profile = await getUserProfile(userId);
  const fatigue = await getMuscleFatigue(userId);

  // Filter exercises relevant to the request
  const allExercises = await getExercises(
    params.category ? { categories: [params.category] } : undefined,
  );

  // If focus area maps to muscles, further filter
  const targetMuscles = params.focusArea ? FOCUS_TO_MUSCLES[params.focusArea] : undefined;
  let relevant: ExerciseWithDetails[];
  if (targetMuscles && targetMuscles.length > 0) {
    relevant = allExercises.filter(ex =>
      ex.primary_muscles.some(m => targetMuscles.includes(m)),
    );
    // If too few, include secondary muscle matches
    if (relevant.length < 20) {
      const secondary = allExercises.filter(ex =>
        !relevant.includes(ex) &&
        ex.secondary_muscles.some(m => targetMuscles.includes(m)),
      );
      relevant = [...relevant, ...secondary];
    }
  } else {
    relevant = allExercises;
  }

  // Difficulty filter
  if (params.difficulty) {
    const diffMap: Record<string, string[]> = {
      easy: ['beginner'],
      beginner: ['beginner'],
      light: ['beginner'],
      gentle: ['beginner'],
      moderate: ['beginner', 'intermediate'],
      medium: ['beginner', 'intermediate'],
      hard: ['intermediate', 'advanced'],
      intense: ['intermediate', 'advanced'],
      advanced: ['advanced'],
      challenging: ['intermediate', 'advanced'],
      brutal: ['advanced'],
    };
    const allowed = diffMap[params.difficulty] || ['beginner', 'intermediate'];
    relevant = relevant.filter(ex => allowed.includes(ex.difficulty));
  }

  // Take top 40 to keep context manageable
  const sample = relevant.slice(0, 40);

  // Build fatigue info
  const highFatigue = fatigue
    .filter(f => f.fatigue_level > 50)
    .map(f => `${f.muscle.replace(/_/g, ' ')}: ${f.fatigue_level}%`);

  // Build exercise list for AI — compact format
  const exerciseList = sample.map(ex =>
    `- ${ex.name} [${ex.category}/${ex.difficulty}] muscles: ${ex.primary_muscles.join(', ')} | ${ex.time_per_set_seconds}s/set`,
  ).join('\n');

  const duration = params.duration || profile?.time_per_session_minutes || 30;
  const exerciseCount = Math.min(6, Math.max(4, Math.floor(duration / 7)));

  return `
CREATE A WORKOUT using ONLY exercises from the list below.

USER REQUEST: "${params.userInput}"
DURATION: ~${duration} minutes
TARGET: ${exerciseCount} exercises
DIFFICULTY: ${params.difficulty || profile?.experience || 'intermediate'}
FOCUS: ${params.focusArea || profile?.goal || 'full body'}
${highFatigue.length > 0 ? `FATIGUED MUSCLES (avoid): ${highFatigue.join(', ')}` : ''}

AVAILABLE EXERCISES:
${exerciseList}

RESPOND WITH EXACTLY this JSON format (no extra text):
{
  "name": "Workout Title",
  "exercises": [
    { "name": "Exact Exercise Name", "sets": 3, "reps": "8-12" },
    ...
  ]
}

RULES:
- Use EXACT exercise names from the list above
- Pick ${exerciseCount} exercises total
- Vary muscle groups for balance
- Match the difficulty and focus area
- Sets: 2-4, Reps: "6-8" or "10-15" or "30s hold" depending on exercise type
`.trim();
}

// ============================================
// RESPONSE PARSER — AI output → DB workout
// ============================================

export async function parseAIWorkoutResponse(
  aiResponse: string,
): Promise<AIWorkoutResult | null> {
  // Extract JSON from AI response (may be wrapped in markdown code block)
  let jsonStr = aiResponse;
  const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1]!;
  } else {
    const rawJsonMatch = aiResponse.match(/\{[\s\S]*"exercises"[\s\S]*\}/);
    if (rawJsonMatch) jsonStr = rawJsonMatch[0];
  }

  let parsed: { name?: string; exercises?: AIWorkoutExercise[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed.exercises || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    return null;
  }

  // Match AI exercise names to actual DB exercises
  const allExercises = await getExercises();
  const exerciseMap = new Map<string, ExerciseWithDetails>();
  for (const ex of allExercises) {
    exerciseMap.set(ex.name.toLowerCase(), ex);
  }

  const matched: Array<{
    dbExercise: ExerciseWithDetails;
    sets: number;
    reps: string;
  }> = [];

  for (const aiEx of parsed.exercises) {
    if (!aiEx.name) continue;
    // Exact match first
    let dbEx = exerciseMap.get(aiEx.name.toLowerCase());
    // Fuzzy match: find closest
    if (!dbEx) {
      const candidates = allExercises.filter(e =>
        e.name.toLowerCase().includes(aiEx.name.toLowerCase()) ||
        aiEx.name.toLowerCase().includes(e.name.toLowerCase()),
      );
      if (candidates.length > 0) dbEx = candidates[0]!;
    }
    if (dbEx) {
      matched.push({
        dbExercise: dbEx,
        sets: Math.min(5, Math.max(1, aiEx.sets || 3)),
        reps: aiEx.reps || '8-12',
      });
    }
  }

  if (matched.length === 0) return null;

  // Persist to DB as a real session
  const sessionId = await generateSecureId('session');
  const durationEstimate = matched.reduce((sum, ex) => {
    return sum + ex.sets * (ex.dbExercise.time_per_set_seconds + 60);
  }, 0) / 60;

  await createWorkoutSession({
    id: sessionId,
    user_id: 'user_local_001',
    duration_minutes: Math.round(durationEstimate),
    total_exercises: matched.length,
    completed_exercises: 0,
    success: false,
    notes: `AI-generated: ${parsed.name || 'Custom Workout'}`,
  });

  for (let i = 0; i < matched.length; i++) {
    const ex = matched[i]!;
    await addSessionExercise({
      id: `${sessionId}_ex_${i + 1}`,
      session_id: sessionId,
      exercise_id: ex.dbExercise.id,
      order_in_session: i + 1,
      prescribed_sets: ex.sets,
      prescribed_reps: ex.reps,
      completed_sets: 0,
      skipped: false,
    });
  }

  return {
    sessionId,
    name: parsed.name || 'AI Custom Workout',
    exerciseCount: matched.length,
    durationEstimate: Math.round(durationEstimate),
    exercises: matched.map(m => ({
      name: m.dbExercise.name,
      sets: m.sets,
      reps: m.reps,
      category: m.dbExercise.category,
      muscles: m.dbExercise.primary_muscles,
    })),
  };
}

// ============================================
// DIRECT WORKOUT CREATION — Fallback when AI
// doesn't return valid JSON. Picks exercises
// straight from the DB using extracted params.
// ============================================

export async function createDirectWorkout(
  params: Partial<AIWorkoutRequest>,
): Promise<AIWorkoutResult> {
  const userId = 'user_local_001';
  const profile = await getUserProfile(userId);
  const fatigue = await getMuscleFatigue(userId);

  const allExercises = await getExercises(
    params.category ? { categories: [params.category] } : undefined,
  );

  // Filter by target muscles
  const targetMuscles = params.focusArea ? FOCUS_TO_MUSCLES[params.focusArea] : undefined;
  let pool: ExerciseWithDetails[];
  if (targetMuscles && targetMuscles.length > 0) {
    pool = allExercises.filter(ex =>
      ex.primary_muscles.some(m => targetMuscles.includes(m)),
    );
    if (pool.length < 10) {
      const secondary = allExercises.filter(ex =>
        !pool.includes(ex) &&
        ex.secondary_muscles.some(m => targetMuscles.includes(m)),
      );
      pool = [...pool, ...secondary];
    }
  } else {
    pool = allExercises;
  }

  // Difficulty filter
  if (params.difficulty) {
    const diffMap: Record<string, string[]> = {
      easy: ['beginner'], beginner: ['beginner'], light: ['beginner'], gentle: ['beginner'],
      moderate: ['beginner', 'intermediate'], medium: ['beginner', 'intermediate'],
      hard: ['intermediate', 'advanced'], intense: ['intermediate', 'advanced'],
      advanced: ['advanced'], challenging: ['intermediate', 'advanced'], brutal: ['advanced'],
    };
    const allowed = diffMap[params.difficulty] || ['beginner', 'intermediate'];
    pool = pool.filter(ex => allowed.includes(ex.difficulty));
  }

  // Avoid fatigued muscles
  const fatiguedMuscles = new Set(
    fatigue.filter(f => f.fatigue_level > 60).map(f => f.muscle),
  );
  const fresh = pool.filter(ex =>
    !ex.primary_muscles.some(m => fatiguedMuscles.has(m)),
  );
  if (fresh.length >= 4) pool = fresh;

  const duration = params.duration || profile?.time_per_session_minutes || 30;
  const count = Math.min(pool.length, Math.max(4, Math.floor(duration / 7)));

  // Pick diverse exercises — spread across different primary muscles
  const selected: ExerciseWithDetails[] = [];
  const usedMuscles = new Set<string>();
  for (const ex of pool) {
    if (selected.length >= count) break;
    const primary = ex.primary_muscles[0] ?? '';
    if (!usedMuscles.has(primary) || selected.length >= count - 1) {
      selected.push(ex);
      ex.primary_muscles.forEach(m => usedMuscles.add(m));
    }
  }
  // Fill remaining if diversity pass didn't get enough
  for (const ex of pool) {
    if (selected.length >= count) break;
    if (!selected.includes(ex)) selected.push(ex);
  }

  // Persist
  const sessionId = await generateSecureId('session');

  // Determine sets/reps based on difficulty, exercise type, and duration
  const getSetsReps = (ex: ExerciseWithDetails, diff?: string): { sets: number; reps: string } => {
    const isHold = ex.category === 'mobility' || ex.category === 'body_control' || ex.category === 'focus';
    const isSpeed = ex.category === 'speed';
    
    if (diff === 'easy' || diff === 'beginner' || diff === 'light' || diff === 'gentle') {
      return isHold ? { sets: 2, reps: '20s hold' } : isSpeed ? { sets: 2, reps: '8-10' } : { sets: 2, reps: '8-10' };
    }
    if (diff === 'hard' || diff === 'intense' || diff === 'advanced' || diff === 'brutal' || diff === 'challenging') {
      return isHold ? { sets: 4, reps: '45s hold' } : isSpeed ? { sets: 4, reps: '12-15' } : { sets: 4, reps: '10-15' };
    }
    // moderate/default
    return isHold ? { sets: 3, reps: '30s hold' } : isSpeed ? { sets: 3, reps: '10-12' } : { sets: 3, reps: '8-12' };
  };

  const durationEstimate = selected.reduce((sum, ex) => {
    const { sets } = getSetsReps(ex, params.difficulty);
    return sum + sets * (ex.time_per_set_seconds + 60);
  }, 0) / 60;

  const focusLabel = params.focusArea
    ? params.focusArea.charAt(0).toUpperCase() + params.focusArea.slice(1)
    : profile?.goal || 'Custom';

  await createWorkoutSession({
    id: sessionId,
    user_id: userId,
    duration_minutes: Math.round(durationEstimate),
    total_exercises: selected.length,
    completed_exercises: 0,
    success: false,
    notes: `AI-generated: ${focusLabel} Workout`,
  });

  for (let i = 0; i < selected.length; i++) {
    const { sets, reps } = getSetsReps(selected[i]!, params.difficulty);
    await addSessionExercise({
      id: `${sessionId}_ex_${i + 1}`,
      session_id: sessionId,
      exercise_id: selected[i]!.id,
      order_in_session: i + 1,
      prescribed_sets: sets,
      prescribed_reps: reps,
      completed_sets: 0,
      skipped: false,
    });
  }

  return {
    sessionId,
    name: `${focusLabel} Workout`,
    exerciseCount: selected.length,
    durationEstimate: Math.round(durationEstimate),
    exercises: selected.map(ex => {
      const { sets, reps } = getSetsReps(ex, params.difficulty);
      return {
        name: ex.name,
        sets,
        reps,
        category: ex.category,
        muscles: ex.primary_muscles,
      };
    }),
  };
}
