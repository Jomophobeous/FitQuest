/**
 * Exercise Taxonomy Mapping
 *
 * Maps external exercise database taxonomies to FitQuest canonical enums.
 * Supports free-exercise-db and exercises.json formats.
 */

import type {
  Category,
  Difficulty,
  TargetMuscle,
  EquipmentItem,
  EquipmentLevel,
  ImpactLevel,
  SpaceFilter,
  TrainingType,
} from '../database/types';

// ============================================
// CATEGORY MAPPING
// ============================================

const CATEGORY_MAP: Record<string, Category> = {
  // free-exercise-db categories
  strength: 'strength',
  powerlifting: 'strength',
  'olympic weightlifting': 'strength',
  strongman: 'strength',
  stretching: 'mobility',
  cardio: 'speed',
  plyometrics: 'speed',
  // Generic fallback
  compound: 'body_control',
  isolation: 'strength',
};

export function mapCategory(externalCategory: string | null | undefined): Category {
  if (!externalCategory) return 'body_control';
  const normalized = externalCategory.toLowerCase().trim();
  return CATEGORY_MAP[normalized] || 'body_control';
}

// ============================================
// DIFFICULTY MAPPING
// ============================================

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  expert: 'advanced', // free-exercise-db uses 'expert'
};

export function mapDifficulty(externalLevel: string | null | undefined): Difficulty {
  if (!externalLevel) return 'intermediate';
  const normalized = externalLevel.toLowerCase().trim();
  return DIFFICULTY_MAP[normalized] || 'intermediate';
}

// ============================================
// MUSCLE MAPPING
// ============================================

const MUSCLE_MAP: Record<string, TargetMuscle> = {
  // free-exercise-db muscles
  abdominals: 'abs',
  abductors: 'glutes_med', // hip abductors map to glute med
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves_gastrocnemius',
  chest: 'chest_mid',
  forearms: 'forearms',
  glutes: 'glutes_max',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower_back',
  'middle back': 'rhomboids',
  neck: 'neck',
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'traps_upper',
  triceps: 'triceps',
  // Additional mappings
  core: 'core_deep',
  abs: 'abs',
  obliques: 'obliques',
  'hip flexors': 'hip_flexors',
  'rotator cuff': 'rotator_cuff',
  serratus: 'serratus',
  deltoids: 'deltoids_front',
  pecs: 'pecs',
};

export function mapMuscle(externalMuscle: string | null | undefined): TargetMuscle | null {
  if (!externalMuscle) return null;
  const normalized = externalMuscle.toLowerCase().trim();
  return MUSCLE_MAP[normalized] || null;
}

export function mapMuscles(externalMuscles: string[] | null | undefined): TargetMuscle[] {
  if (!externalMuscles || !Array.isArray(externalMuscles)) return [];
  return externalMuscles.map((m) => mapMuscle(m)).filter((m): m is TargetMuscle => m !== null);
}

// ============================================
// EQUIPMENT MAPPING
// ============================================

const EQUIPMENT_MAP: Record<string, EquipmentItem | null> = {
  // free-exercise-db equipment
  'body only': null, // No equipment needed
  bands: 'band',
  dumbbell: null, // Not in FitQuest minimal/playground equipment
  barbell: null,
  kettlebells: null,
  cable: null,
  machine: null,
  'exercise ball': null,
  'medicine ball': null,
  'foam roll': 'foam_roller',
  'e-z curl bar': null,
  other: null,
  // Additional mappings for FitQuest equipment
  'pull up bar': 'pull_up_bar',
  'pullup bar': 'pull_up_bar',
  'pull-up bar': 'pull_up_bar',
  'parallel bars': 'parallel_bars',
  'dip bars': 'parallel_bars',
  rings: 'rings',
  'gymnastics rings': 'rings',
  bench: 'bench',
  chair: 'chair',
  wall: 'wall',
  door: 'door_frame',
  doorframe: 'door_frame',
  'jump rope': 'jump_rope',
  rope: 'jump_rope',
  towel: 'towel',
  strap: 'strap',
  'resistance band': 'band',
  backpack: 'backpack',
};

export function mapEquipment(externalEquipment: string | null | undefined): EquipmentItem | null {
  if (!externalEquipment) return null;
  const normalized = externalEquipment.toLowerCase().trim();
  return EQUIPMENT_MAP[normalized] ?? null;
}

/**
 * Determine equipment level based on required equipment
 */
export function inferEquipmentLevel(equipment: EquipmentItem | null): EquipmentLevel {
  if (!equipment) return 'none';

  const playgroundEquipment: EquipmentItem[] = [
    'pull_up_bar',
    'parallel_bars',
    'monkey_bars',
    'bench',
    'hill',
    'sand',
    'sled',
    'parachute',
    'parallettes',
    'rings',
  ];

  if (playgroundEquipment.includes(equipment)) {
    return 'playground';
  }

  return 'minimal';
}

