/**
 * FitQuest Database Service
 * CRUD operations and query helpers for client-side SQLite
 */

import { getDatabase } from './schema';
import type {
  Exercise,
  ExerciseWithDetails,
  ExerciseFilter,
  UserProfile,
  UserEquipment,
  UserInjury,
  MuscleFatigue,
  WorkoutSession,
  SessionExercise,
  ProgressRecord,
  SubscriptionState,
  Category,
  Difficulty,
  EquipmentItem,
  EquipmentLevel,
  TargetMuscle,
  TrainingType,
  ImpactLevel,
  SpaceFilter,
} from './types';

// ============================================
// EXERCISE QUERIES
// ============================================

/**
 * Get all exercises with optional filtering
 */
export async function getExercises(filter?: ExerciseFilter): Promise<ExerciseWithDetails[]> {
  const db = await getDatabase();

  let sql = `
    SELECT 
      e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN em.is_primary = 1 THEN em.muscle END) as primary_muscles,
      GROUP_CONCAT(DISTINCT CASE WHEN em.is_primary = 0 THEN em.muscle END) as secondary_muscles,
      GROUP_CONCAT(DISTINCT CASE WHEN ee.is_required = 1 THEN ee.equipment END) as equipment_required,
      GROUP_CONCAT(DISTINCT CASE WHEN ee.is_required = 0 THEN ee.equipment END) as equipment_optional
    FROM exercises e
    LEFT JOIN exercise_muscles em ON e.id = em.exercise_id
    LEFT JOIN exercise_equipment ee ON e.id = ee.exercise_id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter) {
    if (filter.categories?.length) {
      conditions.push(`e.category IN (${filter.categories.map(() => '?').join(',')})`);
      params.push(...filter.categories);
    }
    if (filter.difficulties?.length) {
      conditions.push(`e.difficulty IN (${filter.difficulties.map(() => '?').join(',')})`);
      params.push(...filter.difficulties);
    }
    if (filter.equipment_levels?.length) {
      conditions.push(`e.equipment_level IN (${filter.equipment_levels.map(() => '?').join(',')})`);
      params.push(...filter.equipment_levels);
    }
    if (filter.impact_levels?.length) {
      conditions.push(`e.impact_level IN (${filter.impact_levels.map(() => '?').join(',')})`);
      params.push(...filter.impact_levels);
    }
    if (filter.space_filters?.length) {
      conditions.push(`e.space_required IN (${filter.space_filters.map(() => '?').join(',')})`);
      params.push(...filter.space_filters);
    }
    if (filter.max_time_per_set) {
      conditions.push(`e.time_per_set_seconds <= ?`);
      params.push(filter.max_time_per_set);
    }
    if (filter.target_muscles?.length) {
      conditions.push(`em.muscle IN (${filter.target_muscles.map(() => '?').join(',')})`);
      params.push(...filter.target_muscles);
    }
    // training_types filter: use subquery to avoid LEFT JOIN elimination
    if (filter.training_types?.length) {
      conditions.push(`e.id IN (
        SELECT exercise_id FROM exercise_training_types
        WHERE training_type IN (${filter.training_types.map(() => '?').join(',')})
      )`);
      params.push(...filter.training_types);
    }
    if (filter.exclude_muscles?.length) {
      conditions.push(`e.id NOT IN (
        SELECT exercise_id FROM exercise_muscles 
        WHERE muscle IN (${filter.exclude_muscles.map(() => '?').join(',')}) AND is_primary = 1
      )`);
      params.push(...filter.exclude_muscles);
    }
  }

  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` GROUP BY e.id ORDER BY e.category, e.order_in_category`;

  const rows = await db.getAllAsync<any>(sql, params);

  return rows.map(row => ({
    ...row,
    instructions: JSON.parse(row.instructions || '[]'),
    primary_muscles: row.primary_muscles?.split(',').filter(Boolean) || [],
    secondary_muscles: row.secondary_muscles?.split(',').filter(Boolean) || [],
    equipment_required: row.equipment_required?.split(',').filter(Boolean) || [],
    equipment_optional: row.equipment_optional?.split(',').filter(Boolean) || [],
    training_types: [], // Loaded separately if needed
  }));
}

/**
 * Get a single exercise by ID with full details
 */
export async function getExerciseById(id: string): Promise<ExerciseWithDetails | null> {
  const db = await getDatabase();

  const exercise = await db.getFirstAsync<any>(
    `SELECT * FROM exercises WHERE id = ?`,
    [id]
  );

  if (!exercise) return null;

  const muscles = await db.getAllAsync<{ muscle: string; is_primary: number }>(
    `SELECT muscle, is_primary FROM exercise_muscles WHERE exercise_id = ?`,
    [id]
  );

  const equipment = await db.getAllAsync<{ equipment: string; is_required: number }>(
    `SELECT equipment, is_required FROM exercise_equipment WHERE exercise_id = ?`,
    [id]
  );

  const trainingTypes = await db.getAllAsync<{ training_type: string; effectiveness: number }>(
    `SELECT training_type, effectiveness FROM exercise_training_types WHERE exercise_id = ?`,
    [id]
  );

  return {
    ...exercise,
    instructions: JSON.parse(exercise.instructions || '[]'),
    primary_muscles: muscles.filter(m => m.is_primary).map(m => m.muscle as TargetMuscle),
    secondary_muscles: muscles.filter(m => !m.is_primary).map(m => m.muscle as TargetMuscle),
    equipment_required: equipment.filter(e => e.is_required).map(e => e.equipment as EquipmentItem),
    equipment_optional: equipment.filter(e => !e.is_required).map(e => e.equipment as EquipmentItem),
    training_types: trainingTypes.map(t => ({
      type: t.training_type as TrainingType,
      effectiveness: t.effectiveness,
    })),
  };
}

/**
 * Get exercises by category
 */
export async function getExercisesByCategory(category: Category): Promise<ExerciseWithDetails[]> {
  return getExercises({ categories: [category] });
}

/**
 * Get exercises targeting specific muscles
 */
export async function getExercisesByMuscle(
  muscles: TargetMuscle[],
  primaryOnly = true
): Promise<ExerciseWithDetails[]> {
  const db = await getDatabase();

  const placeholders = muscles.map(() => '?').join(',');
  const primaryFilter = primaryOnly ? 'AND is_primary = 1' : '';

  const exerciseIds = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT DISTINCT exercise_id FROM exercise_muscles 
     WHERE muscle IN (${placeholders}) ${primaryFilter}`,
    muscles
  );

  if (!exerciseIds.length) return [];

  const ids = exerciseIds.map(r => r.exercise_id);
  return getExercises({ categories: undefined }); // Then filter by ids
}

