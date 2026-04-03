/**
 * FitQuest Database Context
 * Provides database initialization and access throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { initializeDatabase, resetDatabase, closeDatabase, resetInitState } from '../database';
import { getUserProfile, createUserProfile, lockUserProfile, getAppState } from '../database/service';
import type { UserProfile } from '../database/types';
import { getPostHogClient } from '../services/posthogService';
import { systemGuard } from '../services/SystemGuard';
import { recoveryService } from '../services/RecoveryService';
import { snapshotService } from '../services/SnapshotService';
import { walService } from '../services/WriteAheadLogService';
import { dataSync } from '../services/dataSyncService';
import DatabaseRecoveryScreen from '../components/DatabaseRecoveryScreen';

interface DatabaseContextType {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  userProfile: UserProfile | null;
  onboardingComplete: boolean;
  refreshProfile: () => Promise<void>;
  resetAll: () => Promise<void>;
  retry: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

const DEFAULT_USER_ID = 'user_local_001';
const MAX_RETRIES = 3;

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const retryCount = useRef(0);
  const isInitializing = useRef(false);

  const initialize = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    try {
      setIsLoading(true);
      setError(null);

      // Retry loop — deterministic, no setTimeout gaps
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = attempt * 1000;
            if (__DEV__) console.warn(`[FitQuest] Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
            systemGuard.markRecovering(lastError instanceof Error ? lastError.message : 'Retrying');
            // Close the broken connection so retry gets a fresh native handle
            try { await closeDatabase(); } catch { /* ignore */ }
            resetInitState();
            await new Promise(r => setTimeout(r, delay));
          }

          if (__DEV__) console.warn('[FitQuest] Initializing database...');
          await initializeDatabase();
          if (__DEV__) console.warn('[FitQuest] Database initialized successfully');

          // Run recovery check: integrity → WAL → snapshot restore if needed
          const recovery = await recoveryService.run();
          if (__DEV__) console.warn(`[FitQuest] Recovery: ${recovery.outcome} (${recovery.durationMs}ms)`);

          // Initialize WAL table (idempotent)
          await walService.initialize();

          // Start periodic snapshots
          snapshotService.startPeriodicSnapshots();

          // Trigger snapshot on workout completion (critical data event)
          dataSync.subscribe('workout_completed', () => {
            snapshotService.createSnapshot('workout_complete').catch((e) => {
              if (__DEV__) console.warn('[DB] snapshot failed', e);
            });
          });

          // Trigger snapshot on profile mutation (user-critical data)
          dataSync.subscribe('profile_updated', () => {
            snapshotService.createSnapshot('profile_updated').catch((e) => {
              if (__DEV__) console.warn('[DB] snapshot failed', e);
            });
          });

          // Trigger snapshot on XP milestone (level up = significant state change)
          dataSync.subscribe('level_up', () => {
            snapshotService.createSnapshot('xp_milestone').catch((e) => {
              if (__DEV__) console.warn('[DB] snapshot failed', e);
            });
          });

          // Check for existing user profile
          let profile = await getUserProfile(DEFAULT_USER_ID);

          // Check if onboarding has been completed
          const onboardingFlag = await getAppState('onboarding_complete');
          const didOnboard = onboardingFlag === 'true';

          if (!profile) {
            if (__DEV__) console.warn('[FitQuest] Creating default user profile...');
            await createUserProfile({
              id: DEFAULT_USER_ID,
              goal: 'body_control',
              experience: 'intermediate',
              training_days_per_week: 4,
              time_per_session_minutes: 30,
              locked: false,
            });

            // Lock the profile so the workout engine can generate workouts
            await lockUserProfile(DEFAULT_USER_ID);

            profile = await getUserProfile(DEFAULT_USER_ID);
            if (__DEV__) console.warn('[FitQuest] Default profile created and locked');
          }

          // Ensure existing profiles are locked (fixes existing unlocked profiles)
          if (profile && !profile.locked) {
            await lockUserProfile(DEFAULT_USER_ID);
            profile = await getUserProfile(DEFAULT_USER_ID);
            if (__DEV__) console.warn('[FitQuest] Existing profile locked');
          }

          setUserProfile(profile);
          setOnboardingComplete(didOnboard);
          setIsReady(true);
          retryCount.current = 0;
          systemGuard.markReady();

          // Identify user in PostHog with non-PII properties
          if (profile) {
            getPostHogClient()
              .then((client) => {
                if (client) {
                  client.identify(profile.id, {
                    goal: profile.goal,
                    experience: profile.experience,
                    training_days: profile.training_days_per_week,
                    onboarded: didOnboard,
                  });
                }
              })
              .catch(() => {
                /* best-effort */
              });
          }

          // Success — exit retry loop
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            if (__DEV__) console.warn('[FitQuest] Init attempt failed, will retry:', err instanceof Error ? err.message : err);
          }
        }
      }

      // All retries exhausted — surface the error
      if (lastError) {
        if (__DEV__) console.error('[FitQuest] Database initialization failed after all retries:', lastError);
        const msg = lastError instanceof Error ? lastError.message : 'Failed to initialize database';
        systemGuard.markFailed(msg);
        setError(msg);
      }
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    retryCount.current = 0;
    systemGuard.markBooting();
    initialize();
  }, [initialize]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile(DEFAULT_USER_ID);
      setUserProfile(profile);
      const onboardingFlag = await getAppState('onboarding_complete');
      setOnboardingComplete(onboardingFlag === 'true');
    } catch (err) {
      if (__DEV__) console.warn('[FitQuest] Failed to refresh profile:', err);
    }
  }, []);

  const resetAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetDatabase();
      retryCount.current = 0;
      await initialize();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset database');
    } finally {
      setIsLoading(false);
    }
  }, [initialize]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const contextValue = useMemo(
    () => ({
      isReady,
      isLoading,
      error,
      userProfile,
      onboardingComplete,
      refreshProfile,
      resetAll,
      retry,
    }),
    [isReady, isLoading, error, userProfile, onboardingComplete, refreshProfile, resetAll, retry],
  );

  // Hard failure boundary: if DB failed and not loading (no retry pending), block everything
  if (error && !isLoading) {
    return (
      <DatabaseContext.Provider value={contextValue}>
        <DatabaseRecoveryScreen error={error} isRecovering={false} onRetry={retry} onReset={resetAll} />
      </DatabaseContext.Provider>
    );
  }

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export { DEFAULT_USER_ID };
