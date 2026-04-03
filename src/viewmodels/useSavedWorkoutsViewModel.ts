/**
 * Saved Workouts Screen ViewModel
 * Encapsulates workout session loading, deletion, exercise expansion, and data sync.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { createViewModel } from './createViewModel';
import { getRecentSessions, deleteWorkoutSession, getSessionExercises } from '../database/service';
import { useDataSync } from '../services/dataSyncService';

import type { WorkoutSession } from '../database/types';
export type { WorkoutSession } from '../database/types';

type SessionExerciseInfo = {
  exercise_id: string;
  name: string;
  category: string;
  prescribed_sets: number;
  prescribed_reps: string;
};

const USER_ID = 'user_local_001';

export const useSavedWorkoutsViewModel = createViewModel(() => {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, SessionExerciseInfo[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      const sessions = await getRecentSessions(USER_ID, 50);
      if (!mountedRef.current) return;
      const custom = sessions.filter((s) => s.id.startsWith('custom_') || s.notes?.startsWith('Custom:'));
      setWorkouts(custom);
    } catch {
      if (!mountedRef.current) return;
      setLoadError('Failed to load saved workouts');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const deleteWorkout = useCallback(async (sessionId: string) => {
    await deleteWorkoutSession(sessionId);
    setWorkouts((prev) => prev.filter((w) => w.id !== sessionId));
  }, []);

  const loadSessionExercises = useCallback(
    async (sessionId: string) => {
      if (expandedExercises[sessionId]) return;
      try {
        const exercises = await getSessionExercises(sessionId);
        if (mountedRef.current) setExpandedExercises((prev) => ({ ...prev, [sessionId]: exercises }));
      } catch {
        // Session exercises might not be available
      }
    },
    [expandedExercises],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkouts();
  }, [loadWorkouts]);

  // Subscribe to workout events from other screens
  useDataSync('workout_completed', loadWorkouts);
  useDataSync('custom_workout_created', loadWorkouts);

  return {
    workouts,
    expandedExercises,
    refreshing,
    loading,
    loadError,
    loadWorkouts,
    deleteWorkout,
    loadSessionExercises,
    handleRefresh,
  };
});
