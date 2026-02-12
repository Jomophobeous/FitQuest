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

// Initialize database and seed on first load
import { getDatabase } from './schema';
import { seedExercises } from './seed';
import { encryptedDB } from '../security/EncryptedDatabase';

let initialized = false;

/**
 * Initialize the database (call once at app start)
 * Creates core tables + new module tables (FitMind, encrypted, health)
 */
export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  try {
    const db = await getDatabase();
    await seedExercises();

    // Initialize new module schemas (idempotent — safe to call every start)
    await encryptedDB.initialize();

    // Diagnostic: verify seeding actually worked
    const exerciseCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
    const muscleCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercise_muscles');
    const ttCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercise_training_types');
    console.log(`[FitQuest DB] exercises: ${exerciseCount?.count}, muscles: ${muscleCount?.count}, training_types: ${ttCount?.count}`);

    // If junction tables are empty but exercises exist, force a re-seed
    if ((exerciseCount?.count ?? 0) > 0 && ((muscleCount?.count ?? 0) === 0 || (ttCount?.count ?? 0) === 0)) {
      console.warn('[FitQuest DB] Junction tables empty — forcing re-seed');
      await db.execAsync('DELETE FROM exercise_training_types; DELETE FROM exercise_equipment; DELETE FROM exercise_muscles; DELETE FROM exercises;');
      await seedExercises();
      const recount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
      console.log(`[FitQuest DB] After re-seed: ${recount?.count} exercises`);
    }

    initialized = true;
    console.log('[FitQuest DB] Full database initialized (core + FitMind + encrypted)');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
