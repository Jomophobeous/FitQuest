/**
 * Exercise Translation Seed Data
 *
 * Batched, memory-efficient translation pipeline for 8GB-constrained devices.
 * Called once during DB init after core exercises are seeded.
 *
 * Design:
 * - Uses BatchedTranslationEngine for controlled execution
 * - Processes in batches of 75 exercises × 2 languages per cycle
 * - Deduplicates via DB check before insert (skips existing)
 * - Checkpoint/resume — never re-does completed work
 * - English is canonical source in `exercises` table — never duplicated here
 * - No network calls — fully static
 */

import { translationEngine, type TranslationEntry } from './BatchedTranslationEngine';

// ============================================
// TYPES (re-export for language file compat)
// ============================================

interface ExerciseTranslationEntry {
  name: string;
  instructions: string[];
  audio: {
    intro: string;
    setup: string;
    execution: string;
    transition: string;
  };
}

type LanguageTranslations = Record<string, ExerciseTranslationEntry>;

// ============================================
// LANGUAGE REGISTRATION HELPER
// ============================================

/**
 * Register translations for a language.
 * Called by each language file (exercises-af.ts, etc.) at import time.
 * Routes to BatchedTranslationEngine for controlled execution.
 */
export function registerLanguageTranslations(langCode: string, translations: LanguageTranslations): void {
  // Convert to engine format and register
  const engineEntries: Record<string, TranslationEntry> = {};
  for (const [exerciseId, entry] of Object.entries(translations)) {
    engineEntries[exerciseId] = {
      exerciseId,
      name: entry.name,
      instructions: entry.instructions,
      audio: {
        intro: entry.audio.intro,
        setup: entry.audio.setup,
        execution: entry.audio.execution,
        transition: entry.audio.transition,
      },
    };
  }
  translationEngine.registerLanguage(langCode, engineEntries);
}

// ============================================
// SEED FUNCTION
// ============================================

let seeded = false;

/**
 * Seed exercise translations using the batched engine.
 * Safe to call multiple times — engine deduplicates and checkpoints.
 */
export async function seedExerciseTranslations(): Promise<void> {
  if (seeded) return;

  const languages = translationEngine.getRegisteredLanguages();
  if (languages.length === 0) return;

  const report = await translationEngine.execute({
    batchSize: 75,
    languageBatch: 2,
    resumeFromCheckpoint: true,
    validateBatches: __DEV__,
    onBatchComplete: (progress) => {
      if (__DEV__) {
        console.warn(
          `[FitQuest i18n] ${progress.language} ${progress.batchIndex}/${progress.totalBatches}: +${progress.inserted}, skip=${progress.skipped} (${progress.elapsed}ms)`,
        );
      }
    },
  });

  seeded = true;

  // Coverage enforcement + reporting
  const coverage = await translationEngine.getCoverageReport();
  const complete = coverage.complete;

  if (__DEV__) {
    console.warn(
      `[FitQuest i18n] Seeded ${report.totalInserted} translations across ${languages.length} languages (${report.totalSkipped} skipped, ${report.totalExecutionTimeMs}ms)`,
    );
    console.warn(`[FitQuest i18n] Coverage: ${coverage.overallPercentage}% overall, complete=${complete}`);

    // Log per-language severity
    for (const [lang, data] of Object.entries(coverage.languages)) {
      if (data.severity !== 'ACCEPTABLE') {
        console.warn(`[FitQuest i18n] ${lang}: ${data.percentage}% (${data.severity}) — ${data.missingCount} missing`);
      }
    }

    // Log validation warnings
    const gap = await translationEngine.getGapReport();
    if (gap.validationWarnings.length > 0) {
      const leaks = gap.validationWarnings.filter((w) => w.type === 'FALLBACK_LEAK').length;
      const weak = gap.validationWarnings.filter((w) => w.type === 'WEAK_TRANSLATION').length;
      console.warn(`[FitQuest i18n] Quality: ${leaks} fallback leaks, ${weak} weak translations`);
    }
  }
}

/**
 * Reset seed guard (for testing).
 */
export function resetExerciseTranslationSeedState(): void {
  seeded = false;
  translationEngine.reset();
}
