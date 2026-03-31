/**
 * DatabaseLifecycle — Pre-flight validation, self-healing, and migration safety.
 *
 * Enforces the strict DB lifecycle:
 *   BOOTING → VALIDATING → READY
 *                        → RECOVERING → READY | FAILED
 *
 * No direct createTables() without validation gate.
 * No silent corruption. No partial fixes.
 */

import type * as SQLite from 'expo-sqlite';
import { systemGuard } from '../services/SystemGuard';

// ── Types ──────────────────────────────────────────────────────

export interface ValidationReport {
  /** Number of (name, category) duplicate groups found */
  duplicateGroups: number;
  /** Total extra rows (dupes beyond the canonical one per group) */
  duplicateRows: number;
  /** Orphaned child rows referencing non-existent exercises */
  orphanedChildren: number;
  /** Exercises with NULL name or category */
  nullCriticalFields: number;
  /** True when all checks pass */
  isClean: boolean;
  /** Human-readable summary */
  summary: string;
}

export interface RepairReport {
  /** Whether repair succeeded */
  success: boolean;
  /** Number of duplicate rows removed */
  duplicatesRemoved: number;
  /** Number of child rows remapped to canonical IDs */
  childrenRemapped: number;
  /** Number of orphaned child rows cleaned */
  orphansCleaned: number;
  /** Errors encountered during repair */
  errors: string[];
}

const CHILD_TABLES = ['exercise_muscles', 'exercise_equipment', 'exercise_training_types', 'exercise_images'] as const;

// ── Pre-Flight Validation ──────────────────────────────────────

/**
 * Scan the exercises table and children for integrity issues.
 * Returns a report — does NOT modify data.
 */
export async function validateDatabaseIntegrity(db: SQLite.SQLiteDatabase): Promise<ValidationReport> {
  systemGuard.markValidating();

  const issues: string[] = [];

  // 1. Check for duplicate (name, category) groups
  const dupeGroups = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
      SELECT LOWER(TRIM(name)) as n, category
      FROM exercises
      GROUP BY LOWER(TRIM(name)), category
      HAVING COUNT(*) > 1
    )`,
  );
  const duplicateGroups = dupeGroups?.cnt ?? 0;

  // Total extra rows beyond canonical
  let duplicateRows = 0;
  if (duplicateGroups > 0) {
    const extraRows = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM exercises
       WHERE rowid NOT IN (
         SELECT MIN(rowid) FROM exercises
         GROUP BY LOWER(TRIM(name)), category
       )`,
    );
    duplicateRows = extraRows?.cnt ?? 0;
    issues.push(`${duplicateGroups} duplicate groups (${duplicateRows} extra rows)`);
  }

  // 2. Check for orphaned child rows
  let orphanedChildren = 0;
  for (const table of CHILD_TABLES) {
    const orphans = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table}
       WHERE exercise_id NOT IN (SELECT id FROM exercises)`,
    );
    orphanedChildren += orphans?.cnt ?? 0;
  }
  if (orphanedChildren > 0) {
    issues.push(`${orphanedChildren} orphaned child rows`);
  }

  // 3. Check for NULL critical fields
  const nullFields = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM exercises
     WHERE name IS NULL OR TRIM(name) = '' OR category IS NULL OR TRIM(category) = ''`,
  );
  const nullCriticalFields = nullFields?.cnt ?? 0;
  if (nullCriticalFields > 0) {
    issues.push(`${nullCriticalFields} exercises with null/empty name or category`);
  }

  const isClean = duplicateGroups === 0 && orphanedChildren === 0 && nullCriticalFields === 0;
  const summary = isClean ? 'Database integrity verified — clean' : `Issues found: ${issues.join('; ')}`;

  if (__DEV__) {
    console.warn(`[DBLifecycle] Validation: ${summary}`);
  }

  return {
    duplicateGroups,
    duplicateRows,
    orphanedChildren,
    nullCriticalFields,
    isClean,
    summary,
  };
}

// ── Deterministic FK-Safe Repair ───────────────────────────────

/**
 * Repair all detected integrity issues:
 * 1. Delete exercises with null/empty critical fields
 * 2. FK-safe dedup: remap children to canonical ID, then delete dupes
 * 3. Clean orphaned child rows
 *
 * All operations wrapped in a single transaction for atomicity.
 */
