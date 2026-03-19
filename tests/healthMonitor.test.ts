import { describe, expect, it, vi, beforeEach } from 'vitest';

// ============================================
// MOCK DEPENDENCIES
// ============================================

vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeHealthData: vi.fn(() => Promise.resolve()),
    getRecentHealthData: vi.fn(() => Promise.resolve([])),
    createHealthAlert: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../src/database/service', () => ({
  getAppState: vi.fn(() => Promise.resolve(null)),
  setAppState: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/engines/SensorFusionEngine', () => ({
  SensorFusionEngine: {
    getInstance: () => ({
      onUpdate: vi.fn(() => () => {}),
      getStepData: vi.fn(() => ({ steps: 0, calories: 0, distance: 0 })),
    }),
  },
}));

import { HealthMonitorService } from '../src/engines/HealthMonitor';
import { encryptedDB } from '../src/security/EncryptedDatabase';
import { getAppState, setAppState } from '../src/database/service';

// ============================================
// HELPERS
// ============================================

function freshInstance(): HealthMonitorService {
  // @ts-expect-error — reset singleton for test isolation
  HealthMonitorService.instance = null;
  return HealthMonitorService.getInstance();
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// SINGLETON
// ============================================

describe('HealthMonitorService singleton', () => {
  it('returns same instance on repeated calls', () => {
    const a = HealthMonitorService.getInstance();
    const b = HealthMonitorService.getInstance();
    expect(a).toBe(b);
  });
});

// ============================================
// INITIALIZATION
// ============================================

describe('HealthMonitorService.initialize', () => {
  it('initializes without errors', async () => {
    const monitor = freshInstance();
    await expect(monitor.initialize()).resolves.not.toThrow();
  });

  it('loads saved goals on init', async () => {
    const customGoals = { dailySteps: 15000, dailyCalories: 800 };
    vi.mocked(getAppState).mockResolvedValueOnce(JSON.stringify(customGoals));
    const monitor = freshInstance();
    await monitor.initialize();
    const goals = monitor.getGoals();
    expect(goals.dailySteps).toBe(15000);
    expect(goals.dailyCalories).toBe(800);
  });

  it('uses default goals when no saved goals exist', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    const goals = monitor.getGoals();
    expect(goals.dailySteps).toBe(10000);
    expect(goals.dailyCalories).toBe(500);
    expect(goals.dailyActiveMinutes).toBe(30);
    expect(goals.weeklyWorkouts).toBe(4);
  });

  it('is idempotent (double init is safe)', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    await monitor.initialize();
    // getAppState called only once (second init is no-op)
    expect(getAppState).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// GOALS
// ============================================

describe('HealthMonitorService goals', () => {
  it('setGoals persists to app_state', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    await monitor.setGoals({ dailySteps: 20000 });
    expect(setAppState).toHaveBeenCalledWith(
      'health_goals',
      expect.stringContaining('"dailySteps":20000')
    );
  });

  it('setGoals merges with existing goals', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    await monitor.setGoals({ dailySteps: 20000 });
    const goals = monitor.getGoals();
    expect(goals.dailySteps).toBe(20000);
    expect(goals.dailyCalories).toBe(500); // default preserved
  });

  it('getGoalProgress returns 0 when no activity', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    const progress = monitor.getGoalProgress();
    expect(progress.steps).toBe(0);
    expect(progress.calories).toBe(0);
    expect(progress.activeMinutes).toBe(0);
  });
});

// ============================================
// TODAY SUMMARY
// ============================================

