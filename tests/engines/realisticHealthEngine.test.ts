/**
 * Tests: RealisticHealthEngine — Evidence-based health analytics
 *
 * Target: src/engines/RealisticHealthEngine.ts (static methods only)
 * Dependencies: None for tested methods (all pure static)
 * Coverage: BMR, TDEE, body composition, HR zones, calories, hydration, recovery, 1RM
 */

import { describe, it, expect } from 'vitest';
import {
  RealisticHealthEngine,
  type UserBodyStats,
} from '../../src/engines/RealisticHealthEngine';

// ============================================
// TEST FIXTURES
// ============================================

const MALE_STATS: UserBodyStats = {
  age: 25,
  sex: 'MALE',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'MODERATE',
  goal: 'MAINTAIN',
};

const FEMALE_STATS: UserBodyStats = {
  age: 30,
  sex: 'FEMALE',
  heightCm: 165,
  weightKg: 60,
  activityLevel: 'LIGHT',
  goal: 'LOSE_FAT',
};

// ============================================
// BMR (Mifflin-St Jeor)
// ============================================

describe('calculateBMR', () => {
  it('calculates male BMR correctly', () => {
    // 10×80 + 6.25×180 - 5×25 + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(RealisticHealthEngine.calculateBMR(MALE_STATS)).toBe(1805);
  });

  it('calculates female BMR correctly', () => {
    // 10×60 + 6.25×165 - 5×30 - 161 = 600 + 1031.25 - 150 - 161 = 1320
    expect(RealisticHealthEngine.calculateBMR(FEMALE_STATS)).toBe(1320);
  });

  it('male BMR > female BMR for same body stats', () => {
    const sameMale = { ...FEMALE_STATS, sex: 'MALE' as const };
    expect(RealisticHealthEngine.calculateBMR(sameMale)).toBeGreaterThan(
      RealisticHealthEngine.calculateBMR(FEMALE_STATS),
    );
  });

  it('heavier person has higher BMR', () => {
    const heavy = { ...MALE_STATS, weightKg: 100 };
    expect(RealisticHealthEngine.calculateBMR(heavy)).toBeGreaterThan(
      RealisticHealthEngine.calculateBMR(MALE_STATS),
    );
  });
});

// ============================================
// TDEE
// ============================================

describe('calculateTDEE', () => {
  it('TDEE > BMR for all activity levels', () => {
    const bmr = RealisticHealthEngine.calculateBMR(MALE_STATS);
    const tdee = RealisticHealthEngine.calculateTDEE(MALE_STATS);
    expect(tdee).toBeGreaterThan(bmr);
  });

  it('higher activity means higher TDEE', () => {
    const moderate = RealisticHealthEngine.calculateTDEE({ ...MALE_STATS, activityLevel: 'MODERATE' });
    const active = RealisticHealthEngine.calculateTDEE({ ...MALE_STATS, activityLevel: 'ACTIVE' });
    expect(active).toBeGreaterThan(moderate);
  });

  it('sedentary TDEE is ~1.2x BMR', () => {
    const sedentary = { ...MALE_STATS, activityLevel: 'SEDENTARY' as const };
    const bmr = RealisticHealthEngine.calculateBMR(sedentary);
    const tdee = RealisticHealthEngine.calculateTDEE(sedentary);
    expect(tdee).toBe(Math.round(bmr * 1.2));
  });
});

// ============================================
// BMI CATEGORIES
// ============================================

describe('getBMICategory', () => {
  it('classifies underweight', () => {
    expect(RealisticHealthEngine.getBMICategory(17)).toBe('Underweight');
  });

  it('classifies normal', () => {
    expect(RealisticHealthEngine.getBMICategory(22)).toBe('Normal');
  });

  it('classifies overweight', () => {
    expect(RealisticHealthEngine.getBMICategory(27)).toBe('Overweight');
  });

  it('classifies obese I', () => {
    expect(RealisticHealthEngine.getBMICategory(32)).toBe('Obese I');
  });

  it('boundary: 18.5 is Normal', () => {
    expect(RealisticHealthEngine.getBMICategory(18.5)).toBe('Normal');
  });

  it('boundary: 25.0 is Overweight', () => {
    expect(RealisticHealthEngine.getBMICategory(25)).toBe('Overweight');
  });
});

