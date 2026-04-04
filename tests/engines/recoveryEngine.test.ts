/**
 * Tests: Recovery Engine — DB-backed deload detection & fatigue management
 *
 * Target: src/engines/recoveryEngine.ts
 * Strategy: Mock database/service + adaptiveTrainingService + schema at module boundary
 * Coverage: checkDeloadStatus, getFatigueSnapshot, deload lifecycle, daily recovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// State for app_state mock
const appState = new Map<string, string>();

// Mock database service
vi.mock('../../src/database/service', () => ({
  getMuscleFatigue: vi.fn().mockResolvedValue([]),
  updateMuscleFatigue: vi.fn().mockResolvedValue(undefined),
  applyDailyRecovery: vi.fn().mockResolvedValue(undefined),
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getAppState: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(appState.get(key) ?? null);
  }),
  setAppState: vi.fn().mockImplementation((key: string, value: string) => {
    appState.set(key, value);
    return Promise.resolve();
  }),
  getMuscleFatigueLevel: vi.fn().mockResolvedValue(0),
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

// Mock WAL service
vi.mock('../../src/services/WriteAheadLogService', () => ({
  walService: {
    logIntent: vi.fn().mockResolvedValue('wal_001'),
    commit: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock database/schema (for accumulateFatigue raw SQL)
vi.mock('../../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    withTransactionAsync: vi.fn().mockImplementation(async (cb: () => Promise<void>) => cb()),
    runAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

import {
  getFatigueSnapshot,
  getAverageFatigue,
  checkDeloadStatus,
  applyDailyRecoveryTick,
  needsRecoveryTick,
  startDeload,
  endDeload,
  isInDeload,
  incrementWeekCounter,
  generateRecoveryPlan,
  RECOVERY_CONFIG,
} from '../../src/engines/recoveryEngine';
import {
  getMuscleFatigue,
  getRecentSessions,
  setAppState,
  updateMuscleFatigue,
  applyDailyRecovery,
} from '../../src/database/service';
import { getAdaptiveTrainingProfile } from '../../src/services/adaptiveTrainingService';

const USER = 'user_local_001';

beforeEach(() => {
  vi.clearAllMocks();
  appState.clear();

  // Reset adaptive profile to default (prevents leaks from per-test overrides)
  vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
    userId: 'user_local_001',
    fatigueSensitivity: 1,
    progressionAggressiveness: 1,
    volumeTolerance: 1,
    confidence: 0,
    samples: 0,
    updatedAt: Date.now(),
    rationale: [],
  });
});

// ============================================
// getFatigueSnapshot
// ============================================

describe('getFatigueSnapshot', () => {
  it('returns all 22 muscles with fresh status when no fatigue data', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    const snapshot = await getFatigueSnapshot(USER);
    expect(snapshot).toHaveLength(22);
    expect(snapshot.every((s) => s.status === 'fresh')).toBe(true);
    expect(snapshot.every((s) => s.level === 0)).toBe(true);
  });

  it('classifies muscle status based on fatigue thresholds', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 30, last_trained_at: '2026-04-01', updated_at: '2026-04-01' },
      { user_id: USER, muscle: 'quads', fatigue_level: 55, last_trained_at: '2026-04-01', updated_at: '2026-04-01' },
      { user_id: USER, muscle: 'lats', fatigue_level: 75, last_trained_at: '2026-04-01', updated_at: '2026-04-01' },
      { user_id: USER, muscle: 'biceps', fatigue_level: 90, last_trained_at: '2026-04-01', updated_at: '2026-04-01' },
    ]);

    const snapshot = await getFatigueSnapshot(USER);
    const find = (m: string) => snapshot.find((s) => s.muscle === m)!;

    expect(find('chest_mid').status).toBe('fresh'); // 30 < 50
    expect(find('quads').status).toBe('moderate'); // 50 ≤ 55 < 70
    expect(find('lats').status).toBe('fatigued'); // 70 ≤ 75 < 85
    expect(find('biceps').status).toBe('critical'); // 90 ≥ 85
  });
});

// ============================================
// getAverageFatigue
// ============================================

describe('getAverageFatigue', () => {
  it('returns 0 when no fatigue data', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    const avg = await getAverageFatigue(USER);
    expect(avg).toBe(0);
  });

  it('computes weighted average across all 22 muscles (zeroes included)', async () => {
    // Only 2 muscles with fatigue; rest are 0
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 100, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'quads', fatigue_level: 100, last_trained_at: null, updated_at: '' },
    ]);
    const avg = await getAverageFatigue(USER);
    // (100 + 100 + 0*20) / 22 ≈ 9
    expect(avg).toBe(Math.round(200 / 22));
  });
});

// ============================================
// checkDeloadStatus
// ============================================

describe('checkDeloadStatus', () => {
  it('returns none severity when all muscles are fresh', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    vi.mocked(getRecentSessions).mockResolvedValue([]);
    // Default week = 1 (not a deload week)
    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('none');
    expect(status.should_deload).toBe(false);
    expect(status.reasons).toHaveLength(0);
  });

  it('returns required severity when 3+ muscles are critical', async () => {
    // Need 3+ muscles at critical threshold (85 default with sensitivity=1)
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'quads', fatigue_level: 88, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'lats', fatigue_level: 92, last_trained_at: null, updated_at: '' },
    ]);
    vi.mocked(getRecentSessions).mockResolvedValue([]);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');
    expect(status.should_deload).toBe(true);
    expect(status.reasons.some((r) => r.includes('critical fatigue'))).toBe(true);
  });

  it('returns suggested severity when 1-2 muscles are critical', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' },
    ]);
    vi.mocked(getRecentSessions).mockResolvedValue([]);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('suggested');
  });

  it('returns recommended when consecutive failures exceed threshold', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    vi.mocked(getRecentSessions).mockResolvedValue([
      { id: 's3', user_id: USER, success: 0 } as any,
      { id: 's2', user_id: USER, success: 0 } as any,
      { id: 's1', user_id: USER, success: 0 } as any,
    ]);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('recommended');
    expect(status.reasons.some((r) => r.includes('consecutive workout failures'))).toBe(true);
  });

  it('escalates to required when failures + critical muscles combine', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' },
    ]);
    vi.mocked(getRecentSessions).mockResolvedValue([
      { id: 's3', user_id: USER, success: 0 } as any,
      { id: 's2', user_id: USER, success: 0 } as any,
      { id: 's1', user_id: USER, success: 0 } as any,
    ]);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');
  });

  it('triggers on scheduled deload week', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    vi.mocked(getRecentSessions).mockResolvedValue([]);
    // Week 4 triggers scheduled deload (scheduled_deload_weeks=4)
    appState.set(`${USER}_training_week`, '4');

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('suggested');
    expect(status.reasons.some((r) => r.includes('Scheduled deload'))).toBe(true);
  });

  it('respects adaptive fatigue sensitivity for lower thresholds', async () => {
    vi.mocked(getAdaptiveTrainingProfile).mockResolvedValue({
      userId: USER,
      fatigueSensitivity: 1.25, // More sensitive → lower thresholds
      progressionAggressiveness: 1,
      volumeTolerance: 1,
      confidence: 0.8,
      samples: 10,
      updatedAt: Date.now(),
      rationale: [],
    });

    // Critical threshold: 85/1.25 = 68. So 70 is now critical.
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 70, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'quads', fatigue_level: 72, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'lats', fatigue_level: 75, last_trained_at: null, updated_at: '' },
    ]);
    vi.mocked(getRecentSessions).mockResolvedValue([]);

    const status = await checkDeloadStatus(USER);
    expect(status.severity).toBe('required');
  });
});

// ============================================
// Deload lifecycle: start → isInDeload → end
// ============================================

describe('deload lifecycle', () => {
  it('starts deload and reports active', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    await startDeload(USER);
    const active = await isInDeload(USER);
    expect(active).toBe(true);
  });

  it('ends deload and resets high fatigue to 30', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 80, last_trained_at: null, updated_at: '' },
      { user_id: USER, muscle: 'quads', fatigue_level: 20, last_trained_at: null, updated_at: '' },
    ]);

    await startDeload(USER);
    await endDeload(USER);

    // updateMuscleFatigue called for chest_mid (80>30) but NOT quads (20<30)
    expect(vi.mocked(updateMuscleFatigue)).toHaveBeenCalledWith(USER, 'chest_mid', 30, false);
    expect(vi.mocked(updateMuscleFatigue)).not.toHaveBeenCalledWith(USER, 'quads', expect.anything(), expect.anything());
  });

  it('reports inactive after ending deload', async () => {
    await startDeload(USER);
    await endDeload(USER);
    const active = await isInDeload(USER);
    expect(active).toBe(false);
  });

  it('auto-ends deload after expiry (7 days)', async () => {
    // Set deload start to 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    appState.set(`${USER}_deload_active`, 'true');
    appState.set(`${USER}_deload_start`, eightDaysAgo);

    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    const active = await isInDeload(USER);
    expect(active).toBe(false);
  });
});

// ============================================
// Daily recovery tick
// ============================================

describe('applyDailyRecoveryTick', () => {
  it('applies base recovery rate', async () => {
    await applyDailyRecoveryTick(USER);
    expect(vi.mocked(applyDailyRecovery)).toHaveBeenCalledWith(USER, RECOVERY_CONFIG.daily_recovery_rate);
  });

  it('adds rest day bonus', async () => {
    await applyDailyRecoveryTick(USER, true, false);
    const expected = RECOVERY_CONFIG.daily_recovery_rate + RECOVERY_CONFIG.rest_day_recovery_bonus;
    expect(vi.mocked(applyDailyRecovery)).toHaveBeenCalledWith(USER, expected);
  });

  it('adds sleep bonus', async () => {
    await applyDailyRecoveryTick(USER, false, true);
    const expected = RECOVERY_CONFIG.daily_recovery_rate + RECOVERY_CONFIG.sleep_recovery_bonus;
    expect(vi.mocked(applyDailyRecovery)).toHaveBeenCalledWith(USER, expected);
  });

  it('stacks rest day + sleep bonuses', async () => {
    await applyDailyRecoveryTick(USER, true, true);
    const expected =
      RECOVERY_CONFIG.daily_recovery_rate +
      RECOVERY_CONFIG.rest_day_recovery_bonus +
      RECOVERY_CONFIG.sleep_recovery_bonus;
    expect(vi.mocked(applyDailyRecovery)).toHaveBeenCalledWith(USER, expected);
  });

  it('records recovery tick timestamp in app_state', async () => {
    await applyDailyRecoveryTick(USER);
    expect(appState.has(`${USER}_last_recovery_tick`)).toBe(true);
  });
});

// ============================================
// needsRecoveryTick
// ============================================

describe('needsRecoveryTick', () => {
  it('returns true when no previous tick recorded', async () => {
    const needs = await needsRecoveryTick(USER);
    expect(needs).toBe(true);
  });

  it('returns false when tick already done today', async () => {
    appState.set(`${USER}_last_recovery_tick`, new Date().toISOString());
    const needs = await needsRecoveryTick(USER);
    expect(needs).toBe(false);
  });

  it('returns true when last tick was yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    appState.set(`${USER}_last_recovery_tick`, yesterday);
    const needs = await needsRecoveryTick(USER);
    expect(needs).toBe(true);
  });
});

// ============================================
// incrementWeekCounter
// ============================================

describe('incrementWeekCounter', () => {
  it('starts at week 1 and increments to 2', async () => {
    const result = await incrementWeekCounter(USER);
    expect(result).toBe(2);
    expect(appState.get(`${USER}_training_week`)).toBe('2');
  });

  it('increments existing week correctly', async () => {
    appState.set(`${USER}_training_week`, '7');
    const result = await incrementWeekCounter(USER);
    expect(result).toBe(8);
  });
});

// ============================================
// generateRecoveryPlan
// ============================================

describe('generateRecoveryPlan', () => {
  it('returns default plan when not in deload and all fresh', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    const plan = await generateRecoveryPlan(USER);
    expect(plan.deload_active).toBe(false);
    expect(plan.volume_multiplier).toBe(1.0);
    expect(plan.muscles_to_avoid).toHaveLength(0);
  });

  it('avoids fatigued and critical muscles', async () => {
    vi.mocked(getMuscleFatigue).mockResolvedValue([
      { user_id: USER, muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' }, // critical
      { user_id: USER, muscle: 'lats', fatigue_level: 75, last_trained_at: null, updated_at: '' }, // fatigued
    ]);
    const plan = await generateRecoveryPlan(USER);
    expect(plan.muscles_to_avoid).toContain('chest_mid');
    expect(plan.muscles_to_avoid).toContain('lats');
  });

  it('uses deload volume multiplier when in deload', async () => {
    await startDeload(USER);
    vi.mocked(getMuscleFatigue).mockResolvedValue([]);
    const plan = await generateRecoveryPlan(USER);
    expect(plan.deload_active).toBe(true);
    expect(plan.volume_multiplier).toBe(RECOVERY_CONFIG.deload_volume_multiplier);
    expect(plan.deload_days_remaining).toBeGreaterThan(0);
  });
});
