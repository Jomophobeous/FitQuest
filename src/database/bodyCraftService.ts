/**
 * FitQuest Body Craft Database Service
 * CRUD operations for body_craft_algorithms table
 */

import { getDatabase } from './schema';
import type { BodyCraftAlgorithm } from '../engines/bodyCraftEngine';

// ============================================
// SAVE
// ============================================

/**
 * Save a new BodyCraftAlgorithm, deactivating any previous active one
 */
export async function saveBodyCraftAlgorithm(algo: BodyCraftAlgorithm): Promise<void> {
  const db = await getDatabase();

  // Deactivate previous active algorithm for this user
  await db.runAsync(
    'UPDATE body_craft_algorithms SET active = 0 WHERE user_id = ? AND active = 1',
    [algo.user_id]
  );

  await db.runAsync(
    `INSERT INTO body_craft_algorithms (
      id, user_id, body_type, goal_type, timeline_months,
      muscle_priorities, recommended_training_split, training_days_per_week,
      calories_target, protein_g, carbs_g, fats_g,
      daily_water_liters, sleep_hours, cardio_minutes_per_week,
      exercise_category_weights, weekly_schedule, nutrition_tips,
      active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      algo.id,
      algo.user_id,
      algo.body_type,
      algo.goal_type,
      algo.timeline_months,
      JSON.stringify(algo.muscle_priorities),
      algo.recommended_training_split,
      algo.training_days_per_week,
      algo.calories_target,
      algo.protein_g,
      algo.carbs_g,
      algo.fats_g,
      algo.daily_water_liters,
      algo.sleep_hours,
      algo.cardio_minutes_per_week,
      JSON.stringify(algo.exercise_category_weights),
      JSON.stringify(algo.weekly_schedule),
      JSON.stringify(algo.nutrition_tips),
      algo.created_at,
    ]
  );
}

// ============================================
// GET ACTIVE
// ============================================

/**
 * Get the currently active BodyCraftAlgorithm for a user
 */
export async function getActiveBodyCraftAlgorithm(userId: string): Promise<BodyCraftAlgorithm | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<Record<string, any>>(
    'SELECT * FROM body_craft_algorithms WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    body_type: row.body_type,
    goal_type: row.goal_type,
    timeline_months: row.timeline_months,
    muscle_priorities: JSON.parse(row.muscle_priorities),
    recommended_training_split: row.recommended_training_split,
    training_days_per_week: row.training_days_per_week,
    calories_target: row.calories_target,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fats_g: row.fats_g,
    daily_water_liters: row.daily_water_liters,
    sleep_hours: row.sleep_hours,
    cardio_minutes_per_week: row.cardio_minutes_per_week,
    exercise_category_weights: JSON.parse(row.exercise_category_weights),
    weekly_schedule: JSON.parse(row.weekly_schedule),
    nutrition_tips: JSON.parse(row.nutrition_tips),
    created_at: row.created_at,
  };
}

// ============================================
// APPLY TO PROFILE
// ============================================

/**
 * Apply a BodyCraftAlgorithm to the user's profile
 * Updates the user_profile goal and training_days_per_week
 */
export async function applyAlgorithmToProfile(userId: string, algo: BodyCraftAlgorithm): Promise<void> {
  const db = await getDatabase();

  // Map goal_type to the closest exercise category for the user_profile goal field
  const goalToCategory: Record<string, string> = {
    lean_athletic: 'calisthenics',
    muscular_powerful: 'building_muscle',
    tall_flexible: 'getting_taller',
    balanced_toned: 'calisthenics',
    custom: 'calisthenics',
  };

  const mappedGoal = goalToCategory[algo.goal_type] || 'calisthenics';

  await db.runAsync(
    `UPDATE user_profile SET goal = ?, training_days_per_week = ?, updated_at = datetime('now') WHERE id = ?`,
    [mappedGoal, algo.training_days_per_week, userId]
  );
}
