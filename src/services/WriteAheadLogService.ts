/**
 * WriteAheadLogService — Intent-driven execution engine for critical database writes.
 *
 * Upgraded from logging-only → full replay engine:
 * - Logs intent BEFORE executing a critical operation
 * - On recovery, replays pending intents with idempotent guards
 * - Provides walTransaction() for atomic WAL+DB writes
 * - Tracks WAL checkpoints for diff-based snapshots
 *
 * Uses a dedicated SQLite table (`durability_wal`) for atomicity.
 */

import { getDatabase } from '../database/schema';
import { captureException } from './crashReporting';
import { authService } from '../security/AuthService';
import { encryptV3, decryptV3 } from '../security/AESEncryption';
import * as Crypto from 'expo-crypto';

// ============================================
// TYPES
// ============================================

export type WALStatus = 'pending' | 'committed' | 'failed' | 'replayed';

export interface WALEntry {
  id: string;
  operation: string; // e.g. 'create_workout', 'update_profile', 'complete_session'
  table_name: string; // target table
  record_id: string; // target record ID
  payload: string; // JSON stringified intent data
  status: WALStatus;
  created_at: number; // Unix epoch ms
  committed_at: number | null;
}

export interface ReplayResult {
  total: number;
  replayed: number;
  skipped: number; // already applied (idempotent check passed)
  failed: number;
  entries: Array<{ id: string; operation: string; outcome: 'replayed' | 'skipped' | 'failed'; error?: string }>;
}

/** Handler that replays a single WAL operation idempotently */
export type ReplayHandler = (entry: WALEntry, payload: Record<string, unknown>) => Promise<'replayed' | 'skipped'>;

// ============================================
// SCHEMA
// ============================================

const CREATE_WAL_TABLE = `
CREATE TABLE IF NOT EXISTS durability_wal (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'committed', 'failed', 'replayed')),
  created_at INTEGER NOT NULL,
  committed_at INTEGER
);
`;

const CREATE_WAL_INDEX = `
CREATE INDEX IF NOT EXISTS idx_wal_status ON durability_wal(status);
`;

// ============================================
// IDEMPOTENT REPLAY HANDLERS
// ============================================

/**
 * Each handler checks if the target record already exists (idempotent guard)
 * and applies the write only if needed.
 */
async function replayCreateUserProfile(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM user_profile WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  await db.runAsync(
    `INSERT OR IGNORE INTO user_profile (id, goal, experience, training_days_per_week, time_per_session_minutes, locked)
     VALUES (?, ?, ?, 4, 30, 0)`,
    [entry.record_id, String(payload.goal ?? 'body_control'), String(payload.experience ?? 'intermediate')],
  );
  return 'replayed';
}

async function replayUpdateUserProfile(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM user_profile WHERE id = ?`, [
    entry.record_id,
  ]);
  if (!existing) return 'skipped'; // can't update non-existent profile
  const fields = payload.fields as string[] | undefined;
  if (!fields || fields.length === 0) return 'skipped';
  // Re-apply is safe — UPDATE is naturally idempotent for same values
  await db.runAsync(`UPDATE user_profile SET updated_at = datetime('now') WHERE id = ?`, [entry.record_id]);
  return 'replayed';
}

async function replayCreateWorkoutSession(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM workout_sessions WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_sessions (id, user_id, duration_minutes, total_exercises, completed_exercises, success)
     VALUES (?, ?, 0, ?, 0, 0)`,
    [entry.record_id, String(payload.user_id ?? 'user_local_001'), Number(payload.total_exercises ?? 0)],
  );
  return 'replayed';
}

async function replayCompleteWorkoutSession(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<{ id: string; completed_at: string | null }>(
    `SELECT id, completed_at FROM workout_sessions WHERE id = ?`,
    [entry.record_id],
  );
  if (!session) return 'skipped';
  if (session.completed_at) return 'skipped'; // already completed
  await db.runAsync(
    `UPDATE workout_sessions SET completed_at = datetime('now'), completed_exercises = ?, success = ? WHERE id = ?`,
    [Number(payload.completedExercises ?? 0), payload.success ? 1 : 0, entry.record_id],
  );
  return 'replayed';
}

async function replayRecordProgress(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM progress_records WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  await db.runAsync(
    `INSERT OR IGNORE INTO progress_records (id, user_id, exercise_id, date, sets_completed, reps_achieved)
     VALUES (?, 'user_local_001', ?, date('now'), ?, '0')`,
    [entry.record_id, String(payload.exercise_id ?? ''), Number(payload.sets ?? 0)],
  );
  return 'replayed';
}

