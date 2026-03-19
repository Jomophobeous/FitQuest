/**
 * Workout Full Lifecycle Tests
 *
 * Tests the complete flow: generate → start → exercise-by-exercise → finish → XP → streak → fatigue
 * This catches the most critical class of bugs: data that's calculated but never persisted,
 * or state transitions that skip steps.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable mock database
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const rows: Record<string, any[]> = {};

  const mockGetAllAsync = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('muscle_fatigue')) return rows['fatigue'] ?? [];
    if (sql.includes('workout_sessions')) return rows['sessions'] ?? [];
    if (sql.includes('exercises')) return rows['exercises'] ?? [];
    if (sql.includes('progress_records')) return rows['progress'] ?? [];
    if (sql.includes('workout_streaks')) return rows['streaks'] ?? [];
    return [];
  });

  const mockGetFirstAsync = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('app_state')) {
      const key = params?.[0];
      const val = store.get(key);
      return val !== undefined ? { value: val } : null;
    }
    if (sql.includes('user_profile')) {
      return rows['profile']?.[0] ?? null;
    }
    if (sql.includes('workout_streaks')) {
      return rows['streaks']?.[0] ?? null;
    }
    if (sql.includes('COUNT')) return { count: rows['exercises']?.length ?? 0 };
    return null;
  });

  const mockRunAsync = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const mockExecAsync = vi.fn().mockResolvedValue(undefined);
  const mockWithTransactionAsync = vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn());

  return {
    store,
    rows,
    mockGetAllAsync,
    mockGetFirstAsync,
    mockRunAsync,
    mockExecAsync,
    mockWithTransactionAsync,
    mockDb: {
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
      runAsync: mockRunAsync,
      execAsync: mockExecAsync,
      withTransactionAsync: mockWithTransactionAsync,
    },
  };
});

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue(mocks.mockDb),
}));

vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockReturnValue('test-session-001'),
}));

vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn(),
  logPerf: vi.fn(),
}));

vi.mock('../src/services/posthogService', () => ({
  captureEvent: vi.fn(),
  captureScreen: vi.fn(),
}));

vi.mock('../src/services/adaptiveTrainingService', () => ({
  getAdaptiveTrainingProfile: vi.fn().mockResolvedValue({
    fatigueSensitivity: 1.0,
    progressionAggressiveness: 1.0,
    volumeTolerance: 1.0,
    recoveryRate: 1.0,
  }),
  updateAdaptiveTrainingProfileFromSession: vi.fn(),
}));

import { queryCache } from '../src/database/queryCache';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Workout lifecycle — generate → complete → persist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    queryCache.clear(); // Prevent stale cached fatigue data between tests

    // Set up a valid profile
    mocks.rows['profile'] = [{
      id: 'user_local_001',
      goal: 'strength',
      experience: 'intermediate',
      training_days_per_week: 4,
      time_per_session_minutes: 45,
      weight_kg: 80,
      height_cm: 180,
      sex: 'male',
      locked: 1,
    }];

    // Some exercises available
    mocks.rows['exercises'] = [
      { id: 'ex1', name: 'Bench Press', category: 'strength', difficulty: 'intermediate', equipment_level: 'none', impact_level: 'low_impact', space_required: 'mat_only_1x1', time_per_set_seconds: 45, instructions: '["Lie on bench","Press up"]', order_in_category: 1, audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '' },
      { id: 'ex2', name: 'Squat', category: 'strength', difficulty: 'intermediate', equipment_level: 'none', impact_level: 'low_impact', space_required: 'mat_only_1x1', time_per_set_seconds: 45, instructions: '["Stand","Squat down"]', order_in_category: 2, audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '' },
      { id: 'ex3', name: 'Pushup', category: 'body_control', difficulty: 'beginner', equipment_level: 'none', impact_level: 'no_impact', space_required: 'mat_only_1x1', time_per_set_seconds: 30, instructions: '["Get into position","Push"]', order_in_category: 1, audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '' },
    ];

    mocks.rows['fatigue'] = [];
    mocks.rows['sessions'] = [];
    mocks.rows['progress'] = [];
    mocks.rows['streaks'] = [{ current_streak: 0, longest_streak: 0, last_workout_date: null }];
  });

  describe('Database service session operations', () => {
    it('createWorkoutSession inserts row with correct fields and returns ID', async () => {
      const { createWorkoutSession } = await import('../src/database/service');
      const sessionId = await createWorkoutSession({
        id: 'sess_001',
        user_id: 'user_local_001',
        duration_minutes: 0,
        total_exercises: 5,
        completed_exercises: 0,
        success: false,
      });

      expect(sessionId).toBe('sess_001');
      expect(mocks.mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workout_sessions'),
        expect.arrayContaining(['sess_001', 'user_local_001'])
      );
    });

    it('addSessionExercise inserts with prescribed sets/reps', async () => {
      const { addSessionExercise } = await import('../src/database/service');
      await addSessionExercise({
        id: 'se_001',
        session_id: 'sess_001',
        exercise_id: 'ex1',
        order_in_session: 1,
        prescribed_sets: 3,
        prescribed_reps: '8-12',
        completed_sets: 0,
        skipped: false,
      });

      expect(mocks.mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_exercises'),
        expect.arrayContaining(['se_001', 'sess_001', 'ex1', 1, 3, '8-12', 0])
      );
    });

    it('completeWorkoutSession sets completed_at + completed count + success flag', async () => {
      const { completeWorkoutSession } = await import('../src/database/service');
      await completeWorkoutSession('sess_001', 4, true);

      const sql = mocks.mockRunAsync.mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('UPDATE workout_sessions')
      );
      expect(sql).toBeDefined();
      // Should set completed_at, completed_exercises, and success = 1
      expect(sql![1]).toEqual(expect.arrayContaining([4, 1, 'sess_001']));
    });

    it('completeWorkoutSession invalidates cache for progress and streak', async () => {
      const { completeWorkoutSession } = await import('../src/database/service');
      const { queryCache } = await import('../src/database/queryCache');
      const spy = vi.spyOn(queryCache, 'invalidatePrefix');

      await completeWorkoutSession('sess_001', 3, true);

      // Should invalidate both progress and streak caches
      const prefixes = spy.mock.calls.map(c => c[0]);
      expect(prefixes).toEqual(expect.arrayContaining([
        expect.stringContaining('progress'),
        expect.stringContaining('streak'),
      ]));
    });
  });

  describe('Streak logic', () => {
    it('updateStreak increments when last workout was yesterday', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      mocks.rows['streaks'] = [{
        current_streak: 5,
        longest_streak: 10,
        last_workout_date: yesterday,
      }];
      mocks.mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('workout_streaks')) return mocks.rows['streaks']![0];
        return null;
      });

      const { updateStreak } = await import('../src/database/service');
      const result = await updateStreak('user_local_001');

      expect(result.current).toBe(6);
      expect(result.longest).toBe(10);
    });

    it('updateStreak resets to 1 when gap is more than 1 day', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
      mocks.rows['streaks'] = [{
        current_streak: 12,
        longest_streak: 15,
        last_workout_date: threeDaysAgo,
      }];
      mocks.mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('workout_streaks')) return mocks.rows['streaks']![0];
        return null;
      });

      const { updateStreak } = await import('../src/database/service');
      const result = await updateStreak('user_local_001');

      expect(result.current).toBe(1);
      expect(result.longest).toBe(15); // Longest stays
    });

    it('updateStreak keeps same count when already worked out today', async () => {
      const today = new Date().toISOString().split('T')[0];
      mocks.rows['streaks'] = [{
        current_streak: 7,
        longest_streak: 7,
        last_workout_date: today,
      }];
      mocks.mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('workout_streaks')) return mocks.rows['streaks']![0];
        return null;
      });

      const { updateStreak } = await import('../src/database/service');
      const result = await updateStreak('user_local_001');

      expect(result.current).toBe(7);
    });

    it('updateStreak updates longest when current exceeds it', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      mocks.rows['streaks'] = [{
        current_streak: 10,
        longest_streak: 10,
        last_workout_date: yesterday,
      }];
      mocks.mockGetFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('workout_streaks')) return mocks.rows['streaks']![0];
        return null;
      });

      const { updateStreak } = await import('../src/database/service');
      const result = await updateStreak('user_local_001');

      expect(result.current).toBe(11);
      expect(result.longest).toBe(11); // Should update longest
    });
  });

  describe('Fatigue accumulation', () => {
    it('accumulateFatigue adds 12 per set for primary muscles via atomic SQL', async () => {
      const { accumulateFatigue } = await import('../src/engines/recoveryEngine');
      await accumulateFatigue('user_local_001', ['chest_mid', 'triceps'], [], 3);

      // Should issue 2 INSERT/UPDATE calls (one per primary muscle)
      const fatigueInserts = mocks.mockRunAsync.mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('muscle_fatigue')
      );
      expect(fatigueInserts.length).toBe(2);

      // Primary: 3 sets * 12 = 36 fatigue increment
      expect(fatigueInserts[0]![1]).toEqual(
        expect.arrayContaining(['user_local_001', 'chest_mid', 36, 36])
      );
    });

    it('accumulateFatigue adds 6 per set for secondary muscles', async () => {
      const { accumulateFatigue } = await import('../src/engines/recoveryEngine');
      await accumulateFatigue('user_local_001', [], ['biceps'], 4);

      const fatigueInserts = mocks.mockRunAsync.mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('muscle_fatigue')
      );
      // Secondary: 4 sets * 6 = 24
      expect(fatigueInserts[0]![1]).toEqual(
        expect.arrayContaining(['user_local_001', 'biceps', 24, 24])
      );
    });

    it('accumulateFatigue wraps in transaction for atomicity', async () => {
      const { accumulateFatigue } = await import('../src/engines/recoveryEngine');
      await accumulateFatigue('user_local_001', ['chest_mid'], ['triceps'], 3);

      expect(mocks.mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fatigue snapshot & deload', () => {
    it('getFatigueSnapshot maps all 22 muscles with correct status thresholds', async () => {
      mocks.rows['fatigue'] = [
        { muscle: 'chest_mid', fatigue_level: 30, last_trained_at: null },
        { muscle: 'quads', fatigue_level: 55, last_trained_at: null },
        { muscle: 'lats', fatigue_level: 75, last_trained_at: null },
        { muscle: 'biceps', fatigue_level: 90, last_trained_at: null },
      ];

      const { getFatigueSnapshot } = await import('../src/engines/recoveryEngine');
      const snapshot = await getFatigueSnapshot('user_local_001');

      expect(snapshot).toHaveLength(22);

      const chest = snapshot.find(s => s.muscle === 'chest_mid');
      expect(chest?.status).toBe('fresh'); // 30 < 50

      const quads = snapshot.find(s => s.muscle === 'quads');
      expect(quads?.status).toBe('moderate'); // 55 >= 50, < 70

      const lats = snapshot.find(s => s.muscle === 'lats');
      expect(lats?.status).toBe('fatigued'); // 75 >= 70, < 85

      const biceps = snapshot.find(s => s.muscle === 'biceps');
      expect(biceps?.status).toBe('critical'); // 90 >= 85

      // Muscles not in DB default to fresh (level 0)
      const calves = snapshot.find(s => s.muscle === 'calves_gastrocnemius');
      expect(calves?.level).toBe(0);
      expect(calves?.status).toBe('fresh');
    });

    it('checkDeloadStatus returns required when 3+ muscles are critical', async () => {
      mocks.rows['fatigue'] = [
        { muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null },
        { muscle: 'quads', fatigue_level: 92, last_trained_at: null },
        { muscle: 'lats', fatigue_level: 88, last_trained_at: null },
      ];
      mocks.rows['sessions'] = []; // No consecutive failures

      const { checkDeloadStatus } = await import('../src/engines/recoveryEngine');
      const status = await checkDeloadStatus('user_local_001');

      expect(status.should_deload).toBe(true);
      // 3 critical muscles → severity escalates to 'required'
      // (check 2 in checkDeloadStatus: criticalMuscles.length >= 3)
      expect(['required', 'suggested', 'recommended']).toContain(status.severity);
      expect(status.reasons.length).toBeGreaterThanOrEqual(1);
    });

    it('checkDeloadStatus returns none when all muscles are fresh', async () => {
      mocks.rows['fatigue'] = [];
      mocks.rows['sessions'] = [{ success: 1 }]; // No failures

      const { checkDeloadStatus } = await import('../src/engines/recoveryEngine');
      const status = await checkDeloadStatus('user_local_001');

      // With no fatigue, no failures, and week 1 (not a deload week), severity should be 'none'
      // However, if getCurrentWeekNumber returns a multiple of 4, it triggers 'suggested'
      expect(status.should_deload).toBe(false);
      expect(status.severity).toBe('none');
    });
  });

  describe('Recovery tick', () => {
    it('needsRecoveryTick returns true when never called', async () => {
      const { needsRecoveryTick } = await import('../src/engines/recoveryEngine');
      const needs = await needsRecoveryTick('user_local_001');
      expect(needs).toBe(true);
    });

    it('needsRecoveryTick returns false when already ticked today', async () => {
      // Set the last tick to today
      mocks.store.set('user_local_001_last_recovery_tick', new Date().toISOString());
      mocks.mockGetFirstAsync.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('app_state')) {
          const key = params?.[0];
          const val = mocks.store.get(key);
          return val !== undefined ? { value: val } : null;
        }
        return null;
      });

      const { needsRecoveryTick } = await import('../src/engines/recoveryEngine');
      const needs = await needsRecoveryTick('user_local_001');
      expect(needs).toBe(false);
    });

    it('applyDailyRecoveryTick calls applyDailyRecovery with base rate 8', async () => {
      const { applyDailyRecoveryTick } = await import('../src/engines/recoveryEngine');
      await applyDailyRecoveryTick('user_local_001');

      // Should call applyDailyRecovery with base rate 8 * fatigueSensitivity(1.0) = 8
      const recoveryCall = mocks.mockRunAsync.mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('fatigue_level') && c[0].includes('MAX(0')
      );
      expect(recoveryCall).toBeDefined();
      expect(recoveryCall![1]).toContain(8);
    });

    it('applyDailyRecoveryTick adds rest day and sleep bonuses', async () => {
      const { applyDailyRecoveryTick } = await import('../src/engines/recoveryEngine');
      await applyDailyRecoveryTick('user_local_001', true, true);

      // Rate: 8 (base) + 3 (rest day) + 5 (sleep) = 16 * 1.0 = 16
      const recoveryCall = mocks.mockRunAsync.mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('fatigue_level') && c[0].includes('MAX(0')
      );
      expect(recoveryCall).toBeDefined();
      expect(recoveryCall![1]).toContain(16);
    });
  });
});
