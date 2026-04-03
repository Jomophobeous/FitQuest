/**
 * HOOK — usePrefetch
 *
 * Warms caches proactively on dashboard mount.
 * Adjacent screens (fitquest, coach, health-dashboard) benefit from
 * pre-warmed UserState + Readiness caches.
 *
 * Non-blocking. Runs after initial render. No UI impact.
 */

import { useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getUserState } from '../engines/UserStateEngine';
import { getCachedReadiness } from '../engines/ReadinessEngine';
import { getGoalProgress } from '../services/goalTracker';

const PREFETCH_DELAY_MS = 1500; // Wait for dashboard to settle
const USER_ID = 'user_local_001';

/**
 * Fire-and-forget prefetch on mount.
 * Warms UserState (2min TTL) and Readiness (1min TTL) caches
 * so fitquest/coach/health screens load faster.
 */
export function usePrefetch(isSubscribed: boolean): void {
  const { isReady } = useDatabase();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!isReady || prefetchedRef.current) return;
    prefetchedRef.current = true;

    const timer = setTimeout(() => {
      // UserState (covers consistency, fatigue, progression, trial, signal)
      getUserState(USER_ID, isSubscribed).catch(() => {});
      // Readiness snapshot
      getCachedReadiness(USER_ID).catch(() => {});
      // Goal progress (cheap, primes the path for goal cards)
      getGoalProgress(USER_ID).catch(() => {});
    }, PREFETCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isReady, isSubscribed]);
}