async function replayUpdateStreak(entry: WALEntry, payload: Record<string, unknown>): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const currentStreak = (payload.currentStreak as number) ?? 1;
  const longestStreak = (payload.longestStreak as number) ?? 1;
  const date = (payload.date as string) ?? new Date().toISOString().split('T')[0]!;

  // Check if streak already reflects this date
  const existing = await db.getFirstAsync<{ last_workout_date: string | null }>(
    `SELECT last_workout_date FROM workout_streaks WHERE user_id = ?`,
    [entry.record_id],
  );
  if (existing?.last_workout_date === date) return 'skipped';

  await db.runAsync(
    `INSERT INTO workout_streaks (user_id, current_streak, longest_streak, last_workout_date)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       current_streak = MAX(current_streak, ?),
       longest_streak = MAX(longest_streak, ?),
       last_workout_date = ?,
       updated_at = datetime('now')`,
    [entry.record_id, currentStreak, longestStreak, date, currentStreak, longestStreak, date],
  );
  return 'replayed';
}

async function replayAddXP(entry: WALEntry, payload: Record<string, unknown>): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const newTotal = payload.newTotal as number | undefined;
  if (newTotal == null) return 'skipped';

  // Idempotent check: only apply if current XP is less than intended new total
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_state WHERE key = 'user_total_xp'`);
  const currentXP = row ? parseInt(row.value, 10) : 0;
  if (currentXP >= newTotal) return 'skipped'; // already at or past target

  await db.runAsync(
    `INSERT INTO app_state (key, value, updated_at) VALUES ('user_total_xp', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    [String(newTotal), String(newTotal)],
  );
  return 'replayed';
}

async function replayAccumulateFatigue(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const muscles = payload.muscles as string[] | undefined;
  const setsCompleted = (payload.setsCompleted as number) ?? 0;
  if (!muscles || muscles.length === 0 || setsCompleted === 0) return 'skipped';

  // Fatigue accumulation is additive — replaying adds fatigue again.
  // Idempotent guard: check if WAL entry timestamp is older than last fatigue update.
  // If the fatigue was already updated AFTER this WAL entry was created, skip.
  const sample = await db.getFirstAsync<{ updated_at: string }>(
    `SELECT updated_at FROM muscle_fatigue WHERE user_id = ? AND muscle = ? LIMIT 1`,
    [entry.record_id, muscles[0]!],
  );
  if (sample) {
    const fatigueTime = new Date(sample.updated_at).getTime();
    if (fatigueTime > entry.created_at) return 'skipped';
  }

  // Re-apply fatigue with capped values
  for (const muscle of muscles) {
    const increment = setsCompleted * 5; // approximate RECOVERY_CONFIG.fatigue_per_set_primary
    await db.runAsync(
      `INSERT INTO muscle_fatigue (user_id, muscle, fatigue_level, last_trained_at, updated_at)
       VALUES (?, ?, MIN(100, ?), datetime('now'), datetime('now'))
       ON CONFLICT(user_id, muscle) DO UPDATE SET
         fatigue_level = MIN(100, fatigue_level + ?),
         last_trained_at = datetime('now'),
         updated_at = datetime('now')`,
      [entry.record_id, muscle, increment, increment],
    );
  }
  return 'replayed';
}

// --- NEW REPLAY HANDLERS (MUST_COVER batch) ---

async function replayAddSessionExercise(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM session_exercises WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  await db.runAsync(
    `INSERT OR IGNORE INTO session_exercises (id, session_id, exercise_id, order_in_session, prescribed_sets, prescribed_reps, completed_sets, completed_reps, skipped, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.record_id,
      String(payload.session_id ?? ''),
      String(payload.exercise_id ?? ''),
      Number(payload.order_in_session ?? 0),
      Number(payload.prescribed_sets ?? 3),
      String(payload.prescribed_reps ?? '8-12'),
      Number(payload.completed_sets ?? 0),
      (payload.completed_reps as string) ?? null,
      payload.skipped ? 1 : 0,
      (payload.notes as string) ?? null,
    ],
  );
  return 'replayed';
}

async function replaySetUserEquipment(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const equipment = payload.equipment as string[] | undefined;
  if (!equipment) return 'skipped';
  // Idempotent: check current equipment matches
  const rows = await db.getAllAsync<{ equipment: string }>(`SELECT equipment FROM user_equipment WHERE user_id = ?`, [
    entry.record_id,
  ]);
  const current = rows.map((r) => r.equipment).sort();
  const target = [...equipment].sort();
  if (current.length === target.length && current.every((v, i) => v === target[i])) return 'skipped';
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM user_equipment WHERE user_id = ?`, [entry.record_id]);
    for (const item of equipment) {
      await db.runAsync(`INSERT INTO user_equipment (user_id, equipment) VALUES (?, ?)`, [entry.record_id, item]);
    }
  });
  return 'replayed';
}

