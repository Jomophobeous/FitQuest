/**
 * Derived Metrics Service
 *
 * Read-only service that computes higher-level fitness metrics from raw DB data.
 * Provides React hook + standalone functions for:
 * - timeSinceLastWorkout (per overall and per muscle group)
 * - intradayFatigueDecay curves
 * - readinessNow composite
 * - training window detection
 *
 * Uses ReadinessEngine for computation, adds caching + hook integration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCachedReadiness,
  invalidateReadinessCache,
  getStatusDisplay,
  formatStatusForAI,
  type ReadinessSnapshot,
} from '../engines/ReadinessEngine';
import { useDatabase } from '../context/DatabaseContext';

const USER_ID = 'user_local_001';

// ============================================
// STANDALONE FUNCTIONS
// ============================================

/**
 * Get the current readiness snapshot (cached, 1-min TTL).
 * Safe for frequent calls from dashboard, coach, background.
 */
export async function getReadiness(): Promise<ReadinessSnapshot> {
  return getCachedReadiness(USER_ID);
}

/**
 * Force recalculation after a workout is completed or fatigue changes.
 */
export function invalidateMetrics(): void {
  invalidateReadinessCache();
}

/**
 * Get readiness formatted for AI Coach first-message context injection.
 */
export async function getAIStatusContext(): Promise<string> {
  const snapshot = await getCachedReadiness(USER_ID);
  return formatStatusForAI(snapshot);
}

/**
 * Get dashboard-ready status display info.
 */
export async function getDashboardStatus(): Promise<{
  label: string;
  sublabel: string;
  colorKey: 'success' | 'warning' | 'error' | 'accent';
  icon: string;
  score: number;
  timeSinceLastWorkout: string | null;
}> {
  const snapshot = await getCachedReadiness(USER_ID);
  const display = getStatusDisplay(snapshot);

  let timeSinceLastWorkout: string | null = null;
  if (snapshot.timeSinceLastWorkoutMinutes !== null) {
    const mins = snapshot.timeSinceLastWorkoutMinutes;
    if (mins < 60) timeSinceLastWorkout = `${mins}m ago`;
    else if (mins < 1440) timeSinceLastWorkout = `${Math.floor(mins / 60)}h ago`;
    else timeSinceLastWorkout = `${Math.floor(mins / 1440)}d ago`;
  }

  return {
    ...display,
    score: snapshot.score,
    timeSinceLastWorkout,
  };
}

// ============================================
// REACT HOOK
// ============================================

interface UseReadinessResult {
  snapshot: ReadinessSnapshot | null;
  loading: boolean;
  refresh: () => void;
  /** Dashboard display helpers */
  display: ReturnType<typeof getStatusDisplay> | null;
  /** Formatted string for AI context */
  aiContext: string | null;
}

/**
 * React hook for readiness data. Auto-refreshes on mount and on demand.
 * Uses 1-minute cache to prevent excessive DB reads.
 */
export function useReadiness(): UseReadinessResult {
  const { isReady: dbReady } = useDatabase();
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!dbReady) return;
    try {
      const snap = await getCachedReadiness(USER_ID);
      if (mountedRef.current) {
        setSnapshot(snap);
        setLoading(false);
      }
    } catch (e) {
      console.warn('[DerivedMetrics] Failed to load readiness:', e);
      if (mountedRef.current) setLoading(false);
    }
  }, [dbReady]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => {
    invalidateReadinessCache();
    load();
  }, [load]);

  const display = snapshot ? getStatusDisplay(snapshot) : null;
  const aiContext = snapshot ? formatStatusForAI(snapshot) : null;

  return { snapshot, loading, refresh, display, aiContext };
}
