/**
 * FitQuest Database Module
 * Client-side SQLite database for offline-first fitness tracking
 */

// Core database
export { getDatabase, resetDatabase, closeDatabase } from './schema';

// Types
export * from './types';

// Service (CRUD operations)
export * from './service';

// Seed data
export { seedExercises, getExerciseCount } from './seed';
export { seedExternalExercises, hasExternalExercises, getExternalExerciseCount } from './external-seed';

// Initialize database and seed on first load
import { getDatabase } from './schema';
import { seedExercises } from './seed';
import { seedExternalExercises } from './external-seed';
import { encryptedDB } from '../security/EncryptedDatabase';
import { initializeExerciseImages } from '../services/exerciseImageService';
import { seedExerciseTranslations } from '../i18n/exercise-translation-seed';
import { captureException } from '../services/crashReporting';

// Static language file imports removed — Phase 7 runtime translation layer.
// Translations are loaded lazily from SQLite via TranslationResolver.
// Bundled TS files remain on disk as fallback seed source only.
// See: src/i18n/TranslationRegistry.ts, src/i18n/TranslationResolver.ts

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Reset init state so the next initializeDatabase() call runs from scratch.
 * Call this after closeDatabase() when retrying after a failure.
 */
export function resetInitState(): void {
  initialized = false;
  initPromise = null;
}

/**
 * Initialize the database (call once at app start)
 * Creates core tables + new module tables (FitMind, encrypted, health)
 * Uses promise-based mutex to prevent concurrent initialization
 */
export async function initializeDatabase(): Promise<void> {
  // If already initialized, return immediately
  if (initialized) return;

  // If initialization is in progress, wait for it
  if (initPromise) return initPromise;

  // Start initialization and store the promise
  initPromise = (async () => {
    if (initialized) return; // Double-check after acquiring lock

    try {
      const db = await getDatabase();
      await seedExercises();

      // Initialize new module schemas (idempotent — safe to call every start)
      await encryptedDB.initialize();

      // Seed exercise translations (idempotent — checks if already populated)
      try {
        await seedExerciseTranslations();
      } catch (transErr) {
        if (__DEV__) console.warn('[FitQuest DB] Exercise translation seed skipped:', transErr);
      }

      // Initialize exercise image directory and check deployment status
      try {
        await initializeExerciseImages();
      } catch (imgErr) {
        // Non-critical — images are optional
        if (__DEV__) console.warn('[FitQuest DB] Exercise image init skipped:', imgErr);
      }

      // Diagnostic: verify seeding worked (single query instead of 3)
      const counts = await db.getFirstAsync<{ ex: number; mu: number; tt: number }>(`
      SELECT
        (SELECT COUNT(*) FROM exercises) as ex,
        (SELECT COUNT(*) FROM exercise_muscles) as mu,
        (SELECT COUNT(*) FROM exercise_training_types) as tt
    `);
      if (__DEV__)
        console.warn(`[FitQuest DB] exercises: ${counts?.ex}, muscles: ${counts?.mu}, training_types: ${counts?.tt}`);

      // If junction tables are empty but exercises exist, force a re-seed
      if ((counts?.ex ?? 0) > 0 && ((counts?.mu ?? 0) === 0 || (counts?.tt ?? 0) === 0)) {
        if (__DEV__) console.warn('[FitQuest DB] Junction tables empty — forcing re-seed');
        await db.execAsync(
          'DELETE FROM exercise_images; DELETE FROM exercise_training_types; DELETE FROM exercise_equipment; DELETE FROM exercise_muscles; DELETE FROM exercises;',
        );
        await seedExercises();
        await seedExternalExercises();
        const recount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
        if (__DEV__) console.warn(`[FitQuest DB] After re-seed: ${recount?.count} exercises`);
      } else {
        // Defer external exercise seeding — don't block app startup
        // Core exercises are seeded above; external 868 seed in background
        seedExternalExercises().catch((err) => {
          if (__DEV__) console.warn('[FitQuest DB] Deferred external seed failed:', err);
        });
      }

      initialized = true;
      if (__DEV__) console.warn('[FitQuest DB] Full database initialized (core + FitMind + encrypted)');
    } catch (error) {
      if (__DEV__) console.error('Failed to initialize database:', error);
      captureException(error, { flow: 'db_init', critical: true });
      initPromise = null; // Reset promise on error to allow retry
      throw error;
    }
  })();

  return initPromise;
}