async function replaySetUserInjury(entry: WALEntry, payload: Record<string, unknown>): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const muscle = payload.muscle as string;
  const severity = payload.severity as string;
  if (!muscle || !severity) return 'skipped';
  const existing = await db.getFirstAsync<{ severity: string }>(
    `SELECT severity FROM user_injuries WHERE user_id = ? AND muscle = ?`,
    [entry.record_id, muscle],
  );
  if (existing?.severity === severity) return 'skipped';
  await db.runAsync(`INSERT OR REPLACE INTO user_injuries (user_id, muscle, severity) VALUES (?, ?, ?)`, [
    entry.record_id,
    muscle,
    severity,
  ]);
  return 'replayed';
}

async function replayUpdateSubscriptionState(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ tier: string; expires_at: string | null }>(
    `SELECT tier, expires_at FROM subscription_state WHERE user_id = ?`,
    [entry.record_id],
  );
  if (existing?.tier === payload.tier && existing?.expires_at === (payload.expires_at ?? null)) return 'skipped';
  await db.runAsync(
    `INSERT INTO subscription_state (user_id, tier, expires_at, grace_period_start, receipt_data)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = ?, expires_at = ?, last_verified_at = datetime('now'), grace_period_start = ?, receipt_data = ?`,
    [
      entry.record_id,
      String(payload.tier ?? 'free'),
      (payload.expires_at as string) ?? null,
      (payload.grace_period_start as string) ?? null,
      (payload.receipt_data as string) ?? null,
      String(payload.tier ?? 'free'),
      (payload.expires_at as string) ?? null,
      (payload.grace_period_start as string) ?? null,
      (payload.receipt_data as string) ?? null,
    ],
  );
  return 'replayed';
}

async function replayUpsertTrialState(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ user_id: string; ends_at: number }>(
    `SELECT user_id, ends_at FROM trial_state WHERE user_id = ?`,
    [entry.record_id],
  );
  if (existing && existing.ends_at === payload.ends_at) return 'skipped';
  await db.runAsync(
    `INSERT OR REPLACE INTO trial_state (user_id, started_at, ends_at, converted, product_identifier, notifications_sent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.record_id,
      Number(payload.started_at ?? 0),
      Number(payload.ends_at ?? 0),
      Number(payload.converted ?? 0),
      (payload.product_identifier as string) ?? null,
      String(payload.notifications_sent ?? '[]'),
    ],
  );
  return 'replayed';
}

async function replayUpdateTrialConverted(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ converted: number }>(
    `SELECT converted FROM trial_state WHERE user_id = ?`,
    [entry.record_id],
  );
  if (!existing) return 'skipped';
  if (existing.converted === 1) return 'skipped';
  await db.runAsync(`UPDATE trial_state SET converted = 1, product_identifier = ? WHERE user_id = ?`, [
    (payload.product_identifier as string) ?? null,
    entry.record_id,
  ]);
  return 'replayed';
}

async function replaySaveBodyCraftAlgorithm(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM body_craft_algorithms WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  const userId = payload.user_id as string;
  // Deactivate previous
  await db.runAsync(`UPDATE body_craft_algorithms SET active = 0 WHERE user_id = ? AND active = 1`, [userId]);
  await db.runAsync(
    `INSERT OR IGNORE INTO body_craft_algorithms (id, user_id, body_type, goal_type, timeline_months, muscle_priorities, recommended_training_split, training_days_per_week, calories_target, protein_g, carbs_g, fats_g, daily_water_liters, sleep_hours, cardio_minutes_per_week, exercise_category_weights, weekly_schedule, nutrition_tips, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      entry.record_id,
      userId,
      String(payload.body_type ?? ''),
      String(payload.goal_type ?? ''),
      Number(payload.timeline_months ?? 0),
      String(payload.muscle_priorities ?? '[]'),
      String(payload.recommended_training_split ?? ''),
      Number(payload.training_days_per_week ?? 3),
      Number(payload.calories_target ?? 0),
      Number(payload.protein_g ?? 0),
      Number(payload.carbs_g ?? 0),
      Number(payload.fats_g ?? 0),
      Number(payload.daily_water_liters ?? 2.0),
      Number(payload.sleep_hours ?? 8),
      Number(payload.cardio_minutes_per_week ?? 0),
      String(payload.exercise_category_weights ?? '{}'),
      String(payload.weekly_schedule ?? '{}'),
      String(payload.nutrition_tips ?? '[]'),
      String(payload.created_at ?? new Date().toISOString()),
    ],
  );
  return 'replayed';
}

