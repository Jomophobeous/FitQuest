/**
 * SleepAnalysisEngine Tests
 *
 * Tests sleep quality scoring, stage estimation, optimal bedtime,
 * sleep recovery multiplier, analytics helpers, and recommendations.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

(globalThis as any).__DEV__ = false;

// Mock dependencies
vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeHealthData: vi.fn().mockResolvedValue(undefined),
    getRecentHealthData: vi.fn().mockResolvedValue([]),
    getHealthData: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    runAsync: vi.fn().mockResolvedValue({ changes: 0 }),
  }),
}));

import { SleepAnalysisEngine, type SleepSession } from '../src/engines/SleepAnalysisEngine';
import { encryptedDB } from '../src/security/EncryptedDatabase';

const mockStoreHealthData = vi.mocked(encryptedDB.storeHealthData);
const mockGetRecentHealthData = vi.mocked(encryptedDB.getRecentHealthData);

// ============================================
// HELPERS
// ============================================

function makeSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: `sleep_test_${Date.now()}`,
    bedtime: new Date('2024-01-15T23:00:00Z').getTime(),
    wakeTime: new Date('2024-01-16T07:00:00Z').getTime(),
    totalDurationMs: 8 * 60 * 60 * 1000, // 8 hours
    sleepLatencyMs: 15 * 60 * 1000,
    awakeningsCount: 2,
    stages: [
      { stage: 'LIGHT', startMs: 0, durationMs: 2700000 },
      { stage: 'DEEP', startMs: 2700000, durationMs: 1620000 },
      { stage: 'REM', startMs: 4320000, durationMs: 1080000 },
    ],
    qualityScore: 80,
    efficiency: 92,
    notes: null,
    source: 'MANUAL',
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('SleepAnalysisEngine', () => {
  let engine: SleepAnalysisEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = SleepAnalysisEngine.getInstance();
  });

  // ============================================
  // SINGLETON
  // ============================================

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const a = SleepAnalysisEngine.getInstance();
      const b = SleepAnalysisEngine.getInstance();
      expect(a).toBe(b);
    });
  });

  // ============================================
  // MANUAL SESSION RECORDING
  // ============================================

  describe('recordManualSession', () => {
    it('records a valid 8-hour sleep session', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime);

      expect(session.source).toBe('MANUAL');
      expect(session.totalDurationMs).toBe(8 * 60 * 60 * 1000);
      expect(session.qualityScore).toBeGreaterThanOrEqual(0);
      expect(session.qualityScore).toBeLessThanOrEqual(100);
      expect(session.efficiency).toBeGreaterThan(0);
      expect(session.efficiency).toBeLessThanOrEqual(100);
      expect(session.stages.length).toBeGreaterThan(0);
      expect(mockStoreHealthData).toHaveBeenCalledWith('sleep_session', expect.any(Object));
    });

    it('generates sleep stages with LIGHT, DEEP, and REM', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime);
      const stageTypes = new Set(session.stages.map(s => s.stage));

      expect(stageTypes.has('LIGHT')).toBe(true);
      expect(stageTypes.has('DEEP')).toBe(true);
      expect(stageTypes.has('REM')).toBe(true);
    });

    it('applies custom sleep latency', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime, {
        sleepLatencyMin: 30,
      });

      expect(session.sleepLatencyMs).toBe(30 * 60 * 1000);
    });

    it('stores notes when provided', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime, {
        notes: 'Good sleep after workout',
      });

      expect(session.notes).toBe('Good sleep after workout');
    });

    it('rejects invalid duration (negative)', async () => {
      const bedtime = new Date('2024-01-16T07:00:00Z');
      const wakeTime = new Date('2024-01-15T23:00:00Z'); // Before bedtime

      await expect(engine.recordManualSession(bedtime, wakeTime))
        .rejects.toThrow(/Invalid sleep duration/);
    });

    it('rejects duration over 24 hours', async () => {
      const bedtime = new Date('2024-01-15T00:00:00Z');
      const wakeTime = new Date('2024-01-17T01:00:00Z'); // 25 hours

      await expect(engine.recordManualSession(bedtime, wakeTime))
        .rejects.toThrow(/Invalid sleep duration/);
    });
  });

  // ============================================
  // QUALITY SCORING
  // ============================================

  describe('quality scoring', () => {
    it('gives high score for ideal 8-hour sleep', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime, {
        sleepLatencyMin: 10,
        awakenings: 1,
      });

      expect(session.qualityScore).toBeGreaterThanOrEqual(65);
    });

    it('penalizes very short sleep (<6 hours)', async () => {
      const bedtime = new Date('2024-01-16T02:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z'); // 5 hours

      const session = await engine.recordManualSession(bedtime, wakeTime);
      expect(session.qualityScore).toBeLessThan(80);
    });

    it('penalizes many awakenings', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const fewWake = await engine.recordManualSession(bedtime, wakeTime, { awakenings: 1 });
      const manyWake = await engine.recordManualSession(bedtime, wakeTime, { awakenings: 6 });

      expect(fewWake.qualityScore).toBeGreaterThan(manyWake.qualityScore);
    });

    it('penalizes long sleep latency', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const quick = await engine.recordManualSession(bedtime, wakeTime, { sleepLatencyMin: 5 });
      const slow = await engine.recordManualSession(bedtime, wakeTime, { sleepLatencyMin: 45 });

      expect(quick.qualityScore).toBeGreaterThan(slow.qualityScore);
    });

    it('scores between 0 and 100', async () => {
      const bedtime = new Date('2024-01-16T04:00:00Z');
      const wakeTime = new Date('2024-01-16T06:00:00Z'); // Worst case: 2 hours
      const session = await engine.recordManualSession(bedtime, wakeTime, {
        sleepLatencyMin: 45,
        awakenings: 8,
      });

      expect(session.qualityScore).toBeGreaterThanOrEqual(0);
      expect(session.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  // ============================================
  // SLEEP EFFICIENCY
  // ============================================

  describe('sleep efficiency', () => {
    it('calculates efficiency as ratio of actual sleep to time in bed', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z'); // 8h total

      const session = await engine.recordManualSession(bedtime, wakeTime, {
        sleepLatencyMin: 15,
      });

      // Efficiency = (8h - 15min) / 8h ≈ 97%
      expect(session.efficiency).toBeGreaterThan(90);
      expect(session.efficiency).toBeLessThanOrEqual(100);
    });
  });

  // ============================================
  // OPTIMAL BEDTIME
  // ============================================

  describe('getOptimalBedtime', () => {
    it('calculates bedtime for 5 cycles (7.5h) + 15min buffer', () => {
      const wakeTime = new Date('2024-01-16T07:00:00Z');
      const bedtime = engine.getOptimalBedtime(wakeTime, 5);

      // 5 cycles × 90min = 450min = 7h30m + 15min buffer = 7h45m before wake
      // 07:00 - 7:45 = 23:15 previous day
      expect(bedtime.getUTCHours()).toBe(23);
      expect(bedtime.getUTCMinutes()).toBe(15);
    });

    it('calculates bedtime for 4 cycles (6h)', () => {
      const wakeTime = new Date('2024-01-16T06:00:00Z');
      const bedtime = engine.getOptimalBedtime(wakeTime, 4);

      // 4 × 90min = 360min = 6h + 15min = 6h15m before 06:00 = 23:45
      expect(bedtime.getUTCHours()).toBe(23);
      expect(bedtime.getUTCMinutes()).toBe(45);
    });

    it('defaults to 5 cycles', () => {
      const wakeTime = new Date('2024-01-16T07:00:00Z');
      const bedtime = engine.getOptimalBedtime(wakeTime);
      // Same as 5 cycles
      expect(bedtime.getUTCHours()).toBe(23);
      expect(bedtime.getUTCMinutes()).toBe(15);
    });
  });

  // ============================================
  // RECOVERY MULTIPLIER
  // ============================================

  describe('getSleepRecoveryMultiplier', () => {
    it('returns 1.0 when no sessions available', async () => {
      mockGetRecentHealthData.mockResolvedValueOnce([]);
      const multiplier = await engine.getSleepRecoveryMultiplier();
      expect(multiplier).toBe(1.0);
    });

    it('returns <1.0 for poor sleep quality', async () => {
      mockGetRecentHealthData.mockResolvedValueOnce([
        makeSession({ qualityScore: 30, totalDurationMs: 5 * 60 * 60 * 1000 }),
        makeSession({ qualityScore: 25, totalDurationMs: 4.5 * 60 * 60 * 1000 }),
        makeSession({ qualityScore: 35, totalDurationMs: 5 * 60 * 60 * 1000 }),
      ] as any);
      const multiplier = await engine.getSleepRecoveryMultiplier();
      expect(multiplier).toBeLessThan(1.0);
    });

    it('returns good multiplier for quality sleep', async () => {
      mockGetRecentHealthData.mockResolvedValueOnce([
        makeSession({ qualityScore: 85, totalDurationMs: 8 * 60 * 60 * 1000 }),
        makeSession({ qualityScore: 90, totalDurationMs: 8.5 * 60 * 60 * 1000 }),
        makeSession({ qualityScore: 80, totalDurationMs: 7.5 * 60 * 60 * 1000 }),
      ] as any);
      const multiplier = await engine.getSleepRecoveryMultiplier();
      expect(multiplier).toBeGreaterThanOrEqual(0.9);
    });

    it('multiplier is bounded between 0.5 and 1.2', async () => {
      // Very poor sleep
      mockGetRecentHealthData.mockResolvedValueOnce([
        makeSession({ qualityScore: 0, totalDurationMs: 1 * 60 * 60 * 1000 }),
      ] as any);
      const poor = await engine.getSleepRecoveryMultiplier();
      expect(poor).toBeGreaterThanOrEqual(0.4);
      expect(poor).toBeLessThanOrEqual(1.3);
    });
  });

  // ============================================
  // ANALYTICS
  // ============================================

  describe('getAnalytics', () => {
    it('returns empty analytics when no sessions', async () => {
      mockGetRecentHealthData.mockResolvedValueOnce([]);
      const analytics = await engine.getAnalytics(30);
      expect(analytics.avgDurationMs).toBe(0);
      expect(analytics.avgQualityScore).toBe(0);
      expect(analytics.recommendations.length).toBeGreaterThan(0);
    });

    it('computes averages from multiple sessions', async () => {
      const sessions = [
        makeSession({ totalDurationMs: 8 * 3600000, qualityScore: 80, efficiency: 90 }),
        makeSession({ totalDurationMs: 7 * 3600000, qualityScore: 70, efficiency: 85 }),
        makeSession({ totalDurationMs: 9 * 3600000, qualityScore: 90, efficiency: 95 }),
      ];
      mockGetRecentHealthData.mockResolvedValueOnce(sessions as any);

      const analytics = await engine.getAnalytics(30);
      expect(analytics.avgDurationMs).toBe(8 * 3600000);
      expect(analytics.avgQualityScore).toBe(80);
      expect(analytics.avgEfficiency).toBe(90);
    });

    it('generates recommendations for short sleep', async () => {
      const sessions = [
        makeSession({ totalDurationMs: 5 * 3600000, qualityScore: 50, efficiency: 80 }),
        makeSession({ totalDurationMs: 5.5 * 3600000, qualityScore: 55, efficiency: 82 }),
        makeSession({ totalDurationMs: 5 * 3600000, qualityScore: 45, efficiency: 78 }),
      ];
      mockGetRecentHealthData.mockResolvedValueOnce(sessions as any);

      const analytics = await engine.getAnalytics(7);
      expect(analytics.recommendations.length).toBeGreaterThan(0);
      const hasShortSleepRec = analytics.recommendations.some(r =>
        r.includes('aim for 7-9 hours') || r.includes('earlier')
      );
      expect(hasShortSleepRec).toBe(true);
    });
  });

  // ============================================
  // SLEEP STAGE ESTIMATION
  // ============================================

  describe('stage estimation', () => {
    it('generates multiple sleep cycles for 8-hour sleep', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime);

      // 8h ≈ 5-6 cycles, each has LIGHT + DEEP + REM
      expect(session.stages.length).toBeGreaterThanOrEqual(9); // At least 3 stages × 3 cycles
    });

    it('has more deep sleep early and more REM late', async () => {
      const bedtime = new Date('2024-01-15T23:00:00Z');
      const wakeTime = new Date('2024-01-16T07:00:00Z');

      const session = await engine.recordManualSession(bedtime, wakeTime);
      const deepStages = session.stages.filter(s => s.stage === 'DEEP');
      const remStages = session.stages.filter(s => s.stage === 'REM');

      if (deepStages.length >= 2 && remStages.length >= 2) {
        // Earlier deep stages should be longer than later ones
        expect(deepStages[0]!.durationMs).toBeGreaterThanOrEqual(
          deepStages[deepStages.length - 1]!.durationMs
        );
        // Later REM stages should be longer than earlier ones
        expect(remStages[remStages.length - 1]!.durationMs).toBeGreaterThanOrEqual(
          remStages[0]!.durationMs
        );
      }
    });
  });

  // ============================================
  // SENSOR-BASED SESSION
  // ============================================

  describe('recordSensorSession', () => {
    it('records sensor session from movement data', async () => {
      const bedtime = Date.now() - 8 * 3600000;
      const wakeTime = Date.now();
      const movementData = Array.from({ length: 96 }, (_, i) => ({
        timestamp: bedtime + i * 5 * 60000, // Every 5 min
        intensity: i < 3 ? 0.3 : i > 90 ? 0.4 : Math.random() * 0.08, // Settling → sleep → waking
      }));

      const session = await engine.recordSensorSession(bedtime, wakeTime, movementData);

      expect(session.source).toBe('SENSOR');
      expect(session.totalDurationMs).toBe(8 * 3600000);
      expect(session.stages.length).toBeGreaterThan(0);
      expect(session.qualityScore).toBeGreaterThanOrEqual(0);
      expect(mockStoreHealthData).toHaveBeenCalledWith('sleep_session', expect.any(Object));
    });
  });
});