// ============================================
// USER PROFILE QUERIES
// ============================================

/**
 * Get or create user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = await getDatabase();
  return db.getFirstAsync<UserProfile>(
    `SELECT * FROM user_profile WHERE id = ?`,
    [userId]
  );
}

/**
 * Create user profile
 */
export async function createUserProfile(profile: Omit<UserProfile, 'created_at' | 'updated_at'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO user_profile (id, sex, weight_kg, height_cm, goal, experience, 
      training_days_per_week, time_per_session_minutes, locked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.sex || null,
      profile.weight_kg || null,
      profile.height_cm || null,
      profile.goal,
      profile.experience,
      profile.training_days_per_week,
      profile.time_per_session_minutes,
      profile.locked ? 1 : 0,
    ]
  );
}

/**
 * Update user profile (only if not locked)
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  const db = await getDatabase();

  // Check if locked
  const profile = await getUserProfile(userId);
  if (profile?.locked) return false;

  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'locked') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (!fields.length) return true;

  fields.push(`updated_at = datetime('now')`);
  values.push(userId);

  await db.runAsync(
    `UPDATE user_profile SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return true;
}

/**
 * Lock user profile (prevents further edits)
 */
export async function lockUserProfile(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE user_profile SET locked = 1, updated_at = datetime('now') WHERE id = ?`,
    [userId]
  );
}

// ============================================
// USER EQUIPMENT QUERIES
// ============================================

/**
 * Get user's available equipment
 */
export async function getUserEquipment(userId: string): Promise<EquipmentItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ equipment: string }>(
    `SELECT equipment FROM user_equipment WHERE user_id = ?`,
    [userId]
  );
  return rows.map(r => r.equipment as EquipmentItem);
}

/**
 * Set user's equipment (replaces existing)
 */
export async function setUserEquipment(userId: string, equipment: EquipmentItem[]): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM user_equipment WHERE user_id = ?`, [userId]);

  for (const item of equipment) {
    await db.runAsync(
      `INSERT INTO user_equipment (user_id, equipment) VALUES (?, ?)`,
      [userId, item]
    );
  }
}

// ============================================
// INJURY TRACKING QUERIES
// ============================================

/**
 * Get user's current injuries
 */
