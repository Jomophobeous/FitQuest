/**
 * FitQuest SQLite Database Schema
 * Client-side, offline-first database for Phase 1 (Local Dominance)
 */

import * as SQLite from 'expo-sqlite';
import { SCHEMA_VERSION } from './types';
import {
  validateDatabaseIntegrity,
  repairDatabaseIntegrity,
  runMigrationSandboxed,
  createIndexSafe,
} from './DatabaseLifecycle';

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

      // Performance PRAGMAs — enterprise-grade SQLite tuning
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -8000;
        PRAGMA mmap_size = 30000000;
        PRAGMA temp_store = MEMORY;
        PRAGMA foreign_keys = ON;
      `);

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
 * Initialize database schema — strict lifecycle:
 *
 *   1. Create table structures (WITHOUT unique index)
 *   2. Run versioned migrations (each sandboxed)
 *   3. Validate data integrity (pre-flight)
 *   4. Repair if dirty (FK-safe dedup + orphan cleanup)
 *   5. Create unique index (ONLY after data is verified clean)
 *   6. Bump schema version
 *
 * NO direct createTables() without validation gate on existing data.
 */
async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const versionResult = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    if (__DEV__) console.log(`[FitQuest DB] Schema upgrade needed: v${currentVersion} → v${SCHEMA_VERSION}`);

    // ── Step 1: Create table structures (without unique index) ──
    // This ensures all tables exist so migrations can ALTER/SELECT safely.
    await createTables(database);

    // ── Step 2: Run versioned migrations ──
    await runVersionedMigrations(database, currentVersion);

    // Migrate FitMind legacy tables
    await migrateFitMindLegacyTables(database);

    // Re-run createTables to ensure any tables dropped by migrations are recreated
    await createTables(database);

    // ── Step 3: Validate data integrity ──
    const hasExercises = await database.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM exercises`);

    if ((hasExercises?.cnt ?? 0) > 0) {
      const report = await validateDatabaseIntegrity(database);

      // ── Step 4: Repair if dirty ──
      if (!report.isClean) {
        if (__DEV__) console.warn(`[FitQuest DB] Data issues detected: ${report.summary}`);

        const repair = await repairDatabaseIntegrity(database, report);

        if (!repair.success) {
          // Repair failed — last resort: drop exercise tables for clean re-seed
          if (__DEV__) console.error('[FitQuest DB] Repair failed — nuclear reset of exercise tables');
          await database.execAsync('PRAGMA foreign_keys = OFF');
          await database.execAsync(`
            DROP TABLE IF EXISTS exercise_images;
            DROP TABLE IF EXISTS exercise_training_types;
            DROP TABLE IF EXISTS exercise_equipment;
            DROP TABLE IF EXISTS exercise_muscles;
            DROP TABLE IF EXISTS exercises;
          `);
          await database.execAsync('PRAGMA foreign_keys = ON');
          await createTables(database);
          // Tables are now empty — seedExercises will repopulate
        } else {
          // Verify repair succeeded
          const recheck = await validateDatabaseIntegrity(database);
          if (!recheck.isClean) {
            if (__DEV__) console.error('[FitQuest DB] Repair incomplete — nuclear reset');
            await database.execAsync('PRAGMA foreign_keys = OFF');
            await database.execAsync(`
              DROP TABLE IF EXISTS exercise_images;
              DROP TABLE IF EXISTS exercise_training_types;
              DROP TABLE IF EXISTS exercise_equipment;
              DROP TABLE IF EXISTS exercise_muscles;
              DROP TABLE IF EXISTS exercises;
            `);
            await database.execAsync('PRAGMA foreign_keys = ON');
            await createTables(database);
          }
        }
      }
    }

    // ── Step 5: Create unique index (only after data is verified clean) ──
    try {
      await createIndexSafe(database);
    } catch (indexErr) {
      // If index creation still fails, the data isn't clean — nuclear reset
      if (__DEV__) console.error('[FitQuest DB] Index creation failed after validation:', indexErr);
      await database.execAsync('PRAGMA foreign_keys = OFF');
      await database.execAsync(`
        DROP TABLE IF EXISTS exercise_images;
        DROP TABLE IF EXISTS exercise_training_types;
        DROP TABLE IF EXISTS exercise_equipment;
        DROP TABLE IF EXISTS exercise_muscles;
        DROP TABLE IF EXISTS exercises;
      `);
      await database.execAsync('PRAGMA foreign_keys = ON');
      await createTables(database);
      await createIndexSafe(database); // Empty table — guaranteed success
    }

    // ── Step 6: Log + bump version ──
    try {
      await database.runAsync(
        `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
        ['last_migration', JSON.stringify({ from: currentVersion, to: SCHEMA_VERSION, ts: Date.now() })],
      );
    } catch {
      /* non-critical */
    }

    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    if (__DEV__) console.log(`[FitQuest DB] Migration complete: v${currentVersion} → v${SCHEMA_VERSION}`);
  }
}

/**
 * Run all versioned migrations applicable to the current schema version.
 * Each destructive migration is wrapped in a SAVEPOINT for safety.
 */
async function runVersionedMigrations(database: SQLite.SQLiteDatabase, currentVersion: number): Promise<void> {
  // v0–v5 → v6+: drop exercise catalogue for clean re-seed (audio_transition bug)
  if (currentVersion >= 1 && currentVersion < 6) {
    await runMigrationSandboxed(database, '6', async (db) => {
      if (__DEV__)
        console.log(`[FitQuest DB] Migrating v${currentVersion} → v6: dropping exercise tables for clean re-seed`);
      await db.execAsync(`
        DROP TABLE IF EXISTS exercise_training_types;
        DROP TABLE IF EXISTS exercise_equipment;
        DROP TABLE IF EXISTS exercise_muscles;
        DROP TABLE IF EXISTS exercises;
      `);
    });
  }

  // v6 → v7: additive (new module tables — created by createTables IF NOT EXISTS)
  if (currentVersion < 7) {
    if (__DEV__) console.log(`[FitQuest DB] Migrating to v7: security, FitMind, health analytics tables`);
  }

  // v7 → v8: advanced health monitoring (created by createTables)
  if (currentVersion < 8) {
    if (__DEV__) console.log(`[FitQuest DB] Migrating to v8: anomaly detection, sleep, health monitoring`);
  }

  // v8 → v9: trial_state
  if (currentVersion < 9) {
    if (__DEV__) console.log(`[FitQuest DB] Migrating to v9: trial state table`);
  }

  // v9 → v10: ALTER TABLE for exercise columns
  if (currentVersion < 10) {
    await runMigrationSandboxed(database, '10', async (db) => {
      if (__DEV__) console.log(`[FitQuest DB] Migrating to v10: force_type, mechanic, external_id columns`);
      const hasForceType = await hasTableColumn(db, 'exercises', 'force_type');
      if (!hasForceType) await db.execAsync(`ALTER TABLE exercises ADD COLUMN force_type TEXT`);
      const hasMechanic = await hasTableColumn(db, 'exercises', 'mechanic');
      if (!hasMechanic) await db.execAsync(`ALTER TABLE exercises ADD COLUMN mechanic TEXT`);
      const hasExternalId = await hasTableColumn(db, 'exercises', 'external_id');
      if (!hasExternalId) await db.execAsync(`ALTER TABLE exercises ADD COLUMN external_id TEXT`);
    });
  }

  // v10 → v11: FSRS flashcards
  if (currentVersion < 11) {
    await runMigrationSandboxed(database, '11', async (db) => {
      if (__DEV__) console.log(`[FitQuest DB] Migrating to v11: FSRS flashcards`);
      await migrateFSRSFlashcards(db);
    });
  }

  // v11 → v12: Remove variation exercises
  if (currentVersion < 12) {
    await runMigrationSandboxed(database, '12', async (db) => {
      if (__DEV__) console.log(`[FitQuest DB] Migrating to v12: removing variation exercises`);
      await cleanVariationExercises(db);
    });
  }

  // v12 → v13: Re-run cleanup + image sharing
  if (currentVersion < 13) {
    await runMigrationSandboxed(database, '13', async (db) => {
      if (__DEV__) console.log(`[FitQuest DB] Migrating to v13: variation cleanup + image sharing`);
      await cleanVariationExercises(db);
      await shareExternalImagesToCore(db);
    });
  }

  // v13 → v14: Category rename
  if (currentVersion < 14) {
    await runMigrationSandboxed(database, '14', async (db) => {
      if (__DEV__) console.log(`[FitQuest DB] Migrating to v14: category rename`);
      await migrateCategoryRename(db);
    });
  }

  // v14 → v15: Repair stale-bundle category rename
  if (currentVersion < 15) {
    const oldCats = await database.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM exercises WHERE category IN ('calisthenics','getting_taller','faster','flexible','mental_clarity','building_muscle')`,
    );
    if ((oldCats?.cnt ?? 0) > 0) {
      await runMigrationSandboxed(database, '15', async (db) => {
        if (__DEV__) console.log(`[FitQuest DB] Migrating to v15: repairing ${oldCats!.cnt} stale categories`);
        await migrateCategoryRename(db);
      });
    } else {
      if (__DEV__) console.log(`[FitQuest DB] v15: categories already correct`);
    }
  }

  // v15 → v16: Nuclear category fix + user_profile goal constraint
  if (currentVersion < 16) {
    const oldCats = await database.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM exercises WHERE category IN ('calisthenics','getting_taller','faster','flexible','mental_clarity','building_muscle')`,
    );
    if ((oldCats?.cnt ?? 0) > 0) {
      await runMigrationSandboxed(database, '16', async (db) => {
        if (__DEV__) console.log(`[FitQuest DB] v16: ${oldCats!.cnt} old categories — nuclear drop`);
        await db.execAsync('PRAGMA foreign_keys = OFF');
        await db.execAsync('DROP TABLE IF EXISTS exercise_images');
        await db.execAsync('DROP TABLE IF EXISTS exercise_training_types');
        await db.execAsync('DROP TABLE IF EXISTS exercise_equipment');
        await db.execAsync('DROP TABLE IF EXISTS exercise_muscles');
        await db.execAsync('DROP TABLE IF EXISTS exercises');

        try {
          await migrateUserProfileGoals(db);
        } catch (e) {
          if (__DEV__) console.warn(`[FitQuest DB] v16: user_profile migration skipped:`, e);
        }
        try {
          await db.execAsync(`
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
          if (__DEV__) console.warn(`[FitQuest DB] v16: body_craft update skipped:`, e);
        }
        await db.execAsync('PRAGMA foreign_keys = ON');
      });
    } else {
      if (__DEV__) console.log(`[FitQuest DB] v16: categories already correct`);
    }
  }

  // v16 → v17: User interests, personal goals (tables created by createTables)
  if (currentVersion < 17) {
    if (__DEV__) console.log('[FitQuest DB] v17: user interests, personal goals, mind XP');
  }

  // v17 → v18: Fix external exercise equipment_level
  if (currentVersion < 18) {
    await runMigrationSandboxed(database, '18', async (db) => {
      if (__DEV__) console.log('[FitQuest DB] v18: Fixing external exercise equipment levels');
      const fixed = await db.runAsync(`
        UPDATE exercises SET equipment_level = 'playground'
        WHERE equipment_level = 'none' AND id LIKE 'fed_%'
          AND id IN (SELECT DISTINCT exercise_id FROM exercise_equipment
            WHERE is_required = 1 AND equipment IN ('barbell','dumbbell','kettlebell','cable_machine','machine','exercise_ball','medicine_ball'))
      `);
      if (__DEV__) console.log(`[FitQuest DB] v18: Fixed ${fixed.changes} exercises to playground`);

      const nameFix = await db.runAsync(`
        UPDATE exercises SET equipment_level = 'playground'
        WHERE equipment_level = 'none' AND id LIKE 'fed_%'
          AND (name LIKE '%Barbell%' OR name LIKE '%Dumbbell%' OR name LIKE '%Kettlebell%'
            OR name LIKE '%Cable%' OR name LIKE '%Machine%' OR name LIKE '%Smith%'
            OR name LIKE '%EZ-Bar%' OR name LIKE '%E-Z Curl%' OR name LIKE '%Lat Pulldown%'
            OR name LIKE '%Leg Press%' OR name LIKE '%Hack Squat%' OR name LIKE '%Pec Deck%')
      `);
      if (__DEV__) console.log(`[FitQuest DB] v18: Fixed ${nameFix.changes} by name`);

      const benchFix = await db.runAsync(`
        UPDATE exercises SET equipment_level = 'playground'
        WHERE equipment_level = 'none' AND id LIKE 'fed_%'
          AND (name LIKE '%Bench Press%' OR name LIKE '%Incline Press%' OR name LIKE '%Decline Press%'
            OR name LIKE '%Pull-Up%' OR name LIKE '%Pullup%' OR name LIKE '%Chin-Up%'
            OR name LIKE '%Chinup%' OR name LIKE '%Dip%' OR name LIKE '%Ring%')
      `);
      if (__DEV__) console.log(`[FitQuest DB] v18: Fixed ${benchFix.changes} bench/bar exercises`);

      const minimalFix = await db.runAsync(`
        UPDATE exercises SET equipment_level = 'minimal'
        WHERE equipment_level = 'none' AND id LIKE 'fed_%'
          AND id IN (SELECT DISTINCT exercise_id FROM exercise_equipment
            WHERE is_required = 1 AND equipment IN ('band','foam_roller','jump_rope','towel','strap','backpack'))
      `);
      if (__DEV__) console.log(`[FitQuest DB] v18: Fixed ${minimalFix.changes} to minimal`);
    });
  }

  // v18 → v19: Dedup handled by lifecycle validation (Phase 3 above)
  // The old v19 migration was a manual dedup — now replaced by the systematic
  // validateDatabaseIntegrity + repairDatabaseIntegrity lifecycle.
  if (currentVersion < 19) {
    if (__DEV__) console.log('[FitQuest DB] v19: exercise dedup handled by lifecycle validation');
  }

  // v20: exercise_translations table for i18n
  if (currentVersion < 20) {
    await runMigrationSandboxed(database, '20', async (db) => {
      if (__DEV__) console.log('[FitQuest DB] v20: creating exercise_translations table');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS exercise_translations (
          exercise_id TEXT NOT NULL,
          language TEXT NOT NULL,
          name TEXT NOT NULL,
          instructions TEXT NOT NULL,
          audio_intro TEXT NOT NULL DEFAULT '',
          audio_setup TEXT NOT NULL DEFAULT '',
          audio_execution TEXT NOT NULL DEFAULT '',
          audio_transition TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (exercise_id, language),
          FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_exercise_translations_lang ON exercise_translations(language);
      `);
    });
  }
}

async function hasTableColumn(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
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
    if (__DEV__) console.log('[FitQuest DB] FSRS columns already exist, skipping migration');
    return;
  }

  if (__DEV__) console.log('[FitQuest DB] Adding FSRS columns to fitmind_flashcards...');

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
  if (__DEV__) console.log('[FitQuest DB] Migrating existing flashcard data to FSRS format...');
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

  if (__DEV__) console.log('[FitQuest DB] FSRS migration complete');
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
    `SELECT COUNT(*) as count FROM exercises WHERE id LIKE '%_gen_%'`,
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
    `SELECT COUNT(*) as count FROM exercises WHERE id LIKE '%_gen_%'`,
  );

  const removed = (before?.count ?? 0) - (after?.count ?? 0);
  if (__DEV__)
    console.log(
      `[FitQuest DB] Removed ${removed} variation exercises (${before?.count ?? 0} → ${after?.count ?? 0} generated exercises)`,
    );
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
    `SELECT id, name FROM exercises WHERE id NOT LIKE 'fed_%'`,
  );

  // Get all external exercise names → image paths (both start and end frame)
  const externalImages = await database.getAllAsync<{
    exercise_id: string;
    name: string;
    image_path: string;
    image_order: number;
  }>(
    `SELECT e.id as exercise_id, e.name, ei.image_path, ei.image_order 
     FROM exercises e 
     JOIN exercise_images ei ON e.id = ei.exercise_id 
     WHERE e.id LIKE 'fed_%'`,
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
      [core.id],
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
          [core.id, img.image_path, img.image_order],
        );
      }
      shared++;
    }
  }

  const totalWithImages = await database.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT exercise_id) as cnt FROM exercise_images`,
  );

  if (__DEV__)
    console.log(
      `[FitQuest DB] Shared images to ${shared} core exercises. Total exercises with images: ${totalWithImages?.cnt ?? 0}`,
    );
}

/** Normalize exercise name for fuzzy matching */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip special chars
    .replace(/\s+/g, ' ') // collapse whitespace
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
  if (__DEV__) console.log('[FitQuest DB] v16: user_profile goals migrated');
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
      `SELECT category, COUNT(*) as count FROM exercises GROUP BY category ORDER BY count DESC`,
    );
    if (__DEV__) console.log(`[FitQuest DB] Category rename complete:`, JSON.stringify(categories));
  } catch (error) {
    await database.execAsync('ROLLBACK');
    await database.execAsync('PRAGMA foreign_keys = ON');
    if (__DEV__) console.error('[FitQuest DB] Category rename migration failed:', error);
    throw error;
  }
}

