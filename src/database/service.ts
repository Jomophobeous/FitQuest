/**
 * FitQuest Database Service
 * CRUD operations and query helpers for client-side SQLite
 */

import { getDatabase } from './schema';
import { queryCache } from './queryCache';
import type {
  ExerciseWithDetails,
  ExerciseFilter,
  ExerciseImageRecord,
  UserProfile,
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
  DocumentStatus,
  FitMindDocument,
  ReadingSession,
  Annotation,
  Flashcard,
} from './types';
import type { BodyCraftAlgorithm } from '../engines/bodyCraftEngine';
import { generateSecureId } from '../security/randomId';
import { walService } from '../services/WriteAheadLogService';
import { safeWarn } from '../services/logger';

// ============================================
// HELPERS
// ============================================

/**
 * Safely parse the `instructions` column which may be:
 *  - A valid JSON array string: '["step 1","step 2"]'
 *  - Plain text (from external seed data): 'Begin by standing...'
 *  - null/undefined/empty
 * Always returns a string[].
 */
function safeParseInstructions(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  const trimmed = raw.trim();
  // If it looks like a JSON array, try parsing
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Fallback below
    }
  }
  // Plain text — split by newlines or return as single-element array
  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [trimmed];
}

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
  const params: (string | number | null)[] = [];

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

  const exerciseIds = rows.map((row) => row.id as string);
  const trainingTypesByExercise = new Map<string, Array<{ type: TrainingType; effectiveness: number }>>();

  if (exerciseIds.length > 0) {
    const placeholders = exerciseIds.map(() => '?').join(',');
    const trainingRows = await db.getAllAsync<{
      exercise_id: string;
      training_type: string;
      effectiveness: number;
    }>(
      `SELECT exercise_id, training_type, effectiveness
       FROM exercise_training_types
       WHERE exercise_id IN (${placeholders})
       ORDER BY exercise_id, effectiveness DESC`,
      exerciseIds,
    );

    for (const row of trainingRows) {
      const existing = trainingTypesByExercise.get(row.exercise_id) || [];
      existing.push({
        type: row.training_type as TrainingType,
        effectiveness: row.effectiveness,
      });
      trainingTypesByExercise.set(row.exercise_id, existing);
    }
  }

  return rows.map((row) => ({
    ...row,
    instructions: safeParseInstructions(row.instructions),
    primary_muscles: row.primary_muscles?.split(',').filter(Boolean) || [],
    secondary_muscles: row.secondary_muscles?.split(',').filter(Boolean) || [],
    equipment_required: row.equipment_required?.split(',').filter(Boolean) || [],
    equipment_optional: row.equipment_optional?.split(',').filter(Boolean) || [],
    training_types: trainingTypesByExercise.get(row.id) || [],
  }));
}

/**
 * Get a single exercise by ID with full details
 */
export async function getExerciseById(id: string): Promise<ExerciseWithDetails | null> {
  const db = await getDatabase();

  const exercise = await db.getFirstAsync<any>(`SELECT * FROM exercises WHERE id = ?`, [id]);

  if (!exercise) return null;

  // Fetch related data in parallel instead of sequentially
  const [muscles, equipment, trainingTypes] = await Promise.all([
    db.getAllAsync<{ muscle: string; is_primary: number }>(
      `SELECT muscle, is_primary FROM exercise_muscles WHERE exercise_id = ?`,
      [id],
    ),
    db.getAllAsync<{ equipment: string; is_required: number }>(
      `SELECT equipment, is_required FROM exercise_equipment WHERE exercise_id = ?`,
      [id],
    ),
    db.getAllAsync<{ training_type: string; effectiveness: number }>(
      `SELECT training_type, effectiveness FROM exercise_training_types WHERE exercise_id = ?`,
      [id],
    ),
  ]);

  return {
    ...exercise,
    instructions: safeParseInstructions(exercise.instructions),
    primary_muscles: muscles.filter((m) => m.is_primary).map((m) => m.muscle as TargetMuscle),
    secondary_muscles: muscles.filter((m) => !m.is_primary).map((m) => m.muscle as TargetMuscle),
    equipment_required: equipment.filter((e) => e.is_required).map((e) => e.equipment as EquipmentItem),
    equipment_optional: equipment.filter((e) => !e.is_required).map((e) => e.equipment as EquipmentItem),
    training_types: trainingTypes.map((t) => ({
      type: t.training_type as TrainingType,
      effectiveness: t.effectiveness,
    })),
  };
}

/**
 * Batch-fetch multiple exercises by ID in a single round-trip.
 * Returns a Map for O(1) lookup by exercise ID.
 */
export async function getExercisesByIds(ids: string[]): Promise<Map<string, ExerciseWithDetails>> {
  if (ids.length === 0) return new Map();
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');

  const [rows, muscles, equipment, trainingTypes] = await Promise.all([
    db.getAllAsync<any>(`SELECT * FROM exercises WHERE id IN (${placeholders})`, ids),
    db.getAllAsync<{ exercise_id: string; muscle: string; is_primary: number }>(
      `SELECT exercise_id, muscle, is_primary FROM exercise_muscles WHERE exercise_id IN (${placeholders})`,
      ids,
    ),
    db.getAllAsync<{ exercise_id: string; equipment: string; is_required: number }>(
      `SELECT exercise_id, equipment, is_required FROM exercise_equipment WHERE exercise_id IN (${placeholders})`,
      ids,
    ),
    db.getAllAsync<{ exercise_id: string; training_type: string; effectiveness: number }>(
      `SELECT exercise_id, training_type, effectiveness FROM exercise_training_types WHERE exercise_id IN (${placeholders})`,
      ids,
    ),
  ]);

  // Group related data by exercise_id
  const muscleMap = new Map<string, typeof muscles>();
  for (const m of muscles) {
    const arr = muscleMap.get(m.exercise_id) || [];
    arr.push(m);
    muscleMap.set(m.exercise_id, arr);
  }
  const equipMap = new Map<string, typeof equipment>();
  for (const e of equipment) {
    const arr = equipMap.get(e.exercise_id) || [];
    arr.push(e);
    equipMap.set(e.exercise_id, arr);
  }
  const ttMap = new Map<string, Array<{ type: TrainingType; effectiveness: number }>>();
  for (const t of trainingTypes) {
    const arr = ttMap.get(t.exercise_id) || [];
    arr.push({ type: t.training_type as TrainingType, effectiveness: t.effectiveness });
    ttMap.set(t.exercise_id, arr);
  }

  const result = new Map<string, ExerciseWithDetails>();
  for (const row of rows) {
    const mus = muscleMap.get(row.id) || [];
    const eq = equipMap.get(row.id) || [];
    result.set(row.id, {
      ...row,
      instructions: safeParseInstructions(row.instructions),
      primary_muscles: mus.filter((m) => m.is_primary).map((m) => m.muscle as TargetMuscle),
      secondary_muscles: mus.filter((m) => !m.is_primary).map((m) => m.muscle as TargetMuscle),
      equipment_required: eq.filter((e) => e.is_required).map((e) => e.equipment as EquipmentItem),
      equipment_optional: eq.filter((e) => !e.is_required).map((e) => e.equipment as EquipmentItem),
      training_types: ttMap.get(row.id) || [],
    });
  }
  return result;
}

/**
 * Get exercises by category
 */
export async function getExercisesByCategory(category: Category): Promise<ExerciseWithDetails[]> {
  return getExercises({ categories: [category] });
}

/**
 * Get exercises targeting specific muscles — uses SQL JOIN (no full-table scan)
 */
export async function getExercisesByMuscle(
  muscles: TargetMuscle[],
  primaryOnly = true,
): Promise<ExerciseWithDetails[]> {
  if (!muscles.length) return [];

  const db = await getDatabase();
  const placeholders = muscles.map(() => '?').join(',');
  const primaryFilter = primaryOnly ? 'AND fm.is_primary = 1' : '';

  const sql = `
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN em.is_primary = 1 THEN em.muscle END) as primary_muscles,
      GROUP_CONCAT(DISTINCT CASE WHEN em.is_primary = 0 THEN em.muscle END) as secondary_muscles,
      GROUP_CONCAT(DISTINCT CASE WHEN ee.is_required = 1 THEN ee.equipment END) as equipment_required,
      GROUP_CONCAT(DISTINCT CASE WHEN ee.is_required = 0 THEN ee.equipment END) as equipment_optional
    FROM exercises e
    LEFT JOIN exercise_muscles em ON e.id = em.exercise_id
    LEFT JOIN exercise_equipment ee ON e.id = ee.exercise_id
    WHERE e.id IN (
      SELECT DISTINCT exercise_id FROM exercise_muscles fm
      WHERE fm.muscle IN (${placeholders}) ${primaryFilter}
    )
    GROUP BY e.id
    ORDER BY e.category, e.order_in_category
  `;

  const rows = await db.getAllAsync<any>(sql, muscles);
  return rows.map((row) => ({
    ...row,
    instructions: safeParseInstructions(row.instructions),
    primary_muscles: row.primary_muscles?.split(',').filter(Boolean) || [],
    secondary_muscles: row.secondary_muscles?.split(',').filter(Boolean) || [],
    equipment_required: row.equipment_required?.split(',').filter(Boolean) || [],
    equipment_optional: row.equipment_optional?.split(',').filter(Boolean) || [],
    training_types: [],
  }));
}

