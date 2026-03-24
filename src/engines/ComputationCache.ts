/**
 * ENGINE — Computation Cache
 *
 * In-memory TTL cache for expensive engine results.
 * Prevents recomputation on re-renders and screen transitions.
 *
 * Used by:
 * - UserStateEngine (getUserState has its own 2min cache)
 * - Workout generation (cache last workout + explanation)
 * - Progression profile (cache 5min)
 * - Failure pattern (cache 5min)
 * - Simulation report (cache 2min)
 *
 * All caches invalidate after TTL or on explicit `clearAll()`.
 */

// ============================================
// TYPES
// ============================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ============================================
// STORE
// ============================================

const store = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// ============================================
// PUBLIC API
// ============================================

/**
 * Get a cached value, or compute and cache it if missing/expired.
 *
 * @param key - Cache key (e.g., 'progressionProfile:user_local_001')
 * @param compute - Async function to produce the value
 * @param ttlMs - Time-to-live in milliseconds (default: 5 min)
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const existing = store.get(key);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.value as T;
  }

  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * Get a cached value synchronously. Returns null if missing or expired.
 */
export function getCached<T>(key: string): T | null {
  const existing = store.get(key);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.value as T;
  }
  return null;
}

/**
 * Set a cached value manually.
 */
export function setCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate a single cache entry.
 */
export function invalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all entries matching a prefix.
 * e.g., `invalidatePrefix('progression:')` clears all progression caches.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear all cached data. Call after:
 * - Workout completion
 * - Profile changes
 * - Subscription state changes
 */
export function clearAll(): void {
  store.clear();
}

/**
 * Get current cache size (number of entries).
 */
export function cacheSize(): number {
  return store.size;
}
