/**
 * Analytics ViewModel
 *
 * Wraps all analytics data fetching, debounced loading, data sync subscriptions,
 * and calendar day-detail loading.
 * Screen keeps: selectedDay, dayModalVisible, JSX, styles, router.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { createViewModel } from './createViewModel';
import { useDataSync } from '../services/dataSyncService';
import { useDatabase } from '../context/DatabaseContext';
import {
  BarData,
  MuscleGroupData,
  StepStats,
  JogStats,
  PersonalRecord,
  StreakData,
  DaySession,
  fetchWorkoutBars,
  fetchXPData,
  fetchMuscleGroups,
  fetchStepStats,
  fetchJogStats,
  fetchActiveDays,
  fetchPersonalRecords,
  fetchStreakData,
  fetchDaySessions,
} from '../services/analyticsDataService';

export type { BarData, MuscleGroupData, StepStats, JogStats, PersonalRecord, StreakData, DaySession };

const ANALYTICS_LOAD_COOLDOWN_MS = 2000;

export const useAnalyticsViewModel = createViewModel(() => {
  const { isReady: dbReady } = useDatabase();

  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workoutBars, setWorkoutBars] = useState<BarData[]>([]);
  const [xpData, setXPData] = useState<number[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupData[]>([]);
  const [stepStats, setStepStats] = useState<StepStats>({ steps: 0, distance: 0, calories: 0, avgDaily: 0 });
  const [jogStats, setJogStats] = useState<JogStats>({ runs: 0, totalKm: 0, avgPace: '--:--', longestRun: 0 });
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    totalWorkouts: 0,
    consistencyPct: 0,
    thisWeek: 0,
    thisMonth: 0,
  });

  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const isLoadingRef = useRef(false);
  const lastLoadAt = useRef(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    lastLoadAt.current = Date.now();
    setLoading(true);
    setLoadError(null);
    try {
      const [bars, xp, muscles, steps, jogs, active, prs, streak] = await Promise.all([
        fetchWorkoutBars(range),
        fetchXPData(range),
        fetchMuscleGroups(),
        fetchStepStats(range),
        fetchJogStats(range),
        fetchActiveDays(),
        fetchPersonalRecords(),
        fetchStreakData(),
      ]);
      setWorkoutBars(bars);
      setXPData(xp);
      setMuscleGroups(muscles);
      setStepStats(steps);
      setJogStats(jogs);
      setActiveDays(active);
      setPersonalRecords(prs);
      setStreakData(streak);
    } catch (e) {
      if (__DEV__) console.warn('[Analytics] Data load error:', e);
      setLoadError('Failed to load analytics data.');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      lastLoadAt.current = Date.now();
    }
  }, [range]);

  const debouncedLoad = useCallback(() => {
    if (!dbReady) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      if (Date.now() - lastLoadAt.current < ANALYTICS_LOAD_COOLDOWN_MS) return;
      loadData();
    }, 300);
  }, [dbReady, loadData]);

  useEffect(() => {
    if (dbReady) loadData();
  }, [dbReady, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (dbReady) debouncedLoad();
    }, [dbReady, debouncedLoad]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useDataSync(['workout_completed', 'xp_awarded', 'jog_completed', 'steps_updated', 'streak_updated'], debouncedLoad);

  const loadDaySessions = useCallback(async (dateStr: string) => {
    setDayLoading(true);
    try {
      const sessions = await fetchDaySessions(dateStr);
      setDaySessions(sessions);
    } catch (e) {
      if (__DEV__) console.warn('[Analytics] Day sessions load error:', e);
      setDaySessions([]);
    } finally {
      setDayLoading(false);
    }
  }, []);

  return {
    range,
    setRange,
    loading,
    refreshing,
    loadError,
    workoutBars,
    xpData,
    muscleGroups,
    stepStats,
    jogStats,
    activeDays,
    personalRecords,
    streakData,
    daySessions,
    dayLoading,
    loadData,
    handleRefresh,
    loadDaySessions,
  };
});