async function replayDeleteAllUserData(entry: WALEntry): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  // Idempotent: check if user profile still exists
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM user_profile WHERE id = ?`, [
    entry.record_id,
  ]);
  if (!existing) return 'skipped'; // already deleted
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
      await db.runAsync(`DELETE FROM ${table} WHERE ${where}`, entry.record_id);
    } else {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  }
  return 'replayed';
}

async function replayUpsertDailySteps(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const userId = payload.user_id as string;
  const date = payload.date as string;
  const steps = payload.steps as number;
  const activeMinutes = payload.active_minutes as number;
  if (!userId || !date || steps == null) return 'skipped';
  // Idempotent: check if already at target values
  const existing = await db.getFirstAsync<{ steps: number; active_minutes: number }>(
    `SELECT steps, active_minutes FROM daily_steps WHERE user_id = ? AND date = ?`,
    [userId, date],
  );
  if (existing && existing.steps === steps && existing.active_minutes === activeMinutes) return 'skipped';
  await db.runAsync(
    `INSERT INTO daily_steps (id, user_id, date, steps, active_minutes) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET steps = ?, active_minutes = ?`,
    [entry.record_id, userId, date, steps, activeMinutes, steps, activeMinutes],
  );
  return 'replayed';
}

async function replayCreateJogSession(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM jog_sessions WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  // Ensure user profile exists for FK
  const profile = await db.getFirstAsync<{ id: string }>(`SELECT id FROM user_profile WHERE id = ?`, [
    payload.user_id as string,
  ]);
  if (!profile) {
    await db.runAsync(
      `INSERT OR IGNORE INTO user_profile (id, goal, experience, training_days_per_week, time_per_session_minutes, locked) VALUES (?, 'body_control', 'intermediate', 4, 30, 1)`,
      [payload.user_id as string],
    );
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO jog_sessions (id, user_id, start_time, distance_meters, avg_pace_per_km, calories_estimate, route_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      entry.record_id,
      String(payload.user_id ?? ''),
      String(payload.start_time ?? ''),
      Number(payload.distance_meters ?? 0),
      (payload.avg_pace_per_km as number) ?? null,
      (payload.calories_estimate as number) ?? null,
      (payload.route_data as string) ?? null,
    ],
  );
  return 'replayed';
}

async function replayEndJogSession(entry: WALEntry, payload: Record<string, unknown>): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<{ id: string; end_time: string | null }>(
    `SELECT id, end_time FROM jog_sessions WHERE id = ?`,
    [entry.record_id],
  );
  if (!session) return 'skipped';
  if (session.end_time) return 'skipped'; // already ended
  await db.runAsync(
    `UPDATE jog_sessions SET end_time = ?, distance_meters = ?, avg_pace_per_km = ?, calories_estimate = ?, route_data = ? WHERE id = ?`,
    [
      String(payload.end_time ?? ''),
      Number(payload.distance_meters ?? 0),
      (payload.avg_pace_per_km as number) ?? null,
      (payload.calories_estimate as number) ?? null,
      (payload.route_data as string) ?? null,
      entry.record_id,
    ],
  );
  return 'replayed';
}

// ============================================
// FITMIND REPLAY HANDLERS
// ============================================

async function replayAddFitMindDocument(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_documents WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO fitmind_documents
     (id, title, author, type, status, category, tags, file_path, file_size, total_pages,
      current_page, content, word_count, reading_level, estimated_minutes, cover_color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.record_id,
      String(payload.title ?? ''),
      String(payload.author ?? 'Unknown'),
      String(payload.type ?? 'NOTE'),
      String(payload.status ?? 'UNREAD'),
      String(payload.category ?? 'General'),
      String(payload.tags ?? '[]'),
      (payload.file_path as string) ?? null,
      Number(payload.file_size ?? 0),
      Number(payload.total_pages ?? 1),
      Number(payload.current_page ?? 0),
      (payload.content as string) ?? null,
      Number(payload.word_count ?? 0),
      (payload.reading_level as string) ?? null,
      Number(payload.estimated_minutes ?? 0),
      String(payload.cover_color ?? '#10B981'),
      Number(payload.created_at ?? now),
      Number(payload.updated_at ?? now),
    ],
  );
  return 'replayed';
}

async function replayUpdateFitMindProgress(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const currentPage = Number(payload.current_page ?? 0);
  const existing = await db.getFirstAsync<{ current_page: number }>(
    `SELECT current_page FROM fitmind_documents WHERE id = ?`,
    [entry.record_id],
  );
  if (!existing) return 'skipped';
  if (existing.current_page === currentPage) return 'skipped';
  const now = Date.now();
  await db.runAsync(
    `UPDATE fitmind_documents SET current_page = ?, updated_at = ?,
     status = CASE WHEN ? >= total_pages AND total_pages > 0 THEN 'COMPLETED' ELSE 'READING' END WHERE id = ?`,
    [currentPage, now, currentPage, entry.record_id],
  );
  return 'replayed';
}

async function replayDeleteFitMindDocument(entry: WALEntry): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_documents WHERE id = ?`, [
    entry.record_id,
  ]);
  if (!existing) return 'skipped';
  await db.runAsync(`DELETE FROM fitmind_documents WHERE id = ?`, [entry.record_id]);
  return 'replayed';
}

