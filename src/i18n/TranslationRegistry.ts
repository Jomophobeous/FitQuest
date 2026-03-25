/**
 * TranslationRegistry — Central runtime translation cache
 *
 * In-memory LRU cache backed by SQLite exercise_translations table.
 * Resolution priority: cache → DB → English fallback.
 *
 * Design constraints:
 *   - O(1) lookup via Map
 *   - Max 10,000 entries (LRU eviction)
 *   - No full dataset load — lazy per-language, per-exercise
 *   - Thread-safe singleton
 *   - No blocking I/O during UI render (preload at language switch)
 *
 * @module TranslationRegistry
 */

import { getDatabase } from '../database/schema';

// ============================================
// TYPES
// ============================================

export interface CachedTranslation {
  name: string;
  instructions: string[];
  audioIntro: string;
  audioSetup: string;
  audioExecution: string;
  audioTransition: string;
}

interface LRUNode {
  key: string;
  value: CachedTranslation;
  prev: LRUNode | null;
  next: LRUNode | null;
}

export interface RegistryStats {
  cacheSize: number;
  cacheCapacity: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  loadedLanguages: string[];
  dbWriteCount: number;
}

// ============================================
// LRU CACHE
// ============================================

class LRUCache {
  private capacity: number;
  private map = new Map<string, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: string): CachedTranslation | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  put(key: string, value: CachedTranslation): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }

    const node: LRUNode = { key, value, prev: null, next: null };
    this.map.set(key, node);
    this.addToHead(node);

    if (this.map.size > this.capacity) {
      this.evictTail();
    }
  }

  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /** Evict all entries for a specific language prefix */
  evictLanguage(lang: string): number {
    const prefix = `${lang}:`;
    const keysToDelete: string[] = [];
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.delete(key);
    }
    return keysToDelete.length;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  get size(): number {
    return this.map.size;
  }

  private moveToHead(node: LRUNode): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: LRUNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private evictTail(): void {
    if (!this.tail) return;
    const evicted = this.tail;
    this.removeNode(evicted);
    this.map.delete(evicted.key);
  }
}

// ============================================
// REGISTRY SINGLETON
// ============================================

const CACHE_CAPACITY = 10_000;

class TranslationRegistryImpl {
  private cache = new LRUCache(CACHE_CAPACITY);
  private loadedLanguages = new Set<string>();
  private loadingLanguages = new Map<string, Promise<void>>();
  private hitCount = 0;
  private missCount = 0;
  private dbWriteCount = 0;

  // ---- READ (cache-first) ----

  /**
   * Get a single translation from cache.
   * Returns undefined if not cached — caller must handle miss.
   */
  getCached(exerciseId: string, lang: string): CachedTranslation | undefined {
    const key = `${lang}:${exerciseId}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return hit;
  }

  /**
   * Get a single translation: cache → DB.
   * Returns null if no translation exists for this language.
   */
  async get(exerciseId: string, lang: string): Promise<CachedTranslation | null> {
    // Cache check
    const cached = this.cache.get(`${lang}:${exerciseId}`);
    if (cached) {
      this.hitCount++;
      return cached;
    }
    this.missCount++;

    // DB fetch
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
       FROM exercise_translations WHERE exercise_id = ? AND language = ?`,
      [exerciseId, lang],
    );

    if (!row) return null;

    const translation: CachedTranslation = {
      name: row.name,
      instructions: safeParseInstructions(row.instructions),
      audioIntro: row.audio_intro,
      audioSetup: row.audio_setup,
      audioExecution: row.audio_execution,
      audioTransition: row.audio_transition,
    };

