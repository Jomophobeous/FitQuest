/**
 * ENGINE — Batched Translation Execution (v2 — Hardened)
 *
 * Memory-efficient, checkpoint-resumable translation pipeline for 8GB-constrained devices.
 *
 * v2 additions:
 * - 95% minimum coverage enforcement — blocks phase completion below threshold
 * - In-memory translation index — eliminates redundant DB lookups
 * - Batch throttling (75ms delay) — prevents CPU spikes on mobile
 * - Hybrid priority model — usage frequency × 0.7 + category weight × 0.3
 * - Fallback leak detection — flags translations identical to English source
 * - Weak translation detection — flags suspiciously short translations
 * - Severity-graded gap reports — CRITICAL / WARNING / ACCEPTABLE
 *
 * Usage:
 *   import { translationEngine } from './BatchedTranslationEngine';
 *   await translationEngine.execute();             // full run with defaults
 *   const report = translationEngine.getCoverageReport();
 *   const gaps = translationEngine.getGapReport();
 */

import { getDatabase } from '../database/schema';

// ============================================
// TYPES
// ============================================

export interface TranslationEntry {
  exerciseId: string;
  name: string;
  instructions: string[];
  audio: {
    intro: string;
    setup: string;
    execution: string;
    transition: string;
  };
}

export interface TranslationCheckpoint {
  lastExerciseIndex: number;
  completedLanguages: string[];
  currentLanguagePair: string[];
  coverageMap: Record<string, number>;
  totalInserted: number;
  startedAt: number;
  updatedAt: number;
}

export type CoverageSeverity = 'CRITICAL' | 'WARNING' | 'ACCEPTABLE';

export interface LanguageCoverage {
  translated: number;
  total: number;
  percentage: number;
  missingCount: number;
  severity: CoverageSeverity;
}

export interface CoverageReport {
  totalExercises: number;
  languages: Record<string, LanguageCoverage>;
  overallPercentage: number;
  complete: boolean;
  generatedAt: number;
}

export interface GapReportEntry {
  language: string;
  coverage: number;
  missing: number;
  missingIds: string[];
  severity: CoverageSeverity;
}

export interface GapReport {
  entries: GapReportEntry[];
  failedInsertions: Array<{ exerciseId: string; language: string; error: string }>;
  validationWarnings: ValidationWarning[];
  generatedAt: number;
}

export interface ValidationWarning {
  exerciseId: string;
  language: string;
  type: 'FALLBACK_LEAK' | 'WEAK_TRANSLATION' | 'EMPTY_NAME' | 'BAD_INSTRUCTIONS';
  detail: string;
}

export interface PerformanceReport {
  totalBatches: number;
  avgBatchTimeMs: number;
  peakBatchTimeMs: number;
  totalExecutionTimeMs: number;
  totalInserted: number;
  totalSkipped: number;
  generatedAt: number;
}