// ============================================
// EXERCISE IMAGES
// ============================================

/**
 * Get all images for an exercise, ordered by image_order (0 = start, 1 = end).
 */
export async function getExerciseImages(exerciseId: string): Promise<ExerciseImageRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExerciseImageRecord>(
    `SELECT id, exercise_id, image_path, image_order, source 
     FROM exercise_images 
     WHERE exercise_id = ? 
     ORDER BY image_order`,
    [exerciseId],
  );
}

/**
 * Get the primary image path for an exercise (image_order = 0).
 * Returns null if no images exist.
 */
export async function getExercisePrimaryImage(exerciseId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ image_path: string }>(
    `SELECT image_path FROM exercise_images WHERE exercise_id = ? ORDER BY image_order LIMIT 1`,
    [exerciseId],
  );
  return row?.image_path ?? null;
}

/**
 * Batch-fetch primary images for multiple exercises (used by list screens).
 * Returns a Map of exerciseId → image_path.
 */
export async function getExerciseImageMap(exerciseIds: string[]): Promise<Map<string, string>> {
  if (!exerciseIds.length) return new Map();
  const db = await getDatabase();
  const placeholders = exerciseIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ exercise_id: string; image_path: string }>(
    `SELECT exercise_id, MIN(image_path) as image_path 
     FROM exercise_images 
     WHERE exercise_id IN (${placeholders})
     GROUP BY exercise_id`,
    exerciseIds,
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.exercise_id, row.image_path);
  }
  return map;
}

// ============================================
// EXERCISE SEED HELPERS
// ============================================

export async function getExerciseCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM exercises`);
  return result?.count ?? 0;
}

export async function clearExerciseSeedData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM exercise_training_types;
    DELETE FROM exercise_equipment;
    DELETE FROM exercise_muscles;
    DELETE FROM exercises;
  `);
}

export async function beginSeedTransaction(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('BEGIN TRANSACTION');
}

export async function commitSeedTransaction(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('COMMIT');
}

export async function rollbackSeedTransaction(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('ROLLBACK');
}

export async function insertSeedExercise(params: {
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
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
}): Promise<void> {
  const db = await getDatabase();
  // Pre-insert dedup: reject if a different exercise with the same normalized name+category exists.
  // This is the service-layer firewall — the UNIQUE index is the last line of defense.
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM exercises WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND category = ? LIMIT 1`,
    [params.name, params.category],
  );
  if (existing && existing.id !== params.id) {
    if (__DEV__)
      console.warn(
        `[DB] Skipping duplicate exercise: "${params.name}" (${params.category}) — existing id: ${existing.id}`,
      );
    return;
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO exercises (id, name, category, difficulty, equipment_level, 
      impact_level, space_required, time_per_set_seconds, instructions, order_in_category,
      audio_intro, audio_setup, audio_execution, audio_transition)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.name,
      params.category,
      params.difficulty,
      params.equipment_level,
      params.impact_level,
      params.space_required,
      params.time_per_set_seconds,
      JSON.stringify(params.instructions),
      params.order_in_category,
      params.audio_intro,
      params.audio_setup,
      params.audio_execution,
      params.audio_transition,
    ],
  );
}

export async function insertSeedExerciseMuscle(params: {
  exerciseId: string;
  muscle: TargetMuscle;
  isPrimary: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle, is_primary) VALUES (?, ?, ?)`, [
    params.exerciseId,
    params.muscle,
    params.isPrimary ? 1 : 0,
  ]);
}

export async function insertSeedExerciseEquipment(params: {
  exerciseId: string;
  equipment: EquipmentItem;
  isRequired: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment, is_required) VALUES (?, ?, ?)`, [
    params.exerciseId,
    params.equipment,
    params.isRequired ? 1 : 0,
  ]);
}

export async function insertSeedExerciseTrainingType(params: {
  exerciseId: string;
  trainingType: TrainingType;
  effectiveness: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO exercise_training_types (exercise_id, training_type, effectiveness) VALUES (?, ?, ?)`,
    [params.exerciseId, params.trainingType, params.effectiveness],
  );
}

// ============================================
// USER PROFILE QUERIES
// ============================================

/**
 * Get or create user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  return queryCache.getOrFetch(
    `profile:${userId}`,
    async () => {
      const db = await getDatabase();
      return db.getFirstAsync<UserProfile>(`SELECT * FROM user_profile WHERE id = ?`, [userId]);
    },
    60_000,
  );
}

/**
 * Create user profile
 */
export async function createUserProfile(profile: Omit<UserProfile, 'created_at' | 'updated_at'>): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'create_user_profile',
    table_name: 'user_profile',
    record_id: profile.id,
    payload: { goal: profile.goal, experience: profile.experience },
  });
  try {
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
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Update user profile
 * Note: profile.locked is retained for onboarding state, but in-app profile edits must remain writable.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>,
): Promise<boolean> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && key !== 'locked') {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value as string | number | null));
    }
  });

  if (!fields.length) return true;

  const walId = await walService.logIntent({
    operation: 'update_user_profile',
    table_name: 'user_profile',
    record_id: userId,
    payload: { fields: Object.keys(updates) },
  });
  try {
    const db = await getDatabase();
    fields.push(`updated_at = datetime('now')`);
    values.push(userId);

    await db.runAsync(`UPDATE user_profile SET ${fields.join(', ')} WHERE id = ?`, values);

    queryCache.invalidate(`profile:${userId}`);
    await walService.commit(walId);
    return true;
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Lock user profile (prevents further edits)
 */
export async function lockUserProfile(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE user_profile SET locked = 1, updated_at = datetime('now') WHERE id = ?`, [userId]);
  queryCache.invalidate(`profile:${userId}`);
}

// ============================================
// USER EQUIPMENT QUERIES
// ============================================

/**
 * Get user's available equipment
 */
export async function getUserEquipment(userId: string): Promise<EquipmentItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ equipment: string }>(`SELECT equipment FROM user_equipment WHERE user_id = ?`, [
    userId,
  ]);
  return rows.map((r) => r.equipment as EquipmentItem);
}

/**
 * Set user's equipment (replaces existing)
 */
export async function setUserEquipment(userId: string, equipment: EquipmentItem[]): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'set_user_equipment',
    table_name: 'user_equipment',
    record_id: userId,
    payload: { equipment },
  });
  try {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM user_equipment WHERE user_id = ?`, [userId]);
      for (const item of equipment) {
        await db.runAsync(`INSERT INTO user_equipment (user_id, equipment) VALUES (?, ?)`, [userId, item]);
      }
    });
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
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
  return db.getAllAsync<UserInjury>(`SELECT * FROM user_injuries WHERE user_id = ?`, [userId]);
}

/**
 * Add/update an injury
 */
export async function setUserInjury(
  userId: string,
  muscle: TargetMuscle,
  severity: 'mild' | 'moderate' | 'severe',
): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'set_user_injury',
    table_name: 'user_injuries',
    record_id: userId,
    payload: { muscle, severity },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(`INSERT OR REPLACE INTO user_injuries (user_id, muscle, severity) VALUES (?, ?, ?)`, [
      userId,
      muscle,
      severity,
    ]);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Remove an injury
 */
export async function removeUserInjury(userId: string, muscle: TargetMuscle): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM user_injuries WHERE user_id = ? AND muscle = ?`, [userId, muscle]);
}

// ============================================
// FATIGUE TRACKING QUERIES
// ============================================

/**
 * Get muscle fatigue levels for user
 */
export async function getMuscleFatigue(userId: string): Promise<MuscleFatigue[]> {
  return queryCache.getOrFetch(
    `fatigue:${userId}`,
    async () => {
      const db = await getDatabase();
      return db.getAllAsync<MuscleFatigue>(`SELECT * FROM muscle_fatigue WHERE user_id = ?`, [userId]);
    },
    30_000,
  );
}

/**
 * Get fatigue for specific muscle
 */
export async function getMuscleFatigueLevel(userId: string, muscle: TargetMuscle): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ fatigue_level: number }>(
    `SELECT fatigue_level FROM muscle_fatigue WHERE user_id = ? AND muscle = ?`,
    [userId, muscle],
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
  trained = false,
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
    [userId, muscle, clampedLevel, clampedLevel],
  );
  queryCache.invalidate(`fatigue:${userId}`);
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
    [recoveryRate, userId],
  );
}

// ============================================
// WORKOUT SESSION QUERIES
// ============================================

/**
 * Create a new workout session
 */
export async function createWorkoutSession(
  session: Omit<WorkoutSession, 'started_at' | 'completed_at'>,
): Promise<string> {
  const walId = await walService.logIntent({
    operation: 'create_workout_session',
    table_name: 'workout_sessions',
    record_id: session.id,
    payload: { user_id: session.user_id, total_exercises: session.total_exercises },
  });
  try {
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
      ],
    );
    await walService.commit(walId);
    return session.id;
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Complete a workout session
 */
export async function completeWorkoutSession(
  sessionId: string,
  completedExercises: number,
  success: boolean,
): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'complete_workout_session',
    table_name: 'workout_sessions',
    record_id: sessionId,
    payload: { completedExercises, success },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE workout_sessions 
       SET completed_at = datetime('now'),
           completed_exercises = ?,
           success = ?
       WHERE id = ?`,
      [completedExercises, success ? 1 : 0, sessionId],
    );
    queryCache.invalidatePrefix('progress:');
    queryCache.invalidatePrefix('streak:');
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Get recent sessions for user
 */