// ============================================
// TRAINING TYPE INFERENCE
// ============================================

export function inferTrainingTypes(
  category: string | null | undefined,
  mechanic: string | null | undefined,
  force: string | null | undefined,
): { type: TrainingType; effectiveness: number }[] {
  const types: { type: TrainingType; effectiveness: number }[] = [];

  const cat = (category || '').toLowerCase();
  const mech = (mechanic || '').toLowerCase();

  // Primary training type based on category
  if (cat === 'strength' || cat === 'powerlifting') {
    types.push({ type: 'strength', effectiveness: 8 });
    types.push({ type: 'hypertrophy', effectiveness: 6 });
  } else if (cat === 'stretching') {
    types.push({ type: 'mobility', effectiveness: 9 });
    types.push({ type: 'recovery', effectiveness: 7 });
  } else if (cat === 'cardio') {
    types.push({ type: 'endurance', effectiveness: 8 });
    types.push({ type: 'fat_loss', effectiveness: 7 });
  } else if (cat === 'plyometrics') {
    types.push({ type: 'speed_power', effectiveness: 9 });
    types.push({ type: 'coordination', effectiveness: 6 });
  } else if (cat === 'olympic weightlifting') {
    types.push({ type: 'speed_power', effectiveness: 8 });
    types.push({ type: 'strength', effectiveness: 7 });
    types.push({ type: 'coordination', effectiveness: 7 });
  } else if (cat === 'strongman') {
    types.push({ type: 'strength', effectiveness: 9 });
    types.push({ type: 'endurance', effectiveness: 5 });
  }

  // Additional types based on mechanic
  if (mech === 'compound') {
    // Compound movements are good for multiple goals
    if (!types.find((t) => t.type === 'strength')) {
      types.push({ type: 'strength', effectiveness: 6 });
    }
  } else if (mech === 'isolation') {
    // Isolation is good for hypertrophy
    if (!types.find((t) => t.type === 'hypertrophy')) {
      types.push({ type: 'hypertrophy', effectiveness: 7 });
    }
  }

  // Default if no types assigned
  if (types.length === 0) {
    types.push({ type: 'strength', effectiveness: 5 });
  }

  return types;
}

// ============================================
// IMPACT AND SPACE INFERENCE
// ============================================

export function inferImpactLevel(category: string | null | undefined, name: string): ImpactLevel {
  const cat = (category || '').toLowerCase();
  const nameLower = name.toLowerCase();

  // High impact: plyometrics, jumping exercises
  if (
    cat === 'plyometrics' ||
    nameLower.includes('jump') ||
    nameLower.includes('hop') ||
    nameLower.includes('bound') ||
    nameLower.includes('sprint')
  ) {
    return 'high_impact';
  }

  // No impact: stretching, static holds
  if (
    cat === 'stretching' ||
    nameLower.includes('stretch') ||
    nameLower.includes('static') ||
    nameLower.includes('isometric')
  ) {
    return 'no_impact';
  }

  return 'low_impact';
}

export function inferSpaceRequired(category: string | null | undefined, name: string): SpaceFilter {
  const cat = (category || '').toLowerCase();
  const nameLower = name.toLowerCase();

  // Large space needed for dynamic movements
  if (
    cat === 'plyometrics' ||
    cat === 'cardio' ||
    nameLower.includes('sprint') ||
    nameLower.includes('walk') ||
    nameLower.includes('run') ||
    nameLower.includes('sled')
  ) {
    return 'outdoors_hall';
  }

  // Medium space for compound lifts
  if (nameLower.includes('lunge') || nameLower.includes('deadlift') || nameLower.includes('squat')) {
    return 'living_room_3x3';
  }

  // Small space for upper body and stretches
  if (
    cat === 'stretching' ||
    nameLower.includes('curl') ||
    nameLower.includes('press') ||
    nameLower.includes('raise') ||
    nameLower.includes('stretch')
  ) {
    return 'small_bedroom_2x2';
  }

  return 'small_bedroom_2x2';
}

// ============================================
// ID GENERATION
// ============================================

export function generateExerciseId(name: string, source: string): string {
  // Create a deterministic ID from name and source
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);

  const sourcePrefix = source === 'free-exercise-db' ? 'fed' : 'ext';
  return `${sourcePrefix}_${normalized}`;
}

// ============================================
// VALIDATION
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateExternalExercise(exercise: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!exercise.name || typeof exercise.name !== 'string') {
    errors.push('Missing or invalid name');
  }

  if (!exercise.instructions || !Array.isArray(exercise.instructions) || exercise.instructions.length === 0) {
    errors.push('Missing or empty instructions');
  }

  if (!exercise.primaryMuscles || !Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0) {
    warnings.push('No primary muscles specified');
  }

  // Optional field warnings
  if (!exercise.level) {
    warnings.push('No difficulty level specified, defaulting to intermediate');
  }

  if (!exercise.category) {
    warnings.push('No category specified, defaulting to body_control');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
