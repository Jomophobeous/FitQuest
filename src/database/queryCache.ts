/**
 * FitQuest Query Cache
 * In-memory cache layer for frequently accessed SQLite queries.
 * Eliminates redundant disk reads across screen mounts/re-renders.
 *
 * Cache keys are domain-scoped (e.g. 'exercises:all', 'profile:user_local_001').
 * TTL-based expiration with manual invalidation via invalidate() / invalidatePrefix().
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30 seconds

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a cached value, or execute the fetcher and cache the result.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.data as T;
    }
    const data = await fetcher();
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }

  /**
   * Invalidate a specific cache key.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix (e.g. 'exercises:' clears all exercise caches).
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats (for diagnostics).
   */
  stats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export const queryCache = new QueryCache();