export async function getRecentSessions(userId: string, limit = 7): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions 
     WHERE user_id = ? 
     ORDER BY started_at DESC 
     LIMIT ?`,
    [userId, limit],
  );
}

/**
 * Delete a workout session and its associated exercises
 */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  // Remove associated exercises first, then the session itself
  await db.runAsync('DELETE FROM session_exercises WHERE session_id = ?', [sessionId]);
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [sessionId]);
}

/**
 * Add exercise to session
 */
export async function addSessionExercise(exercise: SessionExercise): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'add_session_exercise',
    table_name: 'session_exercises',
    record_id: exercise.id,
    payload: {
      session_id: exercise.session_id,
      exercise_id: exercise.exercise_id,
      order_in_session: exercise.order_in_session,
      prescribed_sets: exercise.prescribed_sets,
      prescribed_reps: exercise.prescribed_reps,
      completed_sets: exercise.completed_sets,
      completed_reps: exercise.completed_reps,
      skipped: exercise.skipped,
      notes: exercise.notes,
    },
  });
  try {
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
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Get session exercises with full exercise details (for loading custom workouts)
 */
export async function getSessionExercises(sessionId: string): Promise<
  Array<{
    id: string;
    exercise_id: string;
    order_in_session: number;
    prescribed_sets: number;
    prescribed_reps: string;
    completed_sets: number;
    skipped: boolean;
    name: string;
    category: string;
    difficulty: string;
    instructions: string;
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }>
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT se.id, se.exercise_id, se.order_in_session,
            se.prescribed_sets, se.prescribed_reps, se.completed_sets,
            se.skipped,
            e.name, e.category, e.difficulty, e.instructions,
            e.audio_intro, e.audio_setup, e.audio_execution, e.audio_transition
     FROM session_exercises se
     LEFT JOIN exercises e ON se.exercise_id = e.id
     WHERE se.session_id = ? AND e.id IS NOT NULL
     ORDER BY se.order_in_session ASC`,
    [sessionId],
  );
}

/**
 * Get a single workout session by ID
 */
export async function getWorkoutSession(sessionId: string): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutSession>(`SELECT * FROM workout_sessions WHERE id = ?`, [sessionId]);
}

/**
 * Get the most recent active (incomplete) workout session for a user.
 * Returns null if no active session exists.
 */
export async function getActiveWorkoutSession(userId: string): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions WHERE user_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
}

/**
 * Update a session_exercise row to mark it completed or skipped.
 * Used for incremental persistence during active workouts.
 */
export async function updateSessionExerciseProgress(
  sessionExerciseId: string,
  completedSets: number,
  skipped: boolean,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE session_exercises SET completed_sets = ?, skipped = ? WHERE id = ?`, [
    completedSets,
    skipped ? 1 : 0,
    sessionExerciseId,
  ]);
}

// ============================================
// PROGRESS TRACKING QUERIES
// ============================================

/**
 * Record progress for an exercise
 */
export async function recordProgress(record: ProgressRecord): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'record_progress',
    table_name: 'progress_records',
    record_id: record.id,
    payload: { exercise_id: record.exercise_id, sets: record.sets_completed },
  });
  try {
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
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Get progress history for an exercise
 */
export async function getProgressHistory(userId: string, exerciseId: string, limit = 30): Promise<ProgressRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProgressRecord>(
    `SELECT * FROM progress_records 
     WHERE user_id = ? AND exercise_id = ?
     ORDER BY date DESC
     LIMIT ?`,
    [userId, exerciseId, limit],
  );
}

/**
 * Get all progress records for a user (across all exercises)
 */
export async function getAllProgressRecords(userId: string, limit = 100): Promise<ProgressRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProgressRecord>(
    `SELECT * FROM progress_records 
     WHERE user_id = ?
     ORDER BY date DESC
     LIMIT ?`,
    [userId, limit],
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
  return db.getFirstAsync<SubscriptionState>(`SELECT * FROM subscription_state WHERE user_id = ?`, [userId]);
}

/**
 * Update subscription state
 */
export async function updateSubscriptionState(state: Omit<SubscriptionState, 'last_verified_at'>): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'update_subscription_state',
    table_name: 'subscription_state',
    record_id: state.user_id,
    payload: {
      tier: state.tier,
      expires_at: state.expires_at,
      grace_period_start: state.grace_period_start,
      receipt_data: state.receipt_data,
    },
  });
  try {
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
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

// ============================================
// APP STATE QUERIES
// ============================================

/**
 * Get app state value
 */
export async function getAppState(key: string): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_state WHERE key = ?`, [key]);
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
    [key, value, value],
  );
}

/**
 * Delete app state entries by key prefix
 */
export async function deleteAppStateByPrefix(prefix: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM app_state WHERE key LIKE ?`, [`${prefix}%`]);
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
  }>(`SELECT * FROM workout_streaks WHERE user_id = ?`, [userId]);

  const today = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;

  let currentStreak = 1;
  let longestStreak = streak?.longest_streak ?? 0;

  if (streak && streak.last_workout_date === yesterday) {
    currentStreak = streak.current_streak + 1;
  } else if (streak && streak.last_workout_date === today) {
    currentStreak = streak.current_streak;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  const walId = await walService.logIntent({
    operation: 'update_streak',
    table_name: 'workout_streaks',
    record_id: userId,
    payload: { currentStreak, longestStreak, date: today },
  });
  try {
    await db.runAsync(
      `INSERT INTO workout_streaks (user_id, current_streak, longest_streak, last_workout_date)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         current_streak = ?,
         longest_streak = ?,
         last_workout_date = ?,
         updated_at = datetime('now')`,
      [userId, currentStreak, longestStreak, today, currentStreak, longestStreak, today],
    );

    queryCache.invalidate(`streak:${userId}`);
    queryCache.invalidatePrefix('progress:');
    await walService.commit(walId);
    return { current: currentStreak, longest: longestStreak };
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

/**
 * Get current streak
 */
export async function getStreak(userId: string): Promise<{ current: number; longest: number }> {
  return queryCache.getOrFetch(
    `streak:${userId}`,
    async () => {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ current_streak: number; longest_streak: number }>(
        `SELECT current_streak, longest_streak FROM workout_streaks WHERE user_id = ?`,
        [userId],
      );
      return {
        current: result?.current_streak ?? 0,
        longest: result?.longest_streak ?? 0,
      };
    },
    60_000,
  );
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
  return queryCache.getOrFetch(
    `progress:${userId}`,
    async () => {
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
        [userId],
      );

      // Get streak info
      const streakInfo = await getStreak(userId);

      // Get last workout date
      const lastWorkout = await db.getFirstAsync<{ last_date: string | null }>(
        `SELECT MAX(started_at) as last_date FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL`,
        [userId],
      );

      // Calculate weekly XP matching xpService formula: 100 base + 20/exercise + 50 completion bonus + 10*streak
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weeklyWorkoutData = await db.getFirstAsync<{ count: number; exercises: number; total_exercises: number }>(
        `SELECT COUNT(*) as count,
            COALESCE(SUM(completed_exercises), 0) as exercises,
            COALESCE(SUM(total_exercises), 0) as total_exercises
     FROM workout_sessions 
     WHERE user_id = ? AND started_at > ? AND completed_at IS NOT NULL`,
        [userId, weekAgo],
      );
      const wkCount = weeklyWorkoutData?.count ?? 0;
      const wkExercises = weeklyWorkoutData?.exercises ?? 0;
      const wkTotalEx = weeklyWorkoutData?.total_exercises ?? 0;
      const wkCompletionBonus = wkExercises >= wkTotalEx && wkTotalEx > 0 ? 50 * wkCount : 0;
      const wkStreakBonus = streakInfo.current * 10;
      const weeklyXP = wkCount * 100 + wkExercises * 20 + wkCompletionBonus + wkStreakBonus;

      return {
        total_workouts: workoutStats?.total ?? 0,
        completed_workouts: workoutStats?.completed ?? 0,
        current_streak: streakInfo.current,
        longest_streak: streakInfo.longest,
        total_exercises_done: workoutStats?.exercises ?? 0,
        weekly_xp: weeklyXP,
        last_workout_date: lastWorkout?.last_date ?? null,
      };
    },
    60_000,
  );
}

// ============================================
// FITMIND QUERIES
// ============================================

export async function addFitMindDocument(doc: Omit<FitMindDocument, 'created_at' | 'updated_at'>): Promise<string> {
  const db = await getDatabase();
  const now = Date.now();

  const walId = await walService.logIntent({
    operation: 'add_fitmind_document',
    table_name: 'fitmind_documents',
    record_id: doc.id,
    payload: { ...doc, created_at: now, updated_at: now },
  });

  try {
    await db.runAsync(
      `INSERT INTO fitmind_documents
       (id, title, author, type, status, category, tags, file_path, file_size, total_pages,
        current_page, content, word_count, reading_level, estimated_minutes, cover_color,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id,
        doc.title,
        doc.author,
        doc.type,
        doc.status,
        doc.category,
        doc.tags,
        doc.file_path,
        doc.file_size,
        doc.total_pages,
        doc.current_page,
        doc.content,
        doc.word_count,
        doc.reading_level,
        doc.estimated_minutes,
        doc.cover_color,
        now,
        now,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }

  return doc.id;
}

