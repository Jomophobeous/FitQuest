import { describe, expect, it, vi, beforeEach } from 'vitest';

// ============================================
// MOCK ALL HEAVY DEPENDENCIES
// ============================================

vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Platform: { OS: 'android' },
}));

vi.mock('expo-battery', () => ({
  getBatteryLevelAsync: vi.fn(() => Promise.resolve(0.85)),
  getBatteryStateAsync: vi.fn(() => Promise.resolve(2)), // UNPLUGGED
  addBatteryStateListener: vi.fn(() => ({ remove: vi.fn() })),
  BatteryState: { UNPLUGGED: 2, CHARGING: 1, FULL: 3 },
}));

vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeHealthData: vi.fn(() => Promise.resolve()),
    getRecentHealthData: vi.fn(() => Promise.resolve([])),
    createHealthAlert: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../src/services/errorTelemetry', () => ({
  captureHealthError: vi.fn(),
}));

vi.mock('../src/engines/AnomalyDetector', () => ({
  AnomalyDetector: vi.fn().mockImplementation(() => ({
    detect: vi.fn(() => []),
    addDataPoint: vi.fn(),
  })),
}));

vi.mock('../src/engines/SleepAnalysisEngine', () => ({
  SleepAnalysisEngine: {
    getInstance: () => ({
      getLastNightSummary: vi.fn(() => null),
      getSleepDebt: vi.fn(() => 0),
      getAnalytics: vi.fn(() => Promise.resolve({ avgQualityScore: 70, avgDurationMs: 28800000 })),
    }),
  },
}));

vi.mock('../src/engines/RealisticHealthEngine', () => ({
  RealisticHealthEngine: {
    calculateBMR: vi.fn(() => 1800),
    calculateTDEE: vi.fn(() => 2500),
    calculateRecoveryScore: vi.fn(() => 75),
  },
}));

vi.mock('../src/engines/SensorFusionEngine', () => ({
  SensorFusionEngine: {
    getInstance: () => ({
      isRunning: vi.fn(() => false),
      start: vi.fn(() => Promise.resolve()),
      stop: vi.fn(),
      getSnapshot: vi.fn(() => ({
        isActive: false,
        activity: 'STATIONARY',
        steps: 0,
      })),
    }),
  },
}));

vi.mock('../src/engines/HealthMonitor', () => ({
  HealthMonitorService: {
    getInstance: () => ({
      initialize: vi.fn(() => Promise.resolve()),
      shutdown: vi.fn(() => Promise.resolve()),
      getTodaySummary: vi.fn(() => ({
        totalSteps: 5000,
        totalCalories: 200,
        activeMinutes: 20,
        workoutCount: 1,
      })),
    }),
  },
}));

vi.mock('../src/engines/ReadinessEngine', () => ({
  getCachedReadiness: vi.fn(() => Promise.resolve(null)),
  invalidateReadinessCache: vi.fn(),
}));

vi.mock('../src/services/healthAdapters', () => ({
  syncHealthData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/database/service', () => ({
  getAverageFatigueLevel: vi.fn(() => Promise.resolve(25)),
  getAppState: vi.fn(() => Promise.resolve(null)),
  getDailyStepsForDate: vi.fn(() => Promise.resolve({ steps: 5000, active_minutes: 20 })),
  getRecoveryScoresSince: vi.fn(() => Promise.resolve([])),
  getStepHistory: vi.fn(() => Promise.resolve([])),
  getUserProfile: vi.fn(() => Promise.resolve({ weight_kg: 75, height_cm: 180 })),
  getWorkoutCountSince: vi.fn(() => Promise.resolve(1)),
  getWorkoutStreakCurrent: vi.fn(() => Promise.resolve(3)),
}));

import { BackgroundHealthEngine } from '../src/engines/BackgroundHealthEngine';

// ============================================
// HELPERS
// ============================================

function freshInstance(): BackgroundHealthEngine {
  // @ts-expect-error — reset singleton for test isolation
  BackgroundHealthEngine.instance = null;
  return BackgroundHealthEngine.getInstance();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

// ============================================
// SINGLETON
// ============================================

describe('BackgroundHealthEngine singleton', () => {
  it('returns same instance', () => {
    const a = BackgroundHealthEngine.getInstance();
    const b = BackgroundHealthEngine.getInstance();
    expect(a).toBe(b);
  });
});

// ============================================
// ENGINE LIFECYCLE
// ============================================

describe('BackgroundHealthEngine lifecycle', () => {
  it('starts in STOPPED state', () => {
    const engine = freshInstance();
    expect(engine.getState()).toBe('STOPPED');
  });

  it('transitions to RUNNING on start', async () => {
    const engine = freshInstance();
    await engine.start();
    expect(engine.getState()).toBe('RUNNING');
    engine.stop();
  });

  it('transitions to STOPPED on stop', async () => {
    const engine = freshInstance();
    await engine.start();
    engine.stop();
    expect(engine.getState()).toBe('STOPPED');
  });

  it('pause sets state to PAUSED', async () => {
    const engine = freshInstance();
    await engine.start();
    engine.pause();
    expect(engine.getState()).toBe('PAUSED');
    engine.stop();
  });

  it('resume sets state back to RUNNING', async () => {
    const engine = freshInstance();
    await engine.start();
    engine.pause();
    engine.resume();
    expect(engine.getState()).toBe('RUNNING');
    engine.stop();
  });

  it('double start is idempotent', async () => {
    const engine = freshInstance();
    await engine.start();
    await engine.start(); // should not throw
    expect(engine.getState()).toBe('RUNNING');
    engine.stop();
  });
});

// ============================================
// HEALTH SNAPSHOT
// ============================================

describe('BackgroundHealthEngine health snapshot', () => {
  it('getSnapshot returns valid snapshot after start', async () => {
    const engine = freshInstance();
    await engine.start();
    const snapshot = await engine.getSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(typeof snapshot.overallScore).toBe('number');
    expect(snapshot.overallScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.overallScore).toBeLessThanOrEqual(100);
    engine.stop();
  });
});