export async function repairDatabaseIntegrity(
  db: SQLite.SQLiteDatabase,
  report: ValidationReport,
): Promise<RepairReport> {
  systemGuard.markRecovering(report.summary);

  const errors: string[] = [];
  let duplicatesRemoved = 0;
  let childrenRemapped = 0;
  let orphansCleaned = 0;

  try {
    // Disable FK checks during repair to avoid cascading issues
    await db.execAsync('PRAGMA foreign_keys = OFF');
    await db.execAsync('SAVEPOINT db_repair');

    // ── Step 1: Remove exercises with null/empty critical fields ──
    if (report.nullCriticalFields > 0) {
      try {
        for (const table of CHILD_TABLES) {
          await db.runAsync(
            `DELETE FROM ${table} WHERE exercise_id IN (
              SELECT id FROM exercises
              WHERE name IS NULL OR TRIM(name) = '' OR category IS NULL OR TRIM(category) = ''
            )`,
          );
        }
        const result = await db.runAsync(
          `DELETE FROM exercises
           WHERE name IS NULL OR TRIM(name) = '' OR category IS NULL OR TRIM(category) = ''`,
        );
        duplicatesRemoved += result.changes;
      } catch (e) {
        errors.push(`Null field cleanup: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Step 2: FK-safe dedup ──
    if (report.duplicateGroups > 0) {
      try {
        // Build canonical map: for each (name, category) group, keep the row
        // with the lowest rowid, preferring handcrafted (external_id IS NULL).
        const dupeGroups = await db.getAllAsync<{ canonical_id: string; n: string; c: string }>(
          `SELECT id as canonical_id, LOWER(TRIM(name)) as n, category as c
           FROM exercises
           WHERE rowid IN (
             SELECT MIN(CASE WHEN external_id IS NULL THEN rowid ELSE rowid + 999999999 END)
             FROM exercises
             GROUP BY LOWER(TRIM(name)), category
             HAVING COUNT(*) > 1
           )`,
        );

        for (const group of dupeGroups) {
          // Get all duplicate IDs for this group (excluding canonical)
          const dupeIds = await db.getAllAsync<{ id: string }>(
            `SELECT id FROM exercises
             WHERE LOWER(TRIM(name)) = ? AND category = ? AND id != ?`,
            [group.n, group.c, group.canonical_id],
          );

          for (const dupe of dupeIds) {
            // Remap all child table references from dupe → canonical
            for (const table of CHILD_TABLES) {
              // Use INSERT OR IGNORE to handle PK conflicts (child already exists for canonical)
              const remapped = await db.runAsync(
                `UPDATE OR IGNORE ${table}
                 SET exercise_id = ?
                 WHERE exercise_id = ?`,
                [group.canonical_id, dupe.id],
              );
              childrenRemapped += remapped.changes;

              // Clean any remaining rows (PK conflict means canonical already has them)
              await db.runAsync(`DELETE FROM ${table} WHERE exercise_id = ?`, [dupe.id]);
            }

            // Now safe to delete the duplicate exercise
            const delResult = await db.runAsync(`DELETE FROM exercises WHERE id = ?`, [dupe.id]);
            duplicatesRemoved += delResult.changes;
          }
        }
      } catch (e) {
        errors.push(`FK-safe dedup: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Step 3: Clean orphaned children ──
    if (report.orphanedChildren > 0) {
      try {
        for (const table of CHILD_TABLES) {
          const result = await db.runAsync(
            `DELETE FROM ${table}
             WHERE exercise_id NOT IN (SELECT id FROM exercises)`,
          );
          orphansCleaned += result.changes;
        }
      } catch (e) {
        errors.push(`Orphan cleanup: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Commit repair
    if (errors.length === 0) {
      await db.execAsync('RELEASE SAVEPOINT db_repair');
    } else {
      await db.execAsync('ROLLBACK TO SAVEPOINT db_repair');
      await db.execAsync('RELEASE SAVEPOINT db_repair');
    }
  } catch (e) {
    // Transaction-level failure
    errors.push(`Transaction: ${e instanceof Error ? e.message : String(e)}`);
    try {
      await db.execAsync('ROLLBACK TO SAVEPOINT db_repair');
    } catch {
      /* already rolled back */
    }
    try {
      await db.execAsync('RELEASE SAVEPOINT db_repair');
    } catch {
      /* cleanup */
    }
  } finally {
    try {
      await db.execAsync('PRAGMA foreign_keys = ON');
    } catch {
      /* ensure restored */
    }
  }

  const success = errors.length === 0;
  if (__DEV__) {
    console.warn(
      `[DBLifecycle] Repair ${success ? 'SUCCESS' : 'FAILED'}: ` +
        `${duplicatesRemoved} dupes removed, ${childrenRemapped} children remapped, ${orphansCleaned} orphans cleaned` +
        (errors.length > 0 ? ` | Errors: ${errors.join('; ')}` : ''),
    );
  }

  return { success, duplicatesRemoved, childrenRemapped, orphansCleaned, errors };
}

// ── Migration Sandbox ──────────────────────────────────────────

/**
 * Run a migration function inside a SAVEPOINT.
 * If the migration throws, the savepoint is rolled back — live data is untouched.
 * If it succeeds, the savepoint is released (committed).
 */
export async function runMigrationSandboxed(
  db: SQLite.SQLiteDatabase,
  versionLabel: string,
  migrationFn: (db: SQLite.SQLiteDatabase) => Promise<void>,
): Promise<void> {
  const savepoint = `migration_v${versionLabel.replace(/\W/g, '_')}`;

  await db.execAsync(`SAVEPOINT ${savepoint}`);
  try {
    await migrationFn(db);
    await db.execAsync(`RELEASE SAVEPOINT ${savepoint}`);
    if (__DEV__) console.warn(`[DBLifecycle] Migration ${versionLabel} — committed`);
  } catch (e) {
    if (__DEV__) console.error(`[DBLifecycle] Migration ${versionLabel} — ROLLBACK:`, e);
    try {
      await db.execAsync(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    } catch {
      /* already rolled back */
    }
    try {
      await db.execAsync(`RELEASE SAVEPOINT ${savepoint}`);
    } catch {
      /* cleanup */
    }
    throw e;
  }
}

// ── Index Safety Guard ─────────────────────────────────────────

/**
 * Only create the UNIQUE index when the dataset is verified clean.
 * If duplicates exist, throws instead of letting SQLite crash.
 */
export async function createIndexSafe(db: SQLite.SQLiteDatabase): Promise<void> {
  const dupeCheck = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
      SELECT LOWER(TRIM(name)) as n, category
      FROM exercises
      GROUP BY LOWER(TRIM(name)), category
      HAVING COUNT(*) > 1
    )`,
  );

  if ((dupeCheck?.cnt ?? 0) > 0) {
    throw new Error(
      `[DBLifecycle] BLOCK: Cannot create UNIQUE index — ${dupeCheck!.cnt} duplicate groups remain. Recovery required.`,
    );
  }

  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name_category ON exercises(LOWER(name), category)`,
  );
}
