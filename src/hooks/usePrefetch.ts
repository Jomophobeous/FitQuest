/**
 * HOOK — usePrefetch
 *
 * Warms caches proactively on dashboard mount.
 * Delegates to preloadService for profile, workout, and settings
 * so adjacent screens load without skeleton states.
 *
 * Non-blocking. Runs after first render. Zero UI impact.
 * Phase 5: predictive preloading.
 */

import { useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { preloadFromDashboard } from '../services/preloadService';

/**
 * Fire-and-forget prefetch on dashboard mount.
 * Warms Profile + Workout + Settings caches.
 */
export function usePrefetch(_isSubscribed: boolean): void {
  const { isReady } = useDatabase();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!isReady || prefetchedRef.current) return;
    prefetchedRef.current = true;
    preloadFromDashboard();
  }, [isReady]);
}