async function replayRecordFitMindSession(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_reading_sessions WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO fitmind_reading_sessions
     (id, document_id, start_page, end_page, duration_minutes, words_read, comprehension_score, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.record_id,
      String(payload.document_id ?? ''),
      Number(payload.start_page ?? 0),
      Number(payload.end_page ?? 0),
      Number(payload.duration_minutes ?? 0),
      Number(payload.words_read ?? 0),
      (payload.comprehension_score as number) ?? null,
      (payload.notes as string) ?? null,
      Number(payload.created_at ?? now),
    ],
  );
  return 'replayed';
}

async function replayAddFitMindAnnotation(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_annotations WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO fitmind_annotations
     (id, document_id, page_number, type, content, color, position_start, position_end, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.record_id,
      String(payload.document_id ?? ''),
      Number(payload.page_number ?? 0),
      String(payload.type ?? 'NOTE'),
      String(payload.content ?? ''),
      String(payload.color ?? '#10B981'),
      (payload.position_start as number) ?? null,
      (payload.position_end as number) ?? null,
      Number(payload.created_at ?? now),
    ],
  );
  return 'replayed';
}

async function replayDeleteFitMindAnnotation(entry: WALEntry): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_annotations WHERE id = ?`, [
    entry.record_id,
  ]);
  if (!existing) return 'skipped';
  await db.runAsync(`DELETE FROM fitmind_annotations WHERE id = ?`, [entry.record_id]);
  return 'replayed';
}

async function replayAddFitMindFlashcard(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_flashcards WHERE id = ?`, [
    entry.record_id,
  ]);
  if (existing) return 'skipped';
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO fitmind_flashcards
     (id, document_id, front, back, difficulty, stability, state, due, scheduled_days,
      reps, lapses, learning_steps, ease_factor, repetitions, interval_days, next_review, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 2.5, 0, 1, ?, ?)`,
    [
      entry.record_id,
      String(payload.document_id ?? ''),
      String(payload.front ?? ''),
      String(payload.back ?? ''),
      Number(payload.difficulty ?? 5),
      Number(payload.stability ?? 0),
      Number(payload.state ?? 0),
      Number(payload.due ?? now),
      Number(payload.next_review ?? now),
      Number(payload.created_at ?? now),
    ],
  );
  return 'replayed';
}

async function replayUpdateFitMindFlashcardFSRS(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM fitmind_flashcards WHERE id = ?`, [
    entry.record_id,
  ]);
  if (!existing) return 'skipped';
  await db.runAsync(
    `UPDATE fitmind_flashcards
     SET due = ?, stability = ?, difficulty = ?, state = ?, scheduled_days = ?,
         reps = ?, lapses = ?, learning_steps = ?, last_review = ?,
         next_review = ?, interval_days = ?, repetitions = ?
     WHERE id = ?`,
    [
      Number(payload.due ?? 0),
      Number(payload.stability ?? 0),
      Number(payload.difficulty ?? 5),
      Number(payload.state ?? 0),
      Number(payload.scheduled_days ?? 0),
      Number(payload.reps ?? 0),
      Number(payload.lapses ?? 0),
      Number(payload.learning_steps ?? 0),
      Number(payload.last_review ?? 0),
      Number(payload.due ?? 0),
      Number(payload.scheduled_days ?? 0),
      Number(payload.reps ?? 0),
      entry.record_id,
    ],
  );
  return 'replayed';
}

async function replayUpdateFitMindReadingStreak(
  entry: WALEntry,
  payload: Record<string, unknown>,
): Promise<'replayed' | 'skipped'> {
  const db = await getDatabase();
  const pagesRead = Number(payload.pages_read ?? 0);
  const minutesRead = Number(payload.minutes_read ?? 0);
  const date = String(payload.date ?? '');
  if (!date) return 'skipped';
  const existing = await db.getFirstAsync<{
    last_read_date: string | null;
    current_streak: number;
    longest_streak: number;
  }>(
    `SELECT last_read_date, current_streak, longest_streak FROM fitmind_reading_streaks WHERE user_id = 'user_local_001'`,
  );
  if (!existing) {
    await db.runAsync(
      `INSERT INTO fitmind_reading_streaks (user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_minutes_read, updated_at)
       VALUES ('user_local_001', 1, 1, ?, ?, ?, ?)`,
      [date, pagesRead, minutesRead, Date.now()],
    );
    return 'replayed';
  }
  // Already processed this date
  if (existing.last_read_date === date) return 'skipped';
  let newStreak = existing.current_streak;
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0]!;
  if (existing.last_read_date === yesterdayStr) {
    newStreak++;
  } else {
    newStreak = 1;
  }
  const longestStreak = Math.max(existing.longest_streak, newStreak);
  await db.runAsync(
    `UPDATE fitmind_reading_streaks SET current_streak = ?, longest_streak = ?, last_read_date = ?,
     total_pages_read = total_pages_read + ?, total_minutes_read = total_minutes_read + ?, updated_at = ?
     WHERE user_id = 'user_local_001'`,
    [newStreak, longestStreak, date, pagesRead, minutesRead, Date.now()],
  );
  return 'replayed';
}

