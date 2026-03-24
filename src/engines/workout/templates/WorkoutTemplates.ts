/**
 * Workout Templates
 *
 * Pre-defined workout structures for different training styles.
 */

import type { Category, TargetMuscle, TrainingType } from '../../../database/types';
import type { WorkoutTemplate, TemplateSlot } from '../types';

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

/**
 * Full Body Template
 * Balanced workout hitting all major patterns
 */
export const FULL_BODY_TEMPLATE: WorkoutTemplate = {
  id: 'full_body',
  name: 'Full Body',
  description: 'Balanced workout targeting all major muscle groups',
  targetGoals: ['body_control', 'strength', 'speed'],
  muscleGroups: [
    ['chest_mid', 'triceps', 'deltoids_front'], // Push
    ['lats', 'biceps', 'rhomboids'], // Pull
    ['quads', 'glutes_max', 'hamstrings'], // Legs
    ['abs', 'core_deep'], // Core
  ],
  sessionsPerWeek: 3,
  estimatedDuration: 45,
  volumeMultiplier: 1.0,
};

/**
 * Push-Pull-Legs Template
 */
export const PUSH_TEMPLATE: WorkoutTemplate = {
  id: 'push',
  name: 'Push Day',
  description: 'Focus on pushing movements and chest/shoulder/tricep',
  targetGoals: ['strength', 'body_control'],
  muscleGroups: [['chest_mid', 'chest_upper', 'chest_lower'], ['deltoids_front', 'shoulders'], ['triceps']],
  sessionsPerWeek: 1,
  estimatedDuration: 40,
  volumeMultiplier: 1.2,
};

export const PULL_TEMPLATE: WorkoutTemplate = {
  id: 'pull',
  name: 'Pull Day',
  description: 'Focus on pulling movements and back/bicep',
  targetGoals: ['strength', 'body_control'],
  muscleGroups: [
    ['lats', 'rhomboids'],
    ['traps_upper', 'traps_mid', 'deltoids_rear'],
    ['biceps', 'forearms'],
  ],
  sessionsPerWeek: 1,
  estimatedDuration: 40,
  volumeMultiplier: 1.2,
};

export const LEGS_TEMPLATE: WorkoutTemplate = {
  id: 'legs',
  name: 'Leg Day',
  description: 'Focus on lower body',
  targetGoals: ['strength', 'body_control', 'speed'],
  muscleGroups: [
    ['quads', 'glutes_max'],
    ['hamstrings', 'glutes_med'],
    ['calves_gastrocnemius', 'calves_soleus'],
    ['hip_flexors', 'adductors'],
  ],
  sessionsPerWeek: 1,
  estimatedDuration: 45,
  volumeMultiplier: 1.2,
};

/**
 * Upper-Lower Split Template
 */
export const UPPER_TEMPLATE: WorkoutTemplate = {
  id: 'upper',
  name: 'Upper Body',
  description: 'Complete upper body workout',
  targetGoals: ['strength', 'body_control'],
  muscleGroups: [
    ['chest_mid', 'triceps'],
    ['lats', 'biceps'],
    ['deltoids_front', 'deltoids_rear'],
    ['abs', 'obliques'],
  ],
  sessionsPerWeek: 2,
  estimatedDuration: 50,
  volumeMultiplier: 1.0,
};

export const LOWER_TEMPLATE: WorkoutTemplate = {
  id: 'lower',
  name: 'Lower Body',
  description: 'Complete lower body workout',
  targetGoals: ['strength', 'body_control', 'speed'],
  muscleGroups: [
    ['quads', 'glutes_max'],
    ['hamstrings', 'lower_back'],
    ['calves_gastrocnemius', 'adductors'],
    ['core_deep', 'hip_flexors'],
  ],
  sessionsPerWeek: 2,
  estimatedDuration: 45,
  volumeMultiplier: 1.0,
};

/**
 * Mobility/Flexibility Template
 */
export const MOBILITY_TEMPLATE: WorkoutTemplate = {
  id: 'mobility',
  name: 'Mobility & Flexibility',
  description: 'Focus on range of motion and flexibility',
  targetGoals: ['mobility', 'posture', 'focus'],
  muscleGroups: [
    ['hip_flexors', 'hamstrings'],
    ['lower_back', 'abs'],
    ['shoulders', 'chest_mid'],
    ['calves_gastrocnemius', 'quads'],
  ],
  sessionsPerWeek: 2,
  estimatedDuration: 30,
  volumeMultiplier: 0.7,
};

/**
 * Core Focus Template
 */
export const CORE_TEMPLATE: WorkoutTemplate = {
  id: 'core',
  name: 'Core Strength',
  description: 'Intensive core training',
  targetGoals: ['body_control', 'focus'],
  muscleGroups: [['abs'], ['obliques'], ['core_deep', 'lower_back'], ['hip_flexors']],
  sessionsPerWeek: 2,
  estimatedDuration: 25,
  volumeMultiplier: 1.0,
};

// ============================================
// TEMPLATE REGISTRY
// ============================================

export const ALL_TEMPLATES: WorkoutTemplate[] = [
  FULL_BODY_TEMPLATE,
  PUSH_TEMPLATE,
  PULL_TEMPLATE,
  LEGS_TEMPLATE,
  UPPER_TEMPLATE,
  LOWER_TEMPLATE,
  MOBILITY_TEMPLATE,
  CORE_TEMPLATE,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkoutTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates suitable for a goal
 */
export function getTemplatesForGoal(goal: Category): WorkoutTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.targetGoals.includes(goal));
}

/**
 * Generate template slots from a template
 */
export function generateSlotsFromTemplate(template: WorkoutTemplate): TemplateSlot[] {
  return template.muscleGroups.map((muscles, index) => ({
    muscleTargets: muscles as TargetMuscle[],
    trainingTypes: getTrainingTypesForGoal(template.targetGoals[0] || 'body_control'),
    minSets: 2,
    maxSets: 4,
    isRequired: index < 2, // First two groups are required
  }));
}

function getTrainingTypesForGoal(goal: Category): TrainingType[] {
  const mapping: Record<Category, TrainingType[]> = {
    body_control: ['strength', 'hypertrophy', 'endurance'],
    posture: ['decompression', 'mobility', 'posture'],
    speed: ['speed_power', 'endurance', 'coordination'],
    mobility: ['mobility', 'recovery'],
    focus: ['mindfulness', 'recovery', 'balance'],
    strength: ['hypertrophy', 'strength'],
  };
  return mapping[goal] || ['strength'];
}

/**
 * Suggest template based on user context
 */
export function suggestTemplate(
  goal: Category,
  sessionsPerWeek: number,
  dayInWeek: number,
  preferredDuration?: number,
): WorkoutTemplate {
  const suitableTemplates = getTemplatesForGoal(goal);

  // For low frequency, prefer full body
  if (sessionsPerWeek <= 2) {
    return FULL_BODY_TEMPLATE;
  }

  // For 3 sessions, rotate through PPL
  if (sessionsPerWeek === 3) {
    const rotation = [PUSH_TEMPLATE, PULL_TEMPLATE, LEGS_TEMPLATE];
    return rotation[dayInWeek % 3]!;
  }

  // For 4+ sessions, use upper/lower split
  if (sessionsPerWeek >= 4) {
    const rotation = [UPPER_TEMPLATE, LOWER_TEMPLATE, UPPER_TEMPLATE, LOWER_TEMPLATE, FULL_BODY_TEMPLATE];
    return rotation[dayInWeek % rotation.length]!;
  }

  return suitableTemplates[0] || FULL_BODY_TEMPLATE;
}
