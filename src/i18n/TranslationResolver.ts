/**
 * TranslationResolver — Public API for exercise translation resolution
 *
 * Priority: cache → DB → English fallback
 * Tracks all fallback events for runtime gap analysis.
 * Provides live update capability (1 DB write = instant UI effect).
 *
 * Usage:
 *   import { translationResolver } from './TranslationResolver';
 *
 *   // Single exercise
 *   const loc = await translationResolver.resolve('push_up_001', 'fr');
 *
 *   // Batch (workout generation)
 *   const map = await translationResolver.resolveBatch(exerciseIds, 'fr');
 *
 *   // Live correction (no reseed)
 *   await translationResolver.updateTranslation('push_up_001', 'fr', 'Pompes', ['Étape 1...']);
 *
 *   // Analytics
 *   const report = translationResolver.getGapReport();
 *
 * @module TranslationResolver
 */

import { translationRegistry, type RegistryStats } from './TranslationRegistry';
import { getDatabase } from '../database/schema';
import { getCurrentLanguage } from './engine-i18n';

// ============================================
// TYPES
// ============================================

export interface ResolvedExercise {
  exerciseId: string;
  language: string;
  name: string;
  instructions: string[];
  audioIntro: string;
  audioSetup: string;
  audioExecution: string;
  audioTransition: string;
  isFallback: boolean;
  source: 'cache' | 'db' | 'english';
}

export interface FallbackEvent {
  exerciseId: string;
  requestedLang: string;
  timestamp: number;
}

export interface GapReportRuntime {
  totalRequests: number;
  totalFallbacks: number;
  fallbackRate: number;
  fallbacksByLanguage: Map<string, number>;
  fallbacksByExercise: Map<string, number>;
  topMissingByLanguage: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  topFallbackExercises: Array<{
    exerciseId: string;
    count: number;
    languages: string[];
  }>;
  registryStats: RegistryStats;
}

export interface TranslationAnalytics {
  qualityScoreByLanguage: Map<string, number>;
  coverageByLanguage: Map<string, { total: number; translated: number; percentage: number }>;
  mostFallbackHeavyExercises: Array<{ exerciseId: string; fallbackCount: number }>;
}

// ============================================
// RESOLVER SINGLETON
// ============================================

const MAX_FALLBACK_LOG = 50_000; // Cap memory for fallback tracking

class TranslationResolverImpl {
  private fallbackLog: FallbackEvent[] = [];
  private totalRequests = 0;
  private totalFallbacks = 0;
  private fallbacksByLang = new Map<string, number>();
  private fallbacksByExercise = new Map<string, number>();

  // ---- RESOLUTION ----

  /**
   * Resolve a single exercise translation.
   * Priority: registry cache → DB → English exercises table.
   */
  async resolve(exerciseId: string, language?: string): Promise<ResolvedExercise> {
    const lang = language ?? getCurrentLanguage();
    this.totalRequests++;

    // English: direct from exercises table
    if (lang === 'en') {
      return this.fetchEnglish(exerciseId);
    }

    // Try registry (cache + DB)
    const translation = await translationRegistry.get(exerciseId, lang);
    if (translation) {
      return {
        exerciseId,
        language: lang,
        name: translation.name,
        instructions: translation.instructions,
        audioIntro: translation.audioIntro,
        audioSetup: translation.audioSetup,
        audioExecution: translation.audioExecution,
        audioTransition: translation.audioTransition,
        isFallback: false,
        source: 'db',
      };
    }

    // Fallback to English
    this.recordFallback(exerciseId, lang);
    return this.fetchEnglish(exerciseId);
  }