/** Registry mapping operation names to their idempotent replay handlers */
const REPLAY_HANDLERS: Record<string, ReplayHandler> = {
  create_user_profile: replayCreateUserProfile,
  update_user_profile: replayUpdateUserProfile,
  create_workout_session: replayCreateWorkoutSession,
  complete_workout_session: replayCompleteWorkoutSession,
  record_progress: replayRecordProgress,
  update_streak: replayUpdateStreak,
  add_xp: replayAddXP,
  accumulate_fatigue: replayAccumulateFatigue,
  // MUST_COVER batch
  add_session_exercise: replayAddSessionExercise,
  set_user_equipment: replaySetUserEquipment,
  set_user_injury: replaySetUserInjury,
  update_subscription_state: replayUpdateSubscriptionState,
  upsert_trial_state: replayUpsertTrialState,
  update_trial_converted: replayUpdateTrialConverted,
  save_body_craft_algorithm: replaySaveBodyCraftAlgorithm,
  delete_all_user_data: replayDeleteAllUserData,
  upsert_daily_steps: replayUpsertDailySteps,
  create_jog_session: replayCreateJogSession,
  end_jog_session: replayEndJogSession,
  // FitMind module
  add_fitmind_document: replayAddFitMindDocument,
  update_fitmind_progress: replayUpdateFitMindProgress,
  delete_fitmind_document: replayDeleteFitMindDocument,
  record_fitmind_session: replayRecordFitMindSession,
  add_fitmind_annotation: replayAddFitMindAnnotation,
  delete_fitmind_annotation: replayDeleteFitMindAnnotation,
  add_fitmind_flashcard: replayAddFitMindFlashcard,
  update_fitmind_flashcard_fsrs: replayUpdateFitMindFlashcardFSRS,
  update_fitmind_reading_streak: replayUpdateFitMindReadingStreak,
};

// ============================================
// SERVICE
// ============================================

class WriteAheadLogServiceImpl {
  private initialized = false;
  private lastCheckpoint = 0; // WAL checkpoint timestamp for diff snapshots

  /**
   * Ensure the WAL table exists. Idempotent — safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const db = await getDatabase();
      await db.execAsync(CREATE_WAL_TABLE);
      await db.execAsync(CREATE_WAL_INDEX);
      this.initialized = true;
      if (__DEV__) console.log('[WAL] Initialized');
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'WAL.initialize',
      });
    }
  }

  /**
   * Log an intent BEFORE executing the write.
   * Payload is encrypted at rest if master key is available.
   * Returns the WAL entry ID for later commit/fail.
   */
  async logIntent(params: {
    operation: string;
    table_name: string;
    record_id: string;
    payload?: Record<string, unknown>;
  }): Promise<string> {
    await this.initialize();
    const db = await getDatabase();
    const id = `wal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const rawPayload = JSON.stringify(params.payload ?? {});
    const storedPayload = await this.encryptPayload(rawPayload);

    await db.runAsync(
      `INSERT INTO durability_wal (id, operation, table_name, record_id, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      id,
      params.operation,
      params.table_name,
      params.record_id,
      storedPayload,
      now,
    );

    return id;
  }

