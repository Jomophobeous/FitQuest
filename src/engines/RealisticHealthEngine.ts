/**
 * FitQuest Realistic Health Analytics Engine
 *
 * Evidence-based health calculations using established formulas:
 * - BMR: Mifflin-St Jeor equation
 * - TDEE: Activity-adjusted BMR
 * - Body composition: Navy method, BMI
 * - Heart rate zones: Karvonen formula
 * - Recovery scoring: HRV + sleep + training load
 * - Calorie tracking: MET-based activity expenditure
 * - Hydration needs: body weight + activity factor
 * - Macro calculations: based on goals + body stats
 *
 * All calculations run on-device with no external dependencies.
 */

import { encryptedDB } from '../security/EncryptedDatabase';

// ============================================
// TYPES
// ============================================

export type BiologicalSex = 'MALE' | 'FEMALE';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type FitnessGoal = 'LOSE_FAT' | 'MAINTAIN' | 'BUILD_MUSCLE' | 'PERFORMANCE';

export interface UserBodyStats {
  age: number;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number; // measured or estimated
  waistCm?: number; // for Navy body fat estimate
  neckCm?: number;
  hipCm?: number; // females only
  restingHeartRate?: number;
  maxHeartRate?: number; // measured or age-estimated
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
}

export interface MetabolicProfile {
  bmr: number; // Basal Metabolic Rate (kcal/day)
  tdee: number; // Total Daily Energy Expenditure
  targetCalories: number; // Adjusted for goal
  bmi: number;
  bmiCategory: string;
  estimatedBodyFat: number; // percent
  leanMass: number; // kg
  fatMass: number; // kg
}

export interface MacroTargets {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  fiberGrams: number;
  proteinPercent: number;
  carbPercent: number;
  fatPercent: number;
}

export interface HeartRateZones {
  zone1: { name: string; min: number; max: number; description: string };
  zone2: { name: string; min: number; max: number; description: string };
  zone3: { name: string; min: number; max: number; description: string };
  zone4: { name: string; min: number; max: number; description: string };
  zone5: { name: string; min: number; max: number; description: string };
  maxHR: number;
  restingHR: number;
}

export interface RecoveryScore {
  score: number; // 0-100
  status: 'POOR' | 'LOW' | 'MODERATE' | 'GOOD' | 'EXCELLENT';
  recommendation: string;
  factors: {
    sleep: number; // 0-25
    hrv: number; // 0-25
    trainingLoad: number; // 0-25
    nutrition: number; // 0-25
  };
}

export interface HydrationTarget {
  baseLiters: number; // from body weight
  activityAddLiters: number; // from exercise
  totalLiters: number;
  glasses: number; // ~250ml per glass
}

export interface WorkoutCalorieEstimate {
  grossCalories: number; // total burned
  netCalories: number; // above resting
  met: number; // metabolic equivalent
  durationMinutes: number;
}

// ============================================
// CONSTANTS
// ============================================

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<FitnessGoal, number> = {
  LOSE_FAT: -500, // 500 kcal deficit
  MAINTAIN: 0,
  BUILD_MUSCLE: 300, // 300 kcal surplus
  PERFORMANCE: 200, // slight surplus
};

/** MET values for common activities */
const ACTIVITY_METS: Record<string, number> = {
  // Strength training
  weight_training_light: 3.5,
  weight_training_moderate: 5.0,
  weight_training_vigorous: 6.0,
  circuit_training: 8.0,
  crossfit: 8.0,

  // Cardio
  walking_slow: 2.5,
  walking_brisk: 4.0,
  jogging: 7.0,
  running_moderate: 8.5,
  running_fast: 10.0,
  sprinting: 15.0,
  cycling_light: 4.0,
  cycling_moderate: 6.8,
  cycling_vigorous: 10.0,
  swimming: 7.0,
  rowing: 7.0,
  jump_rope: 12.0,
  stair_climbing: 9.0,
  elliptical: 5.0,

  // Flexibility & recovery
  yoga: 2.5,
  pilates: 3.0,
  stretching: 2.3,
  foam_rolling: 2.0,

  // Sports
  basketball: 6.5,
  soccer: 7.0,
  tennis: 7.3,
  hiking: 5.3,
  rock_climbing: 8.0,
  martial_arts: 10.3,
  dance: 5.0,

  // Daily activities
  standing: 1.8,
  walking_casual: 2.0,
  housework: 3.5,
  gardening: 4.0,
};

