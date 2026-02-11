/**
 * FitQuest SQLite Database Schema
 * Client-side, offline-first database for Phase 1 (Local Dominance)
 */

import * as SQLite from 'expo-sqlite';
import { SCHEMA_VERSION } from './types';

const DATABASE_NAME = 'fitquest.db';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Get or create the database instance (mutex-protected)
 * Prevents race condition where multiple callers open separate connections
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  // Mutex: if init is already in-flight, wait for it
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await initializeSchema(database);
      db = database;
      return database;
    } catch (error) {
      dbInitPromise = null; // Allow retry on failure
      throw error;
    }
  })();

  return dbInitPromise;
}

/**
 * Initialize database schema
 */
async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check current schema version
  const versionResult = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Migration v0–v5 → v6+: drop exercise catalogue for clean re-seed (audio_transition bug)
    if (currentVersion >= 1 && currentVersion < 6) {
      console.log(`[FitQuest DB] Migrating v${currentVersion} → v${SCHEMA_VERSION}: dropping exercise tables for clean re-seed`);
      await database.execAsync(`
        DROP TABLE IF EXISTS exercise_training_types;
        DROP TABLE IF EXISTS exercise_equipment;
        DROP TABLE IF EXISTS exercise_muscles;
        DROP TABLE IF EXISTS exercises;
      `);
    }

    // v6 → v7: additive migration only (new module tables).
    // No exercise table drops needed — CREATE IF NOT EXISTS is safe.
    if (currentVersion === 6) {
      console.log(`[FitQuest DB] Migrating v6 → v7: adding security, FitMind, and health analytics tables`);
    }

    // v7 → v8: advanced health monitoring tables (anomaly, sleep, HR, daily health)
    if (currentVersion === 7) {
      console.log(`[FitQuest DB] Migrating v7 → v8: adding anomaly detection, sleep tracking, health monitoring tables`);
    }

    await createTables(database);
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/**
 * Create all database tables
 */