  /**
   * Mark a WAL entry as committed (write succeeded).
   */
  async commit(walId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE durability_wal SET status = 'committed', committed_at = ? WHERE id = ?`,
      Date.now(),
      walId,
    );
  }

  /**
   * Mark a WAL entry as failed (write failed, needs recovery action).
   */
  async markFailed(walId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE durability_wal SET status = 'failed' WHERE id = ?`, walId);
  }

  /**
   * Execute a write operation within a transaction-bound WAL entry.
   * Atomic guarantee: WAL intent + DB write succeed or fail together.
   */
  async walTransaction<T>(
    params: {
      operation: string;
      table_name: string;
      record_id: string;
      payload?: Record<string, unknown>;
    },
    writeFn: () => Promise<T>,
  ): Promise<{ walId: string; result: T }> {
    await this.initialize();
    const db = await getDatabase();
    const walId = `wal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const rawPayload = JSON.stringify(params.payload ?? {});
    const storedPayload = await this.encryptPayload(rawPayload);

    let result: T;
    await db.withTransactionAsync(async () => {
      // WAL intent + DB write inside single atomic boundary
      await db.runAsync(
        `INSERT INTO durability_wal (id, operation, table_name, record_id, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        walId,
        params.operation,
        params.table_name,
        params.record_id,
        storedPayload,
        now,
      );
      result = await writeFn();
      await db.runAsync(
        `UPDATE durability_wal SET status = 'committed', committed_at = ? WHERE id = ?`,
        Date.now(),
        walId,
      );
    });

    return { walId, result: result! };
  }

  /**
   * REPLAY ENGINE — Replays all pending WAL intents with idempotent guards.
   * Each operation has a registered handler that checks if the write
   * was already applied before re-executing.
   *
   * Returns: { total, replayed, skipped, failed }
   */
  async replayPendingIntents(): Promise<ReplayResult> {
    await this.initialize();
    const pending = await this.getPendingEntries();
    const result: ReplayResult = { total: pending.length, replayed: 0, skipped: 0, failed: 0, entries: [] };

    if (pending.length === 0) return result;
    if (__DEV__) console.log(`[WAL] Replaying ${pending.length} pending intents...`);

    for (const entry of pending) {
      const handler = REPLAY_HANDLERS[entry.operation];
      if (!handler) {
        // No handler registered — mark as failed (unknown operation)
        if (__DEV__) console.warn(`[WAL] No replay handler for operation: ${entry.operation}`);
        await this.markFailed(entry.id);
        result.failed++;
        result.entries.push({ id: entry.id, operation: entry.operation, outcome: 'failed', error: 'no_handler' });
        continue;
      }

      try {
        const decryptedPayload = await this.decryptPayload(entry.payload);
        const payload = JSON.parse(decryptedPayload) as Record<string, unknown>;
        const outcome = await handler(entry, payload);

        if (outcome === 'replayed') {
          await this.markReplayed(entry.id);
          result.replayed++;
        } else {
          await this.markReplayed(entry.id);
          result.skipped++;
        }
        result.entries.push({ id: entry.id, operation: entry.operation, outcome });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (__DEV__) console.error(`[WAL] Replay failed for ${entry.id}:`, errMsg);
        await this.markFailed(entry.id);
        result.failed++;
        result.entries.push({ id: entry.id, operation: entry.operation, outcome: 'failed', error: errMsg });
        captureException(error instanceof Error ? error : new Error(errMsg), {
          context: 'WAL.replayPendingIntents',
          walEntry: entry.id,
          operation: entry.operation,
        });
      }
    }

    if (__DEV__)
      console.log(
        `[WAL] Replay complete: ${result.replayed} replayed, ${result.skipped} skipped, ${result.failed} failed`,
      );
    return result;
  }

  /**
   * Mark a WAL entry as replayed (intent was successfully recovered).
   */
  async markReplayed(walId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE durability_wal SET status = 'replayed', committed_at = ? WHERE id = ?`,
      Date.now(),
      walId,
    );
  }

  /**
   * Get all pending (uncommitted/non-failed) WAL entries.
   * These represent writes that were interrupted.
   */
  async getPendingEntries(): Promise<WALEntry[]> {
    await this.initialize();
    const db = await getDatabase();
    return db.getAllAsync<WALEntry>(`SELECT * FROM durability_wal WHERE status = 'pending' ORDER BY created_at ASC`);
  }

  /**
   * Get all failed entries (for manual review / retry).
   */
  async getFailedEntries(): Promise<WALEntry[]> {
    await this.initialize();
    const db = await getDatabase();
    return db.getAllAsync<WALEntry>(`SELECT * FROM durability_wal WHERE status = 'failed' ORDER BY created_at ASC`);
  }

  /**
   * Get WAL entries since a given checkpoint timestamp.
   * Used by diff-based snapshots to capture only recent changes.
   */
  async getEntriesSinceCheckpoint(since: number): Promise<WALEntry[]> {
    await this.initialize();
    const db = await getDatabase();
    return db.getAllAsync<WALEntry>(`SELECT * FROM durability_wal WHERE created_at > ? ORDER BY created_at ASC`, [
      since,
    ]);
  }

  /**
   * Get and advance the checkpoint. Returns the previous checkpoint value.
   */
  getCheckpoint(): number {
    return this.lastCheckpoint;
  }

  advanceCheckpoint(): number {
    const prev = this.lastCheckpoint;
    this.lastCheckpoint = Date.now();
    return prev;
  }

  /**
   * Export all WAL entries as JSON for bundled backup.
   */
  async exportAll(): Promise<WALEntry[]> {
    await this.initialize();
    const db = await getDatabase();
    return db.getAllAsync<WALEntry>(`SELECT * FROM durability_wal ORDER BY created_at ASC`);
  }

  /**
   * Import WAL entries from a backup bundle. Skips duplicates by ID.
   */
  async importEntries(entries: WALEntry[]): Promise<number> {
    await this.initialize();
    const db = await getDatabase();
    let imported = 0;
    for (const entry of entries) {
      try {
        await db.runAsync(
          `INSERT OR IGNORE INTO durability_wal (id, operation, table_name, record_id, payload, status, created_at, committed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          entry.id,
          entry.operation,
          entry.table_name,
          entry.record_id,
          entry.payload,
          entry.status,
          entry.created_at,
          entry.committed_at,
        );
        imported++;
      } catch {
        // skip duplicate or corrupt entries
      }
    }
    return imported;
  }

  // ============================================
  // PAYLOAD ENCRYPTION (AES-256-GCM AUTHENTICATED)
  // ============================================

  /**
   * Encrypt a WAL payload using AES-256-GCM (via encryptV3).
   * Falls back to plaintext if master key is unavailable.
   * Encrypted payloads are prefixed with 'enc2:' marker.
   * Legacy 'enc:' (unauthenticated XOR) payloads are still readable.
   */
  private async encryptPayload(plaintext: string): Promise<string> {
    const mk = authService.getMasterKey();
    if (!mk) return plaintext; // No key = plaintext (backward compat)

    const payload = await encryptV3(plaintext, mk);
    return `enc2:${JSON.stringify(payload)}`;
  }

  /**
   * Decrypt a WAL payload. Handles:
   * - enc2: prefix → AES-256-GCM authenticated decryption (v3)
   * - enc: prefix  → Legacy XOR stream cipher (unauthenticated, read-only compat)
   * - no prefix    → Plaintext (legacy)
   */
  private async decryptPayload(stored: string): Promise<string> {
    // AES-256-GCM authenticated payloads (current)
    if (stored.startsWith('enc2:')) {
      const mk = authService.getMasterKey();
      if (!mk) throw new Error('Cannot decrypt WAL payload — master key unavailable');
      const payload = JSON.parse(stored.slice(5));
      return decryptV3(payload, mk);
    }

    // Legacy XOR stream cipher (read-only backward compat)
    if (stored.startsWith('enc:')) {
      return this.decryptLegacyXOR(stored);
    }

    // Plaintext (pre-encryption era)
    return stored;
  }

  /**
   * Legacy XOR stream cipher decryption — kept for reading old WAL entries only.
   * New writes always use AES-256-GCM (enc2: prefix).
   */
  private async decryptLegacyXOR(stored: string): Promise<string> {
    const mk = authService.getMasterKey();
    if (!mk) throw new Error('Cannot decrypt WAL payload — master key unavailable');

    const parts = stored.split(':');
    const nonce = parts[1]!;
    const ctHex = parts[2]!;

    const ctBytes: number[] = [];
    for (let i = 0; i < ctHex.length; i += 2) {
      ctBytes.push(parseInt(ctHex.slice(i, i + 2), 16));
    }

    let keystream = '';
    let blockIdx = 0;
    while (keystream.length < ctBytes.length) {
      const block = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${mk}:${nonce}:wal:${blockIdx}`,
      );
      keystream += block;
      blockIdx++;
    }

    let plaintext = '';
    for (let i = 0; i < ctBytes.length; i++) {
      plaintext += String.fromCharCode(ctBytes[i]! ^ keystream.charCodeAt(i));
    }

    return plaintext;
  }

  /**
   * Clean up old committed/replayed entries (older than 24h).
   */
  async pruneCommitted(): Promise<number> {
    await this.initialize();
    const db = await getDatabase();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const result = await db.runAsync(
      `DELETE FROM durability_wal WHERE status IN ('committed', 'replayed') AND committed_at < ?`,
      cutoff,
    );
    return result.changes;
  }

  /**
   * Clear all WAL entries. Use after a full snapshot restore.
   */
  async clearAll(): Promise<void> {
    await this.initialize();
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM durability_wal`);
  }

  /**
   * Count entries by status. Useful for health monitoring.
   */
  async getStats(): Promise<{ pending: number; committed: number; failed: number; replayed: number }> {
    await this.initialize();
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM durability_wal GROUP BY status`,
    );
    const stats = { pending: 0, committed: 0, failed: 0, replayed: 0 };
    for (const row of rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  }
}

// ============================================
// SINGLETON
// ============================================

export const walService = new WriteAheadLogServiceImpl();