export async function getFitMindDocuments(status?: DocumentStatus): Promise<FitMindDocument[]> {
  const db = await getDatabase();
  if (status) {
    return db.getAllAsync<FitMindDocument>(
      `SELECT * FROM fitmind_documents WHERE status = ? ORDER BY updated_at DESC, created_at DESC`,
      [status],
    );
  }
  return db.getAllAsync<FitMindDocument>(`SELECT * FROM fitmind_documents ORDER BY updated_at DESC, created_at DESC`);
}

export async function getFitMindDocument(id: string): Promise<FitMindDocument | null> {
  const db = await getDatabase();
  return db.getFirstAsync<FitMindDocument>(`SELECT * FROM fitmind_documents WHERE id = ?`, [id]);
}

export async function updateFitMindProgress(docId: string, currentPage: number): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  const walId = await walService.logIntent({
    operation: 'update_fitmind_progress',
    table_name: 'fitmind_documents',
    record_id: docId,
    payload: { current_page: currentPage },
  });

  try {
    await db.runAsync(
      `UPDATE fitmind_documents
       SET current_page = ?,
           updated_at = ?,
           status = CASE
             WHEN ? >= total_pages AND total_pages > 0 THEN 'COMPLETED'
             ELSE 'READING'
           END
       WHERE id = ?`,
      [currentPage, now, currentPage, docId],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }
}

export async function deleteFitMindDocument(id: string): Promise<void> {
  const db = await getDatabase();
  const walId = await walService.logIntent({
    operation: 'delete_fitmind_document',
    table_name: 'fitmind_documents',
    record_id: id,
  });
  try {
    await db.runAsync(`DELETE FROM fitmind_documents WHERE id = ?`, [id]);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }
}

