import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TargetMuscle } from '../src/database/types';

// Mock the database layer before importing the engine
vi.mock('../src/database/service', () => ({
  getMuscleFatigue: vi.fn(),
  updateMuscleFatigue: vi.fn(),
  applyDailyRecovery: vi.fn(),
  getRecentSessions: vi.fn(),
  getAppState: vi.fn(),
  setAppState: vi.fn(),
  getMuscleFatigueLevel: vi.fn(),
}));
vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn(() => ({
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    runAsync: vi.fn(),
    getAllAsync: vi.fn(() => []),
    getFirstAsync: vi.fn(() => null),
  })),
}));
vi.mock('../src/services/adaptiveTrainingService', () => ({
  getAdaptiveTrainingProfile: vi.fn(() => ({
    fatigueSensitivity: 1.0,
    volumePreference: 1.0,
    recoveryRate: 1.0,
  })),
}));

import {
  getFatigueSnapshot,
  getAverageFatigue,
  checkDeloadStatus,
  needsRecoveryTick,
  RECOVERY_CONFIG,
} from '../src/engines/recoveryEngine';
import { getMuscleFatigue, getRecentSessions, getAppState } from '../src/database/service';

const mockGetMuscleFatigue = vi.mocked(getMuscleFatigue);
const mockGetRecentSessions = vi.mocked(getRecentSessions);
const mockGetAppState = vi.mocked(getAppState);

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================
// RECOVERY_CONFIG constants
// =============================================

describe('RECOVERY_CONFIG', () => {
  it('has sane default values', () => {
    expect(RECOVERY_CONFIG.daily_recovery_rate).toBe(8);
    expect(RECOVERY_CONFIG.fatigue_soft_threshold).toBe(50);
    expect(RECOVERY_CONFIG.fatigue_hard_threshold).toBe(70);
    expect(RECOVERY_CONFIG.fatigue_critical_threshold).toBe(85);
    expect(RECOVERY_CONFIG.deload_volume_multiplier).toBe(0.6);
    expect(RECOVERY_CONFIG.deload_duration_days).toBe(7);
    expect(RECOVERY_CONFIG.scheduled_deload_weeks).toBe(4);
  });

  it('fatigue thresholds form ascending chain', () => {
    expect(RECOVERY_CONFIG.fatigue_soft_threshold)
      .toBeLessThan(RECOVERY_CONFIG.fatigue_hard_threshold);
    expect(RECOVERY_CONFIG.fatigue_hard_threshold)
      .toBeLessThan(RECOVERY_CONFIG.fatigue_critical_threshold);
    expect(RECOVERY_CONFIG.fatigue_critical_threshold).toBeLessThanOrEqual(100);
  });
});

// =============================================
// getFatigueSnapshot — fatigue classification
// =============================================

describe('getFatigueSnapshot', () => {
  it('returns all 22 muscles even with empty DB', async () => {
    mockGetMuscleFatigue.mockResolvedValue([]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap).toHaveLength(22);
    expect(snap.every(s => s.status === 'fresh')).toBe(true);
    expect(snap.every(s => s.level === 0)).toBe(true);
  });

  it('classifies fresh muscle (level < 50)', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'chest_mid', fatigue_level: 30, last_trained_at: null, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    const chest = snap.find(s => s.muscle === 'chest_mid')!;
    expect(chest.status).toBe('fresh');
    expect(chest.level).toBe(30);
  });

  it('classifies moderate muscle (50 ≤ level < 70)', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'quads', fatigue_level: 55, last_trained_at: null, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap.find(s => s.muscle === 'quads')!.status).toBe('moderate');
  });

  it('classifies fatigued muscle (70 ≤ level < 85)', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'lats', fatigue_level: 75, last_trained_at: null, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap.find(s => s.muscle === 'lats')!.status).toBe('fatigued');
  });

  it('classifies critical muscle (level ≥ 85)', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'biceps', fatigue_level: 90, last_trained_at: null, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap.find(s => s.muscle === 'biceps')!.status).toBe('critical');
  });

  it('calculates days_since_trained from last_trained_at', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'glutes_max', fatigue_level: 40, last_trained_at: twoDaysAgo, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap.find(s => s.muscle === 'glutes_max')!.days_since_trained).toBe(2);
  });

  it('returns null days_since_trained when never trained', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'abs', fatigue_level: 0, last_trained_at: null, updated_at: '' },
    ]);
    const snap = await getFatigueSnapshot('u1');
    expect(snap.find(s => s.muscle === 'abs')!.days_since_trained).toBeNull();
  });
});