    this.cache.put(`${lang}:${exerciseId}`, translation);
    return translation;
  }

  /**
   * Batch-fetch translations: cache → DB for misses.
   * Returns Map of found translations (missing = not in map).
   */
  async getBatch(exerciseIds: string[], lang: string): Promise<Map<string, CachedTranslation>> {
    if (exerciseIds.length === 0) return new Map();

    const result = new Map<string, CachedTranslation>();
    const uncachedIds: string[] = [];

    // Partition: cached vs uncached
    for (const id of exerciseIds) {
      const cached = this.cache.get(`${lang}:${id}`);
      if (cached) {
        this.hitCount++;
        result.set(id, cached);
      } else {
        this.missCount++;
        uncachedIds.push(id);
      }
    }

    // Batch DB query for misses
    if (uncachedIds.length > 0) {
      const db = await getDatabase();
      const placeholders = uncachedIds.map(() => '?').join(',');
      const rows = await db.getAllAsync<{
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
        [...uncachedIds, lang],
      );

      for (const row of rows) {
        const translation: CachedTranslation = {
          name: row.name,
          instructions: safeParseInstructions(row.instructions),
          audioIntro: row.audio_intro,
          audioSetup: row.audio_setup,
          audioExecution: row.audio_execution,
          audioTransition: row.audio_transition,
        };
        this.cache.put(`${lang}:${row.exercise_id}`, translation);
        result.set(row.exercise_id, translation);
      }
    }

    return result;
  }

  // ---- WRITE (write-through) ----

  /**
   * Update a translation: DB + cache in one call.
   * Instant effect — no reseed required.
   */
  async update(
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
    const db = await getDatabase();
    const instructionsJson = JSON.stringify(instructions);

    await db.runAsync(
      `INSERT OR REPLACE INTO exercise_translations
       (exercise_id, language, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        exerciseId,
        lang,
        name,
        instructionsJson,
        audio?.intro ?? '',
        audio?.setup ?? '',
        audio?.execution ?? '',
        audio?.transition ?? '',
      ],
    );

    // Update cache immediately
    this.cache.put(`${lang}:${exerciseId}`, {
      name,
      instructions,
      audioIntro: audio?.intro ?? '',
      audioSetup: audio?.setup ?? '',
      audioExecution: audio?.execution ?? '',
      audioTransition: audio?.transition ?? '',
    });

    this.dbWriteCount++;
  }

  /**
   * Batch-update translations. Used for bulk corrections.
   */
  async updateBatch(
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
    if (translations.length === 0) return 0;

    const db = await getDatabase();
    let count = 0;

    await db.withTransactionAsync(async () => {
      for (const t of translations) {
        const instructionsJson = JSON.stringify(t.instructions);
        await db.runAsync(
          `INSERT OR REPLACE INTO exercise_translations
           (exercise_id, language, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            t.exerciseId,
            lang,
            t.name,
            instructionsJson,
            t.audio?.intro ?? '',
            t.audio?.setup ?? '',
            t.audio?.execution ?? '',
            t.audio?.transition ?? '',
          ],
        );

        this.cache.put(`${lang}:${t.exerciseId}`, {
          name: t.name,
          instructions: t.instructions,
          audioIntro: t.audio?.intro ?? '',
          audioSetup: t.audio?.setup ?? '',
          audioExecution: t.audio?.execution ?? '',
          audioTransition: t.audio?.transition ?? '',
        });

        count++;
      }
    });

    this.dbWriteCount += count;
    return count;
  }

  // ---- PRELOAD (warm cache for language) ----

  /**
   * Preload translations for a language into cache.
   * Deduplicated — safe to call multiple times.
   * Loads only up to CACHE_CAPACITY / 2 entries per language to leave room.
   */
  async preloadLanguage(lang: string): Promise<void> {
    if (lang === 'en') return; // English is canonical, no translations to load
    if (this.loadedLanguages.has(lang)) return; // Already loaded

    // Deduplicate concurrent calls
    const existing = this.loadingLanguages.get(lang);
    if (existing) return existing;

    const promise = this._doPreload(lang);
    this.loadingLanguages.set(lang, promise);

    try {
      await promise;
    } finally {
      this.loadingLanguages.delete(lang);
    }
  }

  private async _doPreload(lang: string): Promise<void> {
    const db = await getDatabase();
    const maxLoad = Math.floor(CACHE_CAPACITY / 2);

    const rows = await db.getAllAsync<{
      exercise_id: string;
      name: string;
      instructions: string;
      audio_intro: string;
      audio_setup: string;
      audio_execution: string;
      audio_transition: string;
    }>(
      `SELECT exercise_id, name, instructions, audio_intro, audio_setup, audio_execution, audio_transition
       FROM exercise_translations WHERE language = ? LIMIT ?`,
      [lang, maxLoad],
    );

    for (const row of rows) {
      this.cache.put(`${lang}:${row.exercise_id}`, {
        name: row.name,
        instructions: safeParseInstructions(row.instructions),
        audioIntro: row.audio_intro,
        audioSetup: row.audio_setup,
        audioExecution: row.audio_execution,
        audioTransition: row.audio_transition,
      });
    }

    this.loadedLanguages.add(lang);
  }

  /**
   * Check if a language has ANY translations in DB.
   */
  async hasLanguage(lang: string): Promise<boolean> {
    if (lang === 'en') return true;
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM exercise_translations WHERE language = ? LIMIT 1`,
      [lang],
    );
    return (row?.cnt ?? 0) > 0;
  }

  /**
   * Get translation count per language.
   */
  async getLanguageCounts(): Promise<Map<string, number>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ language: string; cnt: number }>(
      `SELECT language, COUNT(*) as cnt FROM exercise_translations GROUP BY language`,
    );
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.language, r.cnt);
    }
    return map;
  }

  // ---- CACHE MANAGEMENT ----

  /**
   * Invalidate cache for a specific language (forces re-read from DB on next access).
   */
  invalidateLanguage(lang: string): number {
    this.loadedLanguages.delete(lang);
    return this.cache.evictLanguage(lang);
  }

  /**
   * Full cache reset. Use after bulk DB operations.
   */
  reset(): void {
    this.cache.clear();
    this.loadedLanguages.clear();
    this.loadingLanguages.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.dbWriteCount = 0;
  }

  // ---- STATS ----

  getStats(): RegistryStats {
    const total = this.hitCount + this.missCount;
    return {
      cacheSize: this.cache.size,
      cacheCapacity: CACHE_CAPACITY,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      loadedLanguages: [...this.loadedLanguages],
      dbWriteCount: this.dbWriteCount,
    };
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

export const translationRegistry = new TranslationRegistryImpl();