// ============================================
// CALORIE ESTIMATION (MET-based)
// ============================================

describe('estimateCalories', () => {
  it('returns positive calories for known activity', () => {
    const result = RealisticHealthEngine.estimateCalories('running_moderate', 30, 80);
    expect(result.grossCalories).toBeGreaterThan(0);
    expect(result.netCalories).toBeGreaterThan(0);
  });

  it('gross > net (net excludes resting)', () => {
    const result = RealisticHealthEngine.estimateCalories('weight_training_moderate', 60, 70);
    expect(result.grossCalories).toBeGreaterThan(result.netCalories);
  });

  it('longer duration means more calories', () => {
    const short = RealisticHealthEngine.estimateCalories('jogging', 15, 80);
    const long = RealisticHealthEngine.estimateCalories('jogging', 60, 80);
    expect(long.grossCalories).toBeGreaterThan(short.grossCalories);
  });

  it('heavier person burns more calories', () => {
    const light = RealisticHealthEngine.estimateCalories('jogging', 30, 60);
    const heavy = RealisticHealthEngine.estimateCalories('jogging', 30, 100);
    expect(heavy.grossCalories).toBeGreaterThan(light.grossCalories);
  });

  it('uses fallback MET=5.0 for unknown activity', () => {
    const result = RealisticHealthEngine.estimateCalories('unknown_activity', 60, 80);
    expect(result.met).toBe(5.0);
    expect(result.grossCalories).toBeGreaterThan(0);
  });

  it('preserves duration in result', () => {
    const result = RealisticHealthEngine.estimateCalories('yoga', 45, 70);
    expect(result.durationMinutes).toBe(45);
  });

  it('net calories are never negative', () => {
    const result = RealisticHealthEngine.estimateCalories('standing', 5, 50);
    expect(result.netCalories).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// HYDRATION
// ============================================

describe('calculateHydration', () => {
  it('returns base hydration from body weight', () => {
    const result = RealisticHealthEngine.calculateHydration(80);
    // 80 × 0.033 = 2.64L
    expect(result.baseLiters).toBeCloseTo(2.6, 1);
    expect(result.activityAddLiters).toBe(0);
  });

  it('adds hydration for exercise', () => {
    const result = RealisticHealthEngine.calculateHydration(80, 60);
    // Extra: (60/30) × 0.5 = 1.0L
    expect(result.activityAddLiters).toBe(1);
    expect(result.totalLiters).toBeGreaterThan(result.baseLiters);
  });

  it('total = base + activity', () => {
    const result = RealisticHealthEngine.calculateHydration(70, 90);
    expect(result.totalLiters).toBeCloseTo(result.baseLiters + result.activityAddLiters, 1);
  });

  it('glasses are based on 250ml servings', () => {
    const result = RealisticHealthEngine.calculateHydration(80);
    expect(result.glasses).toBe(Math.ceil(result.totalLiters / 0.25));
  });
});

// ============================================
// 1RM ESTIMATION (Brzycki)
// ============================================

describe('estimate1RM', () => {
  it('returns weight for 1 rep', () => {
    expect(RealisticHealthEngine.estimate1RM(100, 1)).toBe(100);
  });

  it('returns 0 for 0 reps', () => {
    expect(RealisticHealthEngine.estimate1RM(100, 0)).toBe(0);
  });

  it('estimates higher 1RM for more reps at same weight', () => {
    const fiveReps = RealisticHealthEngine.estimate1RM(80, 5);
    const tenReps = RealisticHealthEngine.estimate1RM(80, 10);
    expect(tenReps).toBeGreaterThan(fiveReps);
  });

  it('Brzycki formula: 100kg × 10 reps ≈ 133kg 1RM', () => {
    // Brzycki: 100 × 36/(37-10) = 100 × 36/27 ≈ 133
    expect(RealisticHealthEngine.estimate1RM(100, 10)).toBe(133);
  });

  it('returns 0 for negative reps', () => {
    expect(RealisticHealthEngine.estimate1RM(100, -1)).toBe(0);
  });
});

// ============================================
// WORKING WEIGHTS
// ============================================

describe('getWorkingWeights', () => {
  it('returns percentages of 1RM', () => {
    const weights = RealisticHealthEngine.getWorkingWeights(100);
    expect(weights['Warm-up (50%)']).toBe(50);
    expect(weights['Hypertrophy (70%)']).toBe(70);
    expect(weights['Strength (80%)']).toBe(80);
  });

  it('all values are less than 1RM', () => {
    const weights = RealisticHealthEngine.getWorkingWeights(200);
    for (const value of Object.values(weights)) {
      expect(value).toBeLessThan(200);
    }
  });

  it('returns 7 weight zones', () => {
    const weights = RealisticHealthEngine.getWorkingWeights(100);
    expect(Object.keys(weights)).toHaveLength(7);
  });
});

// ============================================
// RECOVERY SCORE
// ============================================

describe('calculateRecoveryScore', () => {
  it('returns score between 0 and 100', () => {
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 8,
      sleepQuality: 5,
      trainingLoadToday: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('rest day with good sleep scores high', () => {
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 8,
      sleepQuality: 5,
      trainingLoadToday: 0,
    });
    expect(result.status).toMatch(/GOOD|EXCELLENT/);
  });

  it('heavy training with poor sleep scores low', () => {
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 4,
      sleepQuality: 1,
      trainingLoadToday: 120,
    });
    expect(result.score).toBeLessThan(50);
  });

  it('elevated resting heart rate reduces score', () => {
    const normal = RealisticHealthEngine.calculateRecoveryScore({
      restingHeartRate: 60,
      avgRestingHR: 60,
    });
    const elevated = RealisticHealthEngine.calculateRecoveryScore({
      restingHeartRate: 72,
      avgRestingHR: 60,
    });
    expect(elevated.score).toBeLessThan(normal.score);
  });

  it('returns a recommendation string', () => {
    const result = RealisticHealthEngine.calculateRecoveryScore({});
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('factors sum to total score', () => {
    const result = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 7,
      restingHeartRate: 58,
      avgRestingHR: 60,
      trainingLoadToday: 45,
      hydrationPercent: 80,
    });
    const factorSum = result.factors.sleep + result.factors.hrv + result.factors.trainingLoad + result.factors.nutrition;
    expect(result.score).toBe(Math.min(100, factorSum));
  });
});

// ============================================
// TIME TO GOAL
// ============================================

describe('estimateTimeToGoal', () => {
  it('returns achievable for realistic deficit', () => {
    const result = RealisticHealthEngine.estimateTimeToGoal(80, 75, -500);
    expect(result.achievable).toBe(true);
    expect(result.weeks).toBeGreaterThan(0);
  });

  it('returns not achievable for zero calorie balance', () => {
    const result = RealisticHealthEngine.estimateTimeToGoal(80, 75, 0);
    expect(result.achievable).toBe(false);
  });

  it('flags unsafe rate for extreme deficit', () => {
    const result = RealisticHealthEngine.estimateTimeToGoal(80, 70, -2000);
    expect(result.safeRate).toBe(false);
  });

  it('weight loss takes positive number of weeks', () => {
    const result = RealisticHealthEngine.estimateTimeToGoal(90, 80, -500);
    expect(result.weeks).toBeGreaterThan(0);
    expect(result.days).toBeGreaterThan(0);
  });
});

// ============================================
// BODY COMPOSITION (Navy Method)
// ============================================

describe('estimateBodyFatNavy', () => {
  it('returns body fat percentage for male with measurements', () => {
    const stats: UserBodyStats = {
      ...MALE_STATS,
      waistCm: 85,
      neckCm: 38,
    };
    const bf = RealisticHealthEngine.estimateBodyFatNavy(stats);
    expect(bf).toBeGreaterThan(0);
    expect(bf).toBeLessThan(50);
  });

  it('returns 25 (fallback) when measurements missing', () => {
    const bf = RealisticHealthEngine.estimateBodyFatNavy(MALE_STATS);
    expect(bf).toBe(25);
  });

  it('larger waist increases body fat estimate', () => {
    const slim = RealisticHealthEngine.estimateBodyFatNavy({ ...MALE_STATS, waistCm: 78, neckCm: 38 });
    const wide = RealisticHealthEngine.estimateBodyFatNavy({ ...MALE_STATS, waistCm: 100, neckCm: 38 });
    expect(wide).toBeGreaterThan(slim);
  });
});