async function migrateFitMindLegacyTables(database: SQLite.SQLiteDatabase): Promise<void> {
  const legacyTableExists = await hasTableColumn(database, 'fitmind_documents', 'page_count');
  if (!legacyTableExists) {
    return;
  }

  if (__DEV__) console.log('[FitQuest DB] Migrating legacy FitMind schema to canonical v8+ tables');

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
    if (__DEV__) console.error('[FitQuest DB] FitMind legacy migration failed:', error);
    throw error;
  }
}

/**
 * Create all database tables
 */
async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  if (__DEV__) console.log('[FitQuest DB] createTables() — creating all tables (IF NOT EXISTS)...');
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
    -- NOTE: UNIQUE index idx_exercises_name_category is created by createIndexSafe()
    -- in the lifecycle flow AFTER data validation — NOT here.

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

    CREATE INDEX IF NOT EXISTS idx_exercise_equipment_exercise ON exercise_equipment(exercise_id);

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

    CREATE INDEX IF NOT EXISTS idx_exercise_training_types_exercise ON exercise_training_types(exercise_id);

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

    -- Covering indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_muscle_fatigue_user ON muscle_fatigue(user_id, muscle, fatigue_level);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, completed_at);
    CREATE INDEX IF NOT EXISTS idx_daily_steps_user_date ON daily_steps(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_enc_health_updated ON encrypted_health_data(updated_at);
    CREATE INDEX IF NOT EXISTS idx_health_alerts_ack ON health_alerts(acknowledged_at, severity);
    CREATE INDEX IF NOT EXISTS idx_fitmind_docs_category ON fitmind_documents(category, status);
    CREATE INDEX IF NOT EXISTS idx_anomaly_user_date ON anomaly_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_body_craft_user ON body_craft_algorithms(user_id, active);

    -- Content hash index for document deduplication (v8)
    CREATE TABLE IF NOT EXISTS document_content_hashes (
      hash TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );

    -- ============================================
    -- USER INTERESTS & PERSONAL GOALS (v17)
    -- ============================================

    CREATE TABLE IF NOT EXISTS user_interests (
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, topic),
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_personal_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal_text TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_personal_goals(user_id, status);

    -- ============================================
    -- MIND XP TRACKING (v17)
    -- ============================================

    CREATE TABLE IF NOT EXISTS mind_xp (
      user_id TEXT PRIMARY KEY,
      total_mind_xp INTEGER NOT NULL DEFAULT 0,
      mind_level INTEGER NOT NULL DEFAULT 1,
      pages_read_total INTEGER NOT NULL DEFAULT 0,
      flashcards_reviewed_total INTEGER NOT NULL DEFAULT 0,
      documents_completed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
    );

    -- ============================================
    -- DOCUMENT IMPORTANCE SCORES (v17)
    -- ============================================

    CREATE TABLE IF NOT EXISTS document_importance (
      document_id TEXT PRIMARY KEY,
      importance_score INTEGER NOT NULL DEFAULT 50 CHECK (importance_score BETWEEN 0 AND 100),
      matched_interests TEXT DEFAULT '[]',
      auto_recommended INTEGER NOT NULL DEFAULT 0,
      scanned_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES fitmind_documents(id) ON DELETE CASCADE
    );

    -- ============================================
    -- EXERCISE TRANSLATIONS (v20 — i18n)
    -- ============================================

    CREATE TABLE IF NOT EXISTS exercise_translations (
      exercise_id TEXT NOT NULL,
      language TEXT NOT NULL,
      name TEXT NOT NULL,
      instructions TEXT NOT NULL, -- JSON array of instruction steps
      audio_intro TEXT NOT NULL DEFAULT '',
      audio_setup TEXT NOT NULL DEFAULT '',
      audio_execution TEXT NOT NULL DEFAULT '',
      audio_transition TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (exercise_id, language),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_translations_lang ON exercise_translations(language);
  `);
  if (__DEV__) console.log('[FitQuest DB] createTables() — all tables created successfully');
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
