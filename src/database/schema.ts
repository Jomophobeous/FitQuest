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

      // Enable foreign key constraint enforcement per-connection
      // Without this, ON DELETE CASCADE and FK checks are silently ignored
      await database.execAsync('PRAGMA foreign_keys = ON;');

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
    if (currentVersion < 7) {
      console.log(`[FitQuest DB] Migrating to v7: adding security, FitMind, and health analytics tables`);
    }

    // v7 → v8: advanced health monitoring tables (anomaly, sleep, HR, daily health)
    if (currentVersion < 8) {
      console.log(`[FitQuest DB] Migrating to v8: adding anomaly detection, sleep tracking, health monitoring tables`);
    }

    // v8 → v9: trial_state table for subscription onboarding
    if (currentVersion < 9) {
      console.log(`[FitQuest DB] Migrating to v9: adding trial state table`);
    }

    // v9 → v10: external exercise DB import, force_type, mechanic, exercise_images
    if (currentVersion < 10) {
      console.log(`[FitQuest DB] Migrating to v10: adding force_type, mechanic columns and exercise_images table`);
      // Add new columns to existing exercises table
      const hasForceType = await hasTableColumn(database, 'exercises', 'force_type');
      if (!hasForceType) {
        await database.execAsync(`ALTER TABLE exercises ADD COLUMN force_type TEXT`);
      }
      const hasMechanic = await hasTableColumn(database, 'exercises', 'mechanic');
      if (!hasMechanic) {
        await database.execAsync(`ALTER TABLE exercises ADD COLUMN mechanic TEXT`);
      }
      const hasExternalId = await hasTableColumn(database, 'exercises', 'external_id');
      if (!hasExternalId) {
        await database.execAsync(`ALTER TABLE exercises ADD COLUMN external_id TEXT`);
      }
    }

    // v10 → v11: FSRS flashcard algorithm (stability, state, lapses, learning_steps)
    if (currentVersion < 11) {
      console.log(`[FitQuest DB] Migrating to v11: upgrading flashcards from SM-2 to FSRS algorithm`);
      await migrateFSRSFlashcards(database);
    }

    // v11 → v12: Remove bloat variation exercises (Tempo/Pause/Isometric/Plyometric/Unilateral/Elevated/Weighted)
    if (currentVersion < 12) {
      try {
        console.log(`[FitQuest DB] Migrating to v12: removing variation exercises (keeping base exercises only)`);
        await cleanVariationExercises(database);
      } catch (e) {
        console.error('[FitQuest DB] v12 migration failed:', e);
        throw e;
      }
    }

    // v12 → v13: Re-run cleanup (v12 migration was skipped on some devices due to stale Metro bundle)
    // Also adds image sharing from external exercises to core exercises
    if (currentVersion < 13) {
      try {
        console.log(`[FitQuest DB] Migrating to v13: ensuring variation cleanup + image sharing`);
        await cleanVariationExercises(database);
        await shareExternalImagesToCore(database);
      } catch (e) {
        console.error('[FitQuest DB] v13 migration failed:', e);
        throw e;
      }
    }

    // v13 → v14: Category rename
    // calisthenics→body_control, getting_taller→posture, faster→speed,
    // flexible→mobility, mental_clarity→focus, building_muscle→strength
    if (currentVersion < 14) {
      try {
        console.log(`[FitQuest DB] Migrating to v14: renaming exercise categories`);
        await migrateCategoryRename(database);
      } catch (e) {
        console.error('[FitQuest DB] v14 migration failed:', e);
        throw e;
      }
    }

    // v14 → v15: Repair stale-bundle category rename.
    // Some devices reached user_version=14 via a stale Metro bundle that
    // never contained the v14 migration code. Re-run the rename if old
    // category names are still present in the exercises table.
    if (currentVersion < 15) {
      const oldCats = await database.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM exercises WHERE category IN ('calisthenics','getting_taller','faster','flexible','mental_clarity','building_muscle')`
      );
      if ((oldCats?.cnt ?? 0) > 0) {
        console.log(`[FitQuest DB] Migrating to v15: repairing ${oldCats!.cnt} exercises with stale category names`);
        await migrateCategoryRename(database);
      } else {
        console.log(`[FitQuest DB] v15: categories already correct, skipping rename`);
      }
    }

    // v15 → v16: Nuclear category fix.
    // Previous v14/v15 migrations used complex table-rebuild approach that
    // silently failed on some devices. Drop exercise tables entirely and
    // let seedExercises + seedExternalExercises re-populate with correct
    // category names. Also rebuild user_profile to fix goal CHECK constraint.
    if (currentVersion < 16) {
      const oldCats = await database.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM exercises WHERE category IN ('calisthenics','getting_taller','faster','flexible','mental_clarity','building_muscle')`
      );
      if ((oldCats?.cnt ?? 0) > 0) {
        console.log(`[FitQuest DB] v16: ${oldCats!.cnt} exercises with old categories — dropping for clean re-seed`);
        await database.execAsync('PRAGMA foreign_keys = OFF');
        await database.execAsync('DROP TABLE IF EXISTS exercise_images');
        await database.execAsync('DROP TABLE IF EXISTS exercise_training_types');
        await database.execAsync('DROP TABLE IF EXISTS exercise_equipment');
        await database.execAsync('DROP TABLE IF EXISTS exercise_muscles');
        await database.execAsync('DROP TABLE IF EXISTS exercises');
        console.log(`[FitQuest DB] v16: exercise tables dropped, will re-seed after createTables`);

        // Rebuild user_profile to fix goal CHECK constraint
        try {
          await migrateUserProfileGoals(database);
        } catch (e) {
          console.warn(`[FitQuest DB] v16: user_profile goal migration skipped:`, e);
        }

        // Update body_craft_algorithms goal_type
        try {
          await database.execAsync(`
            UPDATE body_craft_algorithms SET goal_type =
              CASE goal_type
                WHEN 'calisthenics' THEN 'body_control'
                WHEN 'getting_taller' THEN 'posture'
                WHEN 'faster' THEN 'speed'
                WHEN 'flexible' THEN 'mobility'
                WHEN 'mental_clarity' THEN 'focus'
                WHEN 'building_muscle' THEN 'strength'
                ELSE goal_type
              END
          `);
        } catch (e) {
          console.warn(`[FitQuest DB] v16: body_craft goal update skipped:`, e);
        }

        await database.execAsync('PRAGMA foreign_keys = ON');
      } else {
        console.log(`[FitQuest DB] v16: categories already correct`);
      }
    }

    await migrateFitMindLegacyTables(database);
    await createTables(database);
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

