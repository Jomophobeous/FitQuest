/**
 * Tests: Progression Engine — DB-backed decision logic
 *
 * Target: src/engines/progressionEngine.ts
 * Strategy: Mock database/service at module boundary, inject deterministic responses
 * Coverage: calculateProgression decision logic, analyzeExerciseProgression trend detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database service
vi.mock('../../src/database/service', () => ({
  recordProgress: vi.fn(),
  getProgressExerciseIds: vi.fn().mockResolvedValue([]),
  getProgressHistory: vi.fn().mockResolvedValue([]),
}));

// Mock adaptive training
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

// Mock randomId
vi.mock('../../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockResolvedValue('test_id_001'),
}));

import {
  analyzeExerciseProgression,
  calculateProgression,
  PROGRESSION_CONFIG,
} from '../../src/engines/progressionEngine';
import { getProgressHistory } from '../../src/database/service';
import { getAdaptiveTrainingProfile } from '../../src/services/adaptiveTrainingService';

const USER = 'user_local_001';
const EXERCISE = 'ex_pushup_001';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// analyzeExerciseProgression
// ============================================

describe('analyzeExerciseProgression', () => {
  it('returns stagnant state when no history exists', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.consecutive_successes).toBe(0);
    expect(state.consecutive_failures).toBe(0);
    expect(state.trend).toBe('stagnant');
  });

  it('counts consecutive successes (difficulty_rating <= 7)', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p3', user_id: USER, exercise_id: EXERCISE, date: '2026-04-03', sets_completed: 3, reps_achieved: '12', difficulty_rating: 5 },
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '11', difficulty_rating: 6 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '10', difficulty_rating: 7 },
    ]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.consecutive_successes).toBe(3);
    expect(state.consecutive_failures).toBe(0);
  });

  it('counts consecutive failures (difficulty_rating > 7)', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 2, reps_achieved: '6', difficulty_rating: 9 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 2, reps_achieved: '5', difficulty_rating: 8 },
    ]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.consecutive_failures).toBe(2);
    expect(state.consecutive_successes).toBe(0);
  });

  it('detects improving trend (recent reps > older reps by >10%)', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p6', user_id: USER, exercise_id: EXERCISE, date: '2026-04-06', sets_completed: 3, reps_achieved: '15', difficulty_rating: 5 },
      { id: 'p5', user_id: USER, exercise_id: EXERCISE, date: '2026-04-05', sets_completed: 3, reps_achieved: '14', difficulty_rating: 5 },
      { id: 'p4', user_id: USER, exercise_id: EXERCISE, date: '2026-04-04', sets_completed: 3, reps_achieved: '14', difficulty_rating: 5 },
      { id: 'p3', user_id: USER, exercise_id: EXERCISE, date: '2026-04-03', sets_completed: 3, reps_achieved: '10', difficulty_rating: 6 },
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '9', difficulty_rating: 6 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '8', difficulty_rating: 7 },
    ]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.trend).toBe('improving');
  });

  it('detects declining trend (recent reps < older reps by >10%)', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p6', user_id: USER, exercise_id: EXERCISE, date: '2026-04-06', sets_completed: 3, reps_achieved: '5', difficulty_rating: 9 },
      { id: 'p5', user_id: USER, exercise_id: EXERCISE, date: '2026-04-05', sets_completed: 3, reps_achieved: '6', difficulty_rating: 9 },
      { id: 'p4', user_id: USER, exercise_id: EXERCISE, date: '2026-04-04', sets_completed: 3, reps_achieved: '5', difficulty_rating: 8 },
      { id: 'p3', user_id: USER, exercise_id: EXERCISE, date: '2026-04-03', sets_completed: 3, reps_achieved: '12', difficulty_rating: 5 },
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '11', difficulty_rating: 5 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '12', difficulty_rating: 5 },
    ]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.trend).toBe('declining');
  });

  it('breaks streak on mixed success/failure', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p3', user_id: USER, exercise_id: EXERCISE, date: '2026-04-03', sets_completed: 3, reps_achieved: '12', difficulty_rating: 5 },
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 2, reps_achieved: '6', difficulty_rating: 9 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '10', difficulty_rating: 5 },
    ]);
    const state = await analyzeExerciseProgression(USER, EXERCISE);
    expect(state.consecutive_successes).toBe(1);
    expect(state.consecutive_failures).toBe(0);
  });
});

// ============================================
// calculateProgression — decision logic
// ============================================

describe('calculateProgression', () => {
  it('decides PROGRESS after enough consecutive successes', async () => {
    // successes_to_progress = 2 (default), with aggressiveness=1
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '10', difficulty_rating: 5 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '10', difficulty_rating: 6 },
    ]);

    const decision = await calculateProgression(USER, EXERCISE, 3, '8-10', 'hypertrophy');
    expect(decision.action).toBe('progress');
    expect(decision.exercise_id).toBe(EXERCISE);
  });

  it('decides MAINTAIN with mixed history', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '10', difficulty_rating: 5 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 2, reps_achieved: '6', difficulty_rating: 9 },
    ]);

    const decision = await calculateProgression(USER, EXERCISE, 3, '8-10', 'hypertrophy');
    expect(decision.action).toBe('maintain');
  });

  it('decides REGRESS after enough consecutive failures', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 2, reps_achieved: '5', difficulty_rating: 9 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 2, reps_achieved: '4', difficulty_rating: 10 },
    ]);

    const decision = await calculateProgression(USER, EXERCISE, 3, '8-10', 'hypertrophy');
    expect(decision.action).toBe('regress');
  });

  it('increases reps when below ceiling on progress', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '10', difficulty_rating: 5 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '10', difficulty_rating: 6 },
    ]);

    // currentReps '8-10' → parseRepRange('8-10').max = 10. Hypertrophy ceiling = 12. 10 < 12 → increase reps
    const decision = await calculateProgression(USER, EXERCISE, 3, '8-10', 'hypertrophy');
    expect(decision.action).toBe('progress');
    // Should increase reps: newMax = min(10+1, 12) = 11 → reps = '9-11'
    expect(decision.recommendation.sets).toBe(3); // Sets unchanged
  });

  it('adds sets when rep ceiling is reached', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 3, reps_achieved: '12', difficulty_rating: 5 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '12', difficulty_rating: 6 },
    ]);

    // currentReps '10-12' → max = 12. Hypertrophy ceiling = 12. 12 < 12 → false → add set
    const decision = await calculateProgression(USER, EXERCISE, 3, '10-12', 'hypertrophy');
    expect(decision.action).toBe('progress');
    expect(decision.recommendation.sets).toBe(4); // +1 set
  });

  it('decides MAINTAIN with no history', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([]);
    const decision = await calculateProgression(USER, EXERCISE, 3, '8-12', 'default');
    expect(decision.action).toBe('maintain');
  });

  it('respects adaptive aggressiveness for faster progression', async () => {
    vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
      userId: USER,
      fatigueSensitivity: 1,
      progressionAggressiveness: 1.25, // More aggressive
      volumeTolerance: 1,
      confidence: 0.8,
      samples: 10,
      updatedAt: Date.now(),
      rationale: [],
    });

    // Only 1 success, but with aggressiveness=1.25, successes_to_progress = round(2/1.25) = 2
    // Still need 2, so 1 success = maintain
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 3, reps_achieved: '10', difficulty_rating: 5 },
    ]);

    const decision = await calculateProgression(USER, EXERCISE, 3, '8-10', 'default');
    // With 1.25 aggressiveness: round(2/1.25) = 2, still need 2 but only 1 → maintain
    expect(decision.action).toBe('maintain');
  });

  it('reduces reps on regression when above floor', async () => {
    vi.mocked(getProgressHistory).mockResolvedValue([
      { id: 'p2', user_id: USER, exercise_id: EXERCISE, date: '2026-04-02', sets_completed: 2, reps_achieved: '7', difficulty_rating: 9 },
      { id: 'p1', user_id: USER, exercise_id: EXERCISE, date: '2026-04-01', sets_completed: 2, reps_achieved: '6', difficulty_rating: 9 },
    ]);

    const decision = await calculateProgression(USER, EXERCISE, 3, '8-12', 'hypertrophy');
    expect(decision.action).toBe('regress');
    // Rep floor for hypertrophy = 6, current max = 12, 12-2=10 ≥ floor+2 → reduce reps
    expect(decision.recommendation.sets).toBe(3); // Sets stay same
  });
});