// =============================================
// getAverageFatigue
// =============================================

describe('getAverageFatigue', () => {
  it('returns 0 when all muscles are fresh', async () => {
    mockGetMuscleFatigue.mockResolvedValue([]);
    expect(await getAverageFatigue('u1')).toBe(0);
  });

  it('computes rounded average across all 22 muscles', async () => {
    // 2 muscles at 50, rest at 0 → (100 / 22) ≈ 5
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'chest_mid', fatigue_level: 50, last_trained_at: null, updated_at: '' },
      { user_id: 'u1', muscle: 'lats', fatigue_level: 50, last_trained_at: null, updated_at: '' },
    ]);
    const avg = await getAverageFatigue('u1');
    expect(avg).toBe(Math.round(100 / 22)); // 5
  });
});

// =============================================
// checkDeloadStatus — severity escalation
// =============================================

describe('checkDeloadStatus', () => {
  it('returns none severity when fully fresh', async () => {
    mockGetMuscleFatigue.mockResolvedValue([]);
    mockGetRecentSessions.mockResolvedValue([]);
    mockGetAppState.mockResolvedValue('1');
    const status = await checkDeloadStatus('u1');
    expect(status.severity).toBe('none');
    expect(status.should_deload).toBe(false);
    expect(status.reasons).toHaveLength(0);
  });

  it('escalates to suggested when 1 critical muscle', async () => {
    mockGetMuscleFatigue.mockResolvedValue([
      { user_id: 'u1', muscle: 'chest_mid', fatigue_level: 90, last_trained_at: null, updated_at: '' },
    ]);
    mockGetRecentSessions.mockResolvedValue([{ success: true } as any]);
    mockGetAppState.mockResolvedValue('1');
    const status = await checkDeloadStatus('u1');
    expect(status.should_deload).toBe(true);
    expect(['suggested', 'recommended', 'required']).toContain(status.severity);
  });

  it('escalates to required when 3+ critical muscles', async () => {
    const criticalMuscles = (['chest_mid', 'lats', 'quads'] as const).map(m => ({
      user_id: 'u1', muscle: m as TargetMuscle, fatigue_level: 90, last_trained_at: null, updated_at: '',
    }));
    mockGetMuscleFatigue.mockResolvedValue(criticalMuscles);
    mockGetRecentSessions.mockResolvedValue([]);
    mockGetAppState.mockResolvedValue('1');
    const status = await checkDeloadStatus('u1');
    expect(status.severity).toBe('required');
  });

  it('triggers on consecutive failures', async () => {
    mockGetMuscleFatigue.mockResolvedValue([]);
    mockGetRecentSessions.mockResolvedValue([
      { success: false } as any,
      { success: false } as any,
      { success: false } as any,
    ]);
    mockGetAppState.mockResolvedValue('1');
    const status = await checkDeloadStatus('u1');
    expect(status.should_deload).toBe(true);
    expect(status.reasons.some(r => r.includes('consecutive workout failures'))).toBe(true);
  });

  it('triggers on scheduled deload week', async () => {
    mockGetMuscleFatigue.mockResolvedValue([]);
    mockGetRecentSessions.mockResolvedValue([]);
    // Week 4 = scheduled deload
    mockGetAppState.mockResolvedValue('4');
    const status = await checkDeloadStatus('u1');
    expect(status.should_deload).toBe(true);
    expect(status.reasons.some(r => r.includes('Scheduled deload'))).toBe(true);
  });
});

// =============================================
// needsRecoveryTick
// =============================================

describe('needsRecoveryTick', () => {
  it('returns true when no previous tick recorded', async () => {
    mockGetAppState.mockResolvedValue(null);
    expect(await needsRecoveryTick('u1')).toBe(true);
  });

  it('returns false if already ticked today', async () => {
    mockGetAppState.mockResolvedValue(new Date().toISOString());
    expect(await needsRecoveryTick('u1')).toBe(false);
  });

  it('returns true if last tick was yesterday', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    mockGetAppState.mockResolvedValue(yesterday);
    expect(await needsRecoveryTick('u1')).toBe(true);
  });
});
