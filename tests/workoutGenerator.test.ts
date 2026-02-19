import { describe, expect, it, vi, beforeEach } from 'vitest';

// Define __DEV__ global used by React Native
(globalThis as any).__DEV__ = false;

// Mock DB layer before importing engine
vi.mock('../src/database/service', () => ({
  getExercises: vi.fn(),
  getUserProfile: vi.fn(),
  getMuscleFatigue: vi.fn(),
  getRecentSessions: vi.fn(),
  getUserEquipment: vi.fn(),
  getUserInjuries: vi.fn(),
  createWorkoutSession: vi.fn(),
  addSessionExercise: vi.fn(),
  getRecentExerciseIds: vi.fn(() => []),
  getRecentlyTrainedMuscles: vi.fn(() => []),
  getProgressHistory: vi.fn(() => []),
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
  getAdaptiveTrainingProfile: vi.fn(() => ({
    fatigueSensitivity: 1.0,
    volumePreference: 1.0,
    recoveryRate: 1.0,
    progressionAggressiveness: 1.0,
    varietyPreference: 1.0,
  })),
}));

import { generateWorkout } from '../src/engines/workoutGenerator';
import {
  getUserProfile,
  getMuscleFatigue,
  getRecentSessions,
  getExercises,
  getUserEquipment,
  getUserInjuries,
} from '../src/database/service';

const mockGetUserProfile = vi.mocked(getUserProfile);
const mockGetMuscleFatigue = vi.mocked(getMuscleFatigue);
const mockGetRecentSessions = vi.mocked(getRecentSessions);
const mockGetExercises = vi.mocked(getExercises);
const mockGetUserEquipment = vi.mocked(getUserEquipment);
const mockGetUserInjuries = vi.mocked(getUserInjuries);

const MOCK_PROFILE = {
  id: 'u1',
  goal: 'strength' as const,
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

function mockExercise(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || 'ex_1',
    name: overrides.name || 'Push-up',
    category: overrides.category || 'strength',
    difficulty: overrides.difficulty || 'intermediate',
    equipment_level: overrides.equipment_level || 'none',
    impact_level: overrides.impact_level || 'low_impact',
    space_required: overrides.space_required || 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [],
    order_in_category: 0,
    audio_intro: '',
    audio_setup: '',
    audio_execution: '',
    audio_transition: '',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    primary_muscles: overrides.primary_muscles || ['chest_mid'],
    secondary_muscles: overrides.secondary_muscles || ['triceps'],
    equipment_required: overrides.equipment_required || [],
    equipment_optional: [],
    training_types: overrides.training_types || [{ type: 'hypertrophy', effectiveness: 8 }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateWorkout integration', () => {
  it('throws when no profile exists', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    await expect(generateWorkout('u1')).rejects.toThrow('User profile not found');
  });

  it('returns a workout with 4-6 exercises when profile and exercises exist', async () => {
    mockGetUserProfile.mockResolvedValue(MOCK_PROFILE);
    mockGetMuscleFatigue.mockResolvedValue([]);
    mockGetRecentSessions.mockResolvedValue([]);
    mockGetUserEquipment.mockResolvedValue([]);
    mockGetUserInjuries.mockResolvedValue([]);
    // Provide enough exercises for selection
    const exercises = [
      mockExercise({ id: 'ex_push1', primary_muscles: ['chest_mid'], training_types: [{ type: 'hypertrophy', effectiveness: 8 }] }),
      mockExercise({ id: 'ex_push2', name: 'Dip', primary_muscles: ['triceps'], training_types: [{ type: 'hypertrophy', effectiveness: 7 }] }),
      mockExercise({ id: 'ex_pull1', name: 'Pull-up', primary_muscles: ['lats'], training_types: [{ type: 'strength', effectiveness: 9 }] }),
      mockExercise({ id: 'ex_pull2', name: 'Row', primary_muscles: ['rhomboids'], training_types: [{ type: 'hypertrophy', effectiveness: 7 }] }),
      mockExercise({ id: 'ex_leg1', name: 'Squat', primary_muscles: ['quads'], training_types: [{ type: 'hypertrophy', effectiveness: 9 }] }),
      mockExercise({ id: 'ex_leg2', name: 'Lunge', primary_muscles: ['glutes_max'], training_types: [{ type: 'hypertrophy', effectiveness: 7 }] }),
      mockExercise({ id: 'ex_core1', name: 'Plank', primary_muscles: ['abs'], training_types: [{ type: 'endurance', effectiveness: 6 }] }),
      mockExercise({ id: 'ex_core2', name: 'Crunch', primary_muscles: ['obliques'], training_types: [{ type: 'endurance', effectiveness: 5 }] }),
    ];
    mockGetExercises.mockResolvedValue(exercises as any);

    const result = await generateWorkout('u1');
    expect(result).not.toBeNull();
    expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
    expect(result!.exercises.length).toBeLessThanOrEqual(6);
  });

  it('generates workout with deload intent when deloadFlag is true', async () => {
    mockGetUserProfile.mockResolvedValue(MOCK_PROFILE);
    mockGetMuscleFatigue.mockResolvedValue([]);
    mockGetRecentSessions.mockResolvedValue([]);
    mockGetUserEquipment.mockResolvedValue([]);
    mockGetUserInjuries.mockResolvedValue([]);
    const exercises = [
      mockExercise({ id: 'ex_1', primary_muscles: ['chest_mid'] }),
      mockExercise({ id: 'ex_2', primary_muscles: ['lats'] }),
      mockExercise({ id: 'ex_3', primary_muscles: ['quads'] }),
      mockExercise({ id: 'ex_4', primary_muscles: ['abs'] }),
      mockExercise({ id: 'ex_5', primary_muscles: ['triceps'] }),
    ];
    mockGetExercises.mockResolvedValue(exercises as any);

    const result = await generateWorkout('u1', true);
    expect(result).not.toBeNull();
    expect(result!.intent.is_deload).toBe(true);
    expect(result!.exercises.length).toBeGreaterThanOrEqual(4);
  });
});