  /**
   * Batch-resolve exercise translations.
   * Optimal path for workout generation — minimizes DB queries.
   * Returns Map<exerciseId, ResolvedExercise>.
   */
  async resolveBatch(exerciseIds: string[], language?: string): Promise<Map<string, ResolvedExercise>> {
    if (exerciseIds.length === 0) return new Map();

    const lang = language ?? getCurrentLanguage();
    this.totalRequests += exerciseIds.length;

    // English: batch from exercises table
    if (lang === 'en') {
      return this.fetchEnglishBatch(exerciseIds);
    }

    // Batch from registry (cache + DB)
    const translations = await translationRegistry.getBatch(exerciseIds, lang);
    const result = new Map<string, ResolvedExercise>();
    const missingIds: string[] = [];

    for (const id of exerciseIds) {
      const t = translations.get(id);
      if (t) {
        result.set(id, {
          exerciseId: id,
          language: lang,
          name: t.name,
          instructions: t.instructions,
          audioIntro: t.audioIntro,
          audioSetup: t.audioSetup,
          audioExecution: t.audioExecution,
          audioTransition: t.audioTransition,
          isFallback: false,
          source: 'db',
        });
      } else {
        missingIds.push(id);
      }
    }

    // Fill gaps with English
    if (missingIds.length > 0) {
      const englishMap = await this.fetchEnglishBatch(missingIds);
      for (const [id, resolved] of englishMap) {
        this.recordFallback(id, lang);
        result.set(id, resolved);
      }
    }

    return result;
  }

  // ---- LIVE UPDATES ----

  /**
   * Update a single translation. Instant effect — no reseed, no restart.
   * Writes to DB + updates cache in one call.
   */
  async updateTranslation(
    exerciseId: string,
    lang: string,
    name: string,
    instructions: string[],
    audio?: {
      intro?: string;
      setup?: string;
      execution?: string;
      transition?: string;
    },
  ): Promise<void> {
    await translationRegistry.update(exerciseId, lang, name, instructions, audio);
  }

  /**
   * Batch-update translations. Atomic DB transaction + cache update.
   */
  async updateTranslationBatch(
    lang: string,
    translations: Array<{
      exerciseId: string;
      name: string;
      instructions: string[];
      audio?: {
        intro?: string;
        setup?: string;
        execution?: string;
        transition?: string;
      };
    }>,
  ): Promise<number> {
    return translationRegistry.updateBatch(lang, translations);
  }

  // ---- PRELOAD ----

  /**
   * Warm cache for a language. Call on language switch for instant resolution.
   * Idempotent — safe to call repeatedly.
   */
  async preloadLanguage(lang: string): Promise<void> {
    return translationRegistry.preloadLanguage(lang);
  }

  // ---- FALLBACK TRACKING ----