export interface ExecutionOptions {
  /** Exercises per batch (default: 75) */
  batchSize?: number;
  /** Languages per cycle (default: 2) */
  languageBatch?: number;
  /** Max concurrent language jobs (default: 2, max: 2) */
  maxConcurrent?: number;
  /** Resume from checkpoint (default: true) */
  resumeFromCheckpoint?: boolean;
  /** Run validation samples per batch (default: true) */
  validateBatches?: boolean;
  /** Callback after each batch completes */
  onBatchComplete?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  language: string;
  batchIndex: number;
  totalBatches: number;
  inserted: number;
  skipped: number;
  elapsed: number;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_BATCH_SIZE = 75;
const DEFAULT_LANGUAGE_BATCH = 2;
const MAX_CONCURRENT = 2;
const DB_WRITE_BATCH = 50;
const CHECKPOINT_KEY = 'translation_engine_checkpoint';
const VALIDATION_SAMPLE_SIZE = 5;
const BATCH_THROTTLE_MS = 75;
const MIN_COVERAGE_THRESHOLD = 0.95;
const MIN_TRANSLATION_LENGTH = 3;

/** Category weights for hybrid priority (cold-start fallback) */
const CATEGORY_PRIORITY_WEIGHT: Record<string, number> = {
  body_control: 1.0,
  strength: 0.95,
  mobility: 0.9,
  posture: 0.85,
  speed: 0.8,
  focus: 0.75,
};

function classifySeverity(percentage: number): CoverageSeverity {
  if (percentage < 85) return 'CRITICAL';
  if (percentage < 95) return 'WARNING';
  return 'ACCEPTABLE';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// ENGINE
// ============================================

class BatchedTranslationEngine {
  // Translation data registry — populated by language files via registerLanguageData()
  private registry: Map<string, Map<string, TranslationEntry>> = new Map();
  // Exercise priority order (most-used first)
  private priorityOrder: string[] = [];
  // In-memory translation index: Set<"exerciseId_lang"> — loaded once per language
  private translationIndex: Set<string> = new Set();
  // Execution state
  private running = false;
  private paused = false;
  private checkpoint: TranslationCheckpoint | null = null;
  // Performance tracking
  private batchTimes: number[] = [];
  private totalInserted = 0;
  private totalSkipped = 0;
  private failedInsertions: Array<{ exerciseId: string; language: string; error: string }> = [];
  private validationWarnings: ValidationWarning[] = [];

  // ============================================
  // REGISTRATION
  // ============================================

  /**
   * Register translation data for a language.
   * Called by language files (exercises-af.ts, etc.) at import time.
   */
  registerLanguage(langCode: string, translations: Record<string, TranslationEntry>): void {
    const langMap = new Map<string, TranslationEntry>();
    for (const [exerciseId, entry] of Object.entries(translations)) {
      langMap.set(exerciseId, entry);
    }
    this.registry.set(langCode, langMap);
  }

  /**
   * Get all registered language codes.
   */
  getRegisteredLanguages(): string[] {
    return Array.from(this.registry.keys());
  }

  // ============================================
  // EXECUTION
  // ============================================

  /**
   * Execute the full translation pipeline.
   * Processes all registered languages in batches, with checkpoint/resume.
   */
  async execute(options: ExecutionOptions = {}): Promise<PerformanceReport> {
    if (this.running) {
      throw new Error('[TranslationEngine] Already running');
    }

    this.running = true;
    this.paused = false;
    this.batchTimes = [];
    this.totalInserted = 0;
    this.totalSkipped = 0;
    this.failedInsertions = [];
    this.validationWarnings = [];
    this.translationIndex.clear();

    const startTime = Date.now();
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const languageBatch = Math.min(options.languageBatch ?? DEFAULT_LANGUAGE_BATCH, MAX_CONCURRENT);
    const shouldResume = options.resumeFromCheckpoint ?? true;
    const shouldValidate = options.validateBatches ?? true;

    try {
      // 1. Build priority order
      await this.buildPriorityOrder();

      // 2. Load checkpoint if resuming
      if (shouldResume) {
        await this.loadCheckpoint();
      }

      // 3. Determine language execution order
      const allLanguages = this.getRegisteredLanguages();
      const completedLanguages = new Set(this.checkpoint?.completedLanguages ?? []);
      const pendingLanguages = allLanguages.filter((l) => !completedLanguages.has(l));

      if (pendingLanguages.length === 0) {
        if (__DEV__) console.log('[TranslationEngine] All languages already completed');
        this.running = false;
        return this.buildPerformanceReport(startTime);
      }

      // 4. Process languages in pairs
      for (let i = 0; i < pendingLanguages.length; i += languageBatch) {
        if (this.paused) {
          if (__DEV__) console.log('[TranslationEngine] Paused — checkpoint saved');
          break;
        }

        const langPair = pendingLanguages.slice(i, i + languageBatch);

        // Process each language in the pair sequentially (controlled concurrency)
        for (const lang of langPair) {
          if (this.paused) break;

          await this.processLanguage(lang, batchSize, shouldValidate, options.onBatchComplete);

          // Mark language complete
          if (!this.checkpoint) {
            this.checkpoint = this.createEmptyCheckpoint();
          }
          this.checkpoint.completedLanguages.push(lang);
          this.checkpoint.lastExerciseIndex = 0; // Reset for next language
          await this.saveCheckpoint();
        }

        // Release references between language pairs
        this.releaseMemory();
      }

      // 5. Clear checkpoint on full completion
      if (!this.paused) {
        await this.clearCheckpoint();
        if (__DEV__) console.log('[TranslationEngine] Full execution complete');
      }

      return this.buildPerformanceReport(startTime);
    } finally {
      this.running = false;
    }
  }

  /**
   * Process a single language — all exercises in batches.
   */
  private async processLanguage(
    lang: string,
    batchSize: number,
    shouldValidate: boolean,
    onBatchComplete?: (progress: BatchProgress) => void,
  ): Promise<void> {
    const langData = this.registry.get(lang);
    if (!langData) return;

    const db = await getDatabase();

    // Load in-memory index for this language (one DB hit, then pure Set lookups)
    await this.loadTranslationIndex(lang);

    // Get exercise IDs in priority order that have translation data
    const exerciseIds = this.priorityOrder.filter((id) => langData.has(id));
    if (exerciseIds.length === 0) return;

    // Resume from checkpoint offset if applicable
    const startIndex = this.checkpoint?.currentLanguagePair.includes(lang)
      ? (this.checkpoint.lastExerciseIndex ?? 0)
      : 0;

    const totalBatches = Math.ceil((exerciseIds.length - startIndex) / batchSize);

    if (__DEV__) {
      console.log(
        `[TranslationEngine] ${lang}: ${exerciseIds.length} exercises, starting at ${startIndex}, ${totalBatches} batches`,
      );
    }

    let batchIndex = 0;

    for (let offset = startIndex; offset < exerciseIds.length; offset += batchSize) {
      if (this.paused) break;

      const batchStart = Date.now();
      const batchIds = exerciseIds.slice(offset, offset + batchSize);

      // Deduplication: in-memory index lookup (zero DB hits)
      const newIds = batchIds.filter((id) => !this.translationIndex.has(`${id}_${lang}`));
      const skipped = batchIds.length - newIds.length;
      this.totalSkipped += skipped;

      if (newIds.length > 0) {
        // Write in sub-batches of DB_WRITE_BATCH within a transaction
        for (let w = 0; w < newIds.length; w += DB_WRITE_BATCH) {
          const writeBatch = newIds.slice(w, w + DB_WRITE_BATCH);
          await this.writeBatch(db, lang, langData, writeBatch);
        }
        // Update in-memory index with newly inserted IDs
        for (const id of newIds) {
          this.translationIndex.add(`${id}_${lang}`);
        }
      }

      const batchTime = Date.now() - batchStart;
      this.batchTimes.push(batchTime);
      batchIndex++;

      // Update checkpoint
      if (!this.checkpoint) this.checkpoint = this.createEmptyCheckpoint();
      this.checkpoint.lastExerciseIndex = offset + batchSize;
      this.checkpoint.currentLanguagePair = [lang];
      this.checkpoint.updatedAt = Date.now();

      // Save checkpoint every batch
      await this.saveCheckpoint();

      // Validation: sample check
      if (shouldValidate && newIds.length > 0) {
        const sampleIds = newIds.slice(0, Math.min(VALIDATION_SAMPLE_SIZE, newIds.length));
        await this.validateSample(lang, sampleIds);
      }

      // Progress callback
      onBatchComplete?.({
        language: lang,
        batchIndex,
        totalBatches,
        inserted: newIds.length,
        skipped,
        elapsed: batchTime,
      });

      if (__DEV__) {
        console.log(
          `[TranslationEngine] ${lang} batch ${batchIndex}/${totalBatches}: +${newIds.length} inserted, ${skipped} skipped (${batchTime}ms)`,
        );
      }

      // Throttle: prevent CPU spikes on mobile devices
      if (offset + batchSize < exerciseIds.length) {
        await sleep(BATCH_THROTTLE_MS);
      }
    }
  }

  /**
   * Write a batch of translations within a single transaction.
   */
  private async writeBatch(
    db: Awaited<ReturnType<typeof getDatabase>>,
    lang: string,
    langData: Map<string, TranslationEntry>,
    exerciseIds: string[],
  ): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const exerciseId of exerciseIds) {
        const entry = langData.get(exerciseId);
        if (!entry) continue;

        try {
          const instructionsJson = JSON.stringify(entry.instructions);
          await db.runAsync(
            `INSERT OR REPLACE INTO exercise_translations 
             (exercise_id, language, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              exerciseId,
              lang,
              entry.name,
              instructionsJson,
              entry.audio.intro,
              entry.audio.setup,
              entry.audio.execution,
              entry.audio.transition,
            ],
          );
          this.totalInserted++;
        } catch (err) {
          this.failedInsertions.push({
            exerciseId,
            language: lang,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });
  }

  // ============================================
  // IN-MEMORY TRANSLATION INDEX
  // ============================================

  /**
   * Load the full translation index for a language into memory.
   * Single DB query per language — all subsequent dedup checks are pure Set lookups.
   */
  private async loadTranslationIndex(lang: string): Promise<void> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ exercise_id: string }>(
      `SELECT exercise_id FROM exercise_translations WHERE language = ?`,
      [lang],
    );
    for (const row of rows) {
      this.translationIndex.add(`${row.exercise_id}_${lang}`);
    }
  }

  // ============================================
  // PRIORITY
  // ============================================

  /**
   * Build exercise priority order using hybrid model:
   * score = (usageFrequency × 0.7) + (categoryWeight × 0.3)
   * Handles cold-start (no session data) via category weight fallback.
   */
  private async buildPriorityOrder(): Promise<void> {
    const db = await getDatabase();

    // Get usage counts from session history
    const usageRows = await db.getAllAsync<{ exercise_id: string; usage_count: number }>(
      `SELECT exercise_id, COUNT(*) as usage_count
       FROM session_exercises
       GROUP BY exercise_id`,
    );
    const usageMap = new Map<string, number>();
    let maxUsage = 1;
    for (const row of usageRows) {
      usageMap.set(row.exercise_id, row.usage_count);
      if (row.usage_count > maxUsage) maxUsage = row.usage_count;
    }

    // Get all exercises with category
    const allRows = await db.getAllAsync<{ id: string; category: string }>(`SELECT id, category FROM exercises`);

    // Compute hybrid priority score
    const scored = allRows.map((row) => {
      const normalizedUsage = (usageMap.get(row.id) ?? 0) / maxUsage;
      const categoryWeight = CATEGORY_PRIORITY_WEIGHT[row.category] ?? 0.5;
      const score = normalizedUsage * 0.7 + categoryWeight * 0.3;
      return { id: row.id, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    this.priorityOrder = scored.map((s) => s.id);
  }

  // ============================================
  // CHECKPOINT
  // ============================================

  private async loadCheckpoint(): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_state WHERE key = ?`, [
      CHECKPOINT_KEY,
    ]);

    if (row?.value) {
      try {
        this.checkpoint = JSON.parse(row.value);
      } catch {
        this.checkpoint = null;
      }
    }
  }

  private async saveCheckpoint(): Promise<void> {
    if (!this.checkpoint) return;

    const db = await getDatabase();
    this.checkpoint.totalInserted = this.totalInserted;
    this.checkpoint.updatedAt = Date.now();

    await db.runAsync(`INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [
      CHECKPOINT_KEY,
      JSON.stringify(this.checkpoint),
    ]);
  }

  private async clearCheckpoint(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM app_state WHERE key = ?`, [CHECKPOINT_KEY]);
    this.checkpoint = null;
  }

  private createEmptyCheckpoint(): TranslationCheckpoint {
    return {
      lastExerciseIndex: 0,
      completedLanguages: [],
      currentLanguagePair: [],
      coverageMap: {},
      totalInserted: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate a sample of translations after a batch write.
   * Checks: name mapping, instruction rendering, fallback leaks, weak translations.
   */
  private async validateSample(lang: string, sampleIds: string[]): Promise<void> {
    const db = await getDatabase();

    for (const exerciseId of sampleIds) {
      // Get translated version
      const row = await db.getFirstAsync<{
        name: string;
        instructions: string;
      }>(`SELECT name, instructions FROM exercise_translations WHERE exercise_id = ? AND language = ?`, [
        exerciseId,
        lang,
      ]);

      if (!row) {
        this.validationWarnings.push({
          exerciseId,
          language: lang,
          type: 'EMPTY_NAME',
          detail: 'Translation not found after insert',
        });
        continue;
      }

      // Check name is non-empty
      if (!row.name || row.name.trim().length < MIN_TRANSLATION_LENGTH) {
        this.validationWarnings.push({
          exerciseId,
          language: lang,
          type: 'WEAK_TRANSLATION',
          detail: `Name too short: "${row.name}"`,
        });
      }

      // Check instructions parse as JSON array
      let parsedInstructions: string[] = [];
      try {
        const parsed = JSON.parse(row.instructions);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          this.validationWarnings.push({
            exerciseId,
            language: lang,
            type: 'BAD_INSTRUCTIONS',
            detail: 'Instructions empty or not an array',
          });
        } else {
          parsedInstructions = parsed;
        }
      } catch {
        this.validationWarnings.push({
          exerciseId,
          language: lang,
          type: 'BAD_INSTRUCTIONS',
          detail: 'Instructions not valid JSON',
        });
      }

      // Fallback leak detection: compare against English source
      const english = await db.getFirstAsync<{ name: string; instructions: string }>(
        `SELECT name, instructions FROM exercises WHERE id = ?`,
        [exerciseId],
      );
      if (english) {
        if (row.name === english.name) {
          this.validationWarnings.push({
            exerciseId,
            language: lang,
            type: 'FALLBACK_LEAK',
            detail: `Name identical to English: "${row.name}"`,
          });
        }
        // Check if instructions are identical to English
        if (parsedInstructions.length > 0) {
          try {
            const enInstructions = JSON.parse(english.instructions);
            if (
              Array.isArray(enInstructions) &&
              JSON.stringify(parsedInstructions) === JSON.stringify(enInstructions)
            ) {
              this.validationWarnings.push({
                exerciseId,
                language: lang,
                type: 'FALLBACK_LEAK',
                detail: 'Instructions identical to English source',
              });
            }
          } catch {
            /* English instructions may not be JSON — skip */
          }
        }
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  /**
   * Generate coverage report — language → % translated + severity.
   * `complete` is true only when ALL languages are ≥ 95%.
   */
  async getCoverageReport(): Promise<CoverageReport> {
    const db = await getDatabase();

    const totalRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM exercises`);
    const totalExercises = totalRow?.count ?? 0;

    const langRows = await db.getAllAsync<{ language: string; count: number }>(
      `SELECT language, COUNT(*) as count FROM exercise_translations GROUP BY language`,
    );

    const languages: CoverageReport['languages'] = {};
    let totalTranslated = 0;
    let allAboveThreshold = true;

    for (const row of langRows) {
      const pct = totalExercises > 0 ? Math.round((row.count / totalExercises) * 100 * 10) / 10 : 0;
      languages[row.language] = {
        translated: row.count,
        total: totalExercises,
        percentage: pct,
        missingCount: totalExercises - row.count,
        severity: classifySeverity(pct),
      };
      if (pct < MIN_COVERAGE_THRESHOLD * 100) allAboveThreshold = false;
      totalTranslated += row.count;
    }

    const totalPossible = totalExercises * this.getRegisteredLanguages().length;
    const overallPercentage = totalPossible > 0 ? Math.round((totalTranslated / totalPossible) * 100 * 10) / 10 : 0;

    return {
      totalExercises,
      languages,
      overallPercentage,
      complete: allAboveThreshold && langRows.length >= this.getRegisteredLanguages().length,
      generatedAt: Date.now(),
    };
  }

  /**
   * Check if all languages meet the 95% minimum coverage threshold.
   * Returns false if ANY language is below threshold — blocks phase completion.
   */
  async isCoverageComplete(): Promise<boolean> {
    const report = await this.getCoverageReport();
    return report.complete;
  }

  /**
   * Generate severity-graded gap report per language.
   * CRITICAL (<85%), WARNING (85-95%), ACCEPTABLE (≥95%).
   */
  async getGapReport(): Promise<GapReport> {
    const db = await getDatabase();
    const totalRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM exercises`);
    const totalExercises = totalRow?.count ?? 0;
    const entries: GapReportEntry[] = [];

    for (const lang of this.getRegisteredLanguages()) {
      const rows = await db.getAllAsync<{ id: string }>(
        `SELECT e.id FROM exercises e
         WHERE e.id NOT IN (
           SELECT et.exercise_id FROM exercise_translations et WHERE et.language = ?
         )`,
        [lang],
      );

      const translated = totalExercises - rows.length;
      const coverage = totalExercises > 0 ? Math.round((translated / totalExercises) * 100 * 10) / 10 : 0;

      entries.push({
        language: lang,
        coverage,
        missing: rows.length,
        missingIds: rows.map((r) => r.id),
        severity: classifySeverity(coverage),
      });
    }

    // Sort by coverage ascending — worst first
    entries.sort((a, b) => a.coverage - b.coverage);

    return {
      entries,
      failedInsertions: [...this.failedInsertions],
      validationWarnings: [...this.validationWarnings],
      generatedAt: Date.now(),
    };
  }

  private buildPerformanceReport(startTime: number): PerformanceReport {
    const totalTime = Date.now() - startTime;
    const avgBatch =
      this.batchTimes.length > 0 ? Math.round(this.batchTimes.reduce((a, b) => a + b, 0) / this.batchTimes.length) : 0;
    const peakBatch = this.batchTimes.length > 0 ? Math.max(...this.batchTimes) : 0;

    return {
      totalBatches: this.batchTimes.length,
      avgBatchTimeMs: avgBatch,
      peakBatchTimeMs: peakBatch,
      totalExecutionTimeMs: totalTime,
      totalInserted: this.totalInserted,
      totalSkipped: this.totalSkipped,
      generatedAt: Date.now(),
    };
  }

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================

  /**
   * Pause execution — saves checkpoint and stops after current batch.
   */
  pause(): void {
    if (this.running) {
      this.paused = true;
      if (__DEV__) console.log('[TranslationEngine] Pause requested — will stop after current batch');
    }
  }

  /**
   * Resume execution from last checkpoint.
   */
  async resume(options: ExecutionOptions = {}): Promise<PerformanceReport> {
    return this.execute({ ...options, resumeFromCheckpoint: true });
  }

  /**
   * Release memory between language pairs.
   * Forces garbage collection if available.
   */
  private releaseMemory(): void {
    // Hint for GC — no strong guarantees in JS but helps frameworklevel schedulers
    if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
      (global as any).gc();
    }
  }

  /**
   * Check if engine is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if engine is paused.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Reset engine state (for testing).
   */
  reset(): void {
    this.running = false;
    this.paused = false;
    this.checkpoint = null;
    this.batchTimes = [];
    this.totalInserted = 0;
    this.totalSkipped = 0;
    this.failedInsertions = [];
    this.validationWarnings = [];
    this.translationIndex.clear();
  }
}

// ============================================
// SINGLETON
// ============================================

export const translationEngine = new BatchedTranslationEngine();
