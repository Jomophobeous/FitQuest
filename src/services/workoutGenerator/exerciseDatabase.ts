/**
 * FitQuest Mock Exercise Database
 * Integrated with Apollo Client for local queries
 */

import { ExerciseRecord, Muscle, MovementPattern, Goal } from './types';

// ============================================================================
// COMPLETE EXERCISE DATABASE
// ============================================================================

export const EXERCISE_DATABASE: ExerciseRecord[] = [
  // CHEST EXERCISES
  {
    id: 'ex_bench_press',
    name: 'Barbell Bench Press',
    primary_muscle: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    movement_pattern: 'push',
    equipment_required: ['barbell'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 45,
    rep_profile: { min_reps: 4, max_reps: 8, ideal_reps: 6 },
    injury_safe_for: ['shoulders', 'back'],
    instructions: 'Lie flat on bench, lower bar to chest, press up explosively.',
  },
  {
    id: 'ex_dumbbell_press',
    name: 'Dumbbell Bench Press',
    primary_muscle: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    movement_pattern: 'push',
    equipment_required: ['dumbbell'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 40,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 8 },
    injury_safe_for: ['shoulders', 'back'],
  },
  {
    id: 'ex_pushups',
    name: 'Push-ups',
    primary_muscle: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    movement_pattern: 'push',
    equipment_required: ['bodyweight'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy', 'endurance'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 8, max_reps: 20, ideal_reps: 12 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_cable_fly',
    name: 'Cable Chest Fly',
    primary_muscle: 'chest',
    secondary_muscles: ['shoulders'],
    movement_pattern: 'push',
    equipment_required: ['cable'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy'],
    time_to_perform_sec: 35,
    rep_profile: { min_reps: 8, max_reps: 15, ideal_reps: 12 },
    injury_safe_for: ['shoulders', 'back'],
  },
  {
    id: 'ex_incline_press',
    name: 'Incline Dumbbell Press',
    primary_muscle: 'chest',
    secondary_muscles: ['shoulders', 'triceps'],
    movement_pattern: 'push',
    equipment_required: ['dumbbell'],
    difficulty: 'intermediate',
    goal_alignment: ['hypertrophy', 'strength'],
    time_to_perform_sec: 40,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 8 },
    injury_safe_for: ['back'],
  },

  // BACK EXERCISES
  {
    id: 'ex_barbell_row',
    name: 'Barbell Row',
    primary_muscle: 'back',
    secondary_muscles: ['biceps', 'lower_back'],
    movement_pattern: 'pull',
    equipment_required: ['barbell'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 45,
    rep_profile: { min_reps: 4, max_reps: 8, ideal_reps: 6 },
    injury_safe_for: ['chest', 'shoulders'],
  },
  {
    id: 'ex_pullups',
    name: 'Pull-ups',
    primary_muscle: 'back',
    secondary_muscles: ['biceps'],
    movement_pattern: 'pull',
    equipment_required: ['bodyweight'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 4, max_reps: 12, ideal_reps: 8 },
    injury_safe_for: ['chest', 'lower_back'],
  },
  {
    id: 'ex_lat_pulldown',
    name: 'Lat Pulldown',
    primary_muscle: 'back',
    secondary_muscles: ['biceps'],
    movement_pattern: 'pull',
    equipment_required: ['machine', 'cable'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 35,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 10 },
    injury_safe_for: ['chest', 'shoulders', 'lower_back'],
  },
  {
    id: 'ex_cable_row',
    name: 'Seated Cable Row',
    primary_muscle: 'back',
    secondary_muscles: ['biceps', 'lower_back'],
    movement_pattern: 'pull',
    equipment_required: ['cable', 'machine'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 40,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 10 },
    injury_safe_for: ['chest', 'shoulders'],
  },
  {
    id: 'ex_dumbbell_row',
    name: 'Dumbbell Row',
    primary_muscle: 'back',
    secondary_muscles: ['biceps'],
    movement_pattern: 'pull',
    equipment_required: ['dumbbell'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 35,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 10 },
    injury_safe_for: ['chest', 'shoulders', 'lower_back'],
  },

  // SHOULDER EXERCISES
  {
    id: 'ex_ohp',
    name: 'Overhead Press',
    primary_muscle: 'shoulders',
    secondary_muscles: ['triceps', 'upper_back'],
    movement_pattern: 'push',
    equipment_required: ['barbell'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 40,
    rep_profile: { min_reps: 4, max_reps: 8, ideal_reps: 6 },
    injury_safe_for: ['chest', 'back'],
  },
  {
    id: 'ex_lateral_raise',
    name: 'Lateral Raise',
    primary_muscle: 'shoulders',
    secondary_muscles: [],
    movement_pattern: 'push',
    equipment_required: ['dumbbell'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy', 'mobility'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 8, max_reps: 15, ideal_reps: 12 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_face_pull',
    name: 'Face Pull',
    primary_muscle: 'shoulders',
    secondary_muscles: ['back'],
    movement_pattern: 'pull',
    equipment_required: ['cable', 'resistance_band'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy', 'mobility', 'endurance'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 10, max_reps: 20, ideal_reps: 15 },
    injury_safe_for: ['all'],
  },

  // LEG EXERCISES
  {
    id: 'ex_squat',
    name: 'Barbell Back Squat',
    primary_muscle: 'quads',
    secondary_muscles: ['glutes', 'hamstrings'],
    movement_pattern: 'leg',
    equipment_required: ['barbell'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy', 'fat_loss'],
    time_to_perform_sec: 50,
    rep_profile: { min_reps: 4, max_reps: 10, ideal_reps: 6 },
    injury_safe_for: ['shoulders', 'arms', 'back'],
  },
  {
    id: 'ex_goblet_squat',
    name: 'Goblet Squat',
    primary_muscle: 'quads',
    secondary_muscles: ['glutes', 'hamstrings'],
    movement_pattern: 'leg',
    equipment_required: ['dumbbell', 'kettlebell'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy', 'mobility'],
    time_to_perform_sec: 40,
    rep_profile: { min_reps: 6, max_reps: 15, ideal_reps: 10 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_leg_press',
    name: 'Leg Press Machine',
    primary_muscle: 'quads',
    secondary_muscles: ['glutes', 'hamstrings'],
    movement_pattern: 'leg',
    equipment_required: ['machine'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 45,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 10 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_deadlift',
    name: 'Conventional Deadlift',
    primary_muscle: 'hamstrings',
    secondary_muscles: ['glutes', 'lower_back', 'back'],
    movement_pattern: 'leg',
    equipment_required: ['barbell'],
    difficulty: 'advanced',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 50,
    rep_profile: { min_reps: 3, max_reps: 6, ideal_reps: 5 },
    injury_safe_for: ['chest', 'shoulders'],
  },
  {
    id: 'ex_leg_curl',
    name: 'Leg Curl Machine',
    primary_muscle: 'hamstrings',
    secondary_muscles: [],
    movement_pattern: 'leg',
    equipment_required: ['machine'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy'],
    time_to_perform_sec: 35,
    rep_profile: { min_reps: 8, max_reps: 15, ideal_reps: 12 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_glute_bridge',
    name: 'Glute Bridge',
    primary_muscle: 'glutes',
    secondary_muscles: ['hamstrings', 'lower_back'],
    movement_pattern: 'leg',
    equipment_required: ['bodyweight'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'hypertrophy', 'mobility'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 8, max_reps: 20, ideal_reps: 15 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_calf_raise',
    name: 'Calf Raise',
    primary_muscle: 'calves',
    secondary_muscles: [],
    movement_pattern: 'leg',
    equipment_required: ['bodyweight', 'dumbbell'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy', 'endurance'],
    time_to_perform_sec: 25,
    rep_profile: { min_reps: 10, max_reps: 20, ideal_reps: 15 },
    injury_safe_for: ['all'],
  },

  // ARM EXERCISES
  {
    id: 'ex_barbell_curl',
    name: 'Barbell Curl',
    primary_muscle: 'biceps',
    secondary_muscles: ['forearms'],
    movement_pattern: 'pull',
    equipment_required: ['barbell'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy', 'strength'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 6, max_reps: 12, ideal_reps: 10 },
    injury_safe_for: ['chest', 'shoulders', 'back'],
  },
  {
    id: 'ex_dumbbell_curl',
    name: 'Dumbbell Curl',
    primary_muscle: 'biceps',
    secondary_muscles: ['forearms'],
    movement_pattern: 'pull',
    equipment_required: ['dumbbell'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 6, max_reps: 15, ideal_reps: 10 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_tricep_dips',
    name: 'Tricep Dips',
    primary_muscle: 'triceps',
    secondary_muscles: ['chest', 'shoulders'],
    movement_pattern: 'push',
    equipment_required: ['bodyweight'],
    difficulty: 'intermediate',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 4, max_reps: 12, ideal_reps: 8 },
    injury_safe_for: ['legs', 'back'],
  },
  {
    id: 'ex_tricep_pushdown',
    name: 'Tricep Pushdown',
    primary_muscle: 'triceps',
    secondary_muscles: [],
    movement_pattern: 'push',
    equipment_required: ['cable', 'resistance_band'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy'],
    time_to_perform_sec: 25,
    rep_profile: { min_reps: 8, max_reps: 15, ideal_reps: 12 },
    injury_safe_for: ['all'],
  },

  // CORE EXERCISES
  {
    id: 'ex_plank',
    name: 'Plank Hold',
    primary_muscle: 'abs',
    secondary_muscles: ['obliques', 'lower_back'],
    movement_pattern: 'core',
    equipment_required: ['bodyweight'],
    difficulty: 'beginner',
    goal_alignment: ['strength', 'endurance', 'mobility'],
    time_to_perform_sec: 45,
    rep_profile: { min_reps: 20, max_reps: 60, ideal_reps: 30 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_crunch',
    name: 'Crunches',
    primary_muscle: 'abs',
    secondary_muscles: [],
    movement_pattern: 'core',
    equipment_required: ['bodyweight'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy'],
    time_to_perform_sec: 25,
    rep_profile: { min_reps: 10, max_reps: 25, ideal_reps: 15 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_hanging_leg_raise',
    name: 'Hanging Leg Raise',
    primary_muscle: 'abs',
    secondary_muscles: ['lower_back'],
    movement_pattern: 'core',
    equipment_required: ['bodyweight'],
    difficulty: 'advanced',
    goal_alignment: ['strength', 'hypertrophy'],
    time_to_perform_sec: 35,
    rep_profile: { min_reps: 4, max_reps: 15, ideal_reps: 8 },
    injury_safe_for: ['all'],
  },
  {
    id: 'ex_russian_twist',
    name: 'Russian Twist',
    primary_muscle: 'obliques',
    secondary_muscles: ['abs'],
    movement_pattern: 'core',
    equipment_required: ['dumbbell', 'medicine_ball'],
    difficulty: 'beginner',
    goal_alignment: ['hypertrophy', 'mobility'],
    time_to_perform_sec: 30,
    rep_profile: { min_reps: 8, max_reps: 20, ideal_reps: 15 },
    injury_safe_for: ['all'],
  },
];

// ============================================================================
// EXERCISE FILTERS & QUERIES
// ============================================================================

export function filterExercisesByMuscle(muscle: Muscle): ExerciseRecord[] {
  return EXERCISE_DATABASE.filter(
    (ex) => ex.primary_muscle === muscle || ex.secondary_muscles.includes(muscle)
  );
}

export function filterExercisesByGoal(goal: Goal): ExerciseRecord[] {
  return EXERCISE_DATABASE.filter((ex) => ex.goal_alignment.includes(goal));
}

export function filterExercisesByPattern(pattern: MovementPattern): ExerciseRecord[] {
  return EXERCISE_DATABASE.filter((ex) => ex.movement_pattern === pattern);
}

export function filterExercisesByEquipment(equipment: string[]): ExerciseRecord[] {
  return EXERCISE_DATABASE.filter((ex) =>
    ex.equipment_required.some((eq) => equipment.includes(eq))
  );
}

export function getExerciseById(id: string): ExerciseRecord | null {
  return EXERCISE_DATABASE.find((ex) => ex.id === id) || null;
}

export function getAllExercises(): ExerciseRecord[] {
  return [...EXERCISE_DATABASE];
}