  private recordFallback(exerciseId: string, lang: string): void {
    this.totalFallbacks++;

    // Per-language counter
    const langCount = this.fallbacksByLang.get(lang) ?? 0;
    this.fallbacksByLang.set(lang, langCount + 1);

    // Per-exercise counter
    const exCount = this.fallbacksByExercise.get(exerciseId) ?? 0;
    this.fallbacksByExercise.set(exerciseId, exCount + 1);

    // Event log (bounded)
    if (this.fallbackLog.length < MAX_FALLBACK_LOG) {
      this.fallbackLog.push({
        exerciseId,
        requestedLang: lang,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Runtime gap report — live fallback analysis.
   */
  getGapReport(): GapReportRuntime {
    const topMissing = [...this.fallbacksByLang.entries()]
      .map(([language, count]) => ({
        language,
        count,
        percentage: this.totalRequests > 0 ? (count / this.totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Top fallback exercises with affected languages
    const exerciseLangs = new Map<string, Set<string>>();
    for (const event of this.fallbackLog) {
      let langs = exerciseLangs.get(event.exerciseId);
      if (!langs) {
        langs = new Set();
        exerciseLangs.set(event.exerciseId, langs);
      }
      langs.add(event.requestedLang);
    }

    const topExercises = [...this.fallbacksByExercise.entries()]
      .map(([exerciseId, count]) => ({
        exerciseId,
        count,
        languages: [...(exerciseLangs.get(exerciseId) ?? [])],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalRequests: this.totalRequests,
      totalFallbacks: this.totalFallbacks,
      fallbackRate: this.totalRequests > 0 ? this.totalFallbacks / this.totalRequests : 0,
      fallbacksByLanguage: new Map(this.fallbacksByLang),
      fallbacksByExercise: new Map(this.fallbacksByExercise),
      topMissingByLanguage: topMissing,
      topFallbackExercises: topExercises,
      registryStats: translationRegistry.getStats(),
    };
  }

  // ---- ANALYTICS ----

  /**
   * Deep analytics — queries DB for coverage and quality metrics.
   */
  async getAnalytics(): Promise<TranslationAnalytics> {
    const db = await getDatabase();

    // Total exercise count
    const totalRow = await db.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM exercises`);
    const totalExercises = totalRow?.cnt ?? 0;

    // Coverage per language
    const langCounts = await translationRegistry.getLanguageCounts();
    const coverageByLanguage = new Map<string, { total: number; translated: number; percentage: number }>();
    for (const [lang, count] of langCounts) {
      coverageByLanguage.set(lang, {
        total: totalExercises,
        translated: count,
        percentage: totalExercises > 0 ? (count / totalExercises) * 100 : 0,
      });
    }

    // Quality score: (coverage% × (1 - fallbackRate)) per language
    const qualityScoreByLanguage = new Map<string, number>();
    for (const [lang, coverage] of coverageByLanguage) {
      const fallbackCount = this.fallbacksByLang.get(lang) ?? 0;
      const langRequests =
        this.totalRequests > 0
          ? [...this.fallbackLog].filter((e) => e.requestedLang === lang).length + fallbackCount
          : 0;
      const fallbackRate = langRequests > 0 ? fallbackCount / langRequests : 0;
      const score = (coverage.percentage / 100) * (1 - fallbackRate) * 100;
      qualityScoreByLanguage.set(lang, Math.round(score * 10) / 10);
    }

    // Most fallback-heavy exercises
    const mostFallbackHeavyExercises = [...this.fallbacksByExercise.entries()]
      .map(([exerciseId, fallbackCount]) => ({ exerciseId, fallbackCount }))
      .sort((a, b) => b.fallbackCount - a.fallbackCount)
      .slice(0, 50);

    return {
      qualityScoreByLanguage,
      coverageByLanguage,
      mostFallbackHeavyExercises,
    };
  }

  // ---- MANAGEMENT ----

  /**
   * Reset all tracking state. Cache is preserved.
   */
  resetTracking(): void {
    this.fallbackLog = [];
    this.totalRequests = 0;
    this.totalFallbacks = 0;
    this.fallbacksByLang.clear();
    this.fallbacksByExercise.clear();
  }

  /**
   * Full reset — tracking + cache.
   */
  reset(): void {
    this.resetTracking();
    translationRegistry.reset();
  }

  // ---- PRIVATE: English resolution ----

  private async fetchEnglish(exerciseId: string): Promise<ResolvedExercise> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
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

    return {
      exerciseId,
      language: 'en',
      name: row?.name ?? exerciseId,
      instructions: row ? safeParseInstructions(row.instructions) : [],
      audioIntro: row?.audio_intro ?? '',
      audioSetup: row?.audio_setup ?? '',
      audioExecution: row?.audio_execution ?? '',
      audioTransition: row?.audio_transition ?? '',
      isFallback: true,
      source: 'english',
    };
  }

  private async fetchEnglishBatch(exerciseIds: string[]): Promise<Map<string, ResolvedExercise>> {
    const db = await getDatabase();
    const result = new Map<string, ResolvedExercise>();
    const placeholders = exerciseIds.map(() => '?').join(',');

    const rows = await db.getAllAsync<{
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

    for (const row of rows) {
      result.set(row.id, {
        exerciseId: row.id,
        language: 'en',
        name: row.name,
        instructions: safeParseInstructions(row.instructions),
        audioIntro: row.audio_intro,
        audioSetup: row.audio_setup,
        audioExecution: row.audio_execution,
        audioTransition: row.audio_transition,
        isFallback: true,
        source: 'english',
      });
    }

    return result;
  }
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

// ============================================
// SINGLETON
// ============================================

export const translationResolver = new TranslationResolverImpl();
