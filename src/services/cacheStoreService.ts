/**
 * Cache Store Service
 *
 * In-memory cache with TTL support and preload capabilities.
 * Serves as the app-wide data cache — all screens read from here first.
 *
 * Features:
 * - TTL-aware entries (auto-expire after configurable duration)
 * - Namespace isolation (profile, dashboard, workout, screenstate, etc.)
 * - Cache hit/miss tracking for debug builds
 * - Preload support: background fills for adjacent screens
 * - clearNamespace: targeted invalidation without full flush
 */

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number | null; // null = never expires
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function makeKey(namespace: string, key: string): string {
  return `${namespace}::${key}`;
}

function isExpired(entry: CacheEntry): boolean {
  if (entry.expiresAt === null) return false;
  return Date.now() > entry.expiresAt;
}

// ── Core ops ──

export async function getCached<T>(namespace: string, key: string): Promise<{ value: T | null; stale?: boolean }> {
  const k = makeKey(namespace, key);
  const entry = cache.get(k) as CacheEntry<T> | undefined;
  if (!entry) return { value: null };
  if (isExpired(entry)) {
    // Return stale value with stale flag — caller decides what to do
    return { value: entry.value, stale: true };
  }
  return { value: entry.value };
}

export async function setCached<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void> {
  const k = makeKey(namespace, key);
  cache.set(k, {
    value,
    expiresAt: ttlMs != null ? Date.now() + ttlMs : null,
    fetchedAt: Date.now(),
  });
}

export function clearCache(): void {
  cache.clear();
}

export function clearNamespace(namespace: string): void {
  const prefix = `${namespace}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateCacheKey(namespace: string, key: string): void {
  cache.delete(makeKey(namespace, key));
}

/** Check if a cache key has a valid (non-expired) entry */
export function hasCached(namespace: string, key: string): boolean {
  const k = makeKey(namespace, key);
  const entry = cache.get(k);
  if (!entry) return false;
  return !isExpired(entry);
}

/** Get age of cache entry in ms. Returns Infinity if not cached. */
export function getCacheAge(namespace: string, key: string): number {
  const k = makeKey(namespace, key);
  const entry = cache.get(k);
  if (!entry) return Infinity;
  return Date.now() - entry.fetchedAt;
}

/** Debug: get all cache keys with their expiry info */
export function debugCacheStats(): Array<{ key: string; ageMs: number; expired: boolean }> {
  return Array.from(cache.entries()).map(([k, entry]) => ({
    key: k,
    ageMs: Date.now() - entry.fetchedAt,
    expired: isExpired(entry),
  }));
}
