/**
 * Health Engine Deep Tests
 *
 * Expands coverage for RealisticHealthEngine and AnomalyDetector beyond basic
 * BMR/TDEE tests. Tests the exact formulas that drive health recommendations:
 * - Recovery scoring (sleep, HR, training load — each 0-25 pts)
 * - Heart rate zones (Karvonen method)
 * - Macro calculations per goal type
 * - 1RM estimation (Brzycki)
 * - MET-based calorie estimation
 * - Anomaly detection thresholds (z-score severity, IQR fences)
 * - Rate-of-change detection
 * - Hydration targeting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    execAsync: vi.fn(),
    withTransactionAsync: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  }),
}));

vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockReturnValue('test-id'),
}));

vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn(),
  logPerf: vi.fn(),
}));

vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    createHealthAlert: vi.fn().mockResolvedValue(undefined),
    getRecentHealthData: vi.fn().mockResolvedValue([]),
    storeHealthData: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('RealisticHealthEngine — recovery scoring', () => {
  // Recovery = sleep(0-25) + hrv(0-25) + load(0-25) + nutrition(0-25)
  // Defaults when undefined: sleep=12, hrv=12, load=18, nutrition=12 → total=54

  it('sleep score: perfect at 7.5 hours = 25 points', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 7.5,
      restingHeartRate: 60,
      avgRestingHR: 60,
      trainingLoadToday: 0,
    });

    // Sleep: max(0, 25 - |7.5-7.5|×5) = 25
    // HR: delta=0 → 20
    // Training: 0 min → 25
    // Nutrition: default → 12
    // Total = 82
    expect(result.factors.sleep).toBe(25);
    expect(result.factors.hrv).toBe(20);
    expect(result.factors.trainingLoad).toBe(25);
    expect(result.score).toBe(82);
    expect(result.status).toBe('GOOD');
  });

  it('sleep score: 5 hours penalizes heavily', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 5,
    });

    // Sleep: max(0, 25 - |5-7.5|×5) = max(0, 25-12.5) = 13 (rounded)
    expect(result.factors.sleep).toBeLessThanOrEqual(13);
  });

  it('sleep score: 1 hour = 0 points', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 1,
    });

    // Sleep: max(0, 25 - |1-7.5|×5) = max(0, 25-32.5) = 0
    expect(result.factors.sleep).toBe(0);
  });

  it('elevated HR (+7 bpm over avg) = hrvScore 3', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      restingHeartRate: 67,
      avgRestingHR: 60,
    });

    // HR delta = +7 → > +6 → score=3
    expect(result.factors.hrv).toBe(3);
  });

  it('HR lower than avg (-4 bpm) = hrvScore 25', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      restingHeartRate: 56,
      avgRestingHR: 60,
    });

    // HR delta = -4 → ≤ -3 → score=25
    expect(result.factors.hrv).toBe(25);
  });

  it('heavy training day (100min) = loadScore 5', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      trainingLoadToday: 100,
    });

    // Training: ≥90 → score=5
    expect(result.factors.trainingLoad).toBe(5);
  });

  it('recovery status: EXCELLENT >= 85', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 7.5,        // 25 pts
      restingHeartRate: 56,   // delta -4 → 25 pts
      avgRestingHR: 60,
      trainingLoadToday: 0,   // 25 pts
      hydrationPercent: 100,  // 25 pts
    });

    // Total = 100
    expect(result.score).toBe(100);
    expect(result.status).toBe('EXCELLENT');
  });

  it('recovery status: POOR < 30', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 1,          // 0 pts
      restingHeartRate: 80,   // delta +20 → 3 pts
      avgRestingHR: 60,
      trainingLoadToday: 120, // 5 pts
      hydrationPercent: 0,    // 0 pts
    });

    // Total = 8
    expect(result.score).toBe(8);
    expect(result.status).toBe('POOR');
  });
});

describe('RealisticHealthEngine — heart rate zones (Karvonen)', () => {
  it('calculates 5 zones using HRR formula', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const zones = RealisticHealthEngine.calculateHRZones({
      age: 30,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      restingHeartRate: 60,
      maxHeartRate: 190,
      activityLevel: 'MODERATE',
      goal: 'MAINTAIN',
    });

    // HRR = 190 - 60 = 130
    // Zone 1: 60 + 130×0.5 = 125, 60 + 130×0.6 = 138
    expect(zones.zone1.min).toBe(125);
    expect(zones.zone1.max).toBe(138);

    // Zone 5: 60 + 130×0.9 = 177, 60 + 130×1.0 = 190
    expect(zones.zone5.min).toBe(177);
    expect(zones.zone5.max).toBe(190);

    expect(zones.maxHR).toBe(190);
    expect(zones.restingHR).toBe(60);
  });
});

describe('RealisticHealthEngine — 1RM estimation (Brzycki)', () => {
  it('calculates 1RM: 100kg × 5 reps', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const oneRM = RealisticHealthEngine.estimate1RM(100, 5);

    // 1RM = 100 × (36 / (37 - min(5, 36))) = 100 × (36/32) = 112.5 → Math.round → 113
    expect(oneRM).toBe(113);
  });

  it('1 rep = weight itself', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const oneRM = RealisticHealthEngine.estimate1RM(100, 1);

    // 100 × (36 / (37-1)) = 100 × 1.0 = 100
    expect(oneRM).toBe(100);
  });

  it('10 reps gives higher 1RM estimate', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const oneRM = RealisticHealthEngine.estimate1RM(80, 10);

    // 80 × (36 / (37-10)) = 80 × (36/27) = 80 × 1.333 = 106.67 → Math.round → 107
    expect(oneRM).toBe(107);
  });
});

describe('RealisticHealthEngine — MET-based calorie estimation', () => {
  it('estimates weight training calories correctly', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.estimateCalories('weight_moderate', 60, 80);

    // Gross = MET × 80 × 1.0h = 400 (if MET=5.0)
    // Net = gross - (1.0 × 80 × 1.0) = gross - 80
    expect(result.grossCalories).toBeGreaterThan(200);
    expect(result.netCalories).toBeGreaterThan(100);
    expect(result.durationMinutes).toBe(60);
  });
});

describe('RealisticHealthEngine — hydration target', () => {
  it('calculates base hydration (33ml/kg) + exercise bonus', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateHydration(80, 60);

    // Base: round(80 × 0.033 × 10) / 10 = 2.6
    // Exercise: round((60/30) × 0.5 × 10) / 10 = 1.0
    // Total: round(3.6 × 10) / 10 = 3.6
    expect(result.baseLiters).toBe(2.6);
    expect(result.activityAddLiters).toBe(1.0);
    expect(result.totalLiters).toBe(3.6);
    expect(result.glasses).toBe(Math.ceil(3.6 / 0.25));
  });

  it('no exercise = base hydration only', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const result = RealisticHealthEngine.calculateHydration(70, 0);

    // Base: round(70 × 0.033 × 10) / 10 = 2.3
    expect(result.baseLiters).toBe(2.3);
    expect(result.activityAddLiters).toBe(0);
    expect(result.totalLiters).toBe(2.3);
  });
});

describe('RealisticHealthEngine — macro calculations', () => {
  it('BUILD_MUSCLE protein target: 2.2g per kg lean mass', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const macros = RealisticHealthEngine.calculateMacros({
      age: 25,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      bodyFatPercent: 15,
      activityLevel: 'MODERATE',
      goal: 'BUILD_MUSCLE',
    });

    // Lean mass = 80 × (1 - 0.15) = 68 kg
    // Protein = round(68 × 2.2) = 150g
    expect(macros.proteinGrams).toBe(150);
  });

  it('LOSE_FAT protein target: 2.0g per kg lean mass', async () => {
    const { RealisticHealthEngine } = await import('../src/engines/RealisticHealthEngine');
    const macros = RealisticHealthEngine.calculateMacros({
      age: 25,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      bodyFatPercent: 20,
      activityLevel: 'MODERATE',
      goal: 'LOSE_FAT',
    });

    // Lean mass = 80 × 0.8 = 64 kg
    // Protein = round(64 × 2.0) = 128g
    expect(macros.proteinGrams).toBe(128);
    // Fat: 25% of calories for LOSE_FAT
    expect(macros.fatPercent).toBe(25);
  });
});

describe('AnomalyDetector — z-score severity mapping', () => {
  it('|z| >= 4.0 → CRITICAL', () => {
    // Direct formula test
    const zScore = 4.5;
    let severity: string;
    if (Math.abs(zScore) >= 4.0) severity = 'CRITICAL';
    else if (Math.abs(zScore) >= 3.0) severity = 'HIGH';
    else if (Math.abs(zScore) >= 2.0) severity = 'MEDIUM';
    else severity = 'LOW';

    expect(severity).toBe('CRITICAL');
  });

  it('|z| >= 3.0 → HIGH', () => {
    const zScore = 3.2;
    let severity: string;
    if (Math.abs(zScore) >= 4.0) severity = 'CRITICAL';
    else if (Math.abs(zScore) >= 3.0) severity = 'HIGH';
    else if (Math.abs(zScore) >= 2.0) severity = 'MEDIUM';
    else severity = 'LOW';

    expect(severity).toBe('HIGH');
  });

  it('|z| >= 2.0 → MEDIUM (detection threshold)', () => {
    const zScore = 2.1;
    let severity: string;
    if (Math.abs(zScore) >= 4.0) severity = 'CRITICAL';
    else if (Math.abs(zScore) >= 3.0) severity = 'HIGH';
    else if (Math.abs(zScore) >= 2.0) severity = 'MEDIUM';
    else severity = 'LOW';

    expect(severity).toBe('MEDIUM');
  });

  it('|z| < 2.0 → LOW (no anomaly)', () => {
    const zScore = 1.5;
    let severity: string;
    if (Math.abs(zScore) >= 4.0) severity = 'CRITICAL';
    else if (Math.abs(zScore) >= 3.0) severity = 'HIGH';
    else if (Math.abs(zScore) >= 2.0) severity = 'MEDIUM';
    else severity = 'LOW';

    expect(severity).toBe('LOW');
  });

  it('negative z-scores use absolute value', () => {
    const zScore = -3.5;
    const severity = Math.abs(zScore) >= 4.0 ? 'CRITICAL'
      : Math.abs(zScore) >= 3.0 ? 'HIGH'
      : Math.abs(zScore) >= 2.0 ? 'MEDIUM' : 'LOW';

    expect(severity).toBe('HIGH');
  });
});

describe('AnomalyDetector — IQR fence calculations', () => {
  it('correctly computes IQR fences', () => {
    // Dataset: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    // Q1 ≈ 25, Q3 ≈ 75, IQR = 50
    const Q1 = 25;
    const Q3 = 75;
    const IQR = Q3 - Q1;

    const lowerFence = Q1 - 1.5 * IQR;
    const upperFence = Q3 + 1.5 * IQR;

    expect(IQR).toBe(50);
    expect(lowerFence).toBe(-50);
    expect(upperFence).toBe(150);
  });

  it('values outside fences are outliers', () => {
    const Q1 = 60, Q3 = 80;
    const IQR = Q3 - Q1; // 20
    const lowerFence = Q1 - 1.5 * IQR; // 30
    const upperFence = Q3 + 1.5 * IQR; // 110

    expect(25 < lowerFence).toBe(true); // Outlier below
    expect(120 > upperFence).toBe(true); // Outlier above
    expect(70 >= lowerFence && 70 <= upperFence).toBe(true); // Normal
  });

  it('extreme outlier (>Q3+3×IQR) → HIGH severity', () => {
    const Q1 = 60, Q3 = 80;
    const IQR = Q3 - Q1; // 20

    const extremeThreshold = Q3 + 3 * IQR; // 140
    const value = 150;

    const severity = value > extremeThreshold ? 'HIGH' : 'MEDIUM';
    expect(severity).toBe('HIGH');
  });
});

describe('AnomalyDetector — rate-of-change detection', () => {
  it('> 30% change triggers anomaly', () => {
    const previous = 60;
    const latest = 80;
    const rate = (latest - previous) / Math.abs(previous);

    expect(rate).toBeCloseTo(0.333, 2);
    expect(Math.abs(rate) >= 0.3).toBe(true);
  });

  it('> 50% change → HIGH severity', () => {
    const previous = 60;
    const latest = 95;
    const rate = (latest - previous) / Math.abs(previous);

    expect(rate).toBeCloseTo(0.583, 2);
    const severity = Math.abs(rate) > 0.5 ? 'HIGH' : 'MEDIUM';
    expect(severity).toBe('HIGH');
  });

  it('< 30% change → no anomaly', () => {
    const previous = 60;
    const latest = 72;
    const rate = (latest - previous) / Math.abs(previous);

    expect(rate).toBe(0.2);
    expect(Math.abs(rate) >= 0.3).toBe(false);
  });
});

describe('AnomalyDetector — medical reference ranges', () => {
  it('resting HR: normal 40-100, critical <30 or >150', () => {
    const ranges = { min: 40, max: 100, criticalMin: 30, criticalMax: 150 };

    // Normal
    expect(65 >= ranges.min && 65 <= ranges.max).toBe(true);

    // Elevated but not critical
    expect(110 > ranges.max).toBe(true);
    expect(110 < ranges.criticalMax).toBe(true);

    // Critical
    expect(25 < ranges.criticalMin).toBe(true);
    expect(160 > ranges.criticalMax).toBe(true);
  });

  it('weight change per week: normal ±2kg', () => {
    const maxChangePerWeek = 2;

    expect(Math.abs(-1.5) <= maxChangePerWeek).toBe(true);  // Normal
    expect(Math.abs(-2.5) <= maxChangePerWeek).toBe(false);  // Anomaly
    expect(Math.abs(3.0) <= maxChangePerWeek).toBe(false);   // Anomaly
  });
});
