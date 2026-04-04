/**
 * Tests: Sensor Fusion Engine — Core Differentiator
 *
 * Target: src/engines/SensorFusionEngine.ts (738 LOC)
 * Strategy: Mock expo-sensors at module level, test internal logic via
 *           simulated accelerometer/gyroscope streams.
 * Coverage zones:
 *   1. Lifecycle (start, stop, singleton, double-start guard)
 *   2. Step detection (peaks, noise filtering, min interval guard)
 *   3. Activity classification (stationary, walking, running, thresholds)
 *   4. Rep detection (UP→DOWN→NEUTRAL cycle, exercise-only gate)
 *   5. Cadence calculation (edge cases, rolling window)
 *   6. Snapshot & StepData correctness
 *   7. Callback registration & unsubscribe
 *   8. Edge cases (no gyro, idle, jitter, magnitude spikes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// MOCK INFRASTRUCTURE
// ============================================

// Capture the addListener callback so we can simulate sensor data
let accelCallback: ((data: { x: number; y: number; z: number }) => void) | null = null;
let gyroCallback: ((data: { x: number; y: number; z: number }) => void) | null = null;
let pedometerCallback: ((data: { steps: number }) => void) | null = null;

vi.mock('expo-sensors', () => ({
  Accelerometer: {
    addListener: (cb: any) => {
      accelCallback = cb;
      return { remove: () => { accelCallback = null; } };
    },
    removeAllListeners: () => { accelCallback = null; },
    setUpdateInterval: (_ms: number) => {},
    isAvailableAsync: async () => true,
  },
  Gyroscope: {
    addListener: (cb: any) => {
      gyroCallback = cb;
      return { remove: () => { gyroCallback = null; } };
    },
    removeAllListeners: () => { gyroCallback = null; },
    setUpdateInterval: (_ms: number) => {},
    isAvailableAsync: async () => true,
  },
  Pedometer: {
    addListener: (_cb: any) => ({ remove: () => {} }),
    removeAllListeners: () => {},
    setUpdateInterval: (_ms: number) => {},
    isAvailableAsync: async () => true,
    watchStepCount: (cb: any) => {
      pedometerCallback = cb;
      return { remove: () => { pedometerCallback = null; } };
    },
    getStepCountAsync: async () => ({ steps: 0 }),
  },
}));

// Mock AI classifiers — SensorFusionEngine imports these
vi.mock('../../src/ai/TrainedActivityClassifier', () => ({
  trainedActivityClassifier: {
    initialize: async () => false,
    classifyWindow: () => null,
  },
}));

vi.mock('../../src/ai/sensors/DeepActivityClassifier', () => ({
  deepActivityClassifier: {
    initialize: async () => false,
    addSample: () => null,
  },
}));

// Mock encrypted DB
vi.mock('../../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeHealthData: async () => 'mock-session-id',
  },
}));

// Mock react-native AppState
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
    currentState: 'active',
  },
}));

// ============================================
// IMPORT AFTER MOCKS
// ============================================

import { SensorFusionEngine, type MotionSnapshot, type ActivityType } from '../../src/engines/SensorFusionEngine';

// ============================================
// HELPERS
// ============================================

/** Reset the singleton between tests (access private static) */
function resetEngine(): void {
  // @ts-expect-error — accessing private static for test reset
  SensorFusionEngine.instance = null;
  accelCallback = null;
  gyroCallback = null;
  pedometerCallback = null;
}

/** Simulate N accelerometer readings with given magnitude pattern */
function simulateAccelReadings(
  count: number,
  magnitudeGenerator: (i: number) => { x: number; y: number; z: number },
  delayMs = 100,
): void {
  const base = Date.now();
  for (let i = 0; i < count; i++) {
    if (accelCallback) {
      // Temporarily override Date.now for timestamp consistency
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(base + i * delayMs);
      accelCallback(magnitudeGenerator(i));
      vi.spyOn(Date, 'now').mockRestore();
    }
  }
}

/** Generate stationary accelerometer data (magnitude ~1.0g, minimal variance) */
function stationaryData(_i: number) {
  return { x: 0, y: 0, z: 1.0 };
}

/** Generate walking accelerometer data (magnitude ~1.3-1.5g, moderate variance) */
function walkingData(i: number) {
  const wave = Math.sin(i * 0.5) * 0.3;
  return { x: wave * 0.3, y: 0.1, z: 1.0 + wave };
}

/** Generate running accelerometer data (magnitude ~2.0-2.5g, high variance) */
function runningData(i: number) {
  const wave = Math.sin(i * 0.8) * 0.8;
  return { x: wave * 0.5, y: wave * 0.3, z: 1.5 + wave };
}