// ============================================
// REALISTIC HEALTH ENGINE
// ============================================

export class RealisticHealthEngine {
  // ============================================
  // METABOLIC CALCULATIONS
  // ============================================

  /**
   * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
   * Most accurate validated formula for general population.
   */
  static calculateBMR(stats: UserBodyStats): number {
    // Mifflin-St Jeor: 10 × weight(kg) + 6.25 × height(cm) - 5 × age - constant
    const baseBMR = 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age;
    return Math.round(stats.sex === 'MALE' ? baseBMR + 5 : baseBMR - 161);
  }

  /**
   * Calculate Total Daily Energy Expenditure.
   */
  static calculateTDEE(stats: UserBodyStats): number {
    const bmr = RealisticHealthEngine.calculateBMR(stats);
    return Math.round(bmr * ACTIVITY_MULTIPLIERS[stats.activityLevel]);
  }

  /**
   * Get complete metabolic profile.
   */
  static getMetabolicProfile(stats: UserBodyStats): MetabolicProfile {
    const bmr = RealisticHealthEngine.calculateBMR(stats);
    const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[stats.activityLevel]);
    const targetCalories = tdee + GOAL_CALORIE_ADJUSTMENT[stats.goal];

    const bmi = stats.weightKg / (stats.heightCm / 100) ** 2;
    const bmiCategory = RealisticHealthEngine.getBMICategory(bmi);

    // Body fat estimation
    let estimatedBodyFat: number;
    if (stats.bodyFatPercent !== undefined) {
      estimatedBodyFat = stats.bodyFatPercent;
    } else if (stats.waistCm && stats.neckCm) {
      estimatedBodyFat = RealisticHealthEngine.estimateBodyFatNavy(stats);
    } else {
      // BMI-based estimation (less accurate)
      estimatedBodyFat = RealisticHealthEngine.estimateBodyFatFromBMI(bmi, stats.age, stats.sex);
    }

    const fatMass = stats.weightKg * (estimatedBodyFat / 100);
    const leanMass = stats.weightKg - fatMass;

