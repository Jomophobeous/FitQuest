import { deleteAppStateByPrefix, getAppState, setAppState } from '../database/service';
import { getCachePolicy, type CacheDomain } from './cachePolicy';
import { logError, logEvent } from './telemetry';

interface CacheEnvelope<T> {
  value: T;
  updatedAt: number;
  expiresAt: number;
  version: 1;
}

export type CacheHitSource = 'memory' | 'storage' | 'miss';

const CACHE_PREFIX = 'cache.v1.';
const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function buildCacheKey(domain: CacheDomain, cacheId: string): string {
  return `${CACHE_PREFIX}${domain}.${cacheId}`;
}

function isFresh<T>(entry: CacheEnvelope<T>, now: number): boolean {
  return entry.expiresAt > now;
}

function parseEnvelope<T>(raw: string | null): CacheEnvelope<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (!('updatedAt' in parsed) || !('expiresAt' in parsed) || !('value' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getCached<T>(domain: CacheDomain, cacheId: string): Promise<{ value: T | null; source: CacheHitSource }> {
  const key = buildCacheKey(domain, cacheId);
  const now = Date.now();
  const inMemory = memoryCache.get(key) as CacheEnvelope<T> | undefined;

  if (inMemory && isFresh(inMemory, now)) {
    void logEvent('cache_hit', { domain, cacheId, source: 'memory' });
    return { value: inMemory.value, source: 'memory' };
  }

  if (inMemory && !isFresh(inMemory, now)) {
    memoryCache.delete(key);
  }

  try {
    const persisted = parseEnvelope<T>(await getAppState(key));
    if (persisted && isFresh(persisted, now)) {
      memoryCache.set(key, persisted as CacheEnvelope<unknown>);
      void logEvent('cache_hit', { domain, cacheId, source: 'storage' });
      return { value: persisted.value, source: 'storage' };
    }
  } catch (error) {
    void logError(error, { module: 'cacheStoreService.getCached', domain, cacheId });
  }

  void logEvent('cache_miss', { domain, cacheId });
  return { value: null, source: 'miss' };
}

export async function setCached<T>(
  domain: CacheDomain,
  cacheId: string,
  value: T,
  ttlOverrideMs?: number,
): Promise<void> {
  const policy = getCachePolicy(domain);
  const ttlMs = Math.max(1000, Math.floor(ttlOverrideMs ?? policy.ttlMs));
  const key = buildCacheKey(domain, cacheId);
  const now = Date.now();
  const envelope: CacheEnvelope<T> = {
    value,
    updatedAt: now,
    expiresAt: now + ttlMs,
    version: 1,
  };

  memoryCache.set(key, envelope as CacheEnvelope<unknown>);
  if (policy.persistent) {
    await setAppState(key, JSON.stringify(envelope));
  }

  void logEvent('cache_set', { domain, cacheId, ttlMs, persistent: policy.persistent });
}

export async function invalidateCached(domain: CacheDomain, cacheId: string): Promise<void> {
  const key = buildCacheKey(domain, cacheId);
  memoryCache.delete(key);
  await setAppState(key, JSON.stringify({ value: null, updatedAt: Date.now(), expiresAt: 0, version: 1 }));
  void logEvent('cache_invalidate', { domain, cacheId });
}

export async function invalidateCacheDomain(domain: CacheDomain): Promise<void> {
  const prefix = `${CACHE_PREFIX}${domain}.`;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
  await deleteAppStateByPrefix(prefix);
  void logEvent('cache_invalidate_domain', { domain });
}
