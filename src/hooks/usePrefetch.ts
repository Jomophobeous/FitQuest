/**
 * HOOK — usePrefetch
 *
 * Warms caches proactively on dashboard mount.
 * Adjacent screens (fitquest, coach, health-dashboard) benefit from
 * pre-warmed Readiness caches.
 *
 * Non-blocking. Runs after initial render. No UI impact.
 */

import { useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getCachedReadiness } from '../engines/ReadinessEngine';

const PREFETCH_DELAY_MS = 1500;
const USER_ID = 'user_local_001';

/**
 * Fire-and-forget prefetch on mount.
 * Warms Readiness (1min TTL) cache so fitquest/coach/health screens load faster.
 */
export function usePrefetch(_isSubscribed: boolean): void {
  const { isReady } = useDatabase();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!isReady || prefetchedRef.current) return;
    prefetchedRef.current = true;

    const timer = setTimeout(() => {
      getCachedReadiness(USER_ID).catch(() => {});
    }, PREFETCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isReady, _isSubscribed]);
}
