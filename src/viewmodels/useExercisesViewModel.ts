/**
 * Exercises ViewModel
 *
 * Wraps exercise loading (with query cache) and refresh.
 * Screen keeps: filter state, search, scroll animations, detail sheet, UI state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createViewModel } from './createViewModel';
import { getExercises } from '../database/service';
import { queryCache } from '../database/queryCache';
import { useDatabase } from '../context/DatabaseContext';
import type { ExerciseWithDetails, Category } from '../database/types';

export type { ExerciseWithDetails, Category };

export const useExercisesViewModel = createViewModel(() => {
  const { isReady } = useDatabase();
  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      const data = await queryCache.getOrFetch('exercises:all', () => getExercises(), 120_000);
      if (!mountedRef.current) return;
      setExercises(data);
      setLoadError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      if (__DEV__) console.error('[Exercises] Failed to load:', error);
      setLoadError('Failed to load exercises.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    queryCache.invalidate('exercises:all');
    await loadExercises();
    if (mountedRef.current) setRefreshing(false);
  }, [loadExercises]);

  useEffect(() => {
    if (isReady) loadExercises();
  }, [isReady, loadExercises]);

  return { exercises, loading, loadError, refreshing, loadExercises, handleRefresh };
});
