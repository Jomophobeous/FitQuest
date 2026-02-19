import { describe, expect, it, vi, beforeEach } from 'vitest';

import { formatRepRange, parseReps, parseRepRange } from '../src/engines/progressionParsing';

// Mock DB layer for progression decision tests
vi.mock('../src/database/service', () => ({
  getProgressHistory: vi.fn(),
  recordProgress: vi.fn(),
  getProgressExerciseIds: vi.fn(() => []),
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

import {
  analyzeExerciseProgression,
  calculateProgression,
  PROGRESSION_CONFIG,
} from '../src/engines/progressionEngine';
import { getProgressHistory } from '../src/database/service';

const mockGetProgressHistory = vi.mocked(getProgressHistory);

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================
// Pure parsing helpers
// =============================================

describe('progressionEngine rep parsing', () => {
  it('parses single rep counts', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('10 reps')).toBe(10);
  });

  it('parses rep ranges', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('10-15')).toEqual({ min: 10, max: 15 });
  });

  it('formats rep ranges', () => {
    expect(formatRepRange(6, 10)).toBe('6-10');
  });

  it('formats single rep value when min equals max', () => {
    expect(formatRepRange(8, 8)).toBe('8');
  });

  it('parses edge cases gracefully', () => {
    expect(parseReps('30s hold')).toBe(30);
    expect(parseReps('')).toBe(0);
  });
});

// =============================================
// PROGRESSION_CONFIG
// =============================================

describe('PROGRESSION_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(PROGRESSION_CONFIG.success_threshold).toBe(0.9);
    expect(PROGRESSION_CONFIG.successes_to_progress).toBe(2);
    expect(PROGRESSION_CONFIG.failures_to_regress).toBe(2);
    expect(PROGRESSION_CONFIG.rep_increment).toBe(1);
    expect(PROGRESSION_CONFIG.set_increment).toBe(1);
  });

  it('rep ceilings exceed rep floors for all goal types', () => {
    for (const goal of ['strength', 'hypertrophy', 'endurance', 'default'] as const) {
      expect(PROGRESSION_CONFIG.rep_ceilings[goal])
        .toBeGreaterThan(PROGRESSION_CONFIG.rep_floors[goal]);
    }
  });
});

// =============================================
// analyzeExerciseProgression
// =============================================

describe('analyzeExerciseProgression', () => {
  it('returns zeroed state when no history', async () => {
    mockGetProgressHistory.mockResolvedValue([]);
    const state = await analyzeExerciseProgression('u1', 'ex1');
    expect(state).toEqual({
      consecutive_successes: 0,
      consecutive_failures: 0,
      last_sets: 0,
      last_reps_achieved: 0,
      trend: 'stagnant',
    });
  });

  it('counts consecutive successes (difficulty_rating ≤ 7)', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-03', sets_completed: 4, reps_achieved: '10', difficulty_rating: 6 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
      { id: '3', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 3, reps_achieved: '8', difficulty_rating: 9 },
    ]);
    const state = await analyzeExerciseProgression('u1', 'ex1');
    expect(state.consecutive_successes).toBe(2);
    expect(state.consecutive_failures).toBe(0);
  });

  it('counts consecutive failures (difficulty_rating > 7)', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-03', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 3, reps_achieved: '5', difficulty_rating: 10 },
      { id: '3', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
    ]);
    const state = await analyzeExerciseProgression('u1', 'ex1');
    expect(state.consecutive_failures).toBe(2);
    expect(state.consecutive_successes).toBe(0);
  });

  it('detects improving trend when recent > older by >10%', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-06', sets_completed: 4, reps_achieved: '12', difficulty_rating: 5 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-05', sets_completed: 4, reps_achieved: '12', difficulty_rating: 5 },
      { id: '3', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-04', sets_completed: 4, reps_achieved: '11', difficulty_rating: 5 },
      { id: '4', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-03', sets_completed: 3, reps_achieved: '8', difficulty_rating: 6 },
      { id: '5', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 3, reps_achieved: '8', difficulty_rating: 6 },
      { id: '6', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 3, reps_achieved: '7', difficulty_rating: 7 },
    ]);
    const state = await analyzeExerciseProgression('u1', 'ex1');
    expect(state.trend).toBe('improving');
  });

  it('detects declining trend when recent < older by >10%', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-06', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-05', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: '3', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-04', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: '4', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-03', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
      { id: '5', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
      { id: '6', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
    ]);
    const state = await analyzeExerciseProgression('u1', 'ex1');
    expect(state.trend).toBe('declining');
  });
});

// =============================================
// calculateProgression — decision logic
// =============================================

describe('calculateProgression', () => {
  it('progresses (increase reps) after consecutive successes', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 4, reps_achieved: '10', difficulty_rating: 6 },
    ]);
    const decision = await calculateProgression('u1', 'ex1', 4, '8-10', 'hypertrophy');
    expect(decision.action).toBe('progress');
    expect(decision.recommendation.sets).toBe(4); // Sets stay same
  });

  it('progresses (increase sets) when at rep ceiling', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 4, reps_achieved: '12', difficulty_rating: 5 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 4, reps_achieved: '12', difficulty_rating: 6 },
    ]);
    // Rep ceiling for hypertrophy = 12, current at 12 → should add a set
    const decision = await calculateProgression('u1', 'ex1', 4, '10-12', 'hypertrophy');
    expect(decision.action).toBe('progress');
    expect(decision.recommendation.sets).toBe(5); // Sets increase
  });

  it('regresses after consecutive failures', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 3, reps_achieved: '5', difficulty_rating: 10 },
    ]);
    const decision = await calculateProgression('u1', 'ex1', 4, '8-10', 'hypertrophy');
    expect(decision.action).toBe('regress');
  });

  it('maintains when mixed results', async () => {
    mockGetProgressHistory.mockResolvedValue([
      { id: '1', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-02', sets_completed: 4, reps_achieved: '10', difficulty_rating: 5 },
      { id: '2', user_id: 'u1', exercise_id: 'ex1', date: '2024-01-01', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
    ]);
    const decision = await calculateProgression('u1', 'ex1', 4, '8-10', 'hypertrophy');
    expect(decision.action).toBe('maintain');
  });

  it('maintains when no history exists', async () => {
    mockGetProgressHistory.mockResolvedValue([]);
    const decision = await calculateProgression('u1', 'ex1', 3, '8-12', 'default');
    expect(decision.action).toBe('maintain');
  });
});