async function hasTableColumn(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`
  );
  return columns.some((column) => column.name === columnName);
}

/**
 * Migrate flashcards from SM-2 to FSRS algorithm (v10 → v11).
 * 
 * FSRS fields:
 * - stability: Memory stability in days (how long until 90% retention drops)
 * - state: 0=New, 1=Learning, 2=Review, 3=Relearning
 * - due: Next review timestamp (replaces next_review)
 * - scheduled_days: Days until next review (replaces interval_days)
 * - last_review: Timestamp of last review
 * - reps: Total successful reviews (replaces repetitions)
 * - lapses: Number of times card was forgotten
 * - learning_steps: Current step in (re)learning sequence
 */
async function migrateFSRSFlashcards(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check if migration already done
  const hasStability = await hasTableColumn(database, 'fitmind_flashcards', 'stability');
  if (hasStability) {
    console.log('[FitQuest DB] FSRS columns already exist, skipping migration');
    return;
  }

  console.log('[FitQuest DB] Adding FSRS columns to fitmind_flashcards...');

  // Add FSRS-specific columns
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN stability REAL DEFAULT 0;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN state INTEGER DEFAULT 0;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN due INTEGER;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN scheduled_days INTEGER DEFAULT 1;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN last_review INTEGER;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN reps INTEGER DEFAULT 0;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN lapses INTEGER DEFAULT 0;
  `);
  await database.execAsync(`
    ALTER TABLE fitmind_flashcards ADD COLUMN learning_steps INTEGER DEFAULT 0;
  `);

  // Migrate existing data from SM-2 columns to FSRS columns
  // - next_review → due
  // - interval_days → scheduled_days
  // - repetitions → reps
  // - Estimate state based on repetitions (0 reps = New, else Review)
  // - Estimate stability from interval_days (rough heuristic)
  console.log('[FitQuest DB] Migrating existing flashcard data to FSRS format...');
  await database.execAsync(`
    UPDATE fitmind_flashcards SET
      due = COALESCE(next_review, ${Date.now()}),
      scheduled_days = COALESCE(interval_days, 1),
      reps = COALESCE(repetitions, 0),
      state = CASE WHEN COALESCE(repetitions, 0) = 0 THEN 0 ELSE 2 END,
      stability = CASE 
        WHEN COALESCE(repetitions, 0) = 0 THEN 0
        ELSE COALESCE(interval_days, 1) * 0.9
      END,
      lapses = 0,
      learning_steps = 0
    WHERE due IS NULL;
  `);

  console.log('[FitQuest DB] FSRS migration complete');
}

