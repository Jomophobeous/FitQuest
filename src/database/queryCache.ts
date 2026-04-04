/**
 * Query Cache Stub
 * Simple pass-through cache that always executes the fetch function.
 * Full implementation will be rebuilt from FitQ backup.
 */

class QueryCache {
  async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, _ttlMs?: number): Promise<T> {
    return fetchFn();
  }

  invalidate(_key: string): void {
    // no-op
  }

  invalidatePrefix(_prefix: string): void {
    // no-op
  }

  clear(): void {
    // no-op
  }
}

export const queryCache = new QueryCache();