export async function recordFitMindSession(session: Omit<ReadingSession, 'id' | 'created_at'>): Promise<string> {
  const db = await getDatabase();
  const id = await generateSecureId('rs');
  const now = Date.now();

  const walId = await walService.logIntent({
    operation: 'record_fitmind_session',
    table_name: 'fitmind_reading_sessions',
    record_id: id,
    payload: { ...session, created_at: now },
  });

  try {
    await db.runAsync(
      `INSERT INTO fitmind_reading_sessions
       (id, document_id, start_page, end_page, duration_minutes, words_read, comprehension_score, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.document_id,
        session.start_page,
        session.end_page,
        session.duration_minutes,
        session.words_read,
        session.comprehension_score,
        session.notes,
        now,
      ],
    );

    await updateFitMindProgress(session.document_id, session.end_page);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }

  return id;
}

export async function getFitMindSessions(docId: string, limit = 20): Promise<ReadingSession[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReadingSession>(
    `SELECT * FROM fitmind_reading_sessions WHERE document_id = ? ORDER BY created_at DESC LIMIT ?`,
    [docId, limit],
  );
}

export async function addFitMindAnnotation(annotation: Omit<Annotation, 'id' | 'created_at'>): Promise<string> {
  const db = await getDatabase();
  const id = await generateSecureId('ann');
  const now = Date.now();

  const walId = await walService.logIntent({
    operation: 'add_fitmind_annotation',
    table_name: 'fitmind_annotations',
    record_id: id,
    payload: { ...annotation, created_at: now },
  });

  try {
    await db.runAsync(
      `INSERT INTO fitmind_annotations
       (id, document_id, page_number, type, content, color, position_start, position_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        annotation.document_id,
        annotation.page_number,
        annotation.type,
        annotation.content,
        annotation.color,
        annotation.position_start,
        annotation.position_end,
        now,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }

  return id;
}

export async function getFitMindAnnotations(docId: string, page?: number): Promise<Annotation[]> {
  const db = await getDatabase();
  if (page !== undefined) {
    return db.getAllAsync<Annotation>(
      `SELECT * FROM fitmind_annotations WHERE document_id = ? AND page_number = ? ORDER BY created_at`,
      [docId, page],
    );
  }
  return db.getAllAsync<Annotation>(
    `SELECT * FROM fitmind_annotations WHERE document_id = ? ORDER BY page_number, created_at`,
    [docId],
  );
}

export async function deleteFitMindAnnotation(id: string): Promise<void> {
  const db = await getDatabase();
  const walId = await walService.logIntent({
    operation: 'delete_fitmind_annotation',
    table_name: 'fitmind_annotations',
    record_id: id,
  });
  try {
    await db.runAsync(`DELETE FROM fitmind_annotations WHERE id = ?`, [id]);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }
}

export async function addFitMindFlashcard(card: {
  front: string;
  back: string;
  documentId: string;
  difficulty?: number;
}): Promise<string> {
  const db = await getDatabase();
  const id = await generateSecureId('fc');
  const now = Date.now();

  // FSRS initial values (from FSRSService.createNewCard)
  const initialDifficulty = card.difficulty ?? 5; // FSRS uses 1-10 scale, 5 is neutral
  const initialState = 0; // State.New
  const initialStability = 0;

  const walId = await walService.logIntent({
    operation: 'add_fitmind_flashcard',
    table_name: 'fitmind_flashcards',
    record_id: id,
    payload: {
      document_id: card.documentId,
      front: card.front,
      back: card.back,
      difficulty: initialDifficulty,
      stability: initialStability,
      state: initialState,
      due: now,
      next_review: now,
      created_at: now,
    },
  });

  try {
    await db.runAsync(
      `INSERT INTO fitmind_flashcards
       (id, document_id, front, back, difficulty, stability, state, due, scheduled_days,
        reps, lapses, learning_steps, ease_factor, repetitions, interval_days, next_review, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 2.5, 0, 1, ?, ?)`,
      [id, card.documentId, card.front, card.back, initialDifficulty, initialStability, initialState, now, now, now],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }

  return id;
}

export async function getFitMindDueFlashcards(limit = 20): Promise<Flashcard[]> {
  const db = await getDatabase();
  const now = Date.now();
  // Use FSRS 'due' column (falls back to next_review for legacy cards)
  return db.getAllAsync<Flashcard>(
    `SELECT * FROM fitmind_flashcards 
     WHERE COALESCE(due, next_review) <= ? 
     ORDER BY COALESCE(due, next_review) ASC LIMIT ?`,
    [now, limit],
  );
}

/**
 * Get a flashcard by ID (for review operations).
 */
export async function getFitMindFlashcard(cardId: string): Promise<Flashcard | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Flashcard>(`SELECT * FROM fitmind_flashcards WHERE id = ?`, [cardId]);
}

/**
 * Update a flashcard with FSRS scheduling result.
 * This is the core update function used by FSRSService.
 */
export async function updateFitMindFlashcardFSRS(
  cardId: string,
  update: {
    due: number;
    stability: number;
    difficulty: number;
    state: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    learning_steps: number;
    last_review: number;
  },
): Promise<void> {
  const db = await getDatabase();

  const walId = await walService.logIntent({
    operation: 'update_fitmind_flashcard_fsrs',
    table_name: 'fitmind_flashcards',
    record_id: cardId,
    payload: { ...update },
  });

  try {
    await db.runAsync(
      `UPDATE fitmind_flashcards
       SET due = ?, stability = ?, difficulty = ?, state = ?, scheduled_days = ?,
           reps = ?, lapses = ?, learning_steps = ?, last_review = ?,
           next_review = ?, interval_days = ?, repetitions = ?
       WHERE id = ?`,
      [
        update.due,
        update.stability,
        update.difficulty,
        update.state,
        update.scheduled_days,
        update.reps,
        update.lapses,
        update.learning_steps,
        update.last_review,
        // Also update legacy columns for compatibility
        update.due,
        update.scheduled_days,
        update.reps,
        cardId,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }
}

/**
 * @deprecated Use FSRSService.scheduleReview() + updateFitMindFlashcardFSRS() instead.
 * Legacy SM-2 review function kept for backwards compatibility.
 */
export async function reviewFitMindFlashcard(cardId: string, quality: number): Promise<void> {
  const db = await getDatabase();
  const card = await db.getFirstAsync<Flashcard>(`SELECT * FROM fitmind_flashcards WHERE id = ?`, [cardId]);

  if (!card) return;

  // Now delegate to FSRS
  // Map SM-2 quality (0-5) to FSRS rating:
  // 0-2 = Again, 3 = Hard, 4 = Good, 5 = Easy
  let fsrsService:
    | {
        scheduleReview(
          card: Record<string, unknown>,
          rating: string,
        ): { card: import('../fitmind/FSRSService').FSRSCard };
      }
    | undefined;
  try {
    const mod = await import('../fitmind/FSRSService');
    fsrsService = mod.fsrsService;
  } catch {
    if (__DEV__) console.warn('[FitMind] FSRS module unavailable, skipping review');
    return;
  }
  let rating: 'again' | 'hard' | 'good' | 'easy';
  if (quality <= 2) {
    rating = 'again';
  } else if (quality === 3) {
    rating = 'hard';
  } else if (quality === 4) {
    rating = 'good';
  } else {
    rating = 'easy';
  }

  const result = fsrsService.scheduleReview(card as unknown as Record<string, unknown>, rating);
  await updateFitMindFlashcardFSRS(cardId, result.card);
}

export async function getFitMindReadingStreak(): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalBooksCompleted: number;
  totalPagesRead: number;
  totalMinutesRead: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    current_streak: number;
    longest_streak: number;
    total_books_completed: number;
    total_pages_read: number;
    total_minutes_read: number;
  }>(`SELECT * FROM fitmind_reading_streaks WHERE user_id = 'user_local_001'`);

  if (!row) {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO fitmind_reading_streaks
       (user_id, current_streak, longest_streak, total_books_completed, total_minutes_read, total_pages_read, updated_at)
       VALUES ('user_local_001', 0, 0, 0, 0, 0, ?)`,
      [now],
    );
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalBooksCompleted: 0,
      totalPagesRead: 0,
      totalMinutesRead: 0,
    };
  }

  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    totalBooksCompleted: row.total_books_completed,
    totalPagesRead: row.total_pages_read,
    totalMinutesRead: row.total_minutes_read,
  };
}

export async function updateFitMindReadingStreak(pagesRead: number, minutesRead: number): Promise<void> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0]!;
  const now = Date.now();

  const walId = await walService.logIntent({
    operation: 'update_fitmind_reading_streak',
    table_name: 'fitmind_reading_streaks',
    record_id: 'user_local_001',
    payload: { pages_read: pagesRead, minutes_read: minutesRead, date: today },
  });

  try {
    const row = await db.getFirstAsync<{
      current_streak: number;
      longest_streak: number;
      last_read_date: string | null;
    }>(
      `SELECT current_streak, longest_streak, last_read_date FROM fitmind_reading_streaks WHERE user_id = 'user_local_001'`,
    );

    if (!row) {
      await db.runAsync(
        `INSERT INTO fitmind_reading_streaks
         (user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_minutes_read, updated_at)
         VALUES ('user_local_001', 1, 1, ?, ?, ?, ?)`,
        [today, pagesRead, minutesRead, now],
      );
      await walService.commit(walId);
      return;
    }

    let newStreak = row.current_streak;
    if (row.last_read_date !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]!;

      if (row.last_read_date === yesterdayStr) {
        newStreak++;
      } else {
        newStreak = 1;
      }
    }

    const longestStreak = Math.max(row.longest_streak, newStreak);

    await db.runAsync(
      `UPDATE fitmind_reading_streaks
       SET current_streak = ?, longest_streak = ?, last_read_date = ?,
           total_pages_read = total_pages_read + ?,
           total_minutes_read = total_minutes_read + ?,
           updated_at = ?
       WHERE user_id = 'user_local_001'`,
      [newStreak, longestStreak, today, pagesRead, minutesRead, now],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId);
    throw error;
  }
}

export async function getFitMindReadingAnalytics(days = 30): Promise<{
  sessionsCount: number;
  avgReadingSpeedWpm: number;
  avgFocusScore: number;
  totalPagesRead: number;
  totalTimeMs: number;
  avgSessionDurationMs: number;
  booksCompleted: number;
  currentlyReading: number;
}> {
  const db = await getDatabase();
  const since = Date.now() - days * 86400000;

  const sessionStats = await db.getFirstAsync<{
    cnt: number;
    avg_speed: number;
    total_pages: number;
    total_minutes: number;
  }>(
    `SELECT
       COUNT(*) as cnt,
       AVG(CASE WHEN duration_minutes > 0 THEN (CAST(words_read AS REAL) / duration_minutes) ELSE 0 END) as avg_speed,
       SUM(end_page - start_page) as total_pages,
       SUM(duration_minutes) as total_minutes
     FROM fitmind_reading_sessions
     WHERE created_at > ?`,
    [since],
  );

  const completed = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fitmind_documents WHERE status = 'COMPLETED' AND updated_at > ?`,
    [since],
  );

  const reading = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fitmind_documents WHERE status = 'READING'`,
  );

  const totalMinutes = sessionStats?.total_minutes || 0;
  const totalTimeMs = totalMinutes * 60000;

  return {
    sessionsCount: sessionStats?.cnt || 0,
    avgReadingSpeedWpm: Math.round(sessionStats?.avg_speed || 0),
    avgFocusScore: 0,
    totalPagesRead: sessionStats?.total_pages || 0,
    totalTimeMs,
    avgSessionDurationMs: sessionStats?.cnt ? Math.round(totalTimeMs / sessionStats.cnt) : 0,
    booksCompleted: completed?.cnt || 0,
    currentlyReading: reading?.cnt || 0,
  };
}

// ============================================
// TRIAL STATE QUERIES
// ============================================

export interface TrialStateRow {
  user_id: string;
  started_at: number;
  ends_at: number;
  converted: number;
  product_identifier: string | null;
  notifications_sent: string;
}

export async function getTrialState(userId: string): Promise<TrialStateRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<TrialStateRow>(`SELECT * FROM trial_state WHERE user_id = ?`, [userId]);
}

export async function upsertTrialState(state: TrialStateRow): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'upsert_trial_state',
    table_name: 'trial_state',
    record_id: state.user_id,
    payload: {
      started_at: state.started_at,
      ends_at: state.ends_at,
      converted: state.converted,
      product_identifier: state.product_identifier,
      notifications_sent: state.notifications_sent,
    },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO trial_state
       (user_id, started_at, ends_at, converted, product_identifier, notifications_sent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        state.user_id,
        state.started_at,
        state.ends_at,
        state.converted,
        state.product_identifier,
        state.notifications_sent,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function updateTrialConverted(userId: string, productId: string | null): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'update_trial_converted',
    table_name: 'trial_state',
    record_id: userId,
    payload: { product_identifier: productId },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(`UPDATE trial_state SET converted = 1, product_identifier = ? WHERE user_id = ?`, [
      productId,
      userId,
    ]);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function getTrialStartedAt(userId: string): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ started_at: number }>(`SELECT started_at FROM trial_state WHERE user_id = ?`, [
    userId,
  ]);
  return row?.started_at ?? null;
}

export async function getTrialStats(
  userId: string,
  startedAt: number,
): Promise<{
  workouts: number;
  pagesRead: number;
  stepsTotal: number;
  daysActive: number;
}> {
  const db = await getDatabase();

  const workoutResult = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions
     WHERE user_id = ? AND started_at >= ?`,
    [userId, startedAt],
  );

  const stepResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(steps), 0) as total FROM daily_steps
     WHERE user_id = ? AND date >= ?`,
    [userId, new Date(startedAt).toISOString().split('T')[0]!],
  );

  const readingResult = await db.getFirstAsync<{ pages: number }>(
    `SELECT COALESCE(SUM(end_page - start_page), 0) as pages FROM fitmind_reading_sessions
     WHERE created_at >= ?`,
    [startedAt],
  );

  const activeDays = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT date) as cnt FROM daily_steps
     WHERE user_id = ? AND date >= ? AND steps > 100`,
    [userId, new Date(startedAt).toISOString().split('T')[0]!],
  );

  return {
    workouts: workoutResult?.cnt ?? 0,
    pagesRead: readingResult?.pages ?? 0,
    stepsTotal: stepResult?.total ?? 0,
    daysActive: activeDays?.cnt ?? 0,
  };
}

// ============================================
// DAILY STEPS & JOG SESSIONS
// ============================================

