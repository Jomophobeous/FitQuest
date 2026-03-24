/**
 * Exercise Localization Service
 *
 * Provides localized exercise names and instructions.
 * Queries exercise_translations table, falls back to English (exercises table).
 *
 * Usage:
 *   const name = await getLocalizedExerciseName('push_up_001', 'fr');
 *   const instructions = await getLocalizedInstructions('push_up_001', 'fr');
 *   const localized = await getLocalizedExercise('push_up_001', 'fr');
 *
 * For batch operations:
 *   const map = await getLocalizedExerciseNames(['push_up_001', 'squat_001'], 'fr');
 *
 * All functions fall back to English if translation is missing.
 * Never returns empty — always has at least English data.
 */

import { getDatabase } from '../database/schema';
import { getCurrentLanguage } from '../i18n/engine-i18n';

// ============================================
// TYPES
// ============================================

export interface LocalizedExercise {
  exerciseId: string;
  language: string;
  name: string;
  instructions: string[];
  audioIntro: string;
  audioSetup: string;
  audioExecution: string;
  audioTransition: string;
  isFallback: boolean;
}

// ============================================
// SINGLE EXERCISE
// ============================================

/**
 * Get a fully localized exercise. Falls back to English if translation missing.
 */
export async function getLocalizedExercise(exerciseId: string, language?: string): Promise<LocalizedExercise | null> {
  const lang = language ?? getCurrentLanguage();
  const db = await getDatabase();

  // Try localized version first (skip if English — go straight to source)
  if (lang !== 'en') {
    const translation = await db.getFirstAsync<{
      name: string;
      instructions: string;
      audio_intro: string;
      audio_setup: string;
      audio_execution: string;
      audio_transition: string;
    }>(
      `SELECT name, instructions, audio_intro, audio_setup, audio_execution, audio_transition
       FROM exercise_translations WHERE exercise_id = ? AND language = ?`,
      [exerciseId, lang],
    );

    if (translation) {
      return {
        exerciseId,
        language: lang,
        name: translation.name,
        instructions: safeParseInstructions(translation.instructions),
        audioIntro: translation.audio_intro,
        audioSetup: translation.audio_setup,
        audioExecution: translation.audio_execution,
        audioTransition: translation.audio_transition,
        isFallback: false,
      };
    }
  }

  // Fallback to English (exercises table)
  const exercise = await db.getFirstAsync<{
    name: string;
    instructions: string;
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }>(
    `SELECT name, instructions, audio_intro, audio_setup, audio_execution, audio_transition
     FROM exercises WHERE id = ?`,
    [exerciseId],
  );

  if (!exercise) return null;

  return {
    exerciseId,
    language: 'en',
    name: exercise.name,
    instructions: safeParseInstructions(exercise.instructions),
    audioIntro: exercise.audio_intro,
    audioSetup: exercise.audio_setup,
    audioExecution: exercise.audio_execution,
    audioTransition: exercise.audio_transition,
    isFallback: lang !== 'en',
  };
}

/**
 * Get localized exercise name only.
 */
export async function getLocalizedExerciseName(exerciseId: string, language?: string): Promise<string> {
  const lang = language ?? getCurrentLanguage();
  const db = await getDatabase();

  if (lang !== 'en') {
    const row = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM exercise_translations WHERE exercise_id = ? AND language = ?`,
      [exerciseId, lang],
    );
    if (row) return row.name;
  }

  const row = await db.getFirstAsync<{ name: string }>(`SELECT name FROM exercises WHERE id = ?`, [exerciseId]);
  return row?.name ?? exerciseId;
}

/**
 * Get localized exercise instructions only.
 */
export async function getLocalizedInstructions(exerciseId: string, language?: string): Promise<string[]> {
  const lang = language ?? getCurrentLanguage();
  const db = await getDatabase();

  if (lang !== 'en') {
    const row = await db.getFirstAsync<{ instructions: string }>(
      `SELECT instructions FROM exercise_translations WHERE exercise_id = ? AND language = ?`,
      [exerciseId, lang],
    );
    if (row) return safeParseInstructions(row.instructions);
  }

  const row = await db.getFirstAsync<{ instructions: string }>(`SELECT instructions FROM exercises WHERE id = ?`, [
    exerciseId,
  ]);
  return row ? safeParseInstructions(row.instructions) : [];
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Batch-fetch localized names for multiple exercises.
 * Returns Map<exerciseId, localizedName>.
 */
export async function getLocalizedExerciseNames(
  exerciseIds: string[],
  language?: string,
): Promise<Map<string, string>> {
  if (exerciseIds.length === 0) return new Map();

  const lang = language ?? getCurrentLanguage();
  const db = await getDatabase();
  const result = new Map<string, string>();
  const placeholders = exerciseIds.map(() => '?').join(',');

  // Get English names first (always available)
  const englishRows = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM exercises WHERE id IN (${placeholders})`,
    exerciseIds,
  );
  for (const row of englishRows) {
    result.set(row.id, row.name);
  }

  // Overlay translations if not English
  if (lang !== 'en') {
    const translatedRows = await db.getAllAsync<{ exercise_id: string; name: string }>(
      `SELECT exercise_id, name FROM exercise_translations WHERE exercise_id IN (${placeholders}) AND language = ?`,
      [...exerciseIds, lang],
    );
    for (const row of translatedRows) {
      result.set(row.exercise_id, row.name);
    }
  }

  return result;
}

