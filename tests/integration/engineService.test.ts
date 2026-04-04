/**
 * Integration Tests: Engine + Service Interaction
 *
 * Tests the interaction between progression engine, recovery engine, and their
 * shared database service layer. Verifies that engine decisions flow correctly
 * through mocked service boundaries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared state for cross-engine tests
const progressStore = new Map<string, any[]>();
const fatigueStore = new Map<string, number>();
const appState = new Map<string, string>();

// Mock database service with interconnected state
vi.mock('../../src/database/service', () => ({
  // Progression engine dependencies
  recordProgress: vi.fn().mockImplementation((record: any) => {
    const key = record.exercise_id;
    if (!progressStore.has(key)) progressStore.set(key, []);
    progressStore.get(key)!.push(record);
    return Promise.resolve();
  }),
  getProgressExerciseIds: vi.fn().mockImplementation((userId: string) => {
    return Promise.resolve(Array.from(progressStore.keys()));
  }),
  getProgressHistory: vi.fn().mockImplementation((userId: string, exerciseId: string) => {
    return Promise.resolve(progressStore.get(exerciseId) || []);
  }),
  // Recovery engine dependencies
  getMuscleFatigue: vi.fn().mockImplementation((userId: string) => {
    return Promise.resolve(
      Array.from(fatigueStore.entries()).map(([muscle, level]) => ({
        muscle,
        fatigue_level: level,
        last_trained_at: null,
        updated_at: '',
      })),
    );
  }),
  updateMuscleFatigue: vi.fn().mockImplementation((userId: string, muscle: string, level: number) => {
    fatigueStore.set(muscle, Math.min(100, Math.max(0, level)));
    return Promise.resolve();
  }),
  applyDailyRecovery: vi.fn().mockImplementation((userId: string, rate: number) => {
    for (const [muscle, level] of fatigueStore.entries()) {
      fatigueStore.set(muscle, Math.max(0, level - rate));
    }
    return Promise.resolve();
  }),
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getAppState: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(appState.get(key) ?? null);
  }),
  setAppState: vi.fn().mockImplementation((key: string, value: string) => {
    appState.set(key, value);
    return Promise.resolve();
  }),
  getMuscleFatigueLevel: vi.fn().mockImplementation((userId: string, muscle: string) => {
    return Promise.resolve(fatigueStore.get(muscle) || 0);
  }),
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

vi.mock('../../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockResolvedValue('test_progress_001'),
}));

vi.mock('../../src/services/WriteAheadLogService', () => ({
  walService: {
    logIntent: vi.fn().mockResolvedValue('wal_001'),
    commit: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
  }),
}));

import { calculateProgression, recordExercisePerformance } from '../../src/engines/progressionEngine';
import {
  getFatigueSnapshot,
  applyDailyRecoveryTick,
  checkDeloadStatus,
  RECOVERY_CONFIG,
} from '../../src/engines/recoveryEngine';
import { updateMuscleFatigue } from '../../src/database/service';

const USER = 'user_local_001';

beforeEach(() => {
  vi.clearAllMocks();
  progressStore.clear();
  fatigueStore.clear();
  appState.clear();
});

// ============================================
// Cross-engine: Fatigue affects progression decisions
// ============================================

describe('Fatigue → Progression interaction', () => {
  it('progression maintains when no history exists regardless of fatigue', async () => {
    fatigueStore.set('chest_mid', 80);

    const decision = await calculateProgression(USER, 'push_up', 3, '8-12');
    expect(decision.action).toBe('maintain');
    expect(decision.recommendation.sets).toBe(3);
  });

  it('records performance and creates retrievable history', async () => {
    await recordExercisePerformance(USER, {
      exercise_id: 'push_up',
      prescribed_sets: 3,
      prescribed_reps: '8-12',
      completed_sets: 3,
      completed_reps: '12',
      success: true,
    });

    expect(progressStore.has('push_up')).toBe(true);
    expect(progressStore.get('push_up')!.length).toBe(1);
  });
});

// ============================================
// Recovery tick + fatigue state
// ============================================

describe('Recovery tick affects fatigue snapshot', () => {
  it('recovery tick reduces fatigue across all muscles', async () => {
    fatigueStore.set('chest_mid', 50);
    fatigueStore.set('quads', 30);

    await applyDailyRecoveryTick(USER);

    // Recovery rate is 8 (RECOVERY_CONFIG.daily_recovery_rate * 1.0 sensitivity)
    expect(fatigueStore.get('chest_mid')).toBe(42);
    expect(fatigueStore.get('quads')).toBe(22);
  });

  it('fatigue snapshot reflects post-recovery state', async () => {
    fatigueStore.set('chest_mid', 50);
    fatigueStore.set('lats', 70);

    await applyDailyRecoveryTick(USER);

    const snapshot = await getFatigueSnapshot(USER);
    const chest = snapshot.find((m) => m.muscle === 'chest_mid');
    const lats = snapshot.find((m) => m.muscle === 'lats');

    expect(chest!.level).toBe(42);
    expect(lats!.level).toBe(62);
    expect(lats!.status).toBe('moderate'); // 62 >= 50 (soft), < 70 (hard)
  });
});

// ============================================
// Deload status with real fatigue state
// ============================================

describe('Deload detection with shared fatigue state', () => {
  it('no deload when all muscles are fresh', async () => {
    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('none');
  });

  it('triggers deload when multiple muscles are critical', async () => {
    fatigueStore.set('chest_mid', 90);
    fatigueStore.set('quads', 88);
    fatigueStore.set('lats', 86);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');
    expect(status.reasons.length).toBeGreaterThan(0);
  });

  it('recovery tick can prevent deload by reducing fatigue below threshold', async () => {
    fatigueStore.set('chest_mid', 88);
    fatigueStore.set('quads', 87);
    fatigueStore.set('lats', 86);

    // Apply recovery (8 points)
    await applyDailyRecoveryTick(USER);

    // Fatigue now: 80, 79, 78 — below critical (85)
    const status = await checkDeloadStatus(USER);
    // With only fatigue data (no consecutive failures, no scheduled deload),
    // having 0 critical muscles should not trigger required
    expect(status.severity).not.toBe('required');
  });
});

// ============================================
// Muscle usage increases fatigue
// ============================================

describe('Fatigue state → snapshot consistency', () => {
  it('direct fatigue updates are reflected in snapshot', async () => {
    // Simulate fatigue accumulation via service layer
    fatigueStore.set('chest_mid', 36);
    fatigueStore.set('triceps', 18);

    const snapshot = await getFatigueSnapshot(USER);
    const chest = snapshot.find((m) => m.muscle === 'chest_mid');
    const triceps = snapshot.find((m) => m.muscle === 'triceps');

    expect(chest!.level).toBe(36);
    expect(chest!.status).toBe('fresh'); // 36 < 50
    expect(triceps!.level).toBe(18);
  });

  it('critical fatigue triggers deload detection', async () => {
    fatigueStore.set('chest_mid', 90);
    fatigueStore.set('lats', 88);
    fatigueStore.set('quads', 87);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');

    // Apply 2 days of rest recovery (8 pts/day)
    await applyDailyRecoveryTick(USER);
    await applyDailyRecoveryTick(USER);

    // Now: 74, 72, 71 — below critical threshold (85)
    const postRecovery = await checkDeloadStatus(USER);
    expect(postRecovery.severity).not.toBe('required');
  });
});