/**
 * Remove variation exercises from v11→v12 migration.
 * 
 * The exercise generator previously created Tempo/Pause/Isometric/Plyometric/
 * Unilateral/Elevated/Weighted variations from each base template.
 * These added ~340 low-value duplicate exercises with the same instructions.
 * This migration removes them, keeping only base exercises.
 * 
 * Variation exercise IDs contain patterns like: _tempo_, _pause_, _iso_, _plyo_, _single_, _elevated_, _weighted_
 * External exercises (fed_*) and handcrafted exercises (cal_*, tall_*, etc.) are NOT affected.
 */
async function cleanVariationExercises(database: SQLite.SQLiteDatabase): Promise<void> {
  // Count before
  const before = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises WHERE id LIKE '%_gen_%'`
  );
  
  // Delete variation exercises (CASCADE handles junction tables: exercise_muscles, exercise_equipment, exercise_training_types, exercise_images)
  await database.execAsync(`
    DELETE FROM exercises WHERE 
      id LIKE '%_tempo_%' OR
      id LIKE '%_pause_%' OR
      id LIKE '%_iso_%' OR
      id LIKE '%_plyo_%' OR
      id LIKE '%_single_%' OR
      id LIKE '%_elevated_%' OR
      id LIKE '%_weighted_%'
  `);
  
  // Count after
  const after = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises WHERE id LIKE '%_gen_%'`
  );
  
  const removed = (before?.count ?? 0) - (after?.count ?? 0);
  console.log(`[FitQuest DB] Removed ${removed} variation exercises (${before?.count ?? 0} → ${after?.count ?? 0} generated exercises)`);
}

/**
 * Share images from external exercises to matching core/generated exercises.
 * 
 * Strategy:
 * 1. For each core exercise (id NOT starting with 'fed_'), normalize its name
 * 2. Find a matching external exercise by normalized name
 * 3. Copy the image_path from the external exercise's images to the core exercise
 * 
 * This is idempotent — uses INSERT OR IGNORE.
 */
