/**
 * E2E Critical Flow Test: Simulated End-to-End
 *
 * Exercises the critical user path through actual code layers:
 *   Profile Setup → Workout Generation → Session Lifecycle → XP Award → Streak
 *
 * All external I/O (SQLite, SecureStore) is mocked. Business logic runs for real.
 * This validates the CONTRACT between layers, not individual unit behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared in-memory state simulating the database
const appState = new Map<string, string>();
const progressRecords = new Map<string, any[]>();
const fatigueMap = new Map<string, number>();

// ── Mock database service ──
vi.mock('../../src/database/service', () => ({
  getAppState: vi.fn().mockImplementation((key: string) => Promise.resolve(appState.get(key) ?? null)),
  setAppState: vi.fn().mockImplementation((key: string, value: string) => {
    appState.set(key, value);
    return Promise.resolve();
  }),
  recordProgress: vi.fn().mockImplementation((record: any) => {
    const key = record.exercise_id;
    if (!progressRecords.has(key)) progressRecords.set(key, []);
    progressRecords.get(key)!.push(record);
    return Promise.resolve();
  }),
  getProgressHistory: vi.fn().mockImplementation((_userId: string, exerciseId: string) =>
    Promise.resolve(progressRecords.get(exerciseId) || []),
  ),
  getProgressExerciseIds: vi.fn().mockImplementation(() => Promise.resolve(Array.from(progressRecords.keys()))),
  getMuscleFatigue: vi.fn().mockImplementation(() =>
    Promise.resolve(
      Array.from(fatigueMap.entries()).map(([muscle, level]) => ({
        muscle,
        fatigue_level: level,
        last_trained_at: null,
        updated_at: '',
      })),
    ),
  ),
  updateMuscleFatigue: vi.fn().mockImplementation((_uid: string, muscle: string, level: number) => {
    fatigueMap.set(muscle, Math.min(100, Math.max(0, level)));
    return Promise.resolve();
  }),
  applyDailyRecovery: vi.fn().mockImplementation((_uid: string, rate: number) => {
    for (const [m, l] of fatigueMap.entries()) fatigueMap.set(m, Math.max(0, l - rate));
    return Promise.resolve();
  }),
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getMuscleFatigueLevel: vi.fn().mockImplementation((_uid: string, muscle: string) =>
    Promise.resolve(fatigueMap.get(muscle) || 0),
  ),
  // Encrypted DB service functions (for health alerts etc.)
  insertEncryptedHealthRow: vi.fn().mockResolvedValue(undefined),
  getEncryptedHealthRow: vi.fn().mockResolvedValue(null),
  getEncryptedHealthRowsByCategory: vi.fn().mockResolvedValue([]),
}));

// ── Mock adaptive training ──
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
  updateAdaptiveTrainingProfileFromSession: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock WAL service ──
vi.mock('../../src/services/WriteAheadLogService', () => ({
  walService: {
    logIntent: vi.fn().mockResolvedValue('wal_e2e'),
    commit: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock ranking service ──
vi.mock('../../src/services/rankingService', () => ({
  getXPMultiplier: vi.fn().mockReturnValue(1.0),
}));

// ── Mock telemetry (noop) ──
vi.mock('../../src/services/telemetry', () => ({
  logEvent: vi.fn(),
  logPerf: vi.fn(),
}));

// ── Mock logger ──
vi.mock('../../src/services/logger', () => ({
  safeWarn: vi.fn(),
}));

// ── Mock security/randomId ──
vi.mock('../../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockResolvedValue('e2e_test_id'),
}));

// ── Mock database schema ──
vi.mock('../../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
  }),
}));

// ── Imports (after mocks) ──
import { calculateProgression, recordExercisePerformance } from '../../src/engines/progressionEngine';
import {
  getFatigueSnapshot,
  checkDeloadStatus,
  applyDailyRecoveryTick,
} from '../../src/engines/recoveryEngine';
import { awardWorkoutXP, getXPData } from '../../src/services/xpService';

const USER = 'user_local_001';

beforeEach(() => {
  vi.clearAllMocks();
  appState.clear();
  progressRecords.clear();
  fatigueMap.clear();
});

// ============================================
// FLOW 1: Fresh user → first workout → XP
// ============================================

describe('E2E: Fresh user first workout', () => {
  it('complete flow: check readiness → generate decisions → record performance → award XP', async () => {
    // Step 1: Check recovery readiness (fresh user = all clear)
    const snapshot = await getFatigueSnapshot(USER);
    expect(snapshot).toHaveLength(22);
    expect(snapshot.every((m) => m.status === 'fresh')).toBe(true);

    const deload = await checkDeloadStatus(USER);
    expect(deload.severity).toBe('none');

    // Step 2: Get progression decision for first exercise (no history)
    const decision = await calculateProgression(USER, 'push_up', 3, '8-12');
    expect(decision.action).toBe('maintain'); // First time = maintain
    expect(decision.recommendation.sets).toBe(3);

    // Step 3: Record exercise performance (simulating completed workout)
    await recordExercisePerformance(USER, {
      exercise_id: 'push_up',
      prescribed_sets: 3,
      prescribed_reps: '8-12',
      completed_sets: 3,
      completed_reps: '12',
      success: true,
    });
    expect(progressRecords.has('push_up')).toBe(true);

    // Step 4: Award XP
    const xpResult = await awardWorkoutXP(5, 5, 0);
    expect(xpResult.xpEarned).toBeGreaterThan(0);
    expect(xpResult.data.totalXP).toBeGreaterThan(0);
    expect(xpResult.data.level).toBeGreaterThanOrEqual(1);

    // Step 5: Verify XP persists in app_state
    const xpData = await getXPData();
    expect(xpData.totalXP).toBe(xpResult.data.totalXP);
  });
});

// ============================================
// FLOW 2: Multi-day progression
// ============================================

describe('E2E: Multi-day progression cycle', () => {
  it('day 1 workout → recovery → day 2 progression check', async () => {
    // Day 1: Simulate fatigue from workout
    fatigueMap.set('chest_mid', 40);
    fatigueMap.set('triceps', 25);

    // Verify fatigue state
    const day1Snapshot = await getFatigueSnapshot(USER);
    const chest = day1Snapshot.find((m) => m.muscle === 'chest_mid');
    expect(chest!.level).toBe(40);
    expect(chest!.status).toBe('fresh'); // 40 < 50

    // Day 1: Record performance
    await recordExercisePerformance(USER, {
      exercise_id: 'bench_press',
      prescribed_sets: 3,
      prescribed_reps: '8-12',
      completed_sets: 3,
      completed_reps: '12',
      success: true,
    });

    // Overnight recovery
    await applyDailyRecoveryTick(USER);

    // Day 2: Check fatigue reduced
    const day2Snapshot = await getFatigueSnapshot(USER);
    const chestDay2 = day2Snapshot.find((m) => m.muscle === 'chest_mid');
    expect(chestDay2!.level).toBe(32); // 40 - 8 = 32

    // Day 2: Check progression (1 success in history → maintain)
    const decision = await calculateProgression(USER, 'bench_press', 3, '8-12');
    expect(decision.action).toBe('maintain');
  });
});

// ============================================
// FLOW 3: XP accumulation across sessions
// ============================================

describe('E2E: XP accumulation', () => {
  it('XP increases across multiple workout completions', async () => {
    // Session 1
    const result1 = await awardWorkoutXP(4, 5, 0);
    expect(result1.xpEarned).toBeGreaterThan(0);
    const afterSession1 = result1.data.totalXP;

    // Session 2 (with streak)
    const result2 = await awardWorkoutXP(5, 5, 2);
    expect(result2.xpEarned).toBeGreaterThan(0);
    expect(result2.data.totalXP).toBeGreaterThan(afterSession1);

    // Session 2 should earn more (completion bonus + streak bonus)
    expect(result2.xpEarned).toBeGreaterThan(result1.xpEarned);
  });

  it('XP formula: base(100) + exercise(20*n) + completion(50) + streak(10*d)', async () => {
    const result = await awardWorkoutXP(5, 5, 3);
    // 100 + (5*20) + 50 + (3*10) = 100 + 100 + 50 + 30 = 280
    expect(result.xpEarned).toBe(280);
  });
});

// ============================================
// FLOW 4: Deload detection under load
// ============================================

describe('E2E: Deload detection flow', () => {
  it('progressive fatigue eventually triggers deload warning', async () => {
    // Simulate several training days without rest
    fatigueMap.set('chest_mid', 90);
    fatigueMap.set('lats', 88);
    fatigueMap.set('quads', 86);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');
    expect(status.reasons.length).toBeGreaterThan(0);

    // After recovery days, deload should clear
    await applyDailyRecoveryTick(USER);
    await applyDailyRecoveryTick(USER);
    await applyDailyRecoveryTick(USER); // 3 days recovery = -24 each

    const postRecovery = await checkDeloadStatus(USER);
    expect(postRecovery.severity).not.toBe('required');
  });
});
