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

// Define __DEV__ global used by React Native
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

function matchesDifficulty(exerciseDifficulty: Difficulty, allowed?: Difficulty[]): boolean {
  return !allowed?.length || allowed.includes(exerciseDifficulty);
}

function matchesTrainingTypes(
  exerciseTrainingTypes: Array<{ type: TrainingType; effectiveness: number }>,
  allowed?: TrainingType[]
): boolean {
  return !allowed?.length || exerciseTrainingTypes.some(trainingType => allowed.includes(trainingType.type));
}

function matchesTargetMuscles(exercise: ExerciseWithDetails, targetMuscles?: TargetMuscle[]): boolean {
  return !targetMuscles?.length || [...exercise.primary_muscles, ...exercise.secondary_muscles].some(muscle => targetMuscles.includes(muscle));
}

function excludesMuscles(exercise: ExerciseWithDetails, excludedMuscles?: TargetMuscle[]): boolean {
  return !excludedMuscles?.length || !exercise.primary_muscles.some(muscle => excludedMuscles.includes(muscle));
}

function filterRealExercises(filter?: ExerciseFilter): ExerciseWithDetails[] {
  return REAL_EXERCISES.filter((exercise) => {
    if (filter?.categories?.length && !filter.categories.includes(exercise.category)) return false;
    if (!matchesDifficulty(exercise.difficulty, filter?.difficulties)) return false;
    if (filter?.equipment_levels?.length && !filter.equipment_levels.includes(exercise.equipment_level)) return false;
    if (filter?.impact_levels?.length && !filter.impact_levels.includes(exercise.impact_level)) return false;
    if (filter?.space_filters?.length && !filter.space_filters.includes(exercise.space_required)) return false;
    if (filter?.max_time_per_set && exercise.time_per_set_seconds > filter.max_time_per_set) return false;
    if (!matchesTrainingTypes(exercise.training_types, filter?.training_types)) return false;
    if (!matchesTargetMuscles(exercise, filter?.target_muscles)) return false;
    if (!excludesMuscles(exercise, filter?.exclude_muscles)) return false;
    return true;
  });
}

// Mock DB layer before importing engine, but feed it the real exercise catalogue.
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

import { analyzeWorkoutGeneration, generateWorkout } from '../src/engines/workoutGenerator';
import {
  getUserProfile,
  getMuscleFatigue,
  getExercises,
  getUserEquipment,
  getUserInjuries,
  getAllProgressRecords,
  getAppState,
} from '../src/database/service';

const mockGetUserProfile = vi.mocked(getUserProfile);
const mockGetMuscleFatigue = vi.mocked(getMuscleFatigue);
const mockGetExercises = vi.mocked(getExercises);
const mockGetUserEquipment = vi.mocked(getUserEquipment);
const mockGetUserInjuries = vi.mocked(getUserInjuries);
const mockGetAllProgressRecords = vi.mocked(getAllProgressRecords);
const mockGetAppState = vi.mocked(getAppState);

const MOCK_PROFILE = {
  id: 'u1',
  goal: 'body_control' as const,
  experience: 'intermediate' as const,
  training_days_per_week: 4,
  time_per_session_minutes: 45,
  sex: 'male' as const,
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

describe('generateWorkout integration', () => {
  it('throws when no profile exists', async () => {
    runtimeState.userProfile = null;
    await expect(generateWorkout('u1')).rejects.toThrow('User profile not found');
  });

  it('returns a workout with 4-6 exercises using the real exercise catalogue', async () => {
    runtimeState.userProfile = MOCK_PROFILE;
    runtimeState.appState.set('user.equipment_level', 'none');

    const result = await generateWorkout('u1');

    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
    expect(result!.exercises.length).toBeLessThanOrEqual(6);
    expect(result!.exercises.every(({ exercise }) => exercise.training_types.length > 0)).toBe(true);
    expect(mockGetExercises).toHaveBeenCalled();
    expect(mockGetAllProgressRecords).toHaveBeenCalledTimes(1);
    expect(mockGetAppState).toHaveBeenCalledWith('user.equipment_level');
  });

  it('generates a deload workout with reduced volume using the real exercise catalogue', async () => {
    runtimeState.userProfile = MOCK_PROFILE;
    runtimeState.appState.set('user.equipment_level', 'none');

    const normalWorkout = await generateWorkout('u1', false);
    const deloadWorkout = await generateWorkout('u1', true);

    expect(normalWorkout).not.toBeNull();
    expect(deloadWorkout).not.toBeNull();
    expect(deloadWorkout!.intent.is_deload).toBe(true);
    expect(deloadWorkout!.exercises.length).toBeGreaterThanOrEqual(4);

    const normalById = new Map(normalWorkout!.exercises.map((entry) => [entry.exercise.id, entry.sets]));
    for (const entry of deloadWorkout!.exercises) {
      const normalSets = normalById.get(entry.exercise.id);
      if (normalSets) {
        expect(entry.sets).toBeLessThanOrEqual(normalSets);
      }
    }
  });

  it('respects equipment-level preference and severe injuries with the real exercise catalogue', async () => {
    runtimeState.userProfile = MOCK_PROFILE;
    runtimeState.appState.set('user.equipment_level', 'none');
    runtimeState.userInjuries = [
      {
        user_id: 'u1',
        muscle: 'chest_mid',
        severity: 'severe',
        created_at: '2024-01-01',
      },
    ];

    const result = await generateWorkout('u1');

    expect(result).not.toBeNull();
    expect(result!.exercises.every(({ exercise }) => exercise.equipment_level === 'none')).toBe(true);
    expect(
      result!.exercises.some(({ exercise }) => exercise.primary_muscles.includes('chest_mid'))
    ).toBe(false);
  });

  it('prioritizes the freshest focus pattern instead of forcing one-per-pattern', async () => {
    runtimeState.userProfile = MOCK_PROFILE;
    runtimeState.appState.set('user.equipment_level', 'none');
    runtimeState.recentlyTrainedMuscles = [
      'chest_mid', 'chest_upper', 'chest_lower', 'deltoids_front', 'triceps',
      'lats', 'rhomboids', 'biceps', 'deltoids_rear', 'traps_mid',
      'quads', 'hamstrings', 'glutes_max', 'calves_gastrocnemius',
    ];

    const analysis = await analyzeWorkoutGeneration('u1');

    expect(analysis).not.toBeNull();
    expect(analysis!.intent.focus_pattern).toBe('core');
    expect(analysis!.selected.filter((entry) => entry.matches_focus_pattern).length).toBeGreaterThanOrEqual(2);
  });
});
