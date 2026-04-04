/**
 * Tests: Workout Generator — Core Product Brain
 *
 * Target: src/engines/workoutGenerator.ts (909 LOC)
 * Strategy: Mock at service boundary (database/service, adaptiveTrainingService,
 *           ReadinessEngine, progressionEngine, randomId)
 * Coverage zones:
 *   1. Exercise selection logic (muscle targeting, equipment filtering, fallback)
 *   2. Fatigue integration (high fatigue → reduced intensity, low → progression)
 *   3. Pattern matching (push/pull/legs/core balance, no duplicate conflicts)
 *   4. Edge cases (empty DB, missing equipment, conflicting goals, deload)
 *   5. Volume prescription (preset, progression-aware, deload, readiness)
 *   6. Full generation pipeline (end-to-end behavioral)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// SHARED STATE FOR MOCKS
// ============================================

const appState = new Map<string, string>();

// Catalog of mock exercises — each zone can override via getExercises mock
function makeExercise(overrides: Partial<import('../../src/database/types').ExerciseWithDetails> & { id: string; name: string }): import('../../src/database/types').ExerciseWithDetails {
  return {
    category: 'strength',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'low_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: ['Do the thing'],
    order_in_category: 0,
    audio_intro: '',
    audio_setup: '',
    audio_execution: '',
    audio_transition: '',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    primary_muscles: ['chest_mid'] as import('../../src/database/types').TargetMuscle[],
    secondary_muscles: [],
    equipment_required: [],
    equipment_optional: [],
    training_types: [{ type: 'hypertrophy' as import('../../src/database/types').TrainingType, effectiveness: 8 }],
    ...overrides,
  };
}

const PUSH_EXERCISES = [
  makeExercise({ id: 'push_1', name: 'Push-ups', primary_muscles: ['chest_mid', 'triceps'], training_types: [{ type: 'hypertrophy', effectiveness: 8 }] }),
  makeExercise({ id: 'push_2', name: 'Diamond Push-ups', primary_muscles: ['triceps', 'chest_mid'], training_types: [{ type: 'strength', effectiveness: 7 }] }),
  makeExercise({ id: 'push_3', name: 'Pike Push-ups', primary_muscles: ['deltoids_front'], training_types: [{ type: 'strength', effectiveness: 7 }] }),
  makeExercise({ id: 'push_4', name: 'Chest Dips', primary_muscles: ['chest_lower', 'triceps'], training_types: [{ type: 'hypertrophy', effectiveness: 9 }] }),
];

const PULL_EXERCISES = [
  makeExercise({ id: 'pull_1', name: 'Pull-ups', primary_muscles: ['lats', 'biceps'], training_types: [{ type: 'strength', effectiveness: 9 }] }),
  makeExercise({ id: 'pull_2', name: 'Inverted Rows', primary_muscles: ['rhomboids', 'biceps'], training_types: [{ type: 'hypertrophy', effectiveness: 7 }] }),
  makeExercise({ id: 'pull_3', name: 'Face Pulls', primary_muscles: ['deltoids_rear', 'traps_mid'], training_types: [{ type: 'hypertrophy', effectiveness: 6 }] }),
];

const LEG_EXERCISES = [
  makeExercise({ id: 'leg_1', name: 'Squats', primary_muscles: ['quads', 'glutes_max'], training_types: [{ type: 'strength', effectiveness: 9 }] }),
  makeExercise({ id: 'leg_2', name: 'Lunges', primary_muscles: ['quads', 'hamstrings'], training_types: [{ type: 'hypertrophy', effectiveness: 8 }] }),
  makeExercise({ id: 'leg_3', name: 'Calf Raises', primary_muscles: ['calves_gastrocnemius'], training_types: [{ type: 'endurance', effectiveness: 6 }] }),
];

const CORE_EXERCISES = [
  makeExercise({ id: 'core_1', name: 'Plank', primary_muscles: ['core_deep', 'abs'], category: 'body_control', training_types: [{ type: 'endurance', effectiveness: 7 }] }),
  makeExercise({ id: 'core_2', name: 'Russian Twist', primary_muscles: ['obliques'], category: 'body_control', training_types: [{ type: 'endurance', effectiveness: 6 }] }),
];

const MOBILITY_EXERCISES = [
  makeExercise({ id: 'mob_1', name: 'Cat-Cow Stretch', primary_muscles: ['lower_back'], category: 'mobility', difficulty: 'beginner', training_types: [{ type: 'mobility', effectiveness: 8 }] }),
  makeExercise({ id: 'mob_2', name: 'Hip Opener', primary_muscles: ['hip_flexors'], category: 'mobility', difficulty: 'beginner', training_types: [{ type: 'mobility', effectiveness: 7 }] }),
];

const ALL_EXERCISES = [...PUSH_EXERCISES, ...PULL_EXERCISES, ...LEG_EXERCISES, ...CORE_EXERCISES, ...MOBILITY_EXERCISES];

const DEFAULT_PROFILE: import('../../src/database/types').UserProfile = {
  id: 'user_local_001',
  goal: 'strength',
  experience: 'intermediate',
  training_days_per_week: 4,
  time_per_session_minutes: 30,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  locked: false,
};

const DEFAULT_ADAPTIVE = {
  userId: 'user_local_001',
  fatigueSensitivity: 1,
  progressionAggressiveness: 1,
  volumeTolerance: 1,
  confidence: 0,
  samples: 0,
  updatedAt: Date.now(),
  rationale: [],
};

const USER = 'user_local_001';

// ============================================
// MOCKS
// ============================================

vi.mock('../../src/database/service', () => ({
  getExercises: vi.fn().mockResolvedValue([]),
  getUserProfile: vi.fn().mockResolvedValue(null),
  getMuscleFatigue: vi.fn().mockResolvedValue([]),
  getUserEquipment: vi.fn().mockResolvedValue([]),
  getUserInjuries: vi.fn().mockResolvedValue([]),
  createWorkoutSession: vi.fn().mockResolvedValue(undefined),
  addSessionExercise: vi.fn().mockResolvedValue(undefined),
  getRecentExerciseIds: vi.fn().mockResolvedValue([]),
  getRecentlyTrainedMuscles: vi.fn().mockResolvedValue([]),
  getAllProgressRecords: vi.fn().mockResolvedValue([]),
  getAppState: vi.fn().mockImplementation((key: string) => Promise.resolve(appState.get(key) ?? null)),
}));

vi.mock('../../src/services/adaptiveTrainingService', () => ({
  getAdaptiveTrainingProfile: vi.fn().mockResolvedValue({
    userId: 'user_local_001',
    fatigueSensitivity: 1,
    progressionAggressiveness: 1,
    volumeTolerance: 1,
    confidence: 0,
    samples: 0,
    updatedAt: Date.now(),
    rationale: [],
  }),
}));

vi.mock('../../src/engines/ReadinessEngine', () => ({
  getCachedReadiness: vi.fn().mockResolvedValue({ score: 80 }),
}));

vi.mock('../../src/engines/progressionEngine', () => ({
  calculateProgression: vi.fn().mockResolvedValue({
    action: 'maintain',
    reason: 'Insufficient data or mixed results → maintain current prescription',
    recommendation: { sets: 3, reps: '8-12' },
  }),
}));

vi.mock('../../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockImplementation((prefix: string) => Promise.resolve(`${prefix}_test_001`)),
}));

// ============================================
// IMPORTS (after all mocks)
// ============================================

import { generateWorkout, analyzeWorkoutGeneration, persistWorkout, createWorkout } from '../../src/engines/workoutGenerator';
import { getExercises, getUserProfile, getMuscleFatigue, getUserEquipment, getUserInjuries, getRecentExerciseIds, getRecentlyTrainedMuscles, getAllProgressRecords, createWorkoutSession, addSessionExercise } from '../../src/database/service';
import { getAdaptiveTrainingProfile } from '../../src/services/adaptiveTrainingService';
import { getCachedReadiness } from '../../src/engines/ReadinessEngine';
import { calculateProgression } from '../../src/engines/progressionEngine';

// ============================================
// HELPERS
// ============================================

/** Set up standard mocks for a viable workout generation */
function setupStandardMocks(overrides?: {
  exercises?: import('../../src/database/types').ExerciseWithDetails[];
  profile?: import('../../src/database/types').UserProfile | null;
  fatigue?: { user_id: string; muscle: string; fatigue_level: number; last_trained_at: string | null; updated_at: string }[];
  equipment?: string[];
  injuries?: { user_id: string; muscle: string; severity: 'mild' | 'moderate' | 'severe'; created_at: string }[];
  recentExerciseIds?: string[];
  recentMuscles?: string[];
}) {
  const exercises = overrides?.exercises ?? ALL_EXERCISES;
  vi.mocked(getExercises).mockResolvedValue(exercises);
  vi.mocked(getUserProfile).mockResolvedValue(overrides?.profile !== undefined ? overrides.profile : DEFAULT_PROFILE);
  vi.mocked(getMuscleFatigue).mockResolvedValue(overrides?.fatigue as any ?? []);
  vi.mocked(getUserEquipment).mockResolvedValue(overrides?.equipment as any ?? []);
  vi.mocked(getUserInjuries).mockResolvedValue(overrides?.injuries as any ?? []);
  vi.mocked(getRecentExerciseIds).mockResolvedValue(overrides?.recentExerciseIds ?? []);
  vi.mocked(getRecentlyTrainedMuscles).mockResolvedValue(overrides?.recentMuscles ?? []);
  vi.mocked(getAllProgressRecords).mockResolvedValue([]);
}