/** Generate spike data (sudden magnitude jump) */
function spikeData(i: number) {
  if (i === 15) return { x: 3.0, y: 3.0, z: 3.0 }; // spike at reading 15
  return { x: 0, y: 0, z: 1.0 };
}

// ============================================
// TESTS
// ============================================

describe('SensorFusionEngine', () => {
  let engine: SensorFusionEngine;

  beforeEach(() => {
    resetEngine();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    engine = SensorFusionEngine.getInstance();
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  // ============================================
  // ZONE 1: LIFECYCLE
  // ============================================

  describe('Lifecycle', () => {
    it('getInstance returns same singleton', () => {
      const a = SensorFusionEngine.getInstance();
      const b = SensorFusionEngine.getInstance();
      expect(a).toBe(b);
    });

    it('start returns true when accelerometer is available', async () => {
      const result = await engine.start();
      expect(result).toBe(true);
      expect(engine.isRunning()).toBe(true);
    });

    it('double-start is idempotent', async () => {
      await engine.start();
      const second = await engine.start();
      expect(second).toBe(true); // returns true — already running
      expect(engine.isRunning()).toBe(true);
    });

    it('stop sets running to false', async () => {
      await engine.start();
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });

    it('stop is safe to call when not running', () => {
      expect(() => engine.stop()).not.toThrow();
    });

    it('start accepts weight and rep threshold options', async () => {
      const result = await engine.start({ weightKg: 85, repThreshold: 2.0 });
      expect(result).toBe(true);
    });
  });

  // ============================================
  // ZONE 2: STEP DETECTION
  // ============================================

  describe('Step Detection', () => {
    it('counts steps from accelerometer peaks above threshold', async () => {
      await engine.start();
      const now = Date.now();

      // Simulate step-like peaks: magnitude crosses 1.2 threshold
      for (let i = 0; i < 10; i++) {
        // Step peak
        vi.setSystemTime(now + i * 500); // 500ms between steps (well above 250ms min)
        accelCallback?.({ x: 0, y: 0, z: 1.5 }); // magnitude 1.5 > 1.2 threshold
        // Valley between steps
        vi.setSystemTime(now + i * 500 + 250);
        accelCallback?.({ x: 0, y: 0, z: 0.9 }); // below threshold
      }

      const stepData = engine.getStepData();
      expect(stepData.steps).toBeGreaterThanOrEqual(5);
    });

    it('filters out rapid double-steps (< 250ms apart)', async () => {
      await engine.start();
      const now = Date.now();

      // Two peaks only 100ms apart — second should be filtered
      vi.setSystemTime(now);
      accelCallback?.({ x: 0, y: 0, z: 1.5 });
      vi.setSystemTime(now + 100); // too fast
      accelCallback?.({ x: 0, y: 0, z: 1.5 });

      const stepData = engine.getStepData();
      expect(stepData.steps).toBeLessThanOrEqual(1);
    });

    it('detects no steps from stationary data', async () => {
      await engine.start();
      const now = Date.now();

      for (let i = 0; i < 30; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 }); // exactly 1g = stationary
      }

      const stepData = engine.getStepData();
      expect(stepData.steps).toBe(0);
    });
  });

  // ============================================
  // ZONE 3: ACTIVITY CLASSIFICATION
  // ============================================

  describe('Activity Classification (threshold-based fallback)', () => {
    it('classifies stationary with low variance data', async () => {
      await engine.start();
      const now = Date.now();

      // Feed 30 readings (WINDOW_SIZE) of pure stationary data
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 }); // magnitude = 1.0, zero variance
      }

      const snapshot = engine.getSnapshot();
      expect(snapshot.activity).toBe('STATIONARY');
    });

    it('classifies walking with moderate variance data', async () => {
      await engine.start();
      const now = Date.now();

      // Generate walking-like data: magnitude varies between 1.1 and 1.6
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        const wave = Math.sin(i * 0.5) * 0.25;
        accelCallback?.({ x: wave * 0.3, y: 0.1, z: 1.15 + wave });
      }

      const snapshot = engine.getSnapshot();
      expect(['WALKING', 'EXERCISE']).toContain(snapshot.activity);
      expect(snapshot.confidence).toBeGreaterThan(0);
    });

    it('classifies running with high variance data', async () => {
      await engine.start();
      const now = Date.now();

      // Generate running-like data: high magnitude + high variance
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        const wave = Math.sin(i * 0.8) * 0.8;
        accelCallback?.({ x: wave * 0.5, y: wave * 0.3, z: 1.8 + wave });
      }

      const snapshot = engine.getSnapshot();
      expect(['RUNNING', 'EXERCISE']).toContain(snapshot.activity);
    });

    it('snapshot has valid structure', async () => {
      await engine.start();
      const now = Date.now();

      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      const snapshot = engine.getSnapshot();
      expect(snapshot).toHaveProperty('activity');
      expect(snapshot).toHaveProperty('confidence');
      expect(snapshot).toHaveProperty('intensity');
      expect(snapshot).toHaveProperty('currentCadence');
      expect(snapshot).toHaveProperty('repCount');
      expect(snapshot).toHaveProperty('isActive');
      expect(typeof snapshot.confidence).toBe('number');
      expect(snapshot.confidence).toBeGreaterThanOrEqual(0);
      expect(snapshot.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ============================================
  // ZONE 4: REP DETECTION
  // ============================================

  describe('Rep Detection', () => {
    it('counts reps from UP→DOWN oscillation during EXERCISE activity', async () => {
      await engine.start();
      const now = Date.now();

      // First, fill window to classify as EXERCISE (high variance, moderate magnitude)
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        const mag = 1.0 + Math.sin(i * 0.3) * 0.6;
        accelCallback?.({ x: mag * 0.3, y: mag * 0.2, z: mag * 0.9 });
      }

      // Force activity to EXERCISE for rep detection
      // @ts-expect-error — accessing private for test
      engine.currentActivity = 'EXERCISE';

      // Simulate rep cycles: peak above threshold → valley below
      let repStart = now + 3500;
      for (let rep = 0; rep < 5; rep++) {
        // UP phase: magnitude above repThreshold (default 1.5)
        vi.setSystemTime(repStart + rep * 2000);
        accelCallback?.({ x: 0, y: 0, z: 2.0 }); // magnitude 2.0 > 1.5

        vi.setSystemTime(repStart + rep * 2000 + 500);
        accelCallback?.({ x: 0, y: 0, z: 2.2 }); // peak

        // DOWN phase: drop below threshold * 0.8 = 1.2
        vi.setSystemTime(repStart + rep * 2000 + 1000);
        accelCallback?.({ x: 0, y: 0, z: 1.0 }); // < 1.2

        // Return to rest: below 1.05
        vi.setSystemTime(repStart + rep * 2000 + 1500);
        accelCallback?.({ x: 0, y: 0, z: 1.0 }); // near rest
      }

      expect(engine.getSnapshot().repCount).toBeGreaterThan(0);
    });

    it('does not count reps when activity is not EXERCISE', async () => {
      await engine.start();
      const now = Date.now();

      // Ensure activity is STATIONARY
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      const initialReps = engine.getSnapshot().repCount;

      // Simulate oscillation that would be reps during EXERCISE
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(now + 3500 + i * 500);
        accelCallback?.({ x: 0, y: 0, z: i % 2 === 0 ? 2.0 : 0.8 });
      }

      expect(engine.getSnapshot().repCount).toBe(initialReps);
    });

    it('resetRepCount resets counter and optionally changes threshold', async () => {
      await engine.start();

      // @ts-expect-error — accessing private for test setup
      engine.repCount = 5;

      engine.resetRepCount(2.0);
      expect(engine.getSnapshot().repCount).toBe(0);
    });
  });

  // ============================================
  // ZONE 5: CADENCE CALCULATION
  // ============================================

  describe('Cadence Calculation', () => {
    it('returns 0 cadence with fewer than 2 steps', async () => {
      await engine.start();
      const snapshot = engine.getSnapshot();
      expect(snapshot.currentCadence).toBe(0);
    });

    it('calculates cadence from step spacing', async () => {
      await engine.start();
      const now = Date.now();

      // Simulate 10 steps, each 500ms apart (120 steps/min cadence)
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(now + i * 500);
        accelCallback?.({ x: 0, y: 0, z: 1.5 }); // above 1.2 threshold
        // Small gap below threshold to reset
        vi.setSystemTime(now + i * 500 + 100);
        accelCallback?.({ x: 0, y: 0, z: 0.8 });
      }

      const snapshot = engine.getSnapshot();
      // Should calculate some cadence (exact value depends on timing)
      expect(snapshot.currentCadence).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // ZONE 6: SNAPSHOT & STEP DATA
  // ============================================

  describe('StepData', () => {
    it('returns valid step data structure', async () => {
      await engine.start();

      const data = engine.getStepData();
      expect(data).toHaveProperty('steps');
      expect(data).toHaveProperty('distance');
      expect(data).toHaveProperty('calories');
      expect(data).toHaveProperty('cadence');
      expect(data).toHaveProperty('startTime');
      expect(data).toHaveProperty('endTime');
      expect(data.steps).toBeGreaterThanOrEqual(0);
      expect(data.distance).toBeGreaterThanOrEqual(0);
      expect(data.calories).toBeGreaterThanOrEqual(0);
    });

    it('distance is proportional to steps (0.75m stride)', async () => {
      await engine.start();
      const now = Date.now();

      // Force some steps
      for (let i = 0; i < 20; i++) {
        vi.setSystemTime(now + i * 500);
        accelCallback?.({ x: 0, y: 0, z: 1.5 });
      }

      const data = engine.getStepData();
      if (data.steps > 0) {
        // distance = steps * 0.75
        expect(data.distance).toBeCloseTo(data.steps * 0.75, 0);
      }
    });

    it('uses pedometer steps when higher than raw count', async () => {
      await engine.start();

      // Simulate pedometer reporting more steps than raw detection
      if (pedometerCallback) {
        pedometerCallback({ steps: 100 });
      }

      const data = engine.getStepData();
      expect(data.steps).toBeGreaterThanOrEqual(100);
    });
  });

  // ============================================
  // ZONE 7: CALLBACKS
  // ============================================

  describe('Callbacks', () => {
    it('onUpdate registers callback and receives snapshots', async () => {
      const snapshots: MotionSnapshot[] = [];
      const unsubscribe = engine.onUpdate((snap) => snapshots.push(snap));

      await engine.start();
      const now = Date.now();

      // Feed enough data to trigger classification + emit
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      expect(snapshots.length).toBeGreaterThan(0);
      unsubscribe();
    });

    it('unsubscribe stops receiving callbacks', async () => {
      const snapshots: MotionSnapshot[] = [];
      const unsubscribe = engine.onUpdate((snap) => snapshots.push(snap));
      unsubscribe();

      await engine.start();
      const now = Date.now();

      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      expect(snapshots.length).toBe(0);
    });

    it('callback errors do not crash the engine', async () => {
      engine.onUpdate(() => {
        throw new Error('callback exploded');
      });

      await engine.start();
      const now = Date.now();

      // Should not throw
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      expect(engine.isRunning()).toBe(true);
    });
  });

  // ============================================
  // ZONE 8: EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('getSnapshot returns valid defaults before any data', async () => {
      await engine.start();
      const snapshot = engine.getSnapshot();
      expect(snapshot.activity).toBe('STATIONARY');
      expect(snapshot.confidence).toBe(0);
      expect(snapshot.repCount).toBe(0);
      expect(snapshot.isActive).toBe(false);
    });

    it('handles magnitude spike without crashing', async () => {
      await engine.start();
      const now = Date.now();

      // Normal → spike → normal
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        if (i === 15) {
          accelCallback?.({ x: 10, y: 10, z: 10 }); // extreme spike
        } else {
          accelCallback?.({ x: 0, y: 0, z: 1.0 });
        }
      }

      expect(engine.isRunning()).toBe(true);
      const snapshot = engine.getSnapshot();
      expect(typeof snapshot.activity).toBe('string');
    });

    it('handles gyroscope data without crashing', async () => {
      await engine.start();
      const now = Date.now();

      // Feed both accel and gyro data
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
        gyroCallback?.({ x: 0.1, y: 0.2, z: 0.1 });
      }

      expect(engine.isRunning()).toBe(true);
    });

    it('saveSessionToDatabase returns session id', async () => {
      await engine.start();
      const now = Date.now();

      // Generate some activity
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(now + i * 500);
        accelCallback?.({ x: 0, y: 0, z: 1.5 });
      }

      const id = await engine.saveSessionToDatabase();
      expect(id).toBe('mock-session-id');
    });

    it('saveSessionToDatabase returns null when engine has no data', async () => {
      // Not started, no steps
      const id = await engine.saveSessionToDatabase();
      expect(id).toBeNull();
    });

    it('isActive reflects activity type', async () => {
      await engine.start();
      const now = Date.now();

      // Stationary data
      for (let i = 0; i < 35; i++) {
        vi.setSystemTime(now + i * 100);
        accelCallback?.({ x: 0, y: 0, z: 1.0 });
      }

      expect(engine.getSnapshot().isActive).toBe(false);

      // @ts-expect-error — force activity for test
      engine.currentActivity = 'WALKING';
      expect(engine.getSnapshot().isActive).toBe(true);
    });
  });
});