export async function getUserInjuries(userId: string): Promise<UserInjury[]> {
  const db = await getDatabase();
  return db.getAllAsync<UserInjury>(
    `SELECT * FROM user_injuries WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Add/update an injury
 */
export async function setUserInjury(
  userId: string,
  muscle: TargetMuscle,
  severity: 'mild' | 'moderate' | 'severe'
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_injuries (user_id, muscle, severity) VALUES (?, ?, ?)`,
    [userId, muscle, severity]
  );
}

/**
 * Remove an injury
 */
export async function removeUserInjury(userId: string, muscle: TargetMuscle): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM user_injuries WHERE user_id = ? AND muscle = ?`,
    [userId, muscle]
  );
}

// ============================================
// FATIGUE TRACKING QUERIES
// ============================================

/**
 * Get muscle fatigue levels for user
 */
export async function getMuscleFatigue(userId: string): Promise<MuscleFatigue[]> {
  const db = await getDatabase();
  return db.getAllAsync<MuscleFatigue>(
    `SELECT * FROM muscle_fatigue WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Get fatigue for specific muscle
 */
export async function getMuscleFatigueLevel(
  userId: string,
  muscle: TargetMuscle
): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ fatigue_level: number }>(
    `SELECT fatigue_level FROM muscle_fatigue WHERE user_id = ? AND muscle = ?`,
    [userId, muscle]
  );
  return result?.fatigue_level ?? 0;
}

/**
 * Update fatigue for a muscle
 */
export async function updateMuscleFatigue(
  userId: string,
  muscle: TargetMuscle,
  fatigueLevel: number,
  trained = false
): Promise<void> {
  const db = await getDatabase();
  const clampedLevel = Math.max(0, Math.min(100, fatigueLevel));

  await db.runAsync(
    `INSERT INTO muscle_fatigue (user_id, muscle, fatigue_level, last_trained_at, updated_at)
     VALUES (?, ?, ?, ${trained ? "datetime('now')" : 'NULL'}, datetime('now'))
     ON CONFLICT(user_id, muscle) DO UPDATE SET
       fatigue_level = ?,
       last_trained_at = ${trained ? "datetime('now')" : 'last_trained_at'},
       updated_at = datetime('now')`,
    [userId, muscle, clampedLevel, clampedLevel]
  );
}

/**
 * Apply daily recovery to all muscles
 */
export async function applyDailyRecovery(userId: string, recoveryRate = 8): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE muscle_fatigue 
     SET fatigue_level = MAX(0, fatigue_level - ?),
         updated_at = datetime('now')
     WHERE user_id = ?`,
    [recoveryRate, userId]
  );
}

// ============================================
// WORKOUT SESSION QUERIES
// ============================================

/**
 * Create a new workout session
 */
export async function createWorkoutSession(
  session: Omit<WorkoutSession, 'started_at' | 'completed_at'>
): Promise<string> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, user_id, duration_minutes, total_exercises, 
      completed_exercises, success, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.user_id,
      session.duration_minutes,
      session.total_exercises,
      session.completed_exercises,
      session.success ? 1 : 0,
      session.notes || null,
    ]
  );
  return session.id;
}

/**
 * Complete a workout session
 */
export async function completeWorkoutSession(
  sessionId: string,
  completedExercises: number,
  success: boolean
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE workout_sessions 
     SET completed_at = datetime('now'),
         completed_exercises = ?,
         success = ?
     WHERE id = ?`,
    [completedExercises, success ? 1 : 0, sessionId]
  );
}

/**
 * Get recent sessions for user
 */
export async function getRecentSessions(
  userId: string,
  limit = 7
): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions 
     WHERE user_id = ? 
     ORDER BY started_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
}

/**
 * Add exercise to session
 */
export async function addSessionExercise(exercise: SessionExercise): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO session_exercises (id, session_id, exercise_id, order_in_session,
      prescribed_sets, prescribed_reps, completed_sets, completed_reps, skipped, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.session_id,
      exercise.exercise_id,
      exercise.order_in_session,
      exercise.prescribed_sets,
      exercise.prescribed_reps,
      exercise.completed_sets,
      exercise.completed_reps || null,
      exercise.skipped ? 1 : 0,
      exercise.notes || null,
    ]
  );
}

// ============================================
// PROGRESS TRACKING QUERIES
// ============================================

/**
 * Record progress for an exercise
 */
export async function recordProgress(record: ProgressRecord): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO progress_records (id, user_id, exercise_id, date, 
      sets_completed, reps_achieved, difficulty_rating, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.user_id,
      record.exercise_id,
      record.date,
      record.sets_completed,
      record.reps_achieved,
      record.difficulty_rating || null,
      record.notes || null,
    ]
  );
}

/**
 * Get progress history for an exercise
 */
