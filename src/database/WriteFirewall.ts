/**
 * WriteFirewall — Exercise insert gatekeeper.
 *
 * ALL exercise writes MUST go through this service.
 * Normalizes data, pre-checks for duplicates, and rejects bad data
 * BEFORE it ever touches the database.
 *
 * This is the application-layer defense. The UNIQUE index is the last resort.
 */

import type * as SQLite from 'expo-sqlite';
import { getDatabase } from './schema';

// ── Normalization ──────────────────────────────────────────────

/** Normalize exercise name for consistent comparison */
export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// ── Pre-Insert Validation ──────────────────────────────────────

/**
 * Check if an exercise with the same normalized name+category already exists.
 * Returns the existing exercise ID if found, null otherwise.
 */
export async function findExistingExercise(
  name: string,
  category: string,
  db?: SQLite.SQLiteDatabase,
): Promise<string | null> {
  const database = db ?? (await getDatabase());
  const existing = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM exercises WHERE LOWER(TRIM(name)) = LOWER(?) AND category = ? LIMIT 1`,
    [normalizeExerciseName(name), category],
  );
  return existing?.id ?? null;
}

/**
 * Safe exercise insert — normalizes name, checks for duplicates, rejects bad data.
 * Returns true if inserted, false if rejected (duplicate or invalid).
 */
export async function insertExerciseSafe(
  params: {
    id: string;
    name: string;
    category: string;
    difficulty: string;
    equipment_level: string;
    impact_level: string;
    space_required: string;
    time_per_set_seconds: number;
    instructions: string[];
    order_in_category: number;
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
    force_type?: string | null;
    mechanic?: string | null;
    external_id?: string | null;
  },
  db?: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const database = db ?? (await getDatabase());

  // Validate critical fields
  const normalizedName = normalizeExerciseName(params.name);
  if (!normalizedName || !params.category) {
    if (__DEV__) console.warn(`[WriteFirewall] REJECTED: empty name or category`);
    return false;
  }

  // Pre-check: does an exercise with this name+category already exist?
  const existingId = await findExistingExercise(normalizedName, params.category, database);
  if (existingId && existingId !== params.id) {
    if (__DEV__)
      console.warn(
        `[WriteFirewall] REJECTED duplicate: "${normalizedName}" (${params.category}) — existing: ${existingId}`,
      );
    return false;
  }

  // Insert with INSERT OR IGNORE as final safety net
  await database.runAsync(
    `INSERT OR IGNORE INTO exercises (
      id, name, category, difficulty, equipment_level,
      impact_level, space_required, time_per_set_seconds, instructions, order_in_category,
      audio_intro, audio_setup, audio_execution, audio_transition,
      force_type, mechanic, external_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      normalizedName,
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
      params.force_type ?? null,
      params.mechanic ?? null,
      params.external_id ?? null,
    ],
  );

  return true;
}