/**
 * Batch-fetch full localized exercises (name, instructions, audio).
 * Returns Map<exerciseId, LocalizedExercise>.
 * Used by workout hook to localize all workout exercises in one query.
 */
export async function getLocalizedExerciseBatch(
  exerciseIds: string[],
  language?: string,
): Promise<Map<string, LocalizedExercise>> {
  if (exerciseIds.length === 0) return new Map();

  const lang = language ?? getCurrentLanguage();
  const db = await getDatabase();
  const result = new Map<string, LocalizedExercise>();
  const placeholders = exerciseIds.map(() => '?').join(',');

  // Get English data first (always available)
  const englishRows = await db.getAllAsync<{
    id: string;
    name: string;
    instructions: string;
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }>(
    `SELECT id, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition
     FROM exercises WHERE id IN (${placeholders})`,
    exerciseIds,
  );
  for (const row of englishRows) {
    result.set(row.id, {
      exerciseId: row.id,
      language: 'en',
      name: row.name,
      instructions: safeParseInstructions(row.instructions),
      audioIntro: row.audio_intro,
      audioSetup: row.audio_setup,
      audioExecution: row.audio_execution,
      audioTransition: row.audio_transition,
      isFallback: lang !== 'en',
    });
  }

  // Overlay translations if not English
  if (lang !== 'en') {
    const translatedRows = await db.getAllAsync<{
      exercise_id: string;
      name: string;
      instructions: string;
      audio_intro: string;
      audio_setup: string;
      audio_execution: string;
      audio_transition: string;
    }>(
      `SELECT exercise_id, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition
       FROM exercise_translations WHERE exercise_id IN (${placeholders}) AND language = ?`,
      [...exerciseIds, lang],
    );
    for (const row of translatedRows) {
      result.set(row.exercise_id, {
        exerciseId: row.exercise_id,
        language: lang,
        name: row.name,
        instructions: safeParseInstructions(row.instructions),
        audioIntro: row.audio_intro,
        audioSetup: row.audio_setup,
        audioExecution: row.audio_execution,
        audioTransition: row.audio_transition,
        isFallback: false,
      });
    }
  }

  return result;
}

// ============================================
// TRANSLATION MANAGEMENT
// ============================================

/**
 * Upsert a translation for an exercise.
 * Used by translation import pipeline.
 */
export async function upsertExerciseTranslation(
  exerciseId: string,
  language: string,
  name: string,
  instructions: string[] | string,
  audio?: { intro?: string; setup?: string; execution?: string; transition?: string },
): Promise<void> {
  const db = await getDatabase();
  const instructionsJson = typeof instructions === 'string' ? instructions : JSON.stringify(instructions);

  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_translations 
     (exercise_id, language, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      exerciseId,
      language,
      name,
      instructionsJson,
      audio?.intro ?? '',
      audio?.setup ?? '',
      audio?.execution ?? '',
      audio?.transition ?? '',
    ],
  );
}

/**
 * Get all available languages for an exercise.
 */
export async function getExerciseLanguages(exerciseId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ language: string }>(
    `SELECT language FROM exercise_translations WHERE exercise_id = ?`,
    [exerciseId],
  );
  return ['en', ...rows.map((r) => r.language)];
}

// ============================================
// HELPERS
// ============================================

function safeParseInstructions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [String(parsed)];
  } catch {
    return raw.split('\n').filter(Boolean);
  }
}
