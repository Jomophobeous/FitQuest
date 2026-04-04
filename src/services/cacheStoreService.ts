/**
 * Cache Store Service Stub
 * Simple in-memory cache — no persistence.
 */

const cache = new Map<string, unknown>();

function cacheKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

export async function getCached<T>(namespace: string, key: string): Promise<{ value: T | null }> {
  const k = cacheKey(namespace, key);
  const v = cache.get(k);
  return { value: v != null ? (v as T) : null };
}

export async function setCached<T>(namespace: string, key: string, value: T): Promise<void> {
  cache.set(cacheKey(namespace, key), value);
}

export function clearCache(): void {
  cache.clear();
}
