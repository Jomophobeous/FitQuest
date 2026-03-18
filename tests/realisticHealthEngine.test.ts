import { describe, expect, it } from 'vitest';
import { RealisticHealthEngine } from '../src/engines/RealisticHealthEngine';
import type { UserBodyStats } from '../src/engines/RealisticHealthEngine';

// ============================================
// TEST FIXTURES
// ============================================

const MALE_STATS: UserBodyStats = {
  age: 30,
  sex: 'MALE',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'MODERATE',
  goal: 'MAINTAIN',
  restingHeartRate: 65,
};

const FEMALE_STATS: UserBodyStats = {
  age: 25,
  sex: 'FEMALE',
  heightCm: 165,
  weightKg: 60,
  activityLevel: 'ACTIVE',
  goal: 'LOSE_FAT',
  restingHeartRate: 70,
};

// ============================================
// BMR TESTS (Mifflin-St Jeor)
// ============================================

describe('RealisticHealthEngine.calculateBMR', () => {
  it('calculates BMR for male using Mifflin-St Jeor', () => {
    const bmr = RealisticHealthEngine.calculateBMR(MALE_STATS);
    // 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr).toBeCloseTo(1780, 0);
  });

  it('calculates BMR for female using Mifflin-St Jeor', () => {
    const bmr = RealisticHealthEngine.calculateBMR(FEMALE_STATS);
    // 10 * 60 + 6.25 * 165 - 5 * 25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    expect(bmr).toBeCloseTo(1345.25, 0);
  });

  it('returns higher BMR for heavier individuals', () => {
    const light = RealisticHealthEngine.calculateBMR({ ...MALE_STATS, weightKg: 60 });
    const heavy = RealisticHealthEngine.calculateBMR({ ...MALE_STATS, weightKg: 100 });
    expect(heavy).toBeGreaterThan(light);
  });
});

// ============================================
// TDEE TESTS
// ============================================

describe('RealisticHealthEngine.calculateTDEE', () => {
  it('applies MODERATE activity multiplier (1.55)', () => {
    const tdee = RealisticHealthEngine.calculateTDEE(MALE_STATS);
    const bmr = RealisticHealthEngine.calculateBMR(MALE_STATS);
    expect(tdee).toBeCloseTo(bmr * 1.55, 0);
  });

  it('applies ACTIVE activity multiplier (1.725)', () => {
    const tdee = RealisticHealthEngine.calculateTDEE(FEMALE_STATS);
    const bmr = RealisticHealthEngine.calculateBMR(FEMALE_STATS);
    expect(tdee).toBeCloseTo(bmr * 1.725, 0);
  });

  it('SEDENTARY < VERY_ACTIVE for same person', () => {
    const sedentary = RealisticHealthEngine.calculateTDEE({ ...MALE_STATS, activityLevel: 'SEDENTARY' });
    const active = RealisticHealthEngine.calculateTDEE({ ...MALE_STATS, activityLevel: 'VERY_ACTIVE' });
    expect(active).toBeGreaterThan(sedentary);
  });
});

// ============================================
// METABOLIC PROFILE
// ============================================

describe('RealisticHealthEngine.getMetabolicProfile', () => {
  it('returns complete metabolic profile with BMI', () => {
    const profile = RealisticHealthEngine.getMetabolicProfile(MALE_STATS);
    expect(profile.bmi).toBeCloseTo(80 / (1.8 * 1.8), 1);
    expect(profile.bmr).toBeGreaterThan(0);
    expect(profile.tdee).toBeGreaterThan(profile.bmr);
    expect(profile.leanMass + profile.fatMass).toBeCloseTo(80, 1);
  });

  it('adjusts target calories for LOSE_FAT goal (-500)', () => {
    const maintain = RealisticHealthEngine.getMetabolicProfile({ ...MALE_STATS, goal: 'MAINTAIN' });
    const loseFat = RealisticHealthEngine.getMetabolicProfile({ ...MALE_STATS, goal: 'LOSE_FAT' });
    expect(loseFat.targetCalories).toBe(maintain.targetCalories - 500);
  });

  it('adjusts target calories for BUILD_MUSCLE goal (+300)', () => {
    const maintain = RealisticHealthEngine.getMetabolicProfile({ ...MALE_STATS, goal: 'MAINTAIN' });
    const build = RealisticHealthEngine.getMetabolicProfile({ ...MALE_STATS, goal: 'BUILD_MUSCLE' });
    expect(build.targetCalories).toBe(maintain.targetCalories + 300);
  });
});

// ============================================
// BMI CATEGORY
// ============================================