async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- ============================================
    -- EXERCISE CATALOGUE TABLES
    -- ============================================

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN (
        'calisthenics', 'getting_taller', 'faster', 'flexible', 
        'mental_clarity', 'building_muscle'
      )),
      difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
      equipment_level TEXT NOT NULL CHECK (equipment_level IN ('none', 'minimal', 'playground')),
      impact_level TEXT NOT NULL CHECK (impact_level IN ('no_impact', 'low_impact', 'high_impact')),
      space_required TEXT NOT NULL CHECK (space_required IN (
        'mat_only_1x1', 'small_bedroom_2x2', 'living_room_3x3', 'outdoors_hall'
      )),
      time_per_set_seconds INTEGER NOT NULL DEFAULT 30,
      instructions TEXT NOT NULL, -- JSON array of instruction steps
      order_in_category INTEGER NOT NULL DEFAULT 0,
      audio_intro TEXT NOT NULL DEFAULT '',
      audio_setup TEXT NOT NULL DEFAULT '',
      audio_execution TEXT NOT NULL DEFAULT '',
      audio_transition TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
    CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
    CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment_level);

    -- Exercise target muscles (many-to-many)
    CREATE TABLE IF NOT EXISTS exercise_muscles (
      exercise_id TEXT NOT NULL,
      muscle TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (exercise_id, muscle),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_muscles_muscle ON exercise_muscles(muscle);

    -- Exercise equipment requirements (many-to-many)
    CREATE TABLE IF NOT EXISTS exercise_equipment (
      exercise_id TEXT NOT NULL,
      equipment TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (exercise_id, equipment),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    -- Exercise training type effectiveness (many-to-many with score)
    CREATE TABLE IF NOT EXISTS exercise_training_types (
      exercise_id TEXT NOT NULL,
      training_type TEXT NOT NULL CHECK (training_type IN (
        'strength', 'hypertrophy', 'endurance', 'mobility', 'speed_power',
        'balance', 'recovery', 'mindfulness', 'fat_loss', 'posture',
        'decompression', 'coordination'
      )),
      effectiveness INTEGER NOT NULL DEFAULT 5 CHECK (effectiveness BETWEEN 1 AND 10),
      PRIMARY KEY (exercise_id, training_type),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    -- ============================================
    -- USER STATE TABLES
    -- ============================================

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      sex TEXT CHECK (sex IN ('male', 'female', 'other')),
      weight_kg REAL,
      height_cm REAL,
      goal TEXT NOT NULL CHECK (goal IN (
        'calisthenics', 'getting_taller', 'faster', 'flexible', 
        'mental_clarity', 'building_muscle'
      )),
      experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
      training_days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week BETWEEN 1 AND 7),
      time_per_session_minutes INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      locked INTEGER NOT NULL DEFAULT 0
    );

    -- User available equipment
    CREATE TABLE IF NOT EXISTS user_equipment (
      user_id TEXT NOT NULL,
      equipment TEXT NOT NULL,
      PRIMARY KEY (user_id, equipment),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- User injuries/restrictions
    CREATE TABLE IF NOT EXISTS user_injuries (
      user_id TEXT NOT NULL,
      muscle TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, muscle),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- Muscle fatigue tracking
    CREATE TABLE IF NOT EXISTS muscle_fatigue (
      user_id TEXT NOT NULL,
      muscle TEXT NOT NULL,
      fatigue_level INTEGER NOT NULL DEFAULT 0 CHECK (fatigue_level BETWEEN 0 AND 100),
      last_trained_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, muscle),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- ============================================
    -- WORKOUT SESSION TABLES
    -- ============================================

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      total_exercises INTEGER NOT NULL DEFAULT 0,
      completed_exercises INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON workout_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON workout_sessions(started_at);

    -- Exercises within a session
    CREATE TABLE IF NOT EXISTS session_exercises (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      order_in_session INTEGER NOT NULL,
      prescribed_sets INTEGER NOT NULL DEFAULT 3,
      prescribed_reps TEXT NOT NULL DEFAULT '8-12',
      completed_sets INTEGER NOT NULL DEFAULT 0,
      completed_reps TEXT,
      skipped INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);

    -- Progress tracking over time
    CREATE TABLE IF NOT EXISTS progress_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      date TEXT NOT NULL,
      sets_completed INTEGER NOT NULL,
      reps_achieved TEXT NOT NULL,
      difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 10),
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_progress_exercise ON progress_records(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_progress_date ON progress_records(date);

    -- ============================================
    -- SUBSCRIPTION & APP STATE TABLES
    -- ============================================

    CREATE TABLE IF NOT EXISTS subscription_state (
      user_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
      expires_at TEXT,
      last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
      grace_period_start TEXT,
      receipt_data TEXT,
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================
    -- STREAK & ANALYTICS TABLES
    -- ============================================

    CREATE TABLE IF NOT EXISTS workout_streaks (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_workout_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- ============================================
    -- MOVE MODULE TABLES (Steps, Jog/Walk)
    -- Separate from workout engine - utility only
    -- ============================================

    CREATE TABLE IF NOT EXISTS daily_steps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      steps INTEGER NOT NULL DEFAULT 0,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_steps_date ON daily_steps(date);

    CREATE TABLE IF NOT EXISTS jog_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      distance_meters REAL NOT NULL DEFAULT 0,
      avg_pace_per_km REAL, -- seconds per km
      calories_estimate INTEGER,
      route_data TEXT, -- JSON for local route points (optional)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jog_sessions_user ON jog_sessions(user_id);

    -- ============================================
    -- AUDIO SETTINGS TABLE
    -- ============================================

    CREATE TABLE IF NOT EXISTS audio_settings (
      user_id TEXT PRIMARY KEY,
      voice_enabled INTEGER NOT NULL DEFAULT 1,
      speech_rate REAL NOT NULL DEFAULT 1.0 CHECK (speech_rate IN (0.8, 1.0, 1.2)),
      countdown_cues_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- ============================================
    -- BODY CRAFT ALGORITHMS TABLE
    -- ============================================

    CREATE TABLE IF NOT EXISTS body_craft_algorithms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      body_type TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      timeline_months INTEGER NOT NULL,
      muscle_priorities TEXT NOT NULL,
      recommended_training_split TEXT NOT NULL,
      training_days_per_week INTEGER NOT NULL,
      calories_target INTEGER NOT NULL,
      protein_g INTEGER NOT NULL,
      carbs_g INTEGER NOT NULL,
      fats_g INTEGER NOT NULL,
      daily_water_liters REAL NOT NULL,
      sleep_hours REAL NOT NULL,
      cardio_minutes_per_week INTEGER NOT NULL,
      exercise_category_weights TEXT NOT NULL,
      weekly_schedule TEXT NOT NULL,
      nutrition_tips TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- ============================================
    -- ENCRYPTED DATA TABLES (v7)
    -- ============================================

    CREATE TABLE IF NOT EXISTS encrypted_health_data (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      data_blob TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS encrypted_ai_conversations (
      id TEXT PRIMARY KEY,
      ai_personality TEXT NOT NULL CHECK(ai_personality IN ('COACH', 'PROFESSOR')),
      query_blob TEXT NOT NULL,
      response_blob TEXT NOT NULL,
      context_doc_ids TEXT,
      model_version TEXT,
      tokens_used INTEGER DEFAULT 0,
      processing_time_ms INTEGER DEFAULT 0,
      feedback_rating INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS encrypted_notes (
      id TEXT PRIMARY KEY,
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      content_blob TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      data_blob TEXT NOT NULL,
      location_blob TEXT,
      acknowledged_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_enc_health_category ON encrypted_health_data(category, created_at);
    CREATE INDEX IF NOT EXISTS idx_enc_ai_personality ON encrypted_ai_conversations(ai_personality, created_at);
    CREATE INDEX IF NOT EXISTS idx_health_alerts_type ON health_alerts(alert_type, created_at);

    -- ============================================
    -- FITMIND MODULE TABLES (v7)
    -- ============================================

    CREATE TABLE IF NOT EXISTS fitmind_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Unknown',
      type TEXT NOT NULL CHECK(type IN ('PDF', 'EPUB', 'ARTICLE', 'NOTE')),
      status TEXT NOT NULL DEFAULT 'UNREAD' CHECK(status IN ('UNREAD', 'READING', 'COMPLETED', 'ARCHIVED')),
      category TEXT NOT NULL DEFAULT 'General',
      tags TEXT DEFAULT '[]',
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 1,
      current_page INTEGER DEFAULT 0,
      content TEXT,
      word_count INTEGER DEFAULT 0,
      reading_level TEXT,
      estimated_minutes INTEGER DEFAULT 0,
      cover_color TEXT DEFAULT '#10B981',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitmind_reading_sessions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      start_page INTEGER NOT NULL,
      end_page INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      words_read INTEGER DEFAULT 0,
      comprehension_score REAL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fitmind_annotations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('HIGHLIGHT', 'NOTE', 'BOOKMARK', 'QUESTION')),
      content TEXT NOT NULL,
      color TEXT DEFAULT '#10B981',
      position_start INTEGER,
      position_end INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fitmind_flashcards (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      difficulty REAL DEFAULT 2.5,
      repetitions INTEGER DEFAULT 0,
      interval_days INTEGER DEFAULT 1,
      next_review INTEGER NOT NULL,
      ease_factor REAL DEFAULT 2.5,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fitmind_reading_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      type TEXT NOT NULL CHECK(type IN ('DAILY_MINUTES', 'WEEKLY_PAGES', 'MONTHLY_BOOKS')),
      target INTEGER NOT NULL,
      current INTEGER DEFAULT 0,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      achieved INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitmind_reading_streaks (
      user_id TEXT PRIMARY KEY DEFAULT 'user_local_001',
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_read_date TEXT,
      total_books_completed INTEGER DEFAULT 0,
      total_minutes_read INTEGER DEFAULT 0,
      total_pages_read INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fitmind_docs_status ON fitmind_documents(status);
    CREATE INDEX IF NOT EXISTS idx_fitmind_sessions_doc ON fitmind_reading_sessions(document_id);
    CREATE INDEX IF NOT EXISTS idx_fitmind_annotations_doc ON fitmind_annotations(document_id);
    CREATE INDEX IF NOT EXISTS idx_fitmind_flashcards_doc ON fitmind_flashcards(document_id);
    CREATE INDEX IF NOT EXISTS idx_fitmind_flashcards_review ON fitmind_flashcards(next_review);

    -- ============================================
    -- ADVANCED HEALTH MONITORING (v8)
    -- ============================================

    -- Heart rate readings (plaintext — non-PII aggregate data)
    CREATE TABLE IF NOT EXISTS heart_rate_readings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      bpm INTEGER NOT NULL CHECK(bpm BETWEEN 20 AND 250),
      reading_type TEXT NOT NULL DEFAULT 'RESTING' CHECK(reading_type IN ('RESTING', 'ACTIVE', 'RECOVERY', 'MANUAL')),
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'SENSOR', 'WEARABLE')),
      context TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hr_readings_user ON heart_rate_readings(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_hr_readings_type ON heart_rate_readings(reading_type, created_at);

    -- Anomaly detection log (plaintext metadata, encrypted details in health_alerts)
    CREATE TABLE IF NOT EXISTS anomaly_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      expected_min REAL,
      expected_max REAL,
      z_score REAL,
      alert_id TEXT,
      acknowledged INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_anomaly_severity ON anomaly_log(severity, created_at);
    CREATE INDEX IF NOT EXISTS idx_anomaly_type ON anomaly_log(anomaly_type, created_at);

    -- Daily health summaries (composite scores for trend charting)
    CREATE TABLE IF NOT EXISTS daily_health_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      date TEXT NOT NULL,
      health_score INTEGER NOT NULL CHECK(health_score BETWEEN 0 AND 100),
      total_steps INTEGER DEFAULT 0,
      active_minutes INTEGER DEFAULT 0,
      total_calories INTEGER DEFAULT 0,
      workouts_completed INTEGER DEFAULT 0,
      avg_heart_rate INTEGER,
      recovery_score INTEGER,
      sleep_quality INTEGER,
      sleep_hours REAL,
      anomaly_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_health_date ON daily_health_summaries(user_id, date);

    -- Content hash index for document deduplication (v8)
    CREATE TABLE IF NOT EXISTS document_content_hashes (
      hash TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Reset the database (for testing/development)
 */
export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  dbInitPromise = null;
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  await getDatabase();
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  dbInitPromise = null;
}