    return {
      bmr,
      tdee,
      targetCalories: Math.round(targetCalories),
      bmi: Math.round(bmi * 10) / 10,
      bmiCategory,
      estimatedBodyFat: Math.round(estimatedBodyFat * 10) / 10,
      leanMass: Math.round(leanMass * 10) / 10,
      fatMass: Math.round(fatMass * 10) / 10,
    };
  }

  // ============================================
  // BODY COMPOSITION
  // ============================================

  /**
   * US Navy body fat estimation method.
   * Validated formula using circumference measurements.
   */
  static estimateBodyFatNavy(stats: UserBodyStats): number {
    if (!stats.waistCm || !stats.neckCm) return 25; // fallback

    if (stats.sex === 'MALE') {
      const circumDiff = stats.waistCm - stats.neckCm;
      if (circumDiff <= 0) return 25; // guard: log10 of non-positive is NaN
      return Math.max(3, 86.01 * Math.log10(circumDiff) - 70.041 * Math.log10(stats.heightCm) + 36.76);
    } else {
      const hip = stats.hipCm || stats.waistCm * 1.1;
      const circumDiff = stats.waistCm + hip - stats.neckCm;
      if (circumDiff <= 0) return 25; // guard: log10 of non-positive is NaN
      return Math.max(10, 163.205 * Math.log10(circumDiff) - 97.684 * Math.log10(stats.heightCm) - 78.387);
    }
  }

  /**
   * Estimate body fat from BMI (Deurenberg formula).
   * Less accurate but requires no measurements.
   */
  static estimateBodyFatFromBMI(bmi: number, age: number, sex: BiologicalSex): number {
    // Deurenberg: BF% = 1.2 × BMI + 0.23 × age - 10.8 × sex - 5.4
    const sexFactor = sex === 'MALE' ? 1 : 0;
    return Math.max(3, 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4);
  }

  static getBMICategory(bmi: number): string {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    if (bmi < 35) return 'Obese I';
    if (bmi < 40) return 'Obese II';
    return 'Obese III';
  }

  // ============================================
  // MACRO CALCULATIONS
  // ============================================

  /**
   * Calculate macronutrient targets based on goal and body stats.
   */
  static calculateMacros(stats: UserBodyStats): MacroTargets {
    const profile = RealisticHealthEngine.getMetabolicProfile(stats);
    const calories = profile.targetCalories;

    // Protein: 1.6-2.2g per kg lean mass (based on goal)
    const proteinMultiplier =
      stats.goal === 'BUILD_MUSCLE' ? 2.2 : stats.goal === 'LOSE_FAT' ? 2.0 : stats.goal === 'PERFORMANCE' ? 1.8 : 1.6;
    const proteinGrams = Math.round(profile.leanMass * proteinMultiplier);
    const proteinCalories = proteinGrams * 4;

    // Fat: 25-35% of total calories
    const fatPercent = stats.goal === 'LOSE_FAT' ? 0.25 : 0.3;
    const fatCalories = Math.round(calories * fatPercent);
    const fatGrams = Math.round(fatCalories / 9);

    // Carbs: remaining calories
    const carbCalories = calories - proteinCalories - fatCalories;
    const carbGrams = Math.max(50, Math.round(carbCalories / 4));

    // Fiber: 14g per 1000 kcal
    const fiberGrams = Math.round(calories * 0.014);

    return {
      proteinGrams,
      carbGrams,
      fatGrams,
      fiberGrams,
      proteinPercent: Math.round((proteinCalories / calories) * 100),
      carbPercent: Math.round((carbCalories / calories) * 100),
      fatPercent: Math.round(fatPercent * 100),
    };
  }

  // ============================================
  // HEART RATE ZONES (Karvonen Method)
  // ============================================

  /**
   * Calculate heart rate training zones using Karvonen formula.
   * Uses Heart Rate Reserve (HRR) for more personalized zones.
   */
  static calculateHRZones(stats: UserBodyStats): HeartRateZones {
    const restingHR = stats.restingHeartRate || 70;
    const maxHR = stats.maxHeartRate || 220 - stats.age;
    const hrr = maxHR - restingHR; // Heart Rate Reserve

    const zone = (low: number, high: number) => ({
      min: Math.round(restingHR + hrr * low),
      max: Math.round(restingHR + hrr * high),
    });

    return {
      zone1: { name: 'Recovery', ...zone(0.5, 0.6), description: 'Easy effort, warm-up/cool-down' },
      zone2: { name: 'Endurance', ...zone(0.6, 0.7), description: 'Fat burning, conversational pace' },
      zone3: { name: 'Tempo', ...zone(0.7, 0.8), description: 'Aerobic fitness, moderate effort' },
      zone4: { name: 'Threshold', ...zone(0.8, 0.9), description: 'Lactate threshold, hard effort' },
      zone5: { name: 'VO2 Max', ...zone(0.9, 1.0), description: 'Maximum effort, sprint intervals' },
      maxHR,
      restingHR,
    };
  }

  // ============================================
  // CALORIE ESTIMATION
  // ============================================

  /**
   * Estimate calories burned for a specific activity using MET values.
   */
  static estimateCalories(activityKey: string, durationMinutes: number, weightKg: number): WorkoutCalorieEstimate {
    const met = ACTIVITY_METS[activityKey] || 5.0;
    const durationHours = durationMinutes / 60;

    // Gross calories = MET × weight(kg) × duration(hours)
    const grossCalories = Math.round(met * weightKg * durationHours);

    // Net calories = gross - resting metabolic rate for same duration
    // Resting MET = 1.0
    const restingCalories = Math.round(1.0 * weightKg * durationHours);
    const netCalories = grossCalories - restingCalories;

    return {
      grossCalories,
      netCalories: Math.max(0, netCalories),
      met,
      durationMinutes,
    };
  }

  /**
   * Get all available activity types for calorie estimation.
   */
  static getActivityTypes(): Array<{ key: string; name: string; met: number }> {
    return Object.entries(ACTIVITY_METS).map(([key, met]) => ({
      key,
      name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      met,
    }));
  }

  // ============================================
  // HYDRATION
  // ============================================

  /**
   * Calculate daily hydration target.
   * Base: 30-35ml per kg body weight.
   * Add: 0.5L per 30 min exercise.
   */
  static calculateHydration(weightKg: number, exerciseMinutes = 0): HydrationTarget {
    const baseLiters = Math.round(weightKg * 0.033 * 10) / 10; // 33ml/kg
    const activityAddLiters = Math.round((exerciseMinutes / 30) * 0.5 * 10) / 10;
    const totalLiters = Math.round((baseLiters + activityAddLiters) * 10) / 10;

    return {
      baseLiters,
      activityAddLiters,
      totalLiters,
      glasses: Math.ceil(totalLiters / 0.25), // 250ml per glass
    };
  }

  // ============================================
  // RECOVERY SCORING
  // ============================================

  /**
   * Calculate recovery score from available inputs.
   * Each factor scores 0-25, total 0-100.
   */
  static calculateRecoveryScore(inputs: {
    sleepHours?: number;
    sleepQuality?: number; // 1-5
    restingHeartRate?: number;
    avgRestingHR?: number; // 7-day average for comparison
    trainingLoadToday?: number; // minutes of exercise
    trainingLoadWeek?: number; // total minutes this week
    hydrationPercent?: number; // % of target met
    moodScore?: number; // 1-5
  }): RecoveryScore {
    let sleepScore = 12; // default
    let hrvScore = 12;
    let loadScore = 18;
    let nutritionScore = 12;

    // Sleep factor (0-25)
    if (inputs.sleepHours !== undefined) {
      const idealSleep = 7.5;
      const sleepDelta = Math.abs(inputs.sleepHours - idealSleep);
      sleepScore = Math.max(0, Math.round(25 - sleepDelta * 5));
      if (inputs.sleepQuality) {
        sleepScore = Math.round(sleepScore * (inputs.sleepQuality / 5));
      }
    }

    // HRV/Heart rate factor (0-25)
    if (inputs.restingHeartRate && inputs.avgRestingHR) {
      const hrDelta = inputs.restingHeartRate - inputs.avgRestingHR;
      // Higher than average = less recovered
      if (hrDelta <= -3)
        hrvScore = 25; // Much lower = great recovery
      else if (hrDelta <= 0)
        hrvScore = 20; // Slightly lower = good
      else if (hrDelta <= 3)
        hrvScore = 15; // Slightly higher = moderate
      else if (hrDelta <= 6)
        hrvScore = 8; // Higher = poor
      else hrvScore = 3; // Much higher = very poor
    }

    // Training load factor (0-25)
    if (inputs.trainingLoadToday !== undefined) {
      if (inputs.trainingLoadToday === 0) {
        loadScore = 25; // Rest day = full recovery
      } else if (inputs.trainingLoadToday < 30) {
        loadScore = 20; // Light session
      } else if (inputs.trainingLoadToday < 60) {
        loadScore = 15; // Moderate session
      } else if (inputs.trainingLoadToday < 90) {
        loadScore = 10; // Heavy session
      } else {
        loadScore = 5; // Very heavy
      }
    }

    // Nutrition/hydration factor (0-25)
    if (inputs.hydrationPercent !== undefined) {
      nutritionScore = Math.round(Math.min(25, inputs.hydrationPercent * 0.25));
    }
    if (inputs.moodScore) {
      nutritionScore = Math.round((nutritionScore + inputs.moodScore * 5) / 2);
    }

    const totalScore = Math.min(100, sleepScore + hrvScore + loadScore + nutritionScore);

    let status: RecoveryScore['status'];
    let recommendation: string;

    if (totalScore >= 85) {
      status = 'EXCELLENT';
      recommendation = "You're fully recovered! Great day for a challenging workout.";
    } else if (totalScore >= 70) {
      status = 'GOOD';
      recommendation = 'Good recovery. You can train normally today.';
    } else if (totalScore >= 50) {
      status = 'MODERATE';
      recommendation = 'Moderate recovery. Consider a lighter session or focus on technique.';
    } else if (totalScore >= 30) {
      status = 'LOW';
      recommendation = 'Low recovery. Light movement or active recovery recommended.';
    } else {
      status = 'POOR';
      recommendation = 'Poor recovery. Rest day strongly recommended. Focus on sleep and nutrition.';
    }

    return {
      score: totalScore,
      status,
      recommendation,
      factors: {
        sleep: sleepScore,
        hrv: hrvScore,
        trainingLoad: loadScore,
        nutrition: nutritionScore,
      },
    };
  }

  // ============================================
  // PROGRESS PREDICTIONS
  // ============================================

  /**
   * Estimate time to reach a weight goal based on caloric deficit/surplus.
   */
  static estimateTimeToGoal(
    currentWeightKg: number,
    targetWeightKg: number,
    dailyCalorieBalance: number, // negative = deficit, positive = surplus
  ): { weeks: number; days: number; achievable: boolean; safeRate: boolean } {
    const weightDelta = targetWeightKg - currentWeightKg;

    // 1 kg of fat ≈ 7700 kcal
    const caloriesNeeded = Math.abs(weightDelta) * 7700;
    const dailyRate = Math.abs(dailyCalorieBalance);

    if (dailyRate === 0) {
      return { weeks: Infinity, days: Infinity, achievable: false, safeRate: false };
    }

    const days = Math.ceil(caloriesNeeded / dailyRate);
    const weeks = Math.round(days / 7);

    // Safe rate: 0.5-1kg per week loss, 0.25-0.5kg per week gain
    const weeklyChange = (dailyRate * 7) / 7700;
    const safeRate = weightDelta < 0 ? weeklyChange <= 1.0 && weeklyChange >= 0.25 : weeklyChange <= 0.5;

    return { weeks, days, achievable: true, safeRate };
  }

  /**
   * Estimate 1RM (one-rep max) from a set.
   * Uses Brzycki formula.
   */
  static estimate1RM(weight: number, reps: number): number {
    if (reps <= 0) return 0;
    if (reps === 1) return weight;
    // Brzycki: 1RM = weight × (36 / (37 - reps))
    return Math.round(weight * (36 / (37 - Math.min(reps, 36))));
  }

  /**
   * Calculate working weights as percentages of 1RM.
   */
  static getWorkingWeights(oneRepMax: number): Record<string, number> {
    return {
      'Warm-up (50%)': Math.round(oneRepMax * 0.5),
      'Endurance (60%)': Math.round(oneRepMax * 0.6),
      'Hypertrophy (70%)': Math.round(oneRepMax * 0.7),
      'Strength (80%)': Math.round(oneRepMax * 0.8),
      'Power (85%)': Math.round(oneRepMax * 0.85),
      'Peak (90%)': Math.round(oneRepMax * 0.9),
      'Max (95%)': Math.round(oneRepMax * 0.95),
    };
  }

  // ============================================
  // SAVE TO ENCRYPTED DATABASE
  // ============================================

  /**
   * Store a body stats snapshot in encrypted storage.
   */
  static async saveBodyStats(stats: UserBodyStats): Promise<string> {
    const profile = RealisticHealthEngine.getMetabolicProfile(stats);
    return encryptedDB.storeHealthData('body_stats', {
      ...stats,
      ...profile,
      timestamp: Date.now(),
    });
  }
}