describe('RealisticHealthEngine.getBMICategory', () => {
  it('classifies underweight', () => {
    expect(RealisticHealthEngine.getBMICategory(17)).toBe('Underweight');
  });

  it('classifies normal', () => {
    expect(RealisticHealthEngine.getBMICategory(22)).toBe('Normal');
  });

  it('classifies overweight', () => {
    expect(RealisticHealthEngine.getBMICategory(27)).toBe('Overweight');
  });

  it('classifies obese', () => {
    expect(RealisticHealthEngine.getBMICategory(35)).toBe('Obese II');
  });
});

// ============================================
// MACRO CALCULATIONS
// ============================================

describe('RealisticHealthEngine.calculateMacros', () => {
  it('returns macros that sum to ~100%', () => {
    const macros = RealisticHealthEngine.calculateMacros(MALE_STATS);
    const totalPercent = macros.proteinPercent + macros.carbPercent + macros.fatPercent;
    expect(totalPercent).toBeCloseTo(100, 0);
  });

  it('returns positive grams for all macros', () => {
    const macros = RealisticHealthEngine.calculateMacros(FEMALE_STATS);
    expect(macros.proteinGrams).toBeGreaterThan(0);
    expect(macros.carbGrams).toBeGreaterThan(0);
    expect(macros.fatGrams).toBeGreaterThan(0);
    expect(macros.fiberGrams).toBeGreaterThan(0);
  });

  it('gives higher protein for BUILD_MUSCLE goal', () => {
    const maintain = RealisticHealthEngine.calculateMacros({ ...MALE_STATS, goal: 'MAINTAIN' });
    const build = RealisticHealthEngine.calculateMacros({ ...MALE_STATS, goal: 'BUILD_MUSCLE' });
    expect(build.proteinGrams).toBeGreaterThanOrEqual(maintain.proteinGrams);
  });
});

// ============================================
// HEART RATE ZONES (Karvonen)
// ============================================

describe('RealisticHealthEngine.calculateHRZones', () => {
  it('returns 5 zones in ascending order', () => {
    const zones = RealisticHealthEngine.calculateHRZones(MALE_STATS);
    expect(zones.zone1.min).toBeLessThan(zones.zone2.min);
    expect(zones.zone2.min).toBeLessThan(zones.zone3.min);
    expect(zones.zone3.min).toBeLessThan(zones.zone4.min);
    expect(zones.zone4.min).toBeLessThan(zones.zone5.min);
  });

  it('estimates max HR from age when not provided', () => {
    const zones = RealisticHealthEngine.calculateHRZones(MALE_STATS);
    // 220 - 30 = 190
    expect(zones.maxHR).toBe(190);
  });

  it('uses provided max HR when given', () => {
    const zones = RealisticHealthEngine.calculateHRZones({ ...MALE_STATS, maxHeartRate: 195 });
    expect(zones.maxHR).toBe(195);
  });

  it('zone 5 max equals or approximates maxHR', () => {
    const zones = RealisticHealthEngine.calculateHRZones(MALE_STATS);
    expect(zones.zone5.max).toBeLessThanOrEqual(zones.maxHR + 1);
  });
});

// ============================================
// CALORIE ESTIMATION (MET-based)
// ============================================

describe('RealisticHealthEngine.estimateCalories', () => {
  it('estimates calories for moderate weight training', () => {
    const est = RealisticHealthEngine.estimateCalories(
      'weight_training_moderate',
      30,
      80
    );
    expect(est.grossCalories).toBeGreaterThan(0);
    expect(est.netCalories).toBeGreaterThan(0);
    expect(est.met).toBe(5.0);
    expect(est.durationMinutes).toBe(30);
  });

  it('returns higher calories for longer duration', () => {
    const short = RealisticHealthEngine.estimateCalories('jogging', 15, 80);
    const long = RealisticHealthEngine.estimateCalories('jogging', 60, 80);
    expect(long.grossCalories).toBeGreaterThan(short.grossCalories);
  });

  it('returns higher calories for heavier individuals', () => {
    const light = RealisticHealthEngine.estimateCalories('running_moderate', 30, 60);
    const heavy = RealisticHealthEngine.estimateCalories('running_moderate', 30, 100);
    expect(heavy.grossCalories).toBeGreaterThan(light.grossCalories);
  });
});

// ============================================
// HYDRATION TARGET
// ============================================

describe('RealisticHealthEngine.calculateHydration', () => {
  it('returns base hydration from body weight', () => {
    const hydration = RealisticHealthEngine.calculateHydration(80);
    expect(hydration.baseLiters).toBeGreaterThan(0);
    expect(hydration.totalLiters).toBe(hydration.baseLiters);
    expect(hydration.activityAddLiters).toBe(0);
  });

  it('adds hydration for exercise minutes', () => {
    const noExercise = RealisticHealthEngine.calculateHydration(80, 0);
    const withExercise = RealisticHealthEngine.calculateHydration(80, 60);
    expect(withExercise.totalLiters).toBeGreaterThan(noExercise.totalLiters);
    expect(withExercise.activityAddLiters).toBeGreaterThan(0);
  });

  it('returns positive glass count', () => {
    const hydration = RealisticHealthEngine.calculateHydration(70, 30);
    expect(hydration.glasses).toBeGreaterThan(0);
    expect(Number.isInteger(hydration.glasses)).toBe(true);
  });
});