describe('HealthMonitorService today summary', () => {
  it('returns initial zero summary', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    const summary = monitor.getTodaySummary();
    expect(summary.totalSteps).toBe(0);
    expect(summary.totalCalories).toBe(0);
    expect(summary.activeMinutes).toBe(0);
    expect(summary.workoutCount).toBe(0);
    expect(summary.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('recordWorkoutComplete updates today totals', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    monitor.recordWorkoutComplete({
      durationMinutes: 45,
      exerciseCount: 8,
      caloriesBurned: 350,
      intensity: 7,
    });
    const summary = monitor.getTodaySummary();
    expect(summary.workoutCount).toBe(1);
    expect(summary.totalCalories).toBe(350);
    expect(summary.activeMinutes).toBe(45);
  });

  it('accumulates multiple workouts', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    monitor.recordWorkoutComplete({
      durationMinutes: 30,
      exerciseCount: 5,
      caloriesBurned: 200,
      intensity: 6,
    });
    monitor.recordWorkoutComplete({
      durationMinutes: 20,
      exerciseCount: 3,
      caloriesBurned: 150,
      intensity: 5,
    });
    const summary = monitor.getTodaySummary();
    expect(summary.workoutCount).toBe(2);
    expect(summary.totalCalories).toBe(350);
    expect(summary.activeMinutes).toBe(50);
  });
});

// ============================================
// MANUAL METRICS
// ============================================

describe('HealthMonitorService manual metrics', () => {
  it('stores manual health data encrypted', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    await monitor.logManualMetrics({
      restingHeartRate: 62,
      sleepHours: 7.5,
      hydrationLiters: 2.0,
      moodScore: 4,
    });
    expect(encryptedDB.storeHealthData).toHaveBeenCalledWith(
      'manual_metrics',
      expect.objectContaining({
        restingHeartRate: 62,
        sleepHours: 7.5,
        hydrationLiters: 2.0,
        moodScore: 4,
      })
    );
  });
});

// ============================================
// WEEKLY SUMMARY
// ============================================

describe('HealthMonitorService weekly summary', () => {
  it('returns null when no daily data exists', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    const weekly = await monitor.getWeeklySummary();
    expect(weekly).toBeNull();
  });

  it('computes weekly trend from daily data', async () => {
    // First call: loadTodaySummary during initialize() consumes one getRecentHealthData call
    vi.mocked(encryptedDB.getRecentHealthData).mockResolvedValueOnce([]); // init load
    // Second call: getWeeklySummary → getDailySummaries
    vi.mocked(encryptedDB.getRecentHealthData).mockResolvedValueOnce([
      { date: '2025-01-01', totalSteps: 3000, totalCalories: 200, workoutCount: 0, activeMinutes: 10 },
      { date: '2025-01-02', totalSteps: 3500, totalCalories: 250, workoutCount: 0, activeMinutes: 15 },
      { date: '2025-01-03', totalSteps: 4000, totalCalories: 300, workoutCount: 1, activeMinutes: 20 },
      { date: '2025-01-04', totalSteps: 8000, totalCalories: 400, workoutCount: 1, activeMinutes: 30 },
      { date: '2025-01-05', totalSteps: 10000, totalCalories: 500, workoutCount: 1, activeMinutes: 45 },
      { date: '2025-01-06', totalSteps: 12000, totalCalories: 600, workoutCount: 2, activeMinutes: 60 },
    ] as any);
    const monitor = freshInstance();
    await monitor.initialize();
    const weekly = await monitor.getWeeklySummary();
    expect(weekly).not.toBeNull();
    expect(weekly!.trend).toBe('IMPROVING');
    expect(weekly!.totalWorkouts).toBe(5);
    expect(weekly!.avgDailySteps).toBeGreaterThan(0);
  });
});

// ============================================
// SHUTDOWN
// ============================================

describe('HealthMonitorService shutdown', () => {
  it('saves today summary and cleans up', async () => {
    const monitor = freshInstance();
    await monitor.initialize();
    monitor.recordWorkoutComplete({
      durationMinutes: 30,
      exerciseCount: 5,
      caloriesBurned: 200,
      intensity: 6,
    });
    await monitor.shutdown();
    expect(encryptedDB.storeHealthData).toHaveBeenCalledWith(
      'daily_summary',
      expect.objectContaining({
        totalCalories: 200,
        activeMinutes: 30,
        workoutCount: 1,
      })
    );
  });
});
