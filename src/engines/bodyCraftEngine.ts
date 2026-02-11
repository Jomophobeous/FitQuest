/**
 * ENGINE — Body Craft Algorithm Generator
 *
 * Generates a personalized BodyCraftAlgorithm based on the user's
 * body assessment, goal selection, muscle focus areas, and timeline.
 *
 * Calculation methods:
 *  - Calories: Mifflin-St Jeor × activity multiplier × goal modifier
 *  - Macros: protein/fat per kg, carbs from remainder
 *  - Training split: based on goal + available days
 *  - Exercise category weights: fed to workout generator
 */

// ============================================
// TYPES
// ============================================

export type BodyType = 'ectomorph' | 'mesomorph' | 'endomorph';
export type GoalType = 'lean_athletic' | 'muscular_powerful' | 'tall_flexible' | 'balanced_toned' | 'custom';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';
export type MusclePriority = 'priority' | 'maintain' | 'ignore';
export type TimelineMonths = 3 | 6 | 12;

export interface BodyCraftInputs {
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: 'male' | 'female';
  body_type: BodyType;
  fitness_level: FitnessLevel;
  activity_level: ActivityLevel;
  goal_type: GoalType;
  muscle_priorities: Record<string, MusclePriority>;
  timeline_months: TimelineMonths;
}

export interface BodyCraftAlgorithm {
  id: string;
  user_id: string;
  body_type: BodyType;
  goal_type: GoalType;
  timeline_months: TimelineMonths;
  muscle_priorities: Record<string, MusclePriority>;
  recommended_training_split: string;
  training_days_per_week: number;
  calories_target: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  daily_water_liters: number;
  sleep_hours: number;
  cardio_minutes_per_week: number;
  exercise_category_weights: Record<string, number>;
  weekly_schedule: string[];
  nutrition_tips: string[];
  created_at: string;
}

// ============================================
// CONSTANTS
// ============================================

/** Activity level multipliers for TDEE */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

/** Calorie adjustments per goal */
const GOAL_CALORIE_OFFSETS: Record<GoalType, number> = {
  lean_athletic: -300,
  muscular_powerful: 400,
  tall_flexible: 0,
  balanced_toned: -100,
  custom: 0,
};

/** Protein per kg of bodyweight per goal */
const GOAL_PROTEIN_PER_KG: Record<GoalType, number> = {
  lean_athletic: 1.6,
  muscular_powerful: 2.0,
  tall_flexible: 1.6,
  balanced_toned: 1.8,
  custom: 1.8,
};

/** Fat per kg of bodyweight */
const FAT_PER_KG = 0.9; // 0.8–1.0 range, we use 0.9

/** Exercise category weight presets per goal */
const GOAL_CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  muscular_powerful: {
    building_muscle: 0.5,
    calisthenics: 0.3,
    flexible: 0.1,
    getting_taller: 0.1,
  },
  lean_athletic: {
    calisthenics: 0.4,
    building_muscle: 0.2,
    faster: 0.2,
    flexible: 0.2,
  },
  tall_flexible: {
    getting_taller: 0.4,
    flexible: 0.3,
    calisthenics: 0.2,
    mental_clarity: 0.1,
  },
  balanced_toned: {
    calisthenics: 0.3,
    building_muscle: 0.25,
    flexible: 0.25,
    faster: 0.2,
  },
  custom: {
    calisthenics: 0.3,
    building_muscle: 0.25,
    flexible: 0.25,
    faster: 0.2,
  },
};

// ============================================
// HELPERS
// ============================================

/** Generate a simple UUID v4 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Mifflin-St Jeor Equation for Basal Metabolic Rate (BMR)
 *  Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age − 5 + 5
 *  Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
 */