export async function getDailyStepsForDate(
  userId: string,
  date: string,
): Promise<{ steps: number; active_minutes: number } | null> {
  const db = await getDatabase();
  return db.getFirstAsync<{ steps: number; active_minutes: number }>(
    `SELECT steps, active_minutes FROM daily_steps WHERE user_id = ? AND date = ?`,
    [userId, date],
  );
}

export async function upsertDailySteps(
  userId: string,
  date: string,
  steps: number,
  activeMinutes: number,
): Promise<void> {
  const id = await generateSecureId('steps');
  const walId = await walService.logIntent({
    operation: 'upsert_daily_steps',
    table_name: 'daily_steps',
    record_id: id,
    payload: { user_id: userId, date, steps, active_minutes: activeMinutes },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO daily_steps (id, user_id, date, steps, active_minutes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET steps = ?, active_minutes = ?`,
      [id, userId, date, steps, activeMinutes, steps, activeMinutes],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function getStepHistory(
  userId: string,
  days: number,
): Promise<Array<{ date: string; steps: number; active_minutes: number }>> {
  const db = await getDatabase();
  return db.getAllAsync<{ date: string; steps: number; active_minutes: number }>(
    `SELECT date, steps, active_minutes FROM daily_steps
     WHERE user_id = ? ORDER BY date DESC LIMIT ?`,
    [userId, days],
  );
}

export async function createJogSession(params: {
  id: string;
  userId: string;
  startTime: number;
  distanceMeters: number;
  avgPacePerKm?: number | null;
  caloriesEstimate?: number | null;
  routeData?: string | null;
}): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'create_jog_session',
    table_name: 'jog_sessions',
    record_id: params.id,
    payload: {
      user_id: params.userId,
      start_time: new Date(params.startTime).toISOString(),
      distance_meters: params.distanceMeters,
      avg_pace_per_km: params.avgPacePerKm,
      calories_estimate: params.caloriesEstimate,
      route_data: params.routeData,
    },
  });
  try {
    const db = await getDatabase();
    // Ensure user profile exists to satisfy FK constraint
    const profile = await db.getFirstAsync<{ id: string }>(`SELECT id FROM user_profile WHERE id = ?`, [params.userId]);
    if (!profile) {
      await db.runAsync(
        `INSERT OR IGNORE INTO user_profile (id, goal, experience, training_days_per_week, time_per_session_minutes, locked)
         VALUES (?, 'body_control', 'intermediate', 4, 30, 1)`,
        [params.userId],
      );
    }
    await db.runAsync(
      `INSERT INTO jog_sessions
       (id, user_id, start_time, distance_meters, avg_pace_per_km, calories_estimate, route_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        params.id,
        params.userId,
        new Date(params.startTime).toISOString(),
        params.distanceMeters,
        params.avgPacePerKm ?? null,
        params.caloriesEstimate ?? null,
        params.routeData ?? null,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function endJogSession(params: {
  id: string;
  endTime: number;
  distanceMeters: number;
  avgPacePerKm?: number | null;
  caloriesEstimate?: number | null;
  routeData?: string | null;
}): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'end_jog_session',
    table_name: 'jog_sessions',
    record_id: params.id,
    payload: {
      end_time: new Date(params.endTime).toISOString(),
      distance_meters: params.distanceMeters,
      avg_pace_per_km: params.avgPacePerKm,
      calories_estimate: params.caloriesEstimate,
      route_data: params.routeData,
    },
  });
  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE jog_sessions
       SET end_time = ?, distance_meters = ?, avg_pace_per_km = ?, calories_estimate = ?, route_data = ?
       WHERE id = ?`,
      [
        new Date(params.endTime).toISOString(),
        params.distanceMeters,
        params.avgPacePerKm ?? null,
        params.caloriesEstimate ?? null,
        params.routeData ?? null,
        params.id,
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function getJogHistory(
  userId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    start_time: string;
    end_time: string | null;
    distance_meters: number;
    avg_pace_per_km: number | null;
    calories_estimate: number | null;
  }>
> {
  const db = await getDatabase();
  return db.getAllAsync<{
    id: string;
    start_time: string;
    end_time: string | null;
    distance_meters: number;
    avg_pace_per_km: number | null;
    calories_estimate: number | null;
  }>(
    `SELECT id, start_time, end_time, distance_meters, avg_pace_per_km, calories_estimate
     FROM jog_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?`,
    [userId, limit],
  );
}

/**
 * Get a jog session's route data for map display
 */
export async function getJogRoute(jogId: string): Promise<[number, number][] | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ route_data: string | null }>(
    `SELECT route_data FROM jog_sessions WHERE id = ?`,
    [jogId],
  );
  if (!row?.route_data) return null;
  try {
    return JSON.parse(row.route_data) as [number, number][];
  } catch {
    return null;
  }
}

// ============================================
// JOG TOTALS (aggregate stats)
// ============================================

export async function getJogTotals(userId: string): Promise<{ total: number; longest: number; runs: number } | null> {
  const db = await getDatabase();
  return db.getFirstAsync<{ total: number; longest: number; runs: number }>(
    `SELECT COALESCE(SUM(distance_meters), 0) as total,
            COALESCE(MAX(distance_meters), 0) as longest,
            COUNT(*) as runs
     FROM jog_sessions WHERE user_id = ? AND end_time IS NOT NULL`,
    [userId],
  );
}

// ============================================
// AUDIO SETTINGS
// ============================================

export async function getAudioSettingsRow(userId: string): Promise<{
  voice_enabled: number;
  speech_rate: number;
  countdown_cues_enabled: number;
} | null> {
  const db = await getDatabase();
  return db.getFirstAsync<{
    voice_enabled: number;
    speech_rate: number;
    countdown_cues_enabled: number;
  }>(`SELECT * FROM audio_settings WHERE user_id = ?`, [userId]);
}

export async function createAudioSettingsRow(params: {
  userId: string;
  voiceEnabled: boolean;
  speechRate: number;
  countdownCuesEnabled: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO audio_settings (user_id, voice_enabled, speech_rate, countdown_cues_enabled)
     VALUES (?, ?, ?, ?)`,
    [params.userId, params.voiceEnabled ? 1 : 0, params.speechRate, params.countdownCuesEnabled ? 1 : 0],
  );
}

export async function updateAudioSettingsRow(params: {
  userId: string;
  voiceEnabled: boolean;
  speechRate: number;
  countdownCuesEnabled: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE audio_settings
     SET voice_enabled = ?, speech_rate = ?, countdown_cues_enabled = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    [params.voiceEnabled ? 1 : 0, params.speechRate, params.countdownCuesEnabled ? 1 : 0, params.userId],
  );
}

// ============================================
// WORKOUT GENERATOR SUPPORT
// ============================================

export async function getRecentlyTrainedMuscles(userId: string, sinceIso: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ muscle: string }>(
    `SELECT DISTINCT em.muscle
     FROM session_exercises se
     JOIN workout_sessions ws ON se.session_id = ws.id
     JOIN exercise_muscles em ON se.exercise_id = em.exercise_id
     WHERE ws.user_id = ? AND ws.started_at > ? AND em.is_primary = 1`,
    [userId, sinceIso],
  );
  return rows.map((r) => r.muscle);
}

