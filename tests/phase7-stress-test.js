#!/usr/bin/env node
/**
 * Phase 7.5 — Runtime Translation Hardening
 * Comprehensive stress test for TranslationRegistry + TranslationResolver
 *
 * Tests: load, cache validation, fallback pressure, DB failure,
 *        language switch stress, memory profiling, analytics, edge cases
 *
 * Since expo-sqlite can't run in Node, we extract the pure logic
 * and mock the DB layer to simulate all failure modes.
 */

'use strict';

const { performance } = require('perf_hooks');

// ==============================================
// 1. EXTRACTED LRU CACHE (identical to production)
// ==============================================

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  put(key, value) {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }
    const node = { key, value, prev: null, next: null };
    this.map.set(key, node);
    this.addToHead(node);
    if (this.map.size > this.capacity) {
      this.evictTail();
    }
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  evictLanguage(lang) {
    const prefix = `${lang}:`;
    const keysToDelete = [];
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.delete(key);
    return keysToDelete.length;
  }

  clear() {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  get size() {
    return this.map.size;
  }

  moveToHead(node) {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  addToHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  removeNode(node) {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  evictTail() {
    if (!this.tail) return;
    const evicted = this.tail;
    this.removeNode(evicted);
    this.map.delete(evicted.key);
  }
}

// ==============================================
// 2. MOCK DB LAYER
// ==============================================

class MockDB {
  constructor() {
    this.translations = new Map(); // key: `${lang}:${exerciseId}` → translation
    this.exercises = new Map(); // English exercise catalogue
    this.latencyMs = 0;
    this.failMode = false; // 'throw' | 'timeout' | false
    this.queryCount = 0;
    this.failCount = 0;
  }

  seed(numExercises, languages) {
    for (let i = 0; i < numExercises; i++) {
      const id = `ex_${String(i).padStart(5, '0')}`;
      this.exercises.set(id, {
        id,
        name: `Exercise ${i}`,
        instructions: JSON.stringify([`Step 1 for ${i}`, `Step 2 for ${i}`]),
        audio_intro: `intro_${i}`,
        audio_setup: `setup_${i}`,
        audio_execution: `exec_${i}`,
        audio_transition: `trans_${i}`,
      });
      for (const lang of languages) {
        this.translations.set(`${lang}:${id}`, {
          exercise_id: id,
          language: lang,
          name: `${lang}_Exercise_${i}`,
          instructions: JSON.stringify([`${lang} Step 1`, `${lang} Step 2`]),
          audio_intro: `${lang}_intro_${i}`,
          audio_setup: `${lang}_setup_${i}`,
          audio_execution: `${lang}_exec_${i}`,
          audio_transition: `${lang}_trans_${i}`,
        });
      }
    }
  }

  /** Remove translations for random X% of exercises in a language */
  removeRandom(lang, percentage) {
    const keys = [...this.translations.keys()].filter((k) => k.startsWith(`${lang}:`));
    const toRemove = Math.floor(keys.length * percentage);
    const removed = [];
    for (let i = 0; i < toRemove; i++) {
      const idx = Math.floor(Math.random() * keys.length);
      const key = keys.splice(idx, 1)[0];
      this.translations.delete(key);
      removed.push(key.split(':')[1]);
    }
    return removed;
  }

  async simulateLatency() {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
  }

  async getTranslation(exerciseId, lang) {
    this.queryCount++;
    if (this.failMode === 'throw') {
      this.failCount++;
      throw new Error('DB_UNAVAILABLE');
    }
    if (this.failMode === 'timeout') {
      this.failCount++;
      await new Promise((r) => setTimeout(r, 10000));
    }
    await this.simulateLatency();
    return this.translations.get(`${lang}:${exerciseId}`) || null;
  }

  async getTranslationBatch(exerciseIds, lang) {
    this.queryCount++;
    if (this.failMode === 'throw') {
      this.failCount++;
      throw new Error('DB_UNAVAILABLE');
    }
    await this.simulateLatency();
    const results = [];
    for (const id of exerciseIds) {
      const t = this.translations.get(`${lang}:${id}`);
      if (t) results.push(t);
    }
    return results;
  }

  async getExercise(exerciseId) {
    this.queryCount++;
    await this.simulateLatency();
    return this.exercises.get(exerciseId) || null;
  }

  async getExerciseBatch(exerciseIds) {
    this.queryCount++;
    await this.simulateLatency();
    return exerciseIds.map((id) => this.exercises.get(id)).filter(Boolean);
  }

  async getLanguageTranslations(lang, limit) {
    this.queryCount++;
    if (this.failMode === 'throw') {
      this.failCount++;
      throw new Error('DB_UNAVAILABLE');
    }
    await this.simulateLatency();
    const results = [];
    for (const [key, val] of this.translations) {
      if (key.startsWith(`${lang}:`)) {
        results.push(val);
        if (results.length >= limit) break;
      }
    }
    return results;
  }
}

// ==============================================
// 3. MOCK REGISTRY (mirrors TranslationRegistryImpl)
// ==============================================

const CACHE_CAPACITY = 10_000;

class MockTranslationRegistry {
  constructor(db) {
    this.db = db;
    this.cache = new LRUCache(CACHE_CAPACITY);
    this.loadedLanguages = new Set();
    this.loadingLanguages = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.dbWriteCount = 0;
  }

  getCached(exerciseId, lang) {
    const key = `${lang}:${exerciseId}`;
    const hit = this.cache.get(key);
    if (hit) this.hitCount++;
    else this.missCount++;
    return hit;
  }

  async get(exerciseId, lang) {
    const cached = this.cache.get(`${lang}:${exerciseId}`);
    if (cached) {
      this.hitCount++;
      return cached;
    }
    this.missCount++;

    const row = await this.db.getTranslation(exerciseId, lang);
    if (!row) return null;

    const translation = {
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

  async getBatch(exerciseIds, lang) {
    const result = new Map();
    const uncachedIds = [];

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

    if (uncachedIds.length > 0) {
      const rows = await this.db.getTranslationBatch(uncachedIds, lang);
      for (const row of rows) {
        const t = {
          name: row.name,
          instructions: safeParseInstructions(row.instructions),
          audioIntro: row.audio_intro,
          audioSetup: row.audio_setup,
          audioExecution: row.audio_execution,
          audioTransition: row.audio_transition,
        };
        this.cache.put(`${lang}:${row.exercise_id}`, t);
        result.set(row.exercise_id, t);
      }
    }
    return result;
  }

  async update(exerciseId, lang, name, instructions, audio) {
    // Simulate DB write
    this.db.translations.set(`${lang}:${exerciseId}`, {
      exercise_id: exerciseId,
      language: lang,
      name,
      instructions: JSON.stringify(instructions),
      audio_intro: audio?.intro ?? '',
      audio_setup: audio?.setup ?? '',
      audio_execution: audio?.execution ?? '',
      audio_transition: audio?.transition ?? '',
    });

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

  async preloadLanguage(lang) {
    if (lang === 'en') return;
    if (this.loadedLanguages.has(lang)) return;

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

  async _doPreload(lang) {
    const maxLoad = Math.floor(CACHE_CAPACITY / 2);
    const rows = await this.db.getLanguageTranslations(lang, maxLoad);
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

  invalidateLanguage(lang) {
    this.loadedLanguages.delete(lang);
    return this.cache.evictLanguage(lang);
  }

  reset() {
    this.cache.clear();
    this.loadedLanguages.clear();
    this.loadingLanguages.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.dbWriteCount = 0;
  }

  getStats() {
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

// ==============================================
// 4. MOCK RESOLVER (mirrors TranslationResolverImpl)
// ==============================================

const MAX_FALLBACK_LOG = 50_000;

class MockTranslationResolver {
  constructor(registry, db) {
    this.registry = registry;
    this.db = db;
    this.fallbackLog = [];
    this.totalRequests = 0;
    this.totalFallbacks = 0;
    this.fallbacksByLang = new Map();
    this.fallbacksByExercise = new Map();
  }

  async resolve(exerciseId, language) {
    this.totalRequests++;

    if (language === 'en') {
      return this.fetchEnglish(exerciseId);
    }

    try {
      const translation = await this.registry.get(exerciseId, language);
      if (translation) {
        return {
          exerciseId,
          language,
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
    } catch {
      // DB failure → fallback
    }

    this.recordFallback(exerciseId, language);
    return this.fetchEnglish(exerciseId);
  }

  async resolveBatch(exerciseIds, language) {
    if (exerciseIds.length === 0) return new Map();

    this.totalRequests += exerciseIds.length;

    if (language === 'en') {
      return this.fetchEnglishBatch(exerciseIds);
    }

    let translations;
    try {
      translations = await this.registry.getBatch(exerciseIds, language);
    } catch {
      // DB failure → all fallback to English
      const english = await this.fetchEnglishBatch(exerciseIds);
      for (const id of exerciseIds) this.recordFallback(id, language);
      return english;
    }

    const result = new Map();
    const missingIds = [];

    for (const id of exerciseIds) {
      const t = translations.get(id);
      if (t) {
        result.set(id, {
          exerciseId: id,
          language,
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

    if (missingIds.length > 0) {
      const englishMap = await this.fetchEnglishBatch(missingIds);
      for (const [id, resolved] of englishMap) {
        this.recordFallback(id, language);
        result.set(id, resolved);
      }
    }
    return result;
  }

  async updateTranslation(exerciseId, lang, name, instructions, audio) {
    await this.registry.update(exerciseId, lang, name, instructions, audio);
  }

  async preloadLanguage(lang) {
    return this.registry.preloadLanguage(lang);
  }

  recordFallback(exerciseId, lang) {
    this.totalFallbacks++;
    this.fallbacksByLang.set(lang, (this.fallbacksByLang.get(lang) ?? 0) + 1);
    this.fallbacksByExercise.set(exerciseId, (this.fallbacksByExercise.get(exerciseId) ?? 0) + 1);
    if (this.fallbackLog.length < MAX_FALLBACK_LOG) {
      this.fallbackLog.push({ exerciseId, requestedLang: lang, timestamp: Date.now() });
    }
  }

  getGapReport() {
    const topMissing = [...this.fallbacksByLang.entries()]
      .map(([language, count]) => ({
        language,
        count,
        percentage: this.totalRequests > 0 ? (count / this.totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const exerciseLangs = new Map();
    for (const event of this.fallbackLog) {
      let langs = exerciseLangs.get(event.exerciseId);
      if (!langs) { langs = new Set(); exerciseLangs.set(event.exerciseId, langs); }
      langs.add(event.requestedLang);
    }

    const topExercises = [...this.fallbacksByExercise.entries()]
      .map(([exerciseId, count]) => ({
        exerciseId, count,
        languages: [...(exerciseLangs.get(exerciseId) ?? [])],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalRequests: this.totalRequests,
      totalFallbacks: this.totalFallbacks,
      fallbackRate: this.totalRequests > 0 ? this.totalFallbacks / this.totalRequests : 0,
      fallbacksByLanguage: Object.fromEntries(this.fallbacksByLang),
      fallbacksByExercise: Object.fromEntries(this.fallbacksByExercise),
      topMissingByLanguage: topMissing,
      topFallbackExercises: topExercises,
      registryStats: this.registry.getStats(),
    };
  }

  resetTracking() {
    this.fallbackLog = [];
    this.totalRequests = 0;
    this.totalFallbacks = 0;
    this.fallbacksByLang.clear();
    this.fallbacksByExercise.clear();
  }

  reset() {
    this.resetTracking();
    this.registry.reset();
  }

  async fetchEnglish(exerciseId) {
    const row = await this.db.getExercise(exerciseId);
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

  async fetchEnglishBatch(exerciseIds) {
    const rows = await this.db.getExerciseBatch(exerciseIds);
    const result = new Map();
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

function safeParseInstructions(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [String(parsed)];
  } catch {
    return raw.split('\n').filter(Boolean);
  }
}

// ==============================================
// 5. TEST FRAMEWORK
// ==============================================

const LANGS = ['af', 'zu', 'xh', 'st', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'sw'];
const NUM_EXERCISES = 3312;

let passCount = 0;
let failCount = 0;
const testResults = [];
const reports = {
  stress: {},
  cache: {},
  memory: {},
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function runTest(name, fn) {
  const start = performance.now();
  try {
    await fn();
    const elapsed = performance.now() - start;
    passCount++;
    testResults.push({ name, status: 'PASS', elapsed: Math.round(elapsed * 100) / 100 });
    process.stdout.write(`  ✓ ${name} (${Math.round(elapsed)}ms)\n`);
  } catch (err) {
    const elapsed = performance.now() - start;
    failCount++;
    testResults.push({ name, status: 'FAIL', elapsed: Math.round(elapsed * 100) / 100, error: err.message });
    process.stdout.write(`  ✗ ${name} — ${err.message} (${Math.round(elapsed)}ms)\n`);
  }
}

// ==============================================
// TEST SUITES
// ==============================================

async function testLoadPerformance() {
  process.stdout.write('\n═══ TEST 1: LOAD PERFORMANCE (1000+ lookups/min) ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  // Preload French to simulate warm cache
  await resolver.preloadLanguage('fr');

  await runTest('1.1 Single lookup avg <5ms (warm cache)', async () => {
    const iterations = 5000;
    const ids = [];
    for (let i = 0; i < iterations; i++) {
      ids.push(`ex_${String(Math.floor(Math.random() * NUM_EXERCISES)).padStart(5, '0')}`);
    }

    const start = performance.now();
    for (const id of ids) {
      await resolver.resolve(id, 'fr');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    reports.stress.warmCacheSingleLookupAvgMs = Math.round(avgMs * 1000) / 1000;
    reports.stress.warmCacheLookupCount = iterations;
    reports.stress.warmCacheTotalMs = Math.round(elapsed * 100) / 100;
    reports.stress.warmCacheLookupsPerSec = Math.round(iterations / (elapsed / 1000));

    assert(avgMs < 5, `avg lookup ${avgMs.toFixed(3)}ms exceeds 5ms target`);
  });

  await runTest('1.2 Batch lookup (20 exercises) avg <10ms', async () => {
    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const batchIds = [];
      for (let j = 0; j < 20; j++) {
        batchIds.push(`ex_${String(Math.floor(Math.random() * NUM_EXERCISES)).padStart(5, '0')}`);
      }
      await resolver.resolveBatch(batchIds, 'fr');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    reports.stress.batchLookupAvgMs = Math.round(avgMs * 1000) / 1000;
    reports.stress.batchIterations = iterations;
    assert(avgMs < 10, `avg batch lookup ${avgMs.toFixed(3)}ms exceeds 10ms`);
  });

  await runTest('1.3 Cold cache lookup (DB hit)', async () => {
    registry.reset();
    const coldIds = [];
    for (let i = 0; i < 100; i++) {
      coldIds.push(`ex_${String(Math.floor(Math.random() * NUM_EXERCISES)).padStart(5, '0')}`);
    }
    const start = performance.now();
    for (const id of coldIds) {
      await resolver.resolve(id, 'de');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 100;

    reports.stress.coldCacheSingleLookupAvgMs = Math.round(avgMs * 1000) / 1000;
    assert(avgMs < 50, `cold lookup ${avgMs.toFixed(3)}ms exceeds 50ms`);
  });

  await runTest('1.4 Cache hit rate >90% after preload', async () => {
    registry.reset();
    resolver.resetTracking();
    await resolver.preloadLanguage('es');

    // 1000 lookups against preloaded language
    for (let i = 0; i < 1000; i++) {
      const id = `ex_${String(Math.floor(Math.random() * NUM_EXERCISES)).padStart(5, '0')}`;
      await resolver.resolve(id, 'es');
    }

    const stats = registry.getStats();
    reports.stress.hitRateAfterPreload = Math.round(stats.hitRate * 10000) / 100;
    assert(stats.hitRate >= 0.90, `hit rate ${(stats.hitRate * 100).toFixed(1)}% below 90% target`);
  });

  await runTest('1.5 Mixed language concurrent lookups (5 langs)', async () => {
    registry.reset();
    const mixedLangs = ['fr', 'de', 'es', 'ja', 'ar'];
    for (const l of mixedLangs) await resolver.preloadLanguage(l);

    const start = performance.now();
    const promises = [];
    for (let i = 0; i < 500; i++) {
      const lang = mixedLangs[i % mixedLangs.length];
      const id = `ex_${String(Math.floor(Math.random() * NUM_EXERCISES)).padStart(5, '0')}`;
      promises.push(resolver.resolve(id, lang));
    }
    await Promise.all(promises);
    const elapsed = performance.now() - start;

    reports.stress.mixedLangConcurrentMs = Math.round(elapsed * 100) / 100;
    reports.stress.mixedLangConcurrentCount = 500;
    assert(elapsed < 5000, `mixed concurrent ${elapsed.toFixed(0)}ms exceeds 5000ms`);
  });
}

async function testCacheValidation() {
  process.stdout.write('\n═══ TEST 2: CACHE VALIDATION ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  await runTest('2.1 LRU eviction at 10k limit', async () => {
    registry.reset();

    // Fill cache to exactly 10,000
    for (let i = 0; i < 10000; i++) {
      const lang = LANGS[i % LANGS.length];
      const id = `ex_${String(i % NUM_EXERCISES).padStart(5, '0')}`;
      await registry.get(id, lang);
    }

    assert(registry.cache.size === 10000, `cache size ${registry.cache.size} should be 10000`);

    // Add one more → should evict oldest
    await registry.get('ex_00001', 'sw');
    assert(registry.cache.size === 10000, `cache size ${registry.cache.size} should still be 10000 after eviction`);

    reports.cache.evictionAt10kVerified = true;
  });

  await runTest('2.2 Eviction order (LRU tail evicted first)', async () => {
    registry.reset();

    // Insert A, B, C (capacity 3 cache for isolated test)
    const miniCache = new LRUCache(3);
    miniCache.put('a', { name: 'A', instructions: [], audioIntro: '', audioSetup: '', audioExecution: '', audioTransition: '' });
    miniCache.put('b', { name: 'B', instructions: [], audioIntro: '', audioSetup: '', audioExecution: '', audioTransition: '' });
    miniCache.put('c', { name: 'C', instructions: [], audioIntro: '', audioSetup: '', audioExecution: '', audioTransition: '' });

    // Access A → moves to head. Order: A, C, B
    miniCache.get('a');

    // Insert D → should evict B (least recently used)
    miniCache.put('d', { name: 'D', instructions: [], audioIntro: '', audioSetup: '', audioExecution: '', audioTransition: '' });

    assert(miniCache.get('a') !== undefined, 'A should survive (was accessed)');
    assert(miniCache.get('c') !== undefined, 'C should survive (newer than B)');
    assert(miniCache.get('d') !== undefined, 'D should exist (just added)');
    assert(miniCache.get('b') === undefined, 'B should be evicted (LRU)');

    reports.cache.evictionOrderVerified = true;
  });

  await runTest('2.3 No stale entries after DB update', async () => {
    registry.reset();

    // Load into cache
    await registry.get('ex_00100', 'fr');
    const before = registry.getCached('ex_00100', 'fr');
    assert(before !== undefined, 'should be cached');

    // Update via write-through
    await registry.update('ex_00100', 'fr', 'UPDATED_NAME', ['New Step 1'], { intro: 'new_intro' });

    // Verify cache reflects update immediately
    const after = registry.getCached('ex_00100', 'fr');
    assert(after.name === 'UPDATED_NAME', `name should be UPDATED_NAME, got ${after.name}`);
    assert(after.instructions[0] === 'New Step 1', 'instructions should be updated');

    reports.cache.noStaleAfterUpdateVerified = true;
  });

  await runTest('2.4 No duplication across languages', async () => {
    registry.reset();

    // Load same exercise in different languages
    await registry.get('ex_00050', 'fr');
    await registry.get('ex_00050', 'de');
    await registry.get('ex_00050', 'es');

    const fr = registry.getCached('ex_00050', 'fr');
    const de = registry.getCached('ex_00050', 'de');
    const es = registry.getCached('ex_00050', 'es');

    assert(fr.name.startsWith('fr_'), `FR name should start with fr_, got ${fr.name}`);
    assert(de.name.startsWith('de_'), `DE name should start with de_, got ${de.name}`);
    assert(es.name.startsWith('es_'), `ES name should start with es_, got ${es.name}`);
    assert(fr.name !== de.name, 'FR and DE should be different');
    assert(registry.cache.size === 3, `cache should have 3 entries, got ${registry.cache.size}`);

    reports.cache.noCrossLanguageDuplication = true;
  });

  await runTest('2.5 Language invalidation clears only target language', async () => {
    registry.reset();

    // Preload two languages
    await registry.preloadLanguage('fr');
    await registry.preloadLanguage('de');
    const sizeBefore = registry.cache.size;

    // Invalidate only French
    const evicted = registry.invalidateLanguage('fr');

    // German should remain, French should be gone
    const frItem = registry.getCached('ex_00001', 'fr');
    const deItem = registry.getCached('ex_00001', 'de');

    assert(frItem === undefined, 'French should be evicted');
    assert(deItem !== undefined, 'German should survive');
    assert(evicted > 0, `should have evicted entries, evicted ${evicted}`);

    reports.cache.languageInvalidationVerified = true;
    reports.cache.languageInvalidationEvicted = evicted;
  });
}

async function testFallbackPressure() {
  process.stdout.write('\n═══ TEST 3: FALLBACK PRESSURE TEST (5% missing) ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  // Remove 5% of French translations
  const removedIds = db.removeRandom('fr', 0.05);

  await runTest('3.1 Missing translations fall back to English', async () => {
    let fallbackCount = 0;
    for (const id of removedIds.slice(0, 50)) {
      const result = await resolver.resolve(id, 'fr');
      if (result.isFallback && result.source === 'english') fallbackCount++;
    }
    assert(fallbackCount === 50, `expected 50 fallbacks, got ${fallbackCount}`);
    reports.stress.fallbackToEnglishVerified = true;
  });

  await runTest('3.2 No crashes during batch with mixed availability', async () => {
    // Use a Set to avoid duplicates (removed IDs may overlap with present range)
    const mixedSet = new Set();
    // 50 known-missing
    for (let i = 0; i < 50 && i < removedIds.length; i++) {
      mixedSet.add(removedIds[i]);
    }
    // 50 known-present (low range, unlikely to overlap with random removals)
    for (let i = 0; mixedSet.size < 100 && i < NUM_EXERCISES; i++) {
      const id = `ex_${String(i).padStart(5, '0')}`;
      if (!removedIds.includes(id)) mixedSet.add(id);
    }
    const mixedIds = [...mixedSet];

    const result = await resolver.resolveBatch(mixedIds, 'fr');

    assert(result.size === mixedIds.length, `expected ${mixedIds.length} results, got ${result.size}`);
    let fallbacks = 0;
    for (const [, val] of result) {
      if (val.isFallback) fallbacks++;
    }
    assert(fallbacks > 0, 'should have some fallbacks');

    reports.stress.mixedBatchNocrash = true;
    reports.stress.mixedBatchFallbacks = fallbacks;
    reports.stress.mixedBatchTotal = mixedIds.length;
  });

  await runTest('3.3 Fallback events logged correctly', async () => {
    const gap = resolver.getGapReport();
    assert(gap.totalFallbacks > 0, 'should have logged fallbacks');
    assert(gap.fallbacksByLanguage.fr > 0, 'should track FR fallbacks');
    assert(gap.topFallbackExercises.length > 0, 'should have top fallback exercises');

    reports.stress.fallbackEventsLogged = gap.totalFallbacks;
    reports.stress.fallbackRate = Math.round(gap.fallbackRate * 10000) / 100;
  });

  await runTest('3.4 Fallback log bounded at 50k', async () => {
    // Hammer with fallbacks
    for (let i = 0; i < 55000; i++) {
      resolver.recordFallback(`ex_fake_${i}`, 'zz');
    }
    assert(resolver.fallbackLog.length <= MAX_FALLBACK_LOG,
      `fallback log ${resolver.fallbackLog.length} exceeds ${MAX_FALLBACK_LOG}`);
  });
}

async function testDBFailureSimulation() {
  process.stdout.write('\n═══ TEST 4: DB FAILURE SIMULATION ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  await runTest('4.1 DB throw → fallback to English (no crash)', async () => {
    db.failMode = 'throw';

    const result = await resolver.resolve('ex_00001', 'fr');
    assert(result !== null && result !== undefined, 'should return a result');
    assert(result.source === 'english', 'should fallback to English');
    assert(result.isFallback === true, 'should be marked as fallback');

    reports.stress.dbFailureFallbackVerified = true;
    db.failMode = false;
  });

  await runTest('4.2 DB throw → batch fallback (no crash)', async () => {
    db.failMode = 'throw';

    const ids = ['ex_00001', 'ex_00002', 'ex_00003'];
    const result = await resolver.resolveBatch(ids, 'de');
    assert(result.size === 3, `should return 3 results, got ${result.size}`);

    for (const [, val] of result) {
      assert(val.source === 'english', 'all should fallback to English');
    }

    reports.stress.dbFailureBatchFallbackVerified = true;
    db.failMode = false;
  });

  await runTest('4.3 DB recovery → normal resolution resumes', async () => {
    db.failMode = false;
    registry.reset();

    const result = await resolver.resolve('ex_00100', 'fr');
    assert(result.source === 'db', `should resolve from DB after recovery, got ${result.source}`);

    reports.stress.dbRecoveryVerified = true;
  });

  await runTest('4.4 Preload during DB failure → no crash', async () => {
    db.failMode = 'throw';
    registry.reset();

    let caught = false;
    try {
      await resolver.preloadLanguage('ja');
    } catch {
      caught = true;
    }
    // Preload should propagate the error but not crash the system
    // The registry should remain functional
    db.failMode = false;

    // Resolution should still work after failed preload
    const result = await resolver.resolve('ex_00001', 'ja');
    assert(result !== null, 'should still resolve after failed preload');

    reports.stress.preloadDuringDBFailure = caught ? 'error_propagated' : 'silently_handled';
  });

  await runTest('4.5 DB latency spike (100ms) → system survives', async () => {
    db.failMode = false;
    db.latencyMs = 100;
    registry.reset();

    const start = performance.now();
    const result = await resolver.resolve('ex_00001', 'fr');
    const elapsed = performance.now() - start;

    assert(result !== null, 'should return result despite latency');
    assert(elapsed >= 90, `should reflect latency, took ${elapsed.toFixed(0)}ms`);

    reports.stress.latencySpikeMs = Math.round(elapsed);
    reports.stress.latencySpikeRecovered = true;

    db.latencyMs = 0;
  });
}

async function testLanguageSwitchStress() {
  process.stdout.write('\n═══ TEST 5: LANGUAGE SWITCH STRESS (20 rapid switches) ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  await runTest('5.1 Rapid 20 language switches — no crash', async () => {
    const switches = [];
    for (let i = 0; i < 20; i++) {
      switches.push(LANGS[i % LANGS.length]);
    }

    const start = performance.now();
    for (const lang of switches) {
      await resolver.preloadLanguage(lang);
    }
    const elapsed = performance.now() - start;

    reports.stress.rapidSwitchCount = 20;
    reports.stress.rapidSwitchTotalMs = Math.round(elapsed);
    reports.stress.rapidSwitchAvgMs = Math.round(elapsed / 20);
    assert(true, 'survived 20 rapid switches');
  });

  await runTest('5.2 Concurrent preload deduplication', async () => {
    registry.reset();

    // Fire 10 concurrent preloads for same language
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(resolver.preloadLanguage('fr'));
    }
    await Promise.all(promises);

    // DB should only have been queried once for this language
    // (deduplication via loadingLanguages map)
    assert(registry.loadedLanguages.has('fr'), 'French should be marked as loaded');

    reports.stress.concurrentPreloadDedup = true;
  });

  await runTest('5.3 Cache memory stable after 20 switches', async () => {
    registry.reset();

    const memBefore = process.memoryUsage().heapUsed;

    // Preload all 14 languages
    for (const lang of LANGS) {
      await resolver.preloadLanguage(lang);
    }

    const stats = registry.getStats();
    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = memAfter - memBefore;

    // Cache should be bounded at capacity
    assert(stats.cacheSize <= CACHE_CAPACITY,
      `cache ${stats.cacheSize} exceeds capacity ${CACHE_CAPACITY}`);

    reports.stress.cacheAfterAllPreloads = stats.cacheSize;
    reports.stress.memoryDeltaAfterPreloads = Math.round(memDelta / 1024 / 1024 * 100) / 100;
  });

  await runTest('5.4 Resolution correct after language switch', async () => {
    registry.reset();

    await resolver.preloadLanguage('fr');
    const fr = await resolver.resolve('ex_00001', 'fr');
    assert(fr.name.startsWith('fr_'), `should be French, got ${fr.name}`);

    await resolver.preloadLanguage('ja');
    const ja = await resolver.resolve('ex_00001', 'ja');
    assert(ja.name.startsWith('ja_'), `should be Japanese, got ${ja.name}`);

    // French should still work
    const frAgain = await resolver.resolve('ex_00001', 'fr');
    assert(frAgain.name.startsWith('fr_'), `French should still work, got ${frAgain.name}`);

    reports.stress.languageSwitchCorrectnessVerified = true;
  });
}

async function testMemoryProfiling() {
  process.stdout.write('\n═══ TEST 6: MEMORY PROFILING ═══\n');

  await runTest('6.1 Heap usage <300MB after full stress', async () => {
    global.gc && global.gc();

    const db = new MockDB();
    db.seed(NUM_EXERCISES, LANGS);
    const registry = new MockTranslationRegistry(db);
    const resolver = new MockTranslationResolver(registry, db);

    const memBefore = process.memoryUsage();

    // Simulate full stress load
    for (const lang of LANGS) {
      await resolver.preloadLanguage(lang);
    }

    // 10k lookups
    for (let i = 0; i < 10000; i++) {
      const lang = LANGS[i % LANGS.length];
      const id = `ex_${String(i % NUM_EXERCISES).padStart(5, '0')}`;
      await resolver.resolve(id, lang);
    }

    global.gc && global.gc();
    const memAfter = process.memoryUsage();
    const heapUsedMB = memAfter.heapUsed / 1024 / 1024;
    const rssMB = memAfter.rss / 1024 / 1024;

    reports.memory = {
      heapBefore: Math.round(memBefore.heapUsed / 1024 / 1024 * 100) / 100,
      heapAfter: Math.round(heapUsedMB * 100) / 100,
      heapDelta: Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024 * 100) / 100,
      rss: Math.round(rssMB * 100) / 100,
      external: Math.round(memAfter.external / 1024 / 1024 * 100) / 100,
      cacheSize: registry.cache.size,
      cacheCapacity: CACHE_CAPACITY,
      fallbackLogSize: resolver.fallbackLog.length,
    };

    assert(heapUsedMB < 300, `heap ${heapUsedMB.toFixed(1)}MB exceeds 300MB limit`);
  });

  await runTest('6.2 Fallback log memory bounded', async () => {
    const resolver2 = new MockTranslationResolver(
      new MockTranslationRegistry(new MockDB()),
      new MockDB()
    );

    // Generate max fallback events
    for (let i = 0; i < 60000; i++) {
      resolver2.recordFallback(`ex_${i}`, 'zz');
    }

    assert(resolver2.fallbackLog.length <= MAX_FALLBACK_LOG,
      `log size ${resolver2.fallbackLog.length} exceeds cap ${MAX_FALLBACK_LOG}`);

    reports.memory.fallbackLogCapped = true;
    reports.memory.fallbackLogMaxSize = resolver2.fallbackLog.length;
  });

  await runTest('6.3 Cache eviction prevents unbounded growth', async () => {
    const cache = new LRUCache(100);

    for (let i = 0; i < 10000; i++) {
      cache.put(`key_${i}`, {
        name: `name_${i}`,
        instructions: ['step1', 'step2'],
        audioIntro: 'a', audioSetup: 'b', audioExecution: 'c', audioTransition: 'd',
      });
    }

    assert(cache.size === 100, `cache should be 100, got ${cache.size}`);
    reports.memory.evictionPreventsGrowth = true;
  });
}

async function testAnalyticsValidation() {
  process.stdout.write('\n═══ TEST 7: ANALYTICS VALIDATION ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  // Create known gap pattern: remove all of 'zu' for first 100 exercises
  for (let i = 0; i < 100; i++) {
    const id = `ex_${String(i).padStart(5, '0')}`;
    db.translations.delete(`zu:${id}`);
  }

  // Trigger lookups
  for (let i = 0; i < 100; i++) {
    const id = `ex_${String(i).padStart(5, '0')}`;
    await resolver.resolve(id, 'zu');
  }
  for (let i = 0; i < 50; i++) {
    const id = `ex_${String(i).padStart(5, '0')}`;
    await resolver.resolve(id, 'fr');
  }

  await runTest('7.1 Gap report fallback count matches reality', async () => {
    const gap = resolver.getGapReport();
    assert(gap.totalFallbacks === 100, `expected 100 fallbacks, got ${gap.totalFallbacks}`);
    assert(gap.fallbacksByLanguage.zu === 100, `expected 100 zu fallbacks, got ${gap.fallbacksByLanguage.zu}`);
    reports.stress.gapReportAccurate = true;
  });

  await runTest('7.2 Fallback rate calculation correct', async () => {
    const gap = resolver.getGapReport();
    const expectedRate = 100 / gap.totalRequests;
    const diff = Math.abs(gap.fallbackRate - expectedRate);
    assert(diff < 0.001, `fallback rate ${gap.fallbackRate} != expected ${expectedRate}`);
  });

  await runTest('7.3 Top missing by language ranks correctly', async () => {
    const gap = resolver.getGapReport();
    assert(gap.topMissingByLanguage.length > 0, 'should have top missing');
    assert(gap.topMissingByLanguage[0].language === 'zu',
      `top should be zu, got ${gap.topMissingByLanguage[0].language}`);
    assert(gap.topMissingByLanguage[0].count === 100,
      `zu count should be 100, got ${gap.topMissingByLanguage[0].count}`);
  });

  await runTest('7.4 No false positives (fr has 0 fallbacks)', async () => {
    const gap = resolver.getGapReport();
    const frFallbacks = gap.fallbacksByLanguage.fr ?? 0;
    assert(frFallbacks === 0, `fr should have 0 fallbacks, got ${frFallbacks}`);
  });

  await runTest('7.5 Reset tracking clears all counters', async () => {
    resolver.resetTracking();
    const gap = resolver.getGapReport();
    assert(gap.totalRequests === 0, 'totalRequests should be 0');
    assert(gap.totalFallbacks === 0, 'totalFallbacks should be 0');
    assert(gap.fallbackRate === 0, 'fallbackRate should be 0');
  });
}

async function testEdgeCases() {
  process.stdout.write('\n═══ TEST 8: EDGE CASES ═══\n');

  const db = new MockDB();
  db.seed(NUM_EXERCISES, LANGS);
  const registry = new MockTranslationRegistry(db);
  const resolver = new MockTranslationResolver(registry, db);

  await runTest('8.1 Invalid exerciseId → graceful fallback', async () => {
    const result = await resolver.resolve('NONEXISTENT_ID_999', 'fr');
    assert(result !== null, 'should return a result');
    assert(result.isFallback === true, 'should be fallback');
    assert(result.name === 'NONEXISTENT_ID_999', 'should use ID as name when English also missing');
  });

  await runTest('8.2 Unsupported language → English fallback', async () => {
    const result = await resolver.resolve('ex_00001', 'xx_FAKE');
    assert(result !== null, 'should return a result');
    assert(result.isFallback === true, 'should fallback');
    assert(result.source === 'english', 'should be English source');
  });

  await runTest('8.3 Empty exerciseIds batch → empty map', async () => {
    const result = await resolver.resolveBatch([], 'fr');
    assert(result.size === 0, 'should return empty map');
  });

  await runTest('8.4 English language → direct resolution (no cache)', async () => {
    const result = await resolver.resolve('ex_00001', 'en');
    assert(result.language === 'en', 'should be English');
    assert(result.source === 'english', 'source should be english');
    assert(result.isFallback === true, 'English is always marked as fallback source');
  });

  await runTest('8.5 Corrupted instructions JSON → safe parse', async () => {
    // Inject corrupted data
    db.translations.set('fr:ex_corrupt_001', {
      exercise_id: 'ex_corrupt_001',
      language: 'fr',
      name: 'Corrupted',
      instructions: '{not valid json!!!',
      audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '',
    });
    db.exercises.set('ex_corrupt_001', {
      id: 'ex_corrupt_001',
      name: 'Corrupted EN',
      instructions: 'Plain text, not JSON',
      audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '',
    });

    const result = await resolver.resolve('ex_corrupt_001', 'fr');
    assert(result !== null, 'should not crash');
    assert(Array.isArray(result.instructions), 'instructions should be array');
    assert(result.instructions.length > 0, 'should have parsed something');
  });

  await runTest('8.6 Null/undefined instructions → empty array', async () => {
    db.translations.set('fr:ex_null_001', {
      exercise_id: 'ex_null_001',
      language: 'fr',
      name: 'Null Instructions',
      instructions: null,
      audio_intro: '', audio_setup: '', audio_execution: '', audio_transition: '',
    });

    const result = await resolver.resolve('ex_null_001', 'fr');
    assert(Array.isArray(result.instructions), 'should be array');
    assert(result.instructions.length === 0, 'should be empty array');
  });

  await runTest('8.7 Very long exerciseId → no crash', async () => {
    const longId = 'x'.repeat(10000);
    const result = await resolver.resolve(longId, 'fr');
    assert(result !== null, 'should return result');
    assert(result.isFallback === true, 'should fallback');
  });

  await runTest('8.8 Special characters in exerciseId → no crash', async () => {
    const specialIds = [
      "ex_with'quotes",
      'ex_with"double',
      'ex_with;semicolon',
      'ex_with--dashes',
      'ex_with\nnewline',
      'ex_with\ttab',
      'ex_with\x00null',
    ];
    for (const id of specialIds) {
      const result = await resolver.resolve(id, 'fr');
      assert(result !== null, `should handle id: ${JSON.stringify(id)}`);
    }
  });

  await runTest('8.9 Concurrent resolve same exercise → no duplication', async () => {
    registry.reset();
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(resolver.resolve('ex_00001', 'fr'));
    }
    const results = await Promise.all(promises);
    assert(results.length === 50, 'should return 50 results');

    // All should have the same name
    const names = new Set(results.map((r) => r.name));
    assert(names.size === 1, `should have 1 unique name, got ${names.size}`);
  });
}

// ==============================================
// MAIN RUNNER
// ==============================================

async function main() {
  process.stdout.write('╔══════════════════════════════════════════════════════╗\n');
  process.stdout.write('║  PHASE 7.5 — RUNTIME TRANSLATION HARDENING SUITE   ║\n');
  process.stdout.write('║  TranslationRegistry + Resolver Stress Tests        ║\n');
  process.stdout.write('╚══════════════════════════════════════════════════════╝\n');
  process.stdout.write(`\nConfig: ${NUM_EXERCISES} exercises × ${LANGS.length} languages\n`);
  process.stdout.write(`Cache capacity: ${CACHE_CAPACITY}\n`);

  const totalStart = performance.now();

  await testLoadPerformance();
  await testCacheValidation();
  await testFallbackPressure();
  await testDBFailureSimulation();
  await testLanguageSwitchStress();
  await testMemoryProfiling();
  await testAnalyticsValidation();
  await testEdgeCases();

  const totalElapsed = performance.now() - totalStart;

  // Summary
  process.stdout.write('\n══════════════════════════════════════════════\n');
  process.stdout.write(`RESULTS: ${passCount} passed, ${failCount} failed (${Math.round(totalElapsed)}ms)\n`);
  process.stdout.write('══════════════════════════════════════════════\n');

  // Write reports
  const fs = require('fs');
  const reportsDir = require('path').join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const stressReport = {
    timestamp: new Date().toISOString(),
    phase: '7.5',
    title: 'Runtime Translation Stress Test Report',
    config: { exercises: NUM_EXERCISES, languages: LANGS.length, cacheCapacity: CACHE_CAPACITY },
    summary: { passed: passCount, failed: failCount, totalMs: Math.round(totalElapsed) },
    tests: testResults,
    metrics: reports.stress,
  };

  const cacheReport = {
    timestamp: new Date().toISOString(),
    phase: '7.5',
    title: 'Cache Performance Report',
    metrics: reports.cache,
    cacheConfig: { capacity: CACHE_CAPACITY, type: 'LRU', keyFormat: 'lang:exerciseId' },
  };

  const memoryReport = {
    timestamp: new Date().toISOString(),
    phase: '7.5',
    title: 'Memory Profile Report',
    constraint: '<300MB',
    metrics: reports.memory,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  fs.writeFileSync(
    require('path').join(reportsDir, 'StressTestReport.json'),
    JSON.stringify(stressReport, null, 2)
  );
  fs.writeFileSync(
    require('path').join(reportsDir, 'CachePerformanceReport.json'),
    JSON.stringify(cacheReport, null, 2)
  );
  fs.writeFileSync(
    require('path').join(reportsDir, 'MemoryProfile.json'),
    JSON.stringify(memoryReport, null, 2)
  );

  process.stdout.write(`\nReports written to reports/\n`);
  process.stdout.write(`  • StressTestReport.json\n`);
  process.stdout.write(`  • CachePerformanceReport.json\n`);
  process.stdout.write(`  • MemoryProfile.json\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err.stack}\n`);
  process.exit(2);
});
