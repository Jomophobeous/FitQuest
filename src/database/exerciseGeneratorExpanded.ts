/**
 * Exercise Generator Expanded — Stub
 * The full generator was part of the extended codebase.
 * Returns empty array — handcrafted exercises in seed.ts are sufficient for core.
 */

import type {
  Category,
  Difficulty,
  EquipmentLevel,
  ImpactLevel,
  SpaceFilter,
  TargetMuscle,
  EquipmentItem,
  TrainingType,
} from './types';

export interface GeneratedExercise {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  equipment_level: EquipmentLevel;
  impact_level: ImpactLevel;
  space_required: SpaceFilter;
  time_per_set_seconds: number;
  instructions: string[];
  order_in_category: number;
  primary_muscles: TargetMuscle[];
  secondary_muscles: TargetMuscle[];
  equipment_required: EquipmentItem[];
  equipment_optional: EquipmentItem[];
  training_types: { type: TrainingType; effectiveness: number }[];
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
}

export function generateAllExercises(): GeneratedExercise[] {
  return [];
}
