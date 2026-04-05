/**
 * useScreenState — Normalized screen state management hook.
 *
 * Provides a consistent { status, data, error } pattern for all data screens.
 * Eliminates per-screen ad-hoc loading/error state boilerplate.
 * Integrates with cacheStoreService for cache-first loading.
 *
 * Architecture:
 *   - status: 'idle' | 'loading' | 'success' | 'error'
 *   - data: T (null until loaded)
 *   - error: Error | null
 *   - refresh: () triggers re-fetch (bypasses cache)
 *   - setData: optimistic update without re-fetch
 *
 * Usage:
 *   const { status, data, error, refresh } = useScreenState<ProfileData>({
 *     cacheKey: 'profile',
 *     fetch: () => loadProfileFromDB(),
 *     cacheTTL: 60_000, // 60s
 *   });
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getCached, setCached } from '../services/cacheStoreService';
import { useMountedGuard } from './useMountedGuard';

export type ScreenStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ScreenStateResult<T> {
  status: ScreenStatus;
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** Re-fetch, bypassing cache */
  refresh: () => void;
  /** Optimistically update data without re-fetch */
  setData: (updater: (prev: T | null) => T | null) => void;
}

interface UseScreenStateOptions<T> {
  /** Cache namespace + key. Omit to skip caching. */
  cacheKey?: string;
  /** Async function that fetches data */
  fetch: () => Promise<T>;
  /** Cache TTL in ms. Default: 60_000 (1 min) */
  cacheTTL?: number;
  /** Whether to start fetching immediately on mount */
  autoFetch?: boolean;
  /** Dependency array — when these change, re-fetch */
  deps?: unknown[];
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export function useScreenState<T>(options: UseScreenStateOptions<T>): ScreenStateResult<T> {
  const { cacheKey, fetch: fetchFn, cacheTTL = 60_000, autoFetch = true } = options;

  const [status, setStatus] = useState<ScreenStatus>('idle');
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isFetchingRef = useRef(false);
  const { isMounted } = useMountedGuard();

  const load = useCallback(
    async (bypassCache = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      // Cache-first: serve stale data instantly, then refetch
      if (cacheKey && !bypassCache) {
        try {
          const cached = await getCached<CacheEntry<T>>('screenstate', cacheKey);
          if (cached.value && Date.now() - cached.value.fetchedAt < cacheTTL) {
            if (isMounted()) {
              setDataState(cached.value.data);
              setStatus('success');
            }
            isFetchingRef.current = false;
            return;
          }
          // Stale cache — serve immediately but still re-fetch
          if (cached.value) {
            if (isMounted()) {
              setDataState(cached.value.data);
              setStatus('loading'); // Loading shimmer while refreshing stale
            }
          } else {
            if (isMounted()) setStatus('loading');
          }
        } catch {
          if (isMounted()) setStatus('loading');
        }
      } else {
        if (isMounted()) setStatus('loading');
      }

      try {
        const result = await fetchFn();
        if (isMounted()) {
          setDataState(result);
          setStatus('success');
          setError(null);
        }
        if (cacheKey) {
          const entry: CacheEntry<T> = { data: result, fetchedAt: Date.now() };
          await setCached<CacheEntry<T>>('screenstate', cacheKey, entry);
        }
      } catch (e) {
        if (isMounted()) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setStatus('error');
        }
      } finally {
        isFetchingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, cacheTTL, fetchFn],
  );

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  const setData = useCallback(
    (updater: (prev: T | null) => T | null) => {
      setDataState((prev) => {
        const next = updater(prev);
        // Update cache immediately on optimistic updates
        if (cacheKey && next !== null) {
          const entry: CacheEntry<T> = { data: next, fetchedAt: Date.now() };
          void setCached<CacheEntry<T>>('screenstate', cacheKey, entry);
        }
        return next;
      });
    },
    [cacheKey],
  );

  useEffect(() => {
    if (autoFetch) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    refresh,
    setData,
  };
}