function calculateBMR(weight_kg: number, height_cm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Determine training days per week based on fitness level + timeline
 */
function getTrainingDays(fitness_level: FitnessLevel, timeline_months: TimelineMonths): number {
  if (fitness_level === 'beginner') return timeline_months === 3 ? 4 : 3;
  if (fitness_level === 'intermediate') return timeline_months === 3 ? 5 : 4;
  // advanced
  return timeline_months === 3 ? 6 : 5;
}

/**
 * Determine training split based on training days + goal
 */
function getTrainingSplit(days: number, goal_type: GoalType): { split: string; schedule: string[] } {
  if (days <= 3) {
    return {
      split: 'Full Body',
      schedule: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
    };
  }

  if (days === 4) {
    return {
      split: 'Upper / Lower',
      schedule: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'],
    };
  }

  if (goal_type === 'muscular_powerful') {
    // 5-6 day PPL
    if (days >= 6) {
      return {
        split: 'Push / Pull / Legs (×2)',
        schedule: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'],
      };
    }
    return {
      split: 'Push / Pull / Legs + Upper / Lower',
      schedule: ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Lower', 'Rest'],
    };
  }

  if (goal_type === 'tall_flexible') {
    return {
      split: 'Mobility / Strength / Flexibility',
      schedule: ['Mobility', 'Strength', 'Flex', 'Rest', 'Mobility', 'Strength', 'Rest'],
    };
  }

  // lean_athletic, balanced_toned, custom
  if (days >= 6) {
    return {
      split: 'Push / Pull / Legs (×2)',
      schedule: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'],
    };
  }
  return {
    split: 'Push / Pull / Legs',
    schedule: ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Lower', 'Rest'],
  };
}

/**
 * Determine cardio recommendation (minutes per week)
 */
function getCardioMinutes(goal_type: GoalType, fitness_level: FitnessLevel): number {
  const base: Record<GoalType, number> = {
    lean_athletic: 150,
    muscular_powerful: 60,
    tall_flexible: 90,
    balanced_toned: 120,
    custom: 100,
  };

  const modifier: Record<FitnessLevel, number> = {
    beginner: -20,
    intermediate: 0,
    advanced: 30,
  };

  return base[goal_type] + modifier[fitness_level];
}

/**
 * Generate nutrition tips based on goal and body type
 */
function getNutritionTips(goal_type: GoalType, body_type: BodyType): string[] {
  const universal = [
    'Drink water before each meal to support hydration and digestion.',
    'Aim for 25–30 g of fiber daily from whole foods.',
  ];

  const goalTips: Record<GoalType, string[]> = {
    lean_athletic: [
      'Eat protein within 30 minutes post-workout for optimal recovery.',
      'Use calorie cycling: lower carbs on rest days, higher on training days.',
      'Prioritize lean proteins: chicken, fish, tofu, eggs.',
    ],
    muscular_powerful: [
      'Eat in a 300–500 calorie surplus to support muscle growth.',
      'Consume 4–5 meals per day spaced 3–4 hours apart.',
      'Include creatine monohydrate (5 g/day) for strength gains.',
      'Prioritize complex carbs around training for energy.',
    ],
    tall_flexible: [
      'Include anti-inflammatory foods: turmeric, ginger, omega-3 rich fish.',
      'Prioritize collagen-rich foods or supplements for joint health.',
      'Eat magnesium-rich foods (dark greens, nuts) to support flexibility.',
    ],
    balanced_toned: [
      'Focus on whole, unprocessed foods for 80% of your diet.',
      'Balance each meal with protein, complex carbs, and healthy fats.',
      'Practice mindful eating to avoid overconsumption.',
    ],
    custom: [
      'Adjust protein intake based on your specific muscle group priorities.',
      'Track your intake for 2 weeks to calibrate your needs.',
    ],
  };

  const bodyTips: Record<BodyType, string> = {
    ectomorph: 'As an ectomorph, increase meal frequency and add calorie-dense snacks (nuts, nut butters).',
    mesomorph: 'As a mesomorph, you respond well to balanced macros — maintain consistency.',
    endomorph: 'As an endomorph, prioritize protein and fiber to manage satiety and reduce fat gain.',
  };

  return [...universal, ...(goalTips[goal_type] || []), bodyTips[body_type]];
}

// ============================================
// MAIN GENERATOR
// ============================================

/**
 * Generate a complete BodyCraftAlgorithm from user inputs
 */
export function generateBodyCraftAlgorithm(inputs: BodyCraftInputs, userId: string): BodyCraftAlgorithm {
  const {
    height_cm,
    weight_kg,
    age,
    sex,
    body_type,
    fitness_level,
    activity_level,
    goal_type,
    muscle_priorities,
    timeline_months,
  } = inputs;

  // 1. Calculate BMR → TDEE → target calories
  const bmr = calculateBMR(weight_kg, height_cm, age, sex);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];
  const calories_target = Math.round(tdee + GOAL_CALORIE_OFFSETS[goal_type]);

  // 2. Macro breakdown
  const protein_g = Math.round(weight_kg * GOAL_PROTEIN_PER_KG[goal_type]);
  const fats_g = Math.round(weight_kg * FAT_PER_KG);
  const protein_cal = protein_g * 4;
  const fat_cal = fats_g * 9;
  const carbs_g = Math.round(Math.max(0, calories_target - protein_cal - fat_cal) / 4);

  // 3. Training days and split
  const training_days_per_week = getTrainingDays(fitness_level, timeline_months);
  const { split, schedule } = getTrainingSplit(training_days_per_week, goal_type);

  // 4. Cardio
  const cardio_minutes_per_week = getCardioMinutes(goal_type, fitness_level);

  // 5. Recovery: water + sleep
  const daily_water_liters = parseFloat((weight_kg * 0.033 + (goal_type === 'muscular_powerful' ? 0.5 : 0)).toFixed(1));
  const sleep_hours = fitness_level === 'advanced' ? 8.5 : goal_type === 'muscular_powerful' ? 8.0 : 7.5;

  // 6. Exercise category weights
  const exercise_category_weights = { ...GOAL_CATEGORY_WEIGHTS[goal_type] };

  // Boost weights for priority muscle areas (shift towards building_muscle if user has many priority areas)
  const priorityCount = Object.values(muscle_priorities).filter((v) => v === 'priority').length;
  if (priorityCount >= 4 && goal_type !== 'muscular_powerful') {
    exercise_category_weights.building_muscle = Math.min(
      1,
      (exercise_category_weights.building_muscle || 0) + 0.1
    );
    // Re-normalize
    const total = Object.values(exercise_category_weights).reduce((s, v) => s + v, 0);
    for (const key of Object.keys(exercise_category_weights)) {
      exercise_category_weights[key] = parseFloat((exercise_category_weights[key] / total).toFixed(2));
    }
  }

  // 7. Nutrition tips
  const nutrition_tips = getNutritionTips(goal_type, body_type);

  return {
    id: generateId(),
    user_id: userId,
    body_type,
    goal_type,
    timeline_months,
    muscle_priorities,
    recommended_training_split: split,
    training_days_per_week,
    calories_target,
    protein_g,
    carbs_g,
    fats_g,
    daily_water_liters,
    sleep_hours,
    cardio_minutes_per_week,
    exercise_category_weights,
    weekly_schedule: schedule,
    nutrition_tips,
    created_at: new Date().toISOString(),
  };
}