export async function getProgressHistory(
  userId: string,
  exerciseId: string,
  limit = 30
): Promise<ProgressRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProgressRecord>(
    `SELECT * FROM progress_records 
     WHERE user_id = ? AND exercise_id = ?
     ORDER BY date DESC
     LIMIT ?`,
    [userId, exerciseId, limit]
  );
}

// ============================================
// SUBSCRIPTION QUERIES
// ============================================

/**
 * Get subscription state
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SubscriptionState>(
    `SELECT * FROM subscription_state WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Update subscription state
 */
export async function updateSubscriptionState(
  state: Omit<SubscriptionState, 'last_verified_at'>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO subscription_state (user_id, tier, expires_at, grace_period_start, receipt_data)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       tier = ?,
       expires_at = ?,
       last_verified_at = datetime('now'),
       grace_period_start = ?,
       receipt_data = ?`,
    [
      state.user_id,
      state.tier,
      state.expires_at || null,
      state.grace_period_start || null,
      state.receipt_data || null,
      state.tier,
      state.expires_at || null,
      state.grace_period_start || null,
      state.receipt_data || null,
    ]
  );
}

// ============================================
// APP STATE QUERIES
// ============================================

/**
 * Get app state value
 */
export async function getAppState(key: string): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_state WHERE key = ?`,
    [key]
  );
  return result?.value ?? null;
}

/**
 * Set app state value
 */
export async function setAppState(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    [key, value, value]
  );
}

// ============================================
// STREAK QUERIES
// ============================================

/**
 * Update workout streak
 */
export async function updateStreak(userId: string): Promise<{ current: number; longest: number }> {
  const db = await getDatabase();

  const streak = await db.getFirstAsync<{
    current_streak: number;
    longest_streak: number;
    last_workout_date: string | null;
  }>(
    `SELECT * FROM workout_streaks WHERE user_id = ?`,
    [userId]
  );

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let currentStreak = 1;
  let longestStreak = streak?.longest_streak ?? 0;

  if (streak?.last_workout_date === yesterday) {
    currentStreak = streak.current_streak + 1;
  } else if (streak?.last_workout_date === today) {
    currentStreak = streak.current_streak;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  await db.runAsync(
    `INSERT INTO workout_streaks (user_id, current_streak, longest_streak, last_workout_date)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       current_streak = ?,
       longest_streak = ?,
       last_workout_date = ?,
       updated_at = datetime('now')`,
    [userId, currentStreak, longestStreak, today, currentStreak, longestStreak, today]
  );

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Get current streak
 */
export async function getStreak(userId: string): Promise<{ current: number; longest: number }> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ current_streak: number; longest_streak: number }>(
    `SELECT current_streak, longest_streak FROM workout_streaks WHERE user_id = ?`,
    [userId]
  );
  return {
    current: result?.current_streak ?? 0,
    longest: result?.longest_streak ?? 0,
  };
}

// ============================================
// USER PROGRESS (AGGREGATED DATA)
// ============================================

export interface UserProgressData {
  total_workouts: number;
  completed_workouts: number;
  current_streak: number;
  longest_streak: number;
  total_exercises_done: number;
  weekly_xp: number;
  last_workout_date: string | null;
}

/**
 * Get aggregated user progress for dashboard
 */
export async function getUserProgress(userId: string = 'user_local_001'): Promise<UserProgressData> {
  const db = await getDatabase();
  
  // Get workout stats
  const workoutStats = await db.getFirstAsync<{
    total: number;
    completed: number;
    exercises: number;
  }>(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
       SUM(completed_exercises) as exercises
     FROM workout_sessions WHERE user_id = ?`,
    [userId]
  );
  
  // Get streak info
  const streakInfo = await getStreak(userId);
  
  // Get last workout date
  const lastWorkout = await db.getFirstAsync<{ last_date: string | null }>(
    `SELECT MAX(started_at) as last_date FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL`,
    [userId]
  );
  
  // Calculate weekly XP (rough estimate based on recent activity)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weeklyWorkouts = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM workout_sessions 
     WHERE user_id = ? AND started_at > ? AND completed_at IS NOT NULL`,
    [userId, weekAgo]
  );
  const weeklyXP = (weeklyWorkouts?.count ?? 0) * 100; // 100 XP per workout
  
  return {
    total_workouts: workoutStats?.total ?? 0,
    completed_workouts: workoutStats?.completed ?? 0,
    current_streak: streakInfo.current,
    longest_streak: streakInfo.longest,
    total_exercises_done: workoutStats?.exercises ?? 0,
    weekly_xp: weeklyXP,
    last_workout_date: lastWorkout?.last_date ?? null,
  };
}
