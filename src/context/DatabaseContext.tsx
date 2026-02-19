/**
 * FitQuest Database Context
 * Provides database initialization and access throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { initializeDatabase, resetDatabase } from '../database';
import { getUserProfile, createUserProfile } from '../database/service';
import { initializeAIModels } from '../ai';
import type { UserProfile } from '../database/types';

interface DatabaseContextType {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  userProfile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

const DEFAULT_USER_ID = 'user_local_001';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const initialize = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize database and seed exercises
      console.log('[FitQuest] Initializing database...');
      await initializeDatabase();
      console.log('[FitQuest] Database initialized successfully');

      // Check for existing user profile
      let profile = await getUserProfile(DEFAULT_USER_ID);
      
      if (!profile) {
        console.log('[FitQuest] Creating default user profile...');
        // Create a default profile for testing
        await createUserProfile({
          id: DEFAULT_USER_ID,
          goal: 'body_control',
          experience: 'intermediate',
          training_days_per_week: 4,
          time_per_session_minutes: 30,
          locked: false,
        });

        profile = await getUserProfile(DEFAULT_USER_ID);
        console.log('[FitQuest] Default profile created');
      }

      setUserProfile(profile);
      setIsReady(true);

      // AI model loading disabled — Coach & FitMind are deferred to API-based release
      // initializeAIModels().catch((err) =>
      //   console.warn('[FitQuest] AI model init failed (non-critical):', err)
      // );
    } catch (err) {
      console.error('[FitQuest] Database initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = useCallback(async () => {
    const profile = await getUserProfile(DEFAULT_USER_ID);
    setUserProfile(profile);
  }, []);

  const resetAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetDatabase();
      await initialize();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, []);

  const contextValue = useMemo(() => ({
    isReady,
    isLoading,
    error,
    userProfile,
    refreshProfile,
    resetAll,
  }), [isReady, isLoading, error, userProfile, refreshProfile, resetAll]);

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