async function shareExternalImagesToCore(database: SQLite.SQLiteDatabase): Promise<void> {
  // Get all core exercises (non-external)
  const coreExercises = await database.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM exercises WHERE id NOT LIKE 'fed_%'`
  );
  
  // Get all external exercise names → image paths (both start and end frame)
  const externalImages = await database.getAllAsync<{ exercise_id: string; name: string; image_path: string; image_order: number }>(
    `SELECT e.id as exercise_id, e.name, ei.image_path, ei.image_order 
     FROM exercises e 
     JOIN exercise_images ei ON e.id = ei.exercise_id 
     WHERE e.id LIKE 'fed_%'`
  );
  
  // Build lookup: normalized name → image records
  const imagesByName = new Map<string, { image_path: string; image_order: number }[]>();
  for (const img of externalImages) {
    const normalized = normalizeName(img.name);
    if (!imagesByName.has(normalized)) {
      imagesByName.set(normalized, []);
    }
    imagesByName.get(normalized)!.push({ image_path: img.image_path, image_order: img.image_order });
  }
  
  let shared = 0;
  
  for (const core of coreExercises) {
    // Already has images?
    const existing = await database.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM exercise_images WHERE exercise_id = ?`,
      [core.id]
    );
    if (existing && existing.cnt > 0) continue;
    
    // Try exact normalized match
    const normalized = normalizeName(core.name);
    let images = imagesByName.get(normalized);
    
    // Try partial match (strip common prefixes from generated exercises)
    if (!images) {
      const stripped = normalized
        .replace(/^(tempo|pause|isometric|plyometric|single leg|elevated|weighted)\s+/i, '')
        .trim();
      if (stripped !== normalized) {
        images = imagesByName.get(stripped);
      }
    }
    
    if (images && images.length > 0) {
      for (const img of images) {
        await database.runAsync(
          `INSERT OR IGNORE INTO exercise_images (exercise_id, image_path, image_order, source) VALUES (?, ?, ?, 'shared')`,
          [core.id, img.image_path, img.image_order]
        );
      }
      shared++;
    }
  }
  
  const totalWithImages = await database.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT exercise_id) as cnt FROM exercise_images`
  );
  
  console.log(`[FitQuest DB] Shared images to ${shared} core exercises. Total exercises with images: ${totalWithImages?.cnt ?? 0}`);
}

/** Normalize exercise name for fuzzy matching */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip special chars
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim();
}

/**
 * v16 helper: Rebuild user_profile table with new goal CHECK constraint.
 * Simpler than full migrateCategoryRename — only touches user_profile.
 */
async function migrateUserProfileGoals(database: SQLite.SQLiteDatabase): Promise<void> {
  const GOAL_CASE = `
    CASE goal
      WHEN 'calisthenics' THEN 'body_control'
      WHEN 'getting_taller' THEN 'posture'
      WHEN 'faster' THEN 'speed'
      WHEN 'flexible' THEN 'mobility'
      WHEN 'mental_clarity' THEN 'focus'
      WHEN 'building_muscle' THEN 'strength'
      ELSE goal
    END`;

  await database.execAsync('DROP TABLE IF EXISTS user_profile_new');
  await database.execAsync(`
    CREATE TABLE user_profile_new (
      id TEXT PRIMARY KEY,
      sex TEXT CHECK (sex IN ('male', 'female', 'other')),
      weight_kg REAL,
      height_cm REAL,
      goal TEXT NOT NULL CHECK (goal IN (
        'body_control', 'posture', 'speed', 'mobility', 'focus', 'strength'
      )),
      experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
      training_days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week BETWEEN 1 AND 7),
      time_per_session_minutes INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      locked INTEGER NOT NULL DEFAULT 0
    )
  `);
  await database.execAsync(`
    INSERT INTO user_profile_new
    SELECT id, sex, weight_kg, height_cm, ${GOAL_CASE}, experience,
           training_days_per_week, time_per_session_minutes,
           created_at, updated_at, locked
    FROM user_profile
  `);
  await database.execAsync('DROP TABLE IF EXISTS user_profile');
  await database.execAsync('ALTER TABLE user_profile_new RENAME TO user_profile');
  console.log('[FitQuest DB] v16: user_profile goals migrated');
}

/**
 * v14 migration: Rename categories from descriptive to standard fitness terms.
 * Mapping: calisthenics→body_control, getting_taller→posture, faster→speed,
 *          flexible→mobility, mental_clarity→focus, building_muscle→strength
 *
 * Approach: Recreate exercises and user_profile tables with new CHECK constraints,
 * transform category/goal values via CASE, then rename tables back.
 * Foreign keys are disabled during this operation to prevent CASCADE side-effects.
 */
async function migrateCategoryRename(database: SQLite.SQLiteDatabase): Promise<void> {
  const CATEGORY_CASE = `
    CASE category
      WHEN 'calisthenics' THEN 'body_control'
      WHEN 'getting_taller' THEN 'posture'
      WHEN 'faster' THEN 'speed'
      WHEN 'flexible' THEN 'mobility'
      WHEN 'mental_clarity' THEN 'focus'
      WHEN 'building_muscle' THEN 'strength'
      ELSE category
    END`;

  const GOAL_CASE = `
    CASE goal
      WHEN 'calisthenics' THEN 'body_control'
      WHEN 'getting_taller' THEN 'posture'
      WHEN 'faster' THEN 'speed'
      WHEN 'flexible' THEN 'mobility'
      WHEN 'mental_clarity' THEN 'focus'
      WHEN 'building_muscle' THEN 'strength'
      ELSE goal
    END`;

  await database.execAsync('PRAGMA foreign_keys = OFF');

  // Defensive: drop leftover temp tables from a previous failed attempt
  await database.execAsync('DROP TABLE IF EXISTS exercises_new');
  await database.execAsync('DROP TABLE IF EXISTS user_profile_new');

  await database.execAsync('BEGIN TRANSACTION');

  try {
    // --- 1. Recreate exercises table with new CHECK constraint ---
    await database.execAsync(`
      CREATE TABLE exercises_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN (
          'body_control', 'posture', 'speed', 'mobility', 'focus', 'strength'
        )),
        difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
        equipment_level TEXT NOT NULL CHECK (equipment_level IN ('none', 'minimal', 'playground')),
        impact_level TEXT NOT NULL CHECK (impact_level IN ('no_impact', 'low_impact', 'high_impact')),
        space_required TEXT NOT NULL CHECK (space_required IN (
          'mat_only_1x1', 'small_bedroom_2x2', 'living_room_3x3', 'outdoors_hall'
        )),
        time_per_set_seconds INTEGER NOT NULL DEFAULT 30,
        instructions TEXT NOT NULL,
        order_in_category INTEGER NOT NULL DEFAULT 0,
        audio_intro TEXT NOT NULL DEFAULT '',
        audio_setup TEXT NOT NULL DEFAULT '',
        audio_execution TEXT NOT NULL DEFAULT '',
        audio_transition TEXT NOT NULL DEFAULT '',
        force_type TEXT,
        mechanic TEXT,
        external_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await database.execAsync(`
      INSERT INTO exercises_new
      SELECT id, name, ${CATEGORY_CASE}, difficulty, equipment_level,
             impact_level, space_required, time_per_set_seconds, instructions,
             order_in_category, audio_intro, audio_setup, audio_execution,
             audio_transition, force_type, mechanic, external_id,
             created_at, updated_at
      FROM exercises
    `);

    await database.execAsync('DROP TABLE exercises');
    await database.execAsync('ALTER TABLE exercises_new RENAME TO exercises');

    // Recreate indexes
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
      CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
      CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment_level);
      CREATE INDEX IF NOT EXISTS idx_exercises_external_id ON exercises(external_id);
    `);

    // --- 2. Recreate user_profile table with new CHECK constraint ---
    await database.execAsync(`
      CREATE TABLE user_profile_new (
        id TEXT PRIMARY KEY,
        sex TEXT CHECK (sex IN ('male', 'female', 'other')),
        weight_kg REAL,
        height_cm REAL,
        goal TEXT NOT NULL CHECK (goal IN (
          'body_control', 'posture', 'speed', 'mobility', 'focus', 'strength'
        )),
        experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
        training_days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week BETWEEN 1 AND 7),
        time_per_session_minutes INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        locked INTEGER NOT NULL DEFAULT 0
      )
    `);

    await database.execAsync(`
      INSERT INTO user_profile_new
      SELECT id, sex, weight_kg, height_cm, ${GOAL_CASE}, experience,
             training_days_per_week, time_per_session_minutes,
             created_at, updated_at, locked
      FROM user_profile
    `);

    await database.execAsync('DROP TABLE user_profile');
    await database.execAsync('ALTER TABLE user_profile_new RENAME TO user_profile');

    // --- 3. Update body_craft_algorithms goal_type (no CHECK constraint) ---
    await database.execAsync(`
      UPDATE body_craft_algorithms SET goal_type =
        CASE goal_type
          WHEN 'calisthenics' THEN 'body_control'
          WHEN 'getting_taller' THEN 'posture'
          WHEN 'faster' THEN 'speed'
          WHEN 'flexible' THEN 'mobility'
          WHEN 'mental_clarity' THEN 'focus'
          WHEN 'building_muscle' THEN 'strength'
          ELSE goal_type
        END
    `);

    await database.execAsync('COMMIT');

    // Re-enable FK enforcement
    await database.execAsync('PRAGMA foreign_keys = ON');

    // Log result
    const categories = await database.getAllAsync<{ category: string; count: number }>(
      `SELECT category, COUNT(*) as count FROM exercises GROUP BY category ORDER BY count DESC`
    );
    console.log(`[FitQuest DB] Category rename complete:`, JSON.stringify(categories));

  } catch (error) {
    await database.execAsync('ROLLBACK');
    await database.execAsync('PRAGMA foreign_keys = ON');
    console.error('[FitQuest DB] Category rename migration failed:', error);
    throw error;
  }
}

async function migrateFitMindLegacyTables(database: SQLite.SQLiteDatabase): Promise<void> {
  const legacyTableExists = await hasTableColumn(database, 'fitmind_documents', 'page_count');
  if (!legacyTableExists) {
    return;
  }

  console.log('[FitQuest DB] Migrating legacy FitMind schema to canonical v8+ tables');

  await database.execAsync('BEGIN TRANSACTION');

  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS fitmind_documents_new (
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

      CREATE TABLE IF NOT EXISTS fitmind_reading_sessions_new (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        start_page INTEGER NOT NULL,
        end_page INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        words_read INTEGER DEFAULT 0,
        comprehension_score REAL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES fitmind_documents_new(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS fitmind_annotations_new (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('HIGHLIGHT', 'NOTE', 'BOOKMARK', 'QUESTION')),
        content TEXT NOT NULL,
        color TEXT DEFAULT '#10B981',
        position_start INTEGER,
        position_end INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES fitmind_documents_new(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS fitmind_flashcards_new (
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
        FOREIGN KEY (document_id) REFERENCES fitmind_documents_new(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS fitmind_reading_goals_new (
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

      CREATE TABLE IF NOT EXISTS fitmind_reading_streaks_new (
        user_id TEXT PRIMARY KEY DEFAULT 'user_local_001',
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_read_date TEXT,
        total_books_completed INTEGER DEFAULT 0,
        total_minutes_read INTEGER DEFAULT 0,
        total_pages_read INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    await database.execAsync(`
      INSERT INTO fitmind_documents_new (
        id, title, author, type, status, category, tags, file_path, file_size,
        total_pages, current_page, content, word_count, reading_level,
        estimated_minutes, cover_color, created_at, updated_at
      )
      SELECT
        id,
        title,
        author,
        type,
        status,
        category,
        tags,
        file_path,
        file_size,
        CASE WHEN page_count IS NULL OR page_count < 1 THEN 1 ELSE page_count END,
        current_page,
        NULL,
        0,
        CASE WHEN difficulty_level IS NOT NULL THEN CAST(difficulty_level AS TEXT) ELSE NULL END,
        0,
        '#10B981',
        COALESCE(added_at, strftime('%s', 'now') * 1000),
        COALESCE(last_read_at, completed_at, added_at, strftime('%s', 'now') * 1000)
      FROM fitmind_documents;
    `);

    await database.execAsync(`
      INSERT INTO fitmind_reading_sessions_new (
        id, document_id, start_page, end_page, duration_minutes,
        words_read, comprehension_score, notes, created_at
      )
      SELECT
        id,
        document_id,
        start_page,
        end_page,
        CASE
          WHEN duration_ms IS NULL OR duration_ms < 60000 THEN 1
          ELSE CAST((duration_ms + 59999) / 60000 AS INTEGER)
        END,
        words_read,
        comprehension_score,
        NULL,
        COALESCE(ended_at, started_at, strftime('%s', 'now') * 1000)
      FROM fitmind_reading_sessions;
    `);

    await database.execAsync(`
      INSERT INTO fitmind_annotations_new (
        id, document_id, page_number, type, content, color,
        position_start, position_end, created_at
      )
      SELECT
        id,
        document_id,
        page_number,
        type,
        content,
        COALESCE(color, '#10B981'),
        NULL,
        NULL,
        COALESCE(updated_at, created_at, strftime('%s', 'now') * 1000)
      FROM fitmind_annotations;
    `);

    await database.execAsync(`
      INSERT INTO fitmind_flashcards_new (
        id, document_id, front, back, difficulty, repetitions,
        interval_days, next_review, ease_factor, created_at
      )
      SELECT
        id,
        document_id,
        front,
        back,
        CASE
          WHEN typeof(difficulty) = 'text' THEN
            CASE difficulty
              WHEN 'EASY' THEN 2.8
              WHEN 'MEDIUM' THEN 2.5
              WHEN 'HARD' THEN 2.2
              ELSE 2.5
            END
          ELSE difficulty
        END,
        repetitions,
        interval_days,
        COALESCE(next_review_at, strftime('%s', 'now') * 1000),
        ease_factor,
        COALESCE(created_at, strftime('%s', 'now') * 1000)
      FROM fitmind_flashcards
      WHERE document_id IS NOT NULL;
    `);

    await database.execAsync(`
      INSERT INTO fitmind_reading_goals_new (
        id, user_id, type, target, current, period_start, period_end, achieved, created_at
      )
      SELECT
        id,
        'user_local_001',
        CASE type
          WHEN 'DAILY_PAGES' THEN 'WEEKLY_PAGES'
          WHEN 'WEEKLY_BOOKS' THEN 'MONTHLY_BOOKS'
          ELSE type
        END,
        CASE type
          WHEN 'DAILY_PAGES' THEN target * 7
          WHEN 'WEEKLY_BOOKS' THEN target * 4
          ELSE target
        END,
        current,
        period_start,
        period_end,
        CASE WHEN achieved THEN 1 ELSE 0 END,
        strftime('%s', 'now') * 1000
      FROM fitmind_reading_goals;
    `);

    await database.execAsync(`
      INSERT INTO fitmind_reading_streaks_new (
        user_id, current_streak, longest_streak, last_read_date,
        total_books_completed, total_minutes_read, total_pages_read, updated_at
      )
      SELECT
        COALESCE(user_id, 'user_local_001'),
        current_streak,
        longest_streak,
        last_read_date,
        total_books_completed,
        CAST((total_reading_time_ms + 59999) / 60000 AS INTEGER),
        total_pages_read,
        COALESCE(updated_at, created_at, strftime('%s', 'now') * 1000)
      FROM fitmind_reading_streaks;
    `);

    await database.execAsync(`
      DROP TABLE IF EXISTS fitmind_documents;
      DROP TABLE IF EXISTS fitmind_reading_sessions;
      DROP TABLE IF EXISTS fitmind_annotations;
      DROP TABLE IF EXISTS fitmind_flashcards;
      DROP TABLE IF EXISTS fitmind_reading_goals;
      DROP TABLE IF EXISTS fitmind_reading_streaks;

      ALTER TABLE fitmind_documents_new RENAME TO fitmind_documents;
      ALTER TABLE fitmind_reading_sessions_new RENAME TO fitmind_reading_sessions;
      ALTER TABLE fitmind_annotations_new RENAME TO fitmind_annotations;
      ALTER TABLE fitmind_flashcards_new RENAME TO fitmind_flashcards;
      ALTER TABLE fitmind_reading_goals_new RENAME TO fitmind_reading_goals;
      ALTER TABLE fitmind_reading_streaks_new RENAME TO fitmind_reading_streaks;
    `);

    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK');
    console.error('[FitQuest DB] FitMind legacy migration failed:', error);
    throw error;
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
        'body_control', 'posture', 'speed', 'mobility', 
        'focus', 'strength'
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
      force_type TEXT, -- v10: push, pull, static, compound
      mechanic TEXT,   -- v10: compound, isolation
      external_id TEXT, -- v10: ID from external exercise database
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
    CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
    CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment_level);
    CREATE INDEX IF NOT EXISTS idx_exercises_external_id ON exercises(external_id);

    -- v10: Exercise images from external databases
    CREATE TABLE IF NOT EXISTS exercise_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id TEXT NOT NULL,
      image_path TEXT NOT NULL,
      image_order INTEGER NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'external', -- 'external', 'user', 'generated'
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_images_exercise ON exercise_images(exercise_id);

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
        'body_control', 'posture', 'speed', 'mobility', 
        'focus', 'strength'
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
    CREATE INDEX IF NOT EXISTS idx_progress_user_exercise_date ON progress_records(user_id, exercise_id, date);

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

    CREATE TABLE IF NOT EXISTS trial_state (
      user_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      converted INTEGER DEFAULT 0,
      product_identifier TEXT,
      notifications_sent TEXT DEFAULT '[]'
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
      -- FSRS core fields
      difficulty REAL DEFAULT 5.0,
      stability REAL DEFAULT 0,
      state INTEGER DEFAULT 0,
      -- Scheduling
      due INTEGER NOT NULL,
      scheduled_days INTEGER DEFAULT 1,
      last_review INTEGER,
      -- Progress tracking
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      learning_steps INTEGER DEFAULT 0,
      -- Legacy SM-2 compatibility
      repetitions INTEGER DEFAULT 0,
      interval_days INTEGER DEFAULT 1,
      next_review INTEGER,
      ease_factor REAL DEFAULT 2.5,
      -- Timestamps
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
    CREATE INDEX IF NOT EXISTS idx_fitmind_flashcards_due ON fitmind_flashcards(due);

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