export async function getRecentExerciseIds(userId: string, sinceIso: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT DISTINCT se.exercise_id
     FROM session_exercises se
     JOIN workout_sessions ws ON se.session_id = ws.id
     WHERE ws.user_id = ? AND ws.started_at > ?`,
    [userId, sinceIso],
  );
  return rows.map((r) => r.exercise_id);
}

// ============================================
// BODY CRAFT ALGORITHMS
// ============================================

export async function saveBodyCraftAlgorithm(algo: BodyCraftAlgorithm): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'save_body_craft_algorithm',
    table_name: 'body_craft_algorithms',
    record_id: algo.id,
    payload: {
      user_id: algo.user_id,
      body_type: algo.body_type,
      goal_type: algo.goal_type,
      timeline_months: algo.timeline_months,
      muscle_priorities: JSON.stringify(algo.muscle_priorities),
      recommended_training_split: algo.recommended_training_split,
      training_days_per_week: algo.training_days_per_week,
      calories_target: algo.calories_target,
      protein_g: algo.protein_g,
      carbs_g: algo.carbs_g,
      fats_g: algo.fats_g,
      daily_water_liters: algo.daily_water_liters,
      sleep_hours: algo.sleep_hours,
      cardio_minutes_per_week: algo.cardio_minutes_per_week,
      exercise_category_weights: JSON.stringify(algo.exercise_category_weights),
      weekly_schedule: JSON.stringify(algo.weekly_schedule),
      nutrition_tips: JSON.stringify(algo.nutrition_tips),
      created_at: algo.created_at,
    },
  });
  try {
    const db = await getDatabase();
    await db.runAsync('UPDATE body_craft_algorithms SET active = 0 WHERE user_id = ? AND active = 1', [algo.user_id]);
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
      ],
    );
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}

export async function getActiveBodyCraftAlgorithm(userId: string): Promise<BodyCraftAlgorithm | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<Record<string, any>>(
    'SELECT * FROM body_craft_algorithms WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1',
    [userId],
  );

  if (!row) return null;

  const safeParse = (str: string, fallback: unknown = []) => {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  };

  return {
    id: row.id,
    user_id: row.user_id,
    body_type: row.body_type,
    goal_type: row.goal_type,
    timeline_months: row.timeline_months,
    muscle_priorities: safeParse(row.muscle_priorities, []),
    recommended_training_split: row.recommended_training_split,
    training_days_per_week: row.training_days_per_week,
    calories_target: row.calories_target,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fats_g: row.fats_g,
    daily_water_liters: row.daily_water_liters,
    sleep_hours: row.sleep_hours,
    cardio_minutes_per_week: row.cardio_minutes_per_week,
    exercise_category_weights: safeParse(row.exercise_category_weights, {}),
    weekly_schedule: safeParse(row.weekly_schedule, []),
    nutrition_tips: safeParse(row.nutrition_tips, []),
    created_at: row.created_at,
  };
}

export async function applyBodyCraftAlgorithmToProfile(userId: string, algo: BodyCraftAlgorithm): Promise<void> {
  const db = await getDatabase();
  const goalToCategory: Record<string, string> = {
    lean_athletic: 'body_control',
    muscular_powerful: 'strength',
    tall_flexible: 'posture',
    balanced_toned: 'body_control',
    custom: 'body_control',
  };

  const mappedGoal = goalToCategory[algo.goal_type] || 'body_control';

  await db.runAsync(
    `UPDATE user_profile SET goal = ?, training_days_per_week = ?, updated_at = datetime('now') WHERE id = ?`,
    [mappedGoal, algo.training_days_per_week, userId],
  );
}

// ============================================
// HEALTH ENGINE SUPPORT
// ============================================

export async function getWorkoutCountSince(timestamp: number): Promise<number> {
  const db = await getDatabase();
  const sinceIso = new Date(timestamp).toISOString();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions WHERE started_at >= ?`,
    [sinceIso],
  );
  return row?.cnt ?? 0;
}

export async function getAverageFatigueLevel(): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ avg_fatigue: number }>(
    `SELECT AVG(fatigue_level) as avg_fatigue FROM muscle_fatigue`,
  );
  return row?.avg_fatigue ?? null;
}

export async function getWorkoutStreakCurrent(userId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ current_streak: number }>(
    `SELECT current_streak FROM workout_streaks WHERE user_id = ?`,
    [userId],
  );
  return row?.current_streak ?? 0;
}

export async function getRecoveryScoresSince(
  since: number,
): Promise<Array<{ recovery_score: number; updated_at: number }>> {
  const db = await getDatabase();
  const sinceIso = new Date(since).toISOString();
  const rows = await db.getAllAsync<{ recovery_score: number; updated_at: string }>(
    `SELECT (100 - fatigue_level) as recovery_score, updated_at FROM muscle_fatigue
     WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 30`,
    [sinceIso],
  );

  return rows.map((row) => ({
    recovery_score: row.recovery_score,
    updated_at: Date.parse(row.updated_at),
  }));
}

// ============================================
// PROGRESSION SUPPORT
// ============================================

export async function getProgressExerciseIds(userId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT DISTINCT exercise_id FROM progress_records WHERE user_id = ?`,
    [userId],
  );
  return rows.map((r) => r.exercise_id);
}

// ============================================
// ENCRYPTED DATA SUPPORT
// ============================================

export interface EncryptedRow {
  id: string;
  data_blob: string;
  created_at: number;
  updated_at: number;
}

export async function insertEncryptedHealthRow(params: {
  id: string;
  category: string;
  data_blob: string;
  created_at: number;
  updated_at: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO encrypted_health_data (id, category, data_blob, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [params.id, params.category, params.data_blob, params.created_at, params.updated_at],
  );
}

export async function getEncryptedHealthRow(id: string): Promise<EncryptedRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<EncryptedRow>(`SELECT * FROM encrypted_health_data WHERE id = ?`, [id]);
}

export async function getEncryptedHealthRowsByCategory(category: string, limit: number): Promise<EncryptedRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<EncryptedRow>(
    `SELECT * FROM encrypted_health_data WHERE category = ? ORDER BY created_at DESC LIMIT ?`,
    [category, limit],
  );
}

export async function updateEncryptedHealthRow(params: {
  id: string;
  data_blob: string;
  updated_at: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE encrypted_health_data SET data_blob = ?, updated_at = ? WHERE id = ?`, [
    params.data_blob,
    params.updated_at,
    params.id,
  ]);
}

export async function getAllEncryptedHealthRows(): Promise<Array<{ id: string; data_blob: string }>> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; data_blob: string }>(`SELECT id, data_blob FROM encrypted_health_data`);
}

export async function insertEncryptedAIConversationRow(params: {
  id: string;
  personality: 'COACH' | 'PROFESSOR';
  query_blob: string;
  response_blob: string;
  context_doc_ids?: string | null;
  model_version?: string | null;
  tokens_used?: number;
  processing_time_ms?: number;
  created_at: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO encrypted_ai_conversations
     (id, ai_personality, query_blob, response_blob, context_doc_ids, model_version, tokens_used, processing_time_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.personality,
      params.query_blob,
      params.response_blob,
      params.context_doc_ids ?? null,
      params.model_version ?? null,
      params.tokens_used ?? 0,
      params.processing_time_ms ?? 0,
      params.created_at,
    ],
  );
}

export async function getEncryptedAIConversations(
  personality: 'COACH' | 'PROFESSOR',
  limit: number,
): Promise<Array<{ id: string; query_blob: string; response_blob: string; created_at: number }>> {
  const db = await getDatabase();
  return db.getAllAsync<{
    id: string;
    query_blob: string;
    response_blob: string;
    created_at: number;
  }>(
    `SELECT id, query_blob, response_blob, created_at
     FROM encrypted_ai_conversations
     WHERE ai_personality = ?
     ORDER BY created_at DESC LIMIT ?`,
    [personality, limit],
  );
}

export async function updateEncryptedAIConversationRow(params: {
  id: string;
  query_blob: string;
  response_blob: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE encrypted_ai_conversations SET query_blob = ?, response_blob = ? WHERE id = ?`, [
    params.query_blob,
    params.response_blob,
    params.id,
  ]);
}

/** Delete AI conversations older than the given Unix epoch timestamp */
export async function deleteOldAIConversations(
  personality: 'COACH' | 'PROFESSOR',
  olderThanMs: number,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM encrypted_ai_conversations WHERE ai_personality = ? AND created_at < ?`,
    [personality, olderThanMs],
  );
  return result.changes;
}

export async function getAllEncryptedAIConversationRows(): Promise<
  Array<{ id: string; query_blob: string; response_blob: string }>
> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; query_blob: string; response_blob: string }>(
    `SELECT id, query_blob, response_blob FROM encrypted_ai_conversations`,
  );
}

export async function insertHealthAlertRow(params: {
  id: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  data_blob: string;
  location_blob: string | null;
  created_at: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO health_alerts (id, alert_type, severity, data_blob, location_blob, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.id, params.alert_type, params.severity, params.data_blob, params.location_blob, params.created_at],
  );
}