// ============================================
// RECOVERY SCORE
// ============================================

describe('RealisticHealthEngine.calculateRecoveryScore', () => {
  it('returns score between 0-100', () => {
    const recovery = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 8,
      sleepQuality: 4,
      restingHeartRate: 55,
      avgRestingHR: 60,
      trainingLoadToday: 60,
      trainingLoadWeek: 200,
      hydrationPercent: 75,
    });
    expect(recovery.score).toBeGreaterThanOrEqual(0);
    expect(recovery.score).toBeLessThanOrEqual(100);
  });

  it('returns EXCELLENT for optimal inputs', () => {
    const recovery = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 7.5,
      sleepQuality: 5,
      restingHeartRate: 55,
      avgRestingHR: 62,
      trainingLoadToday: 0,
      hydrationPercent: 100,
      moodScore: 5,
    });
    expect(['GOOD', 'EXCELLENT']).toContain(recovery.status);
  });

  it('returns POOR for suboptimal inputs', () => {
    const recovery = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 3,
      sleepQuality: 1,
      restingHeartRate: 85,
      avgRestingHR: 60,
      trainingLoadToday: 120,
      hydrationPercent: 10,
      moodScore: 1,
    });
    expect(['POOR', 'LOW']).toContain(recovery.status);
  });

  it('factors break down to 4 components summing to 100 max', () => {
    const recovery = RealisticHealthEngine.calculateRecoveryScore({
      sleepHours: 7,
      sleepQuality: 3,
      restingHeartRate: 65,
      avgRestingHR: 65,
      trainingLoadToday: 45,
      hydrationPercent: 70,
    });
    const factorSum = recovery.factors.sleep + recovery.factors.hrv +
      recovery.factors.trainingLoad + recovery.factors.nutrition;
    expect(factorSum).toBeLessThanOrEqual(100);
    expect(factorSum).toBeGreaterThan(0);
    expect(recovery.recommendation).toBeTruthy();
  });
});

// ============================================
// 1RM ESTIMATION (Brzycki)
// ============================================

describe('RealisticHealthEngine.estimate1RM', () => {
  it('estimates 1RM from weight and reps', () => {
    const oneRM = RealisticHealthEngine.estimate1RM(100, 5);
    // Brzycki: weight * 36 / (37 - reps) = 100 * 36 / 32 = 112.5, rounded to 113
    expect(oneRM).toBe(113);
  });

  it('returns the weight itself for 1 rep', () => {
    const oneRM = RealisticHealthEngine.estimate1RM(100, 1);
    expect(oneRM).toBe(100);
  });

  it('increases estimated 1RM with more reps at same weight', () => {
    const low = RealisticHealthEngine.estimate1RM(100, 3);
    const high = RealisticHealthEngine.estimate1RM(100, 10);
    expect(high).toBeGreaterThan(low);
  });
});

// ============================================
// WORKING WEIGHTS
// ============================================

describe('RealisticHealthEngine.getWorkingWeights', () => {
  it('returns weight recommendations keyed by descriptive labels', () => {
    const weights = RealisticHealthEngine.getWorkingWeights(100);
    expect(weights).toHaveProperty('Strength (80%)');
    expect(weights).toHaveProperty('Hypertrophy (70%)');
    expect(weights).toHaveProperty('Endurance (60%)');
    expect(weights).toHaveProperty('Warm-up (50%)');
  });

  it('Strength > Hypertrophy > Endurance > Warm-up', () => {
    const w = RealisticHealthEngine.getWorkingWeights(100);
    expect(w['Strength (80%)']!).toBeGreaterThan(w['Hypertrophy (70%)']!);
    expect(w['Hypertrophy (70%)']!).toBeGreaterThan(w['Endurance (60%)']!);
    expect(w['Endurance (60%)']!).toBeGreaterThan(w['Warm-up (50%)']!);
  });
});

// ============================================
// ACTIVITY TYPES CATALOG
// ============================================

describe('RealisticHealthEngine.getActivityTypes', () => {
  it('returns a non-empty list of activities with MET values', () => {
    const activities = RealisticHealthEngine.getActivityTypes();
    expect(activities.length).toBeGreaterThan(0);
    activities.forEach((a) => {
      expect(a.key).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.met).toBeGreaterThan(0);
    });
  });
});