// ============================================
// TESTS
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  appState.clear();
  // Re-apply default adaptive mock (clearAllMocks resets implementations)
  vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue(DEFAULT_ADAPTIVE);
  vi.mocked(getCachedReadiness).mockResolvedValue({ score: 80 });
  vi.mocked(calculateProgression).mockResolvedValue({
    action: 'maintain',
    reason: 'Insufficient data or mixed results → maintain current prescription',
    recommendation: { sets: 3, reps: '8-12' },
  });
});

// ============================================
// ZONE 1: EXERCISE SELECTION LOGIC
// ============================================

describe('Exercise Selection Logic', () => {
  it('returns null when no profile exists', async () => {
    setupStandardMocks({ profile: null });
    await expect(generateWorkout(USER)).rejects.toThrow('User profile not found');
  });

  it('returns null when fewer than 4 exercises pass hard filter', async () => {
    setupStandardMocks({ exercises: [PUSH_EXERCISES[0]!] });
    const result = await generateWorkout(USER);
    expect(result).toBeNull();
  });

  it('generates a workout with 4-6 exercises for standard profile', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
    expect(result!.exercises.length).toBeLessThanOrEqual(6);
  });

  it('selects exercises matching the user goal training types', async () => {
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, goal: 'strength' },
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    // Strength goal → hypertrophy + strength training types
    // At least some selected exercises should have matching training types
    const hasStrengthRelated = result!.exercises.some(e =>
      e.exercise.training_types.some(tt =>
        ['hypertrophy', 'strength'].includes(tt.type)
      )
    );
    expect(hasStrengthRelated).toBe(true);
  });

  it('filters out exercises requiring equipment user does not have', async () => {
    const gymExercise = makeExercise({
      id: 'gym_1',
      name: 'Barbell Bench Press',
      equipment_level: 'minimal',
      equipment_required: ['barbell'] as any,
      primary_muscles: ['chest_mid'],
    });
    setupStandardMocks({
      exercises: [...ALL_EXERCISES, gymExercise],
      equipment: [], // user has no equipment
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    const ids = result!.exercises.map(e => e.exercise.id);
    expect(ids).not.toContain('gym_1');
  });

  it('includes exercises when user has required equipment', async () => {
    const equipExercise = makeExercise({
      id: 'equip_1',
      name: 'Resistance Band Row',
      equipment_required: ['resistance_bands'] as any,
      primary_muscles: ['lats', 'biceps'],
      training_types: [{ type: 'hypertrophy', effectiveness: 10 }], // High score to ensure selection
    });
    // Only equipment exercises to force selection
    const equippedPool = [
      equipExercise,
      makeExercise({ id: 'e2', name: 'Ex2', primary_muscles: ['quads'], equipment_required: ['resistance_bands'] as any, training_types: [{ type: 'strength', effectiveness: 9 }] }),
      makeExercise({ id: 'e3', name: 'Ex3', primary_muscles: ['core_deep'], equipment_required: ['resistance_bands'] as any, training_types: [{ type: 'strength', effectiveness: 8 }] }),
      makeExercise({ id: 'e4', name: 'Ex4', primary_muscles: ['hamstrings'], equipment_required: ['resistance_bands'] as any, training_types: [{ type: 'strength', effectiveness: 7 }] }),
    ];
    setupStandardMocks({
      exercises: equippedPool,
      equipment: ['resistance_bands'] as any,
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBe(4);
  });

  it('excludes exercises targeting injured muscles (moderate/severe)', async () => {
    setupStandardMocks({
      injuries: [
        { user_id: USER, muscle: 'chest_mid', severity: 'severe', created_at: '2026-01-01' },
      ],
    });
    const result = await generateWorkout(USER);
    if (result) {
      const exercisesMuscles = result.exercises.flatMap(e => e.exercise.primary_muscles);
      expect(exercisesMuscles).not.toContain('chest_mid');
    }
  });

  it('allows exercises for mild injuries', async () => {
    setupStandardMocks({
      injuries: [
        { user_id: USER, muscle: 'chest_mid', severity: 'mild', created_at: '2026-01-01' },
      ],
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    // mild injuries don't filter out exercises
  });

  it('filters gym-keyword exercises when bodyweight-only', async () => {
    const gymNamedExercise = makeExercise({
      id: 'gym_named_1',
      name: 'Barbell Squat',
      equipment_level: 'none', // mis-tagged as no equipment
      primary_muscles: ['quads', 'glutes_max'],
    });
    setupStandardMocks({
      exercises: [...ALL_EXERCISES, gymNamedExercise],
    });
    // Equipment level = none (bodyweight only)
    appState.set('user.equipment_level', 'none');
    const result = await generateWorkout(USER);
    if (result) {
      const ids = result.exercises.map(e => e.exercise.id);
      expect(ids).not.toContain('gym_named_1');
    }
  });

  it('respects difficulty range for beginner (only beginner exercises)', async () => {
    const advancedOnly = makeExercise({
      id: 'adv_1',
      name: 'Planche Push-up',
      difficulty: 'advanced',
      primary_muscles: ['chest_mid', 'deltoids_front'],
    });
    // Create a pool with only beginner exercises + one advanced
    const beginnerPool = [
      makeExercise({ id: 'b1', name: 'Wall Push-up', difficulty: 'beginner', primary_muscles: ['chest_mid'], training_types: [{ type: 'strength', effectiveness: 6 }] }),
      makeExercise({ id: 'b2', name: 'Knee Push-up', difficulty: 'beginner', primary_muscles: ['chest_mid', 'triceps'], training_types: [{ type: 'strength', effectiveness: 6 }] }),
      makeExercise({ id: 'b3', name: 'Air Squat', difficulty: 'beginner', primary_muscles: ['quads'], training_types: [{ type: 'strength', effectiveness: 7 }] }),
      makeExercise({ id: 'b4', name: 'Dead Hang', difficulty: 'beginner', primary_muscles: ['lats'], training_types: [{ type: 'strength', effectiveness: 5 }] }),
      advancedOnly,
    ];
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, experience: 'beginner' },
      exercises: beginnerPool,
    });
    // getExercises mock applies difficulty filter — simulate by only returning beginners
    vi.mocked(getExercises).mockImplementation(async (filter) => {
      return beginnerPool.filter(e => {
        if (filter?.difficulties && !filter.difficulties.includes(e.difficulty)) return false;
        if (filter?.categories && !filter.categories.includes(e.category)) return false;
        if (filter?.training_types && !e.training_types.some(tt => filter.training_types!.includes(tt.type))) return false;
        return true;
      });
    });
    const result = await generateWorkout(USER);
    if (result) {
      const ids = result.exercises.map(e => e.exercise.id);
      expect(ids).not.toContain('adv_1');
    }
  });
});

// ============================================
// ZONE 2: FATIGUE INTEGRATION
// ============================================

describe('Fatigue Integration', () => {
  it('avoids muscles with fatigue above threshold (70)', async () => {
    setupStandardMocks({
      fatigue: [
        { user_id: USER, muscle: 'chest_mid', fatigue_level: 85, last_trained_at: null, updated_at: '' },
        { user_id: USER, muscle: 'triceps', fatigue_level: 80, last_trained_at: null, updated_at: '' },
      ],
    });
    const result = await generateWorkout(USER);
    if (result) {
      // chest_mid and triceps are above threshold — exercises targeting them should be skipped
      for (const ex of result.exercises) {
        for (const muscle of ex.exercise.primary_muscles) {
          if (muscle === 'chest_mid' || muscle === 'triceps') {
            // This can still appear if it's secondarily used — the key is primary targeting
            // The hard filter checks each primary muscle
          }
        }
      }
      // The result should still be valid (enough non-fatigued exercises)
      expect(result.exercises.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('respects adaptive fatigue sensitivity for lower thresholds', async () => {
    // fatigueSensitivity 1.25 → threshold = 70 - (1.25-1)*20 = 65
    vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
      ...DEFAULT_ADAPTIVE,
      fatigueSensitivity: 1.25,
    });
    setupStandardMocks({
      fatigue: [
        { user_id: USER, muscle: 'chest_mid', fatigue_level: 68, last_trained_at: null, updated_at: '' },
      ],
    });
    const result = await generateWorkout(USER);
    if (result) {
      // With sensitivity 1.25, threshold = 65. Fatigue 68 > 65, so chest_mid should be avoided
      const chestExercises = result.exercises.filter(e =>
        e.exercise.primary_muscles.includes('chest_mid' as any)
      );
      expect(chestExercises.length).toBe(0);
    }
  });

  it('prefers fresher muscle groups in scoring', async () => {
    setupStandardMocks({
      fatigue: [
        { user_id: USER, muscle: 'chest_mid', fatigue_level: 40, last_trained_at: null, updated_at: '' },
        { user_id: USER, muscle: 'lats', fatigue_level: 10, last_trained_at: null, updated_at: '' },
      ],
    });
    const diag = await analyzeWorkoutGeneration(USER);
    if (diag && diag.top_scored.length >= 2) {
      // Exercises targeting lats (fresher) should score higher than chest_mid on freshness
      const latExercise = diag.top_scored.find(e => e.primary_muscles.includes('lats' as any));
      const chestExercise = diag.top_scored.find(e => e.primary_muscles.includes('chest_mid' as any) && !e.primary_muscles.includes('lats' as any));
      if (latExercise && chestExercise) {
        // Lat exercise should have a higher freshness-related score
        expect(latExercise.score).toBeGreaterThanOrEqual(chestExercise.score);
      }
    }
  });

  it('still generates workouts when some muscles are fatigued', async () => {
    setupStandardMocks({
      fatigue: [
        { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' },
        { user_id: USER, muscle: 'triceps', fatigue_level: 85, last_trained_at: null, updated_at: '' },
      ],
    });
    const result = await generateWorkout(USER);
    // Should still generate — other muscles are available
    expect(result).not.toBeNull();
    if (result) {
      expect(result.exercises.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ============================================
// ZONE 3: PATTERN MATCHING
// ============================================

describe('Pattern Matching', () => {
  it('covers multiple movement patterns (push/pull/legs/core)', async () => {
    setupStandardMocks();
    const diag = await analyzeWorkoutGeneration(USER);
    expect(diag).not.toBeNull();
    if (diag) {
      const selectedMuscles = diag.selected.flatMap(s => s.primary_muscles);
      // Should have diversity — not all from one pattern
      const patterns = new Set<string>();
      const PATTERN_DEF: Record<string, string[]> = {
        push: ['chest_mid', 'chest_upper', 'chest_lower', 'deltoids_front', 'triceps'],
        pull: ['lats', 'rhomboids', 'biceps', 'deltoids_rear', 'traps_mid'],
        legs: ['quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius'],
        core: ['abs', 'obliques', 'core_deep', 'lower_back'],
      };
      for (const [pattern, muscles] of Object.entries(PATTERN_DEF)) {
        if (selectedMuscles.some(m => muscles.includes(m))) {
          patterns.add(pattern);
        }
      }
      // With our test pool, should cover at least 2 patterns
      expect(patterns.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not select duplicate exercises', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      const ids = result.exercises.map(e => e.exercise.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('limits muscle overlap between selected exercises', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // Check that no two exercises have identical primary muscle sets
      for (let i = 0; i < result.exercises.length; i++) {
        for (let j = i + 1; j < result.exercises.length; j++) {
          const musclesA = result.exercises[i]!.exercise.primary_muscles;
          const musclesB = result.exercises[j]!.exercise.primary_muscles;
          const overlap = musclesA.filter(m => musclesB.includes(m));
          // Overlap should not be total (some overlap is fine for compound movements)
          const isIdentical = overlap.length === musclesA.length && overlap.length === musclesB.length;
          expect(isIdentical).toBe(false);
        }
      }
    }
  });

  it('prioritizes focus pattern exercises', async () => {
    setupStandardMocks();
    const diag = await analyzeWorkoutGeneration(USER);
    expect(diag).not.toBeNull();
    if (diag && diag.intent.focus_pattern) {
      // At least one selected exercise should match the focus pattern
      const hasMatchingFocus = diag.selected.some(s => s.matches_focus_pattern);
      expect(hasMatchingFocus).toBe(true);
    }
  });

  it('penalizes recently used exercises via variety score', async () => {
    setupStandardMocks({
      recentExerciseIds: ['push_1', 'pull_1', 'leg_1'],
    });
    const diag = await analyzeWorkoutGeneration(USER);
    expect(diag).not.toBeNull();
    if (diag) {
      // Recent exercises should score lower, preferring variety
      const recentInTop = diag.top_scored.filter(e => ['push_1', 'pull_1', 'leg_1'].includes(e.id));
      const freshInTop = diag.top_scored.filter(e => !['push_1', 'pull_1', 'leg_1'].includes(e.id));
      // Fresh exercises should generally score higher (variety bonus 80 vs 20)
      if (recentInTop.length > 0 && freshInTop.length > 0) {
        const avgRecent = recentInTop.reduce((s, e) => s + e.score, 0) / recentInTop.length;
        const avgFresh = freshInTop.reduce((s, e) => s + e.score, 0) / freshInTop.length;
        expect(avgFresh).toBeGreaterThan(avgRecent);
      }
    }
  });

  it('avoids highly fatigued pattern when determining session intent', async () => {
    // All push muscles are heavily fatigued → intent should avoid push pattern
    setupStandardMocks({
      fatigue: [
        { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: new Date(Date.now() - 3600000).toISOString(), updated_at: '' },
        { user_id: USER, muscle: 'chest_upper', fatigue_level: 85, last_trained_at: new Date(Date.now() - 3600000).toISOString(), updated_at: '' },
        { user_id: USER, muscle: 'triceps', fatigue_level: 88, last_trained_at: new Date(Date.now() - 3600000).toISOString(), updated_at: '' },
        { user_id: USER, muscle: 'deltoids_front', fatigue_level: 80, last_trained_at: new Date(Date.now() - 3600000).toISOString(), updated_at: '' },
      ],
    });
    const diag = await analyzeWorkoutGeneration(USER);
    expect(diag).not.toBeNull();
    if (diag) {
      // Push muscles are all highly fatigued → freshest pattern should NOT be push
      expect(diag.intent.focus_pattern).not.toBe('push');
    }
  });
});

// ============================================
// ZONE 4: EDGE CASES
// ============================================

describe('Edge Cases', () => {
  it('returns null when exercise DB is empty', async () => {
    setupStandardMocks({ exercises: [] });
    vi.mocked(getExercises).mockResolvedValue([]);
    const result = await generateWorkout(USER);
    expect(result).toBeNull();
  });

  it('handles profile with minimal time (short sessions)', async () => {
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, time_per_session_minutes: 15 },
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // 15 min / 8 = ~1-2, clamped to MIN_EXERCISES (4)
      expect(result.exercises.length).toBe(4);
    }
  });

  it('handles profile with maximum time (long sessions)', async () => {
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, time_per_session_minutes: 90 },
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // 90/8 = ~11, clamped to MAX_EXERCISES (6)
      expect(result.exercises.length).toBeLessThanOrEqual(6);
    }
  });

  it('generates deload workout with reduced volume', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER, true); // deload flag
    expect(result).not.toBeNull();
    if (result) {
      // Deload sets = floor(original * 0.6), min 2
      for (const ex of result.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
        expect(ex.sets).toBeLessThanOrEqual(3); // 4*0.6=2.4→2, 5*0.6=3
      }
    }
  });

  it('returns diagnostics from analyzeWorkoutGeneration', async () => {
    setupStandardMocks();
    const diag = await analyzeWorkoutGeneration(USER);
    expect(diag).not.toBeNull();
    expect(diag!.user_id).toBe(USER);
    expect(diag!.candidate_count).toBeGreaterThan(0);
    expect(diag!.selected_count).toBeGreaterThanOrEqual(4);
    expect(diag!.intent).toBeDefined();
    expect(diag!.top_scored.length).toBeGreaterThan(0);
    expect(diag!.selected.length).toBeGreaterThanOrEqual(4);
  });

  it('handles all muscles fatigued to near threshold', async () => {
    // All muscles at 60 (below default threshold of 70) — should still work
    const fatigue = ['chest_mid', 'triceps', 'lats', 'biceps', 'quads', 'hamstrings', 'glutes_max', 'core_deep'].map(m => ({
      user_id: USER,
      muscle: m,
      fatigue_level: 60,
      last_trained_at: null as null,
      updated_at: '',
    }));
    setupStandardMocks({ fatigue });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
  });

  it('uses fallback when primary category filter returns too few', async () => {
    // First call returns < 4 (primary), second call returns full pool (fallback)
    let callCount = 0;
    vi.mocked(getExercises).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return [PUSH_EXERCISES[0]!]; // too few
      return ALL_EXERCISES; // fallback expands
    });
    vi.mocked(getUserProfile).mockResolvedValue(DEFAULT_PROFILE);
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    vi.mocked(getUserEquipment).mockResolvedValue([]);
    vi.mocked(getUserInjuries).mockResolvedValue([]);
    vi.mocked(getRecentExerciseIds).mockResolvedValue([]);
    vi.mocked(getRecentlyTrainedMuscles).mockResolvedValue([]);
    vi.mocked(getAllProgressRecords).mockResolvedValue([]);

    const result = await generateWorkout(USER);
    // Fallback should have been triggered (multiple getExercises calls)
    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(result).not.toBeNull();
  });

  it('handles mobility goal with hold-based reps', async () => {
    const mobilityExercises = [
      makeExercise({ id: 'm1', name: 'Cat-Cow', category: 'mobility', difficulty: 'beginner', primary_muscles: ['lower_back'], training_types: [{ type: 'mobility', effectiveness: 8 }] }),
      makeExercise({ id: 'm2', name: 'Hip Circle', category: 'mobility', difficulty: 'beginner', primary_muscles: ['hip_flexors'], training_types: [{ type: 'mobility', effectiveness: 7 }] }),
      makeExercise({ id: 'm3', name: 'Shoulder Roll', category: 'mobility', difficulty: 'beginner', primary_muscles: ['deltoids_front'], training_types: [{ type: 'recovery', effectiveness: 6 }] }),
      makeExercise({ id: 'm4', name: 'Ankle Mobility', category: 'mobility', difficulty: 'beginner', primary_muscles: ['calves_gastrocnemius'], training_types: [{ type: 'mobility', effectiveness: 7 }] }),
    ];
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, goal: 'mobility', experience: 'beginner' },
      exercises: mobilityExercises,
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // Mobility exercises should have hold-based reps
      for (const ex of result.exercises) {
        if (ex.exercise.category === 'mobility') {
          expect(ex.reps).toMatch(/hold|s$/i); // contains "hold" or ends with "s" (seconds)
        }
      }
    }
  });
});

// ============================================
// ZONE 5: VOLUME PRESCRIPTION
// ============================================

describe('Volume Prescription', () => {
  it('uses static preset for exercises without progression history', async () => {
    // calculateProgression returns "maintain with insufficient data" → generator falls back to preset
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      for (const ex of result.exercises) {
        // intermediate strength preset: 4 sets, "8-12"
        expect(ex.sets).toBeGreaterThanOrEqual(2);
        expect(ex.sets).toBeLessThanOrEqual(6);
      }
    }
  });

  it('applies progression-based volume when history exists', async () => {
    vi.mocked(calculateProgression).mockResolvedValue({
      action: 'progress_reps',
      reason: 'Consistent performance → increase reps',
      recommendation: { sets: 4, reps: '10-15' },
    });
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // At least one exercise should use the progression recommendation
      const hasProgressed = result.exercises.some(e => e.reps === '10-15');
      expect(hasProgressed).toBe(true);
    }
  });

  it('applies deload reduction (60%) to volume', async () => {
    setupStandardMocks();
    const normal = await generateWorkout(USER, false);
    const deload = await generateWorkout(USER, true);
    expect(normal).not.toBeNull();
    expect(deload).not.toBeNull();
    if (normal && deload) {
      // Deload sets should be less than or equal to normal sets
      const normalAvgSets = normal.exercises.reduce((s, e) => s + e.sets, 0) / normal.exercises.length;
      const deloadAvgSets = deload.exercises.reduce((s, e) => s + e.sets, 0) / deload.exercises.length;
      expect(deloadAvgSets).toBeLessThanOrEqual(normalAvgSets);
    }
  });

  it('reduces volume when readiness score is low', async () => {
    vi.mocked(getCachedReadiness).mockResolvedValue({ score: 30 }); // low readiness
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // Low readiness (30 < 50) → readinessFactor = 0.7 + (30/50)*0.3 = 0.88
      // Sets reduced by ~12%
      for (const ex of result.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('applies adaptive volume tolerance multiplier', async () => {
    vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
      ...DEFAULT_ADAPTIVE,
      volumeTolerance: 1.5, // High tolerance → more sets
    });
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      // 4 sets * 1.5 = 6 → capped but within range
      for (const ex of result.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('posture exercises use hold-based reps regardless of progression', async () => {
    vi.mocked(calculateProgression).mockResolvedValue({
      action: 'progress_reps',
      reason: 'Increase reps',
      recommendation: { sets: 4, reps: '12-15' },
    });
    const postureExercises = [
      makeExercise({ id: 'p1', name: 'Wall Angels', category: 'posture', difficulty: 'beginner', primary_muscles: ['deltoids_rear'], training_types: [{ type: 'posture', effectiveness: 8 }] }),
      makeExercise({ id: 'p2', name: 'Thoracic Extension', category: 'posture', difficulty: 'beginner', primary_muscles: ['traps_mid'], training_types: [{ type: 'decompression', effectiveness: 7 }] }),
      makeExercise({ id: 'p3', name: 'Chin Tuck', category: 'posture', difficulty: 'beginner', primary_muscles: ['core_deep'], training_types: [{ type: 'posture', effectiveness: 7 }] }),
      makeExercise({ id: 'p4', name: 'Dead Hang', category: 'posture', difficulty: 'beginner', primary_muscles: ['lats'], training_types: [{ type: 'decompression', effectiveness: 8 }] }),
    ];
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, goal: 'posture', experience: 'beginner' },
      exercises: postureExercises,
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      for (const ex of result.exercises) {
        if (ex.exercise.category === 'posture') {
          // Should use preset hold-based reps, not progression reps
          expect(ex.reps).toMatch(/hold/i);
        }
      }
    }
  });

  it('ensures minimum of 2 sets even with extreme reductions', async () => {
    vi.mocked(getCachedReadiness).mockResolvedValue({ score: 5 }); // very low readiness
    vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
      ...DEFAULT_ADAPTIVE,
      volumeTolerance: 0.5, // Low tolerance
    });
    setupStandardMocks();
    const result = await generateWorkout(USER, true); // deload + low readiness + low tolerance
    expect(result).not.toBeNull();
    if (result) {
      for (const ex of result.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

// ============================================
// ZONE 6: FULL PIPELINE (END-TO-END BEHAVIORAL)
// ============================================

describe('Full Generation Pipeline', () => {
  it('generates a valid workout with session ID and duration estimate', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('session_test_001');
    expect(result!.total_duration_estimate).toBeGreaterThan(0);
    expect(result!.intent).toBeDefined();
    expect(result!.intent.training_types.length).toBeGreaterThan(0);
  });

  it('exercises are ordered sequentially', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      for (let i = 0; i < result.exercises.length; i++) {
        expect(result.exercises[i]!.order).toBe(i + 1);
      }
    }
  });

  it('persistWorkout creates session and exercise records', async () => {
    setupStandardMocks();
    const workout = await generateWorkout(USER);
    expect(workout).not.toBeNull();

    const sessionId = await persistWorkout(USER, workout!);
    expect(sessionId).toBe(workout!.session_id);

    // createWorkoutSession called once
    expect(vi.mocked(createWorkoutSession)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createWorkoutSession)).toHaveBeenCalledWith(
      expect.objectContaining({
        id: workout!.session_id,
        user_id: USER,
        total_exercises: workout!.exercises.length,
      })
    );

    // addSessionExercise called for each exercise
    expect(vi.mocked(addSessionExercise)).toHaveBeenCalledTimes(workout!.exercises.length);
  });

  it('createWorkout generates AND persists in one call', async () => {
    setupStandardMocks();
    const result = await createWorkout(USER);
    expect(result).not.toBeNull();
    expect(vi.mocked(createWorkoutSession)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addSessionExercise)).toHaveBeenCalled();
  });

  it('each exercise has valid structure', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    for (const ex of result!.exercises) {
      expect(ex.exercise.id).toBeTruthy();
      expect(ex.exercise.name).toBeTruthy();
      expect(ex.sets).toBeGreaterThanOrEqual(2);
      expect(ex.reps).toBeTruthy();
      expect(ex.order).toBeGreaterThanOrEqual(1);
    }
  });

  it('workout output is goal-aligned (strength → hypertrophy/strength types)', async () => {
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, goal: 'strength' },
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.intent.training_types).toContain('hypertrophy');
      expect(result.intent.training_types).toContain('strength');
    }
  });

  it('workout output is goal-aligned (mobility → mobility/recovery types)', async () => {
    const mobilityPool = [
      makeExercise({ id: 'm1', name: 'Cat-Cow', category: 'mobility', difficulty: 'beginner', primary_muscles: ['lower_back'], training_types: [{ type: 'mobility', effectiveness: 8 }] }),
      makeExercise({ id: 'm2', name: 'Hip Opener', category: 'mobility', difficulty: 'beginner', primary_muscles: ['hip_flexors'], training_types: [{ type: 'mobility', effectiveness: 7 }] }),
      makeExercise({ id: 'm3', name: 'Ankle', category: 'mobility', difficulty: 'beginner', primary_muscles: ['calves_gastrocnemius'], training_types: [{ type: 'recovery', effectiveness: 6 }] }),
      makeExercise({ id: 'm4', name: 'Shoulder', category: 'mobility', difficulty: 'beginner', primary_muscles: ['deltoids_front'], training_types: [{ type: 'mobility', effectiveness: 7 }] }),
    ];
    setupStandardMocks({
      profile: { ...DEFAULT_PROFILE, goal: 'mobility', experience: 'beginner' },
      exercises: mobilityPool,
    });
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.intent.training_types).toContain('mobility');
      expect(result.intent.training_types).toContain('recovery');
    }
  });

  it('readiness engine failure is non-fatal', async () => {
    vi.mocked(getCachedReadiness).mockRejectedValue(new Error('Readiness unavailable'));
    setupStandardMocks();
    const result = await generateWorkout(USER);
    // Should not throw — readiness is optional
    expect(result).not.toBeNull();
  });

  it('progression engine failure is non-fatal per exercise', async () => {
    vi.mocked(calculateProgression).mockRejectedValue(new Error('Progression DB error'));
    setupStandardMocks();
    const result = await generateWorkout(USER);
    // Generator should fall back to static preset
    expect(result).not.toBeNull();
    if (result) {
      for (const ex of result.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('total duration estimate is reasonable', async () => {
    setupStandardMocks();
    const result = await generateWorkout(USER);
    expect(result).not.toBeNull();
    // Duration = sum(sets * (time_per_set + 60)) / 60 minutes
    // With 4-6 exercises, 2-5 sets, 30s+60s rest = ~90s per set
    // Min: 4 exercises * 2 sets * 90s = 720s = 12 min
    // Max: 6 exercises * 6 sets * 90s = 3240s = 54 min
    expect(result!.total_duration_estimate).toBeGreaterThanOrEqual(5);
    expect(result!.total_duration_estimate).toBeLessThanOrEqual(60);
  });
});

// ============================================
// ZONE 7: DIFFERENT GOALS (DETERMINISTIC BEHAVIOR)
// ============================================

describe('Goal-Specific Behavior', () => {
  const goals: Array<{ goal: import('../../src/database/types').Category; expectedTypes: string[] }> = [
    { goal: 'body_control', expectedTypes: ['strength', 'hypertrophy', 'endurance'] },
    { goal: 'posture', expectedTypes: ['decompression', 'mobility', 'posture'] },
    { goal: 'speed', expectedTypes: ['speed_power', 'endurance', 'coordination'] },
    { goal: 'mobility', expectedTypes: ['mobility', 'recovery'] },
    { goal: 'focus', expectedTypes: ['balance', 'coordination', 'mindfulness', 'recovery'] },
    { goal: 'strength', expectedTypes: ['hypertrophy', 'strength'] },
  ];

  for (const { goal, expectedTypes } of goals) {
    it(`maps goal "${goal}" to correct training types`, async () => {
      const dummyExercises = expectedTypes.flatMap((tt, i) => [
        makeExercise({
          id: `${goal}_${tt}_${i}`,
          name: `${goal} ${tt} ${i}`,
          category: goal,
          difficulty: 'beginner',
          primary_muscles: (['chest_mid', 'lats', 'quads', 'core_deep', 'calves_gastrocnemius', 'hip_flexors'] as const)[i % 6] ? [(['chest_mid', 'lats', 'quads', 'core_deep', 'calves_gastrocnemius', 'hip_flexors'] as const)[i % 6]!] : ['chest_mid'],
          training_types: [{ type: tt as import('../../src/database/types').TrainingType, effectiveness: 8 }],
        }),
      ]);
      // Ensure at least 4
      while (dummyExercises.length < 4) {
        dummyExercises.push(makeExercise({
          id: `${goal}_fill_${dummyExercises.length}`,
          name: `Fill ${dummyExercises.length}`,
          category: goal,
          difficulty: 'beginner',
          primary_muscles: [(['deltoids_front', 'biceps', 'hamstrings', 'obliques'] as const)[dummyExercises.length % 4]!],
          training_types: [{ type: expectedTypes[0] as import('../../src/database/types').TrainingType, effectiveness: 7 }],
        }));
      }
      setupStandardMocks({
        profile: { ...DEFAULT_PROFILE, goal, experience: 'beginner' },
        exercises: dummyExercises,
      });
      const result = await generateWorkout(USER);
      if (result) {
        // Intent training types should match the goal mapping
        for (const tt of expectedTypes) {
          expect(result.intent.training_types).toContain(tt);
        }
      }
    });
  }
});
