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
    
    // Seed external exercises (868 from free-exercise-db)
    // This adds force_type, mechanic, external_id, and images
    await seedExternalExercises();

    // Initialize new module schemas (idempotent — safe to call every start)
    await encryptedDB.initialize();

    // Initialize exercise image directory and check deployment status
    try {
      await initializeExerciseImages();
    } catch (imgErr) {
      // Non-critical — images are optional
      console.warn('[FitQuest DB] Exercise image init skipped:', imgErr);
    }

    // Diagnostic: verify seeding worked (single query instead of 3)
    const counts = await db.getFirstAsync<{ ex: number; mu: number; tt: number }>(`
      SELECT
        (SELECT COUNT(*) FROM exercises) as ex,
        (SELECT COUNT(*) FROM exercise_muscles) as mu,
        (SELECT COUNT(*) FROM exercise_training_types) as tt
    `);
    if (__DEV__) console.log(`[FitQuest DB] exercises: ${counts?.ex}, muscles: ${counts?.mu}, training_types: ${counts?.tt}`);

    // If junction tables are empty but exercises exist, force a re-seed
    if ((counts?.ex ?? 0) > 0 && ((counts?.mu ?? 0) === 0 || (counts?.tt ?? 0) === 0)) {
      console.warn('[FitQuest DB] Junction tables empty — forcing re-seed');
      await db.execAsync('DELETE FROM exercise_images; DELETE FROM exercise_training_types; DELETE FROM exercise_equipment; DELETE FROM exercise_muscles; DELETE FROM exercises;');
      await seedExercises();
      await seedExternalExercises();
      const recount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
      if (__DEV__) console.log(`[FitQuest DB] After re-seed: ${recount?.count} exercises`);
    }

    initialized = true;
    if (__DEV__) console.log('[FitQuest DB] Full database initialized (core + FitMind + encrypted)');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    initPromise = null; // Reset promise on error to allow retry
    throw error;
  }
  })();

  return initPromise;
}
