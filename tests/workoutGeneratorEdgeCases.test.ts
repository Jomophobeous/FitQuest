/**
 * Workout Generator Edge Case Tests
 *
 * Tests extreme scenarios not covered in base file:
 * - All muscles critically fatigued
 * - Various goal types (strength, speed, mobility, etc.)
 * - Advanced difficulty user
 * - Equipment level variations
 * - Multiple severe injuries
 * - Analysis diagnostics
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAllExercises } from '../src/database/exerciseGeneratorExpanded';
import { getDefaultAdaptiveTrainingProfile } from '../src/services/adaptiveTrainingMath';
import type {
  Difficulty,
  EquipmentItem,
  EquipmentLevel,
  ExerciseFilter,
  ExerciseWithDetails,
  MuscleFatigue,
  ProgressRecord,
  TargetMuscle,
  TrainingType,
  UserInjury,
  UserProfile,
  WorkoutSession,
} from '../src/database/types';

(globalThis as any).__DEV__ = false;

const runtimeState = vi.hoisted(() => ({
  userProfile: null as UserProfile | null,
  fatigue: [] as MuscleFatigue[],
  recentSessions: [] as WorkoutSession[],
  userEquipment: [] as EquipmentItem[],
  userInjuries: [] as UserInjury[],
  recentExerciseIds: [] as string[],
  recentlyTrainedMuscles: [] as TargetMuscle[],
  progressRecords: [] as ProgressRecord[],
  appState: new Map<string, string>(),
}));

function buildRealExerciseCatalog(): ExerciseWithDetails[] {
  return generateAllExercises().map((exercise) => ({
    ...exercise,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    audio_intro: exercise.audio_intro || '',
    audio_setup: exercise.audio_setup || '',
    audio_execution: exercise.audio_execution || '',
    audio_transition: exercise.audio_transition || '',
  }));
}

const REAL_EXERCISES = buildRealExerciseCatalog();

function filterRealExercises(filter?: ExerciseFilter): ExerciseWithDetails[] {
  return REAL_EXERCISES.filter((exercise) => {
    if (filter?.categories?.length && !filter.categories.includes(exercise.category)) return false;
    if (filter?.difficulties?.length && !filter.difficulties.includes(exercise.difficulty)) return false;
    if (filter?.equipment_levels?.length && !filter.equipment_levels.includes(exercise.equipment_level)) return false;
    if (filter?.impact_levels?.length && !filter.impact_levels.includes(exercise.impact_level)) return false;
    if (filter?.space_filters?.length && !filter.space_filters.includes(exercise.space_required)) return false;
    if (filter?.max_time_per_set && exercise.time_per_set_seconds > filter.max_time_per_set) return false;
    if (filter?.training_types?.length &&
      !exercise.training_types.some(t => filter.training_types!.includes(t.type))) return false;
    if (filter?.target_muscles?.length &&
      ![...exercise.primary_muscles, ...exercise.secondary_muscles].some(m => filter.target_muscles!.includes(m))) return false;
    if (filter?.exclude_muscles?.length &&
      exercise.primary_muscles.some(m => filter.exclude_muscles!.includes(m))) return false;
    return true;
  });
}

vi.mock('../src/database/service', () => ({
  getExercises: vi.fn(async (filter?: ExerciseFilter) => filterRealExercises(filter)),
  getUserProfile: vi.fn(async () => runtimeState.userProfile),
  getMuscleFatigue: vi.fn(async () => runtimeState.fatigue),
  getRecentSessions: vi.fn(async () => runtimeState.recentSessions),
  getUserEquipment: vi.fn(async () => runtimeState.userEquipment),
  getUserInjuries: vi.fn(async () => runtimeState.userInjuries),
  createWorkoutSession: vi.fn(),
  addSessionExercise: vi.fn(),
  getRecentExerciseIds: vi.fn(async () => runtimeState.recentExerciseIds),
  getRecentlyTrainedMuscles: vi.fn(async () => runtimeState.recentlyTrainedMuscles),
  getAllProgressRecords: vi.fn(async (_userId: string, limit = 100) =>
    [...runtimeState.progressRecords]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, limit)
  ),
  getAppState: vi.fn(async (key: string) => runtimeState.appState.get(key) ?? null),
}));
vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn(() => ({
    getAllAsync: vi.fn(() => []),
    getFirstAsync: vi.fn(() => null),
    runAsync: vi.fn(),
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  })),
}));
vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn((prefix: string) => `${prefix}_test_${Date.now()}`),
}));
vi.mock('../src/services/adaptiveTrainingService', () => ({
  getAdaptiveTrainingProfile: vi.fn((userId: string) => getDefaultAdaptiveTrainingProfile(userId)),
}));

import { generateWorkout, analyzeWorkoutGeneration } from '../src/engines/workoutGenerator';

const ALL_MUSCLES: TargetMuscle[] = [
  'chest_upper', 'chest_mid', 'chest_lower',
  'deltoids_front', 'deltoids_side', 'deltoids_rear',
  'triceps', 'biceps', 'forearms',
  'lats', 'rhomboids', 'traps_upper', 'traps_mid',
  'quads', 'hamstrings', 'glutes_max', 'glutes_med',
  'calves_gastrocnemius', 'calves_soleus',
  'abs_upper', 'abs_lower', 'obliques',
];

const BASE_PROFILE: UserProfile = {
  id: 'u1',
  goal: 'body_control',
  experience: 'intermediate',
  training_days_per_week: 4,
  time_per_session_minutes: 45,
  sex: 'male',
  weight_kg: 80,
  height_cm: 180,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  locked: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  runtimeState.userProfile = null;
  runtimeState.fatigue = [];
  runtimeState.recentSessions = [];
  runtimeState.userEquipment = [];
  runtimeState.userInjuries = [];
  runtimeState.recentExerciseIds = [];
  runtimeState.recentlyTrainedMuscles = [];
  runtimeState.progressRecords = [];
  runtimeState.appState = new Map();
});

describe('Workout Generator Edge Cases', () => {
  // ============================================
  // ALL MUSCLES FATIGUED
  // ============================================

  describe('all muscles critically fatigued', () => {
    it('still generates a workout (selects least-fatigued muscles)', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'none');
      runtimeState.fatigue = ALL_MUSCLES.map((muscle) => ({
        user_id: 'u1',
        muscle,
        fatigue_level: 90, // All at 90%
        last_trained_at: '2024-01-15',
        updated_at: '2024-01-15',
      }));

      const result = await generateWorkout('u1');
      // Should still produce something — recovery/deload type workout
      expect(result).not.toBeNull();
      expect(result!.exercises.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // GOAL TYPES
  // ============================================

  describe('different goal types', () => {
    const goals = ['body_control', 'posture', 'speed', 'mobility', 'focus', 'strength'] as const;

    for (const goal of goals) {
      it(`generates workout for ${goal} goal`, async () => {
        runtimeState.userProfile = { ...BASE_PROFILE, goal };
        runtimeState.appState.set('user.equipment_level', 'none');

        const result = await generateWorkout('u1');
        expect(result).not.toBeNull();
        expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
      });
    }
  });

  // ============================================
  // EXPERIENCE LEVELS
  // ============================================

  describe('experience levels', () => {
    it('generates beginner-friendly workout', async () => {
      runtimeState.userProfile = { ...BASE_PROFILE, experience: 'beginner' };
      runtimeState.appState.set('user.equipment_level', 'none');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      // Beginners should get exercises they can do
      for (const entry of result!.exercises) {
        expect(['beginner', 'intermediate']).toContain(entry.exercise.difficulty);
      }
    });

    it('generates advanced workout', async () => {
      runtimeState.userProfile = { ...BASE_PROFILE, experience: 'advanced' };
      runtimeState.appState.set('user.equipment_level', 'none');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ============================================
  // MULTIPLE INJURIES
  // ============================================

  describe('multiple severe injuries', () => {
    it('excludes exercises targeting injured muscles', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'none');
      runtimeState.userInjuries = [
        { user_id: 'u1', muscle: 'chest_mid', severity: 'severe', created_at: '2024-01-01' },
        { user_id: 'u1', muscle: 'deltoids_front', severity: 'severe', created_at: '2024-01-01' },
        { user_id: 'u1', muscle: 'triceps', severity: 'severe', created_at: '2024-01-01' },
      ];

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();

      // No exercise should primarily target the injured muscles
      for (const entry of result!.exercises) {
        expect(entry.exercise.primary_muscles).not.toContain('chest_mid');
        expect(entry.exercise.primary_muscles).not.toContain('deltoids_front');
        expect(entry.exercise.primary_muscles).not.toContain('triceps');
      }
    });

    it('generates workout even with many injuries', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'none');
      // Injure multiple upper body muscles
      runtimeState.userInjuries = [
        { user_id: 'u1', muscle: 'chest_mid', severity: 'severe', created_at: '2024-01-01' },
        { user_id: 'u1', muscle: 'chest_upper', severity: 'severe', created_at: '2024-01-01' },
        { user_id: 'u1', muscle: 'lats', severity: 'moderate', created_at: '2024-01-01' },
        { user_id: 'u1', muscle: 'biceps', severity: 'severe', created_at: '2024-01-01' },
      ];

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      expect(result!.exercises.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // EQUIPMENT LEVELS
  // ============================================

  describe('equipment level filtering', () => {
    it('bodyweight-only workout has no equipment exercises', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'none');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      for (const entry of result!.exercises) {
        expect(entry.exercise.equipment_level).toBe('none');
      }
    });

    it('minimal equipment includes bodyweight + minimal', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'minimal');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      for (const entry of result!.exercises) {
        expect(['none', 'minimal']).toContain(entry.exercise.equipment_level);
      }
    });
  });

  // ============================================
  // ANALYZE WORKOUT GENERATION
  // ============================================

  describe('analyzeWorkoutGeneration diagnostics', () => {
    it('returns full diagnostic analysis', async () => {
      runtimeState.userProfile = BASE_PROFILE;
      runtimeState.appState.set('user.equipment_level', 'none');

      const analysis = await analyzeWorkoutGeneration('u1');
      expect(analysis).not.toBeNull();
      expect(analysis!.intent).toBeDefined();
      expect(analysis!.selected.length).toBeGreaterThanOrEqual(1);
    });

    it('throws when no profile exists', async () => {
      runtimeState.userProfile = null;
      await expect(analyzeWorkoutGeneration('u1')).rejects.toThrow('User profile not found');
    });
  });

  // ============================================
  // TIME CONSTRAINT
  // ============================================

  describe('session time constraints', () => {
    it('respects short session time (20 min)', async () => {
      runtimeState.userProfile = { ...BASE_PROFILE, time_per_session_minutes: 20 };
      runtimeState.appState.set('user.equipment_level', 'none');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      // Fewer exercises for shorter session
      expect(result!.exercises.length).toBeLessThanOrEqual(6);
    });

    it('fills longer session (60 min) with more exercises', async () => {
      runtimeState.userProfile = { ...BASE_PROFILE, time_per_session_minutes: 60 };
      runtimeState.appState.set('user.equipment_level', 'none');

      const result = await generateWorkout('u1');
      expect(result).not.toBeNull();
      expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
    });
  });
});
