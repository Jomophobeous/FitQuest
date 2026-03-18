/**
 * FitQuest Database Context
 * Provides database initialization and access throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { initializeDatabase, resetDatabase, closeDatabase, resetInitState } from '../database';
import { getUserProfile, createUserProfile, lockUserProfile, getAppState } from '../database/service';
import type { UserProfile } from '../database/types';
import { getPostHogClient } from '../services/posthogService';

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
    let retryScheduled = false;
    try {
      setIsLoading(true);
      setError(null);

      // Initialize database and seed exercises
      console.log('[FitQuest] Initializing database...');
      await initializeDatabase();
      console.log('[FitQuest] Database initialized successfully');

      // Check for existing user profile
      let profile = await getUserProfile(DEFAULT_USER_ID);

      // Check if onboarding has been completed
      const onboardingFlag = await getAppState('onboarding_complete');
      const didOnboard = onboardingFlag === 'true';
      
      if (!profile) {
        console.log('[FitQuest] Creating default user profile...');
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
        console.log('[FitQuest] Default profile created and locked');
      }

      // Ensure existing profiles are locked (fixes existing unlocked profiles)
      if (profile && !profile.locked) {
        await lockUserProfile(DEFAULT_USER_ID);
        profile = await getUserProfile(DEFAULT_USER_ID);
        console.log('[FitQuest] Existing profile locked');
      }

      setUserProfile(profile);
      setOnboardingComplete(didOnboard);
      setIsReady(true);
      retryCount.current = 0;

      // Identify user in PostHog with non-PII properties
      if (profile) {
        getPostHogClient().then(client => {
          if (client) {
            client.identify(profile.id, {
              goal: profile.goal,
              experience: profile.experience,
              training_days: profile.training_days_per_week,
              onboarded: didOnboard,
            });
          }
        }).catch(() => { /* best-effort */ });
      }
    } catch (err) {
      console.error('[FitQuest] Database initialization failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to initialize database';
      
      // Auto-retry with backoff
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current += 1;
        const delay = retryCount.current * 1000;
        console.log(`[FitQuest] Retrying in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`);
        // Close the broken connection so retry gets a fresh native handle
        try { await closeDatabase(); } catch (_) { /* ignore close errors */ }
        resetInitState();
        retryScheduled = true;
        isInitializing.current = false;
        setTimeout(() => { initialize(); }, delay);
        return;
      }
      
      setError(msg);
    } finally {
      // Only clear loading state when we're done (not when a retry is pending)
      if (!retryScheduled) {
        setIsLoading(false);
      }
      isInitializing.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    retryCount.current = 0;
    initialize();
  }, [initialize]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile(DEFAULT_USER_ID);
      setUserProfile(profile);
      const onboardingFlag = await getAppState('onboarding_complete');
      setOnboardingComplete(onboardingFlag === 'true');
    } catch (err) {
      console.warn('[FitQuest] Failed to refresh profile:', err);
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

  const contextValue = useMemo(() => ({
    isReady,
    isLoading,
    error,
    userProfile,
    onboardingComplete,
    refreshProfile,
    resetAll,
    retry,
  }), [isReady, isLoading, error, userProfile, onboardingComplete, refreshProfile, resetAll, retry]);

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export { DEFAULT_USER_ID };