export async function acknowledgeHealthAlertRow(id: string, acknowledgedAt: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE health_alerts SET acknowledged_at = ? WHERE id = ?`, [acknowledgedAt, id]);
}

export async function getActiveHealthAlertRows(): Promise<
  Array<{ id: string; alert_type: string; severity: string; data_blob: string; created_at: number }>
> {
  const db = await getDatabase();
  return db.getAllAsync<{
    id: string;
    alert_type: string;
    severity: string;
    data_blob: string;
    created_at: number;
  }>(
    `SELECT id, alert_type, severity, data_blob, created_at
     FROM health_alerts WHERE acknowledged_at IS NULL ORDER BY created_at DESC`,
  );
}

export async function insertEncryptedNoteRow(params: {
  id: string;
  reference_type: string;
  reference_id: string;
  content_blob: string;
  created_at: number;
  updated_at: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO encrypted_notes (id, reference_type, reference_id, content_blob, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.id, params.reference_type, params.reference_id, params.content_blob, params.created_at, params.updated_at],
  );
}

export async function getEncryptedNoteRow(id: string): Promise<{ content_blob: string } | null> {
  const db = await getDatabase();
  return db.getFirstAsync<{ content_blob: string }>(`SELECT content_blob FROM encrypted_notes WHERE id = ?`, [id]);
}

export async function secureDeleteEncryptedRow(params: {
  table: 'encrypted_health_data' | 'encrypted_ai_conversations' | 'encrypted_notes' | 'health_alerts';
  id: string;
  randomBlob: string;
}): Promise<void> {
  const db = await getDatabase();
  const table = params.table;

  if (table === 'encrypted_health_data') {
    await db.runAsync(`UPDATE encrypted_health_data SET data_blob = ? WHERE id = ?`, [params.randomBlob, params.id]);
    await db.runAsync(`DELETE FROM encrypted_health_data WHERE id = ?`, [params.id]);
    return;
  }

  if (table === 'encrypted_ai_conversations') {
    await db.runAsync(`UPDATE encrypted_ai_conversations SET query_blob = ?, response_blob = ? WHERE id = ?`, [
      params.randomBlob,
      params.randomBlob,
      params.id,
    ]);
    await db.runAsync(`DELETE FROM encrypted_ai_conversations WHERE id = ?`, [params.id]);
    return;
  }

  if (table === 'encrypted_notes') {
    await db.runAsync(`UPDATE encrypted_notes SET content_blob = ? WHERE id = ?`, [params.randomBlob, params.id]);
    await db.runAsync(`DELETE FROM encrypted_notes WHERE id = ?`, [params.id]);
    return;
  }

  if (table === 'health_alerts') {
    await db.runAsync(`UPDATE health_alerts SET data_blob = ? WHERE id = ?`, [params.randomBlob, params.id]);
    await db.runAsync(`DELETE FROM health_alerts WHERE id = ?`, [params.id]);
  }
}

// ============================================
// USER INTERESTS (v17)
// ============================================

export async function getUserInterests(userId: string): Promise<Array<{ topic: string; priority: number }>> {
  const db = await getDatabase();
  return db.getAllAsync<{ topic: string; priority: number }>(
    'SELECT topic, priority FROM user_interests WHERE user_id = ? ORDER BY priority DESC',
    [userId],
  );
}

export async function setUserInterests(
  userId: string,
  interests: Array<{ topic: string; priority: number }>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_interests WHERE user_id = ?', [userId]);
  for (const interest of interests) {
    await db.runAsync('INSERT INTO user_interests (user_id, topic, priority, created_at) VALUES (?, ?, ?, ?)', [
      userId,
      interest.topic,
      interest.priority,
      Date.now(),
    ]);
  }
}

// ============================================
// USER PERSONAL GOALS (v17)
// ============================================

export async function getUserPersonalGoals(
  userId: string,
  status?: 'active' | 'completed' | 'paused',
): Promise<
  Array<{ id: string; goal_text: string; category: string; status: string; created_at: number; updated_at: number }>
> {
  const db = await getDatabase();
  if (status) {
    return db.getAllAsync(
      'SELECT id, goal_text, category, status, created_at, updated_at FROM user_personal_goals WHERE user_id = ? AND status = ? ORDER BY updated_at DESC',
      [userId, status],
    );
  }
  return db.getAllAsync(
    'SELECT id, goal_text, category, status, created_at, updated_at FROM user_personal_goals WHERE user_id = ? ORDER BY updated_at DESC',
    [userId],
  );
}

export async function addUserPersonalGoal(userId: string, goalText: string, category: string): Promise<string> {
  const db = await getDatabase();
  const id = await generateSecureId('goal');
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO user_personal_goals (id, user_id, goal_text, category, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, goalText, category, 'active', now, now],
  );
  return id;
}

export async function updateUserPersonalGoalStatus(
  goalId: string,
  status: 'active' | 'completed' | 'paused',
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE user_personal_goals SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    Date.now(),
    goalId,
  ]);
}

// ============================================
// MIND XP (v17)
// ============================================

export async function getMindXP(userId: string): Promise<{
  total_mind_xp: number;
  mind_level: number;
  pages_read_total: number;
  flashcards_reviewed_total: number;
  documents_completed: number;
} | null> {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT total_mind_xp, mind_level, pages_read_total, flashcards_reviewed_total, documents_completed FROM mind_xp WHERE user_id = ?',
    [userId],
  );
}

export async function awardMindXP(
  userId: string,
  xpAmount: number,
  source: 'reading' | 'flashcard' | 'document_complete',
): Promise<{ total_mind_xp: number; mind_level: number; levelUp: boolean }> {
  const db = await getDatabase();
  const MIND_XP_PER_LEVEL = 200;
  const now = Date.now();

  // Upsert mind_xp row
  const existing = await db.getFirstAsync<{
    total_mind_xp: number;
    mind_level: number;
    pages_read_total: number;
    flashcards_reviewed_total: number;
    documents_completed: number;
  }>('SELECT * FROM mind_xp WHERE user_id = ?', [userId]);

  if (!existing) {
    const newXP = xpAmount;
    const level = Math.floor(newXP / MIND_XP_PER_LEVEL) + 1;
    await db.runAsync(
      'INSERT INTO mind_xp (user_id, total_mind_xp, mind_level, pages_read_total, flashcards_reviewed_total, documents_completed, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        newXP,
        level,
        source === 'reading' ? 1 : 0,
        source === 'flashcard' ? 1 : 0,
        source === 'document_complete' ? 1 : 0,
        now,
      ],
    );
    return { total_mind_xp: newXP, mind_level: level, levelUp: level > 1 };
  }

  const newTotal = existing.total_mind_xp + xpAmount;
  const oldLevel = existing.mind_level;
  const newLevel = Math.floor(newTotal / MIND_XP_PER_LEVEL) + 1;
  const incPages = source === 'reading' ? 1 : 0;
  const incFlash = source === 'flashcard' ? 1 : 0;
  const incDocs = source === 'document_complete' ? 1 : 0;

  await db.runAsync(
    `UPDATE mind_xp SET total_mind_xp = ?, mind_level = ?, pages_read_total = pages_read_total + ?, flashcards_reviewed_total = flashcards_reviewed_total + ?, documents_completed = documents_completed + ?, updated_at = ? WHERE user_id = ?`,
    [newTotal, newLevel, incPages, incFlash, incDocs, now, userId],
  );

  return { total_mind_xp: newTotal, mind_level: newLevel, levelUp: newLevel > oldLevel };
}

// ============================================
// DOCUMENT IMPORTANCE (v17)
// ============================================

export async function setDocumentImportance(
  documentId: string,
  score: number,
  matchedInterests: string[],
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO document_importance (document_id, importance_score, matched_interests, auto_recommended, scanned_at) VALUES (?, ?, ?, 1, ?)`,
    [documentId, Math.max(0, Math.min(100, score)), JSON.stringify(matchedInterests), Date.now()],
  );
}

export async function getDocumentImportance(
  documentId: string,
): Promise<{ importance_score: number; matched_interests: string; auto_recommended: number } | null> {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT importance_score, matched_interests, auto_recommended FROM document_importance WHERE document_id = ?',
    [documentId],
  );
}

/**
 * Delete ALL user data from the database (Google Play compliance: data deletion request).
 * Preserves exercise catalogue (seed data) but removes all user-generated content.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  const walId = await walService.logIntent({
    operation: 'delete_all_user_data',
    table_name: 'user_profile',
    record_id: userId,
    payload: {},
  });
  try {
    const db = await getDatabase();
    const tables = [
      { table: 'session_exercises', where: `session_id IN (SELECT id FROM workout_sessions WHERE user_id = ?)` },
      { table: 'workout_sessions', where: `user_id = ?` },
      { table: 'progress_records', where: `user_id = ?` },
      { table: 'muscle_fatigue', where: `user_id = ?` },
      { table: 'user_injuries', where: `user_id = ?` },
      { table: 'user_equipment', where: `user_id = ?` },
      { table: 'workout_streaks', where: `user_id = ?` },
      { table: 'daily_steps', where: `user_id = ?` },
      { table: 'jog_sessions', where: `user_id = ?` },
      { table: 'audio_settings', where: `user_id = ?` },
      { table: 'body_craft_algorithms', where: `user_id = ?` },
      { table: 'subscription_state', where: `user_id = ?` },
      { table: 'trial_state', where: `user_id = ?` },
      { table: 'encrypted_health_data', where: null },
      { table: 'encrypted_ai_conversations', where: null },
      { table: 'encrypted_notes', where: null },
      { table: 'health_alerts', where: `user_id = ?` },
      { table: 'heart_rate_readings', where: `user_id = ?` },
      { table: 'anomaly_log', where: `user_id = ?` },
      { table: 'daily_health_summaries', where: `user_id = ?` },
      { table: 'fitmind_reading_sessions', where: null },
      { table: 'fitmind_annotations', where: null },
      { table: 'fitmind_flashcards', where: null },
      { table: 'fitmind_reading_goals', where: `user_id = ?` },
      { table: 'fitmind_reading_streaks', where: `user_id = ?` },
      { table: 'fitmind_documents', where: null },
      { table: 'document_content_hashes', where: null },
      { table: 'app_state', where: null },
      { table: 'user_profile', where: `id = ?` },
    ];
    for (const { table, where } of tables) {
      if (where) {
        await db.runAsync(`DELETE FROM ${table} WHERE ${where}`, userId);
      } else {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    }
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch((e) => safeWarn('[DB] WAL markFailed error', { error: String(e) }));
    throw error;
  }
}
