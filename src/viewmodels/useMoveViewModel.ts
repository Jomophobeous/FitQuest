/**
 * useMoveViewModel — Move Tab ViewModel
 *
 * Owns: step tracking, jog lifecycle, sensor fusion, XP awards,
 * history loading, route review, data sync subscriptions.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { createViewModel } from './createViewModel';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import { usePedometer, type DailySteps, type JogSession } from '../hooks/usePedometer';
import { useSensorFusion, type ActivityType } from '../engines/SensorFusionEngine';
import { awardJogXP, awardStepXP } from '../services/xpService';
import { logEvent } from '../services/telemetry';
import { useDataSync, notifyStepsUpdated, notifyJogCompleted } from '../services/dataSyncService';
import { getJogRoute } from '../database/service';

// ============================================
// TYPES (exported for screen)
// ============================================

export type { DailySteps, JogSession, ActivityType };

export interface JogCompletionData {
  distance: number;
  duration: string;
  calories: number;
  xpEarned: number;
}

const DAILY_STEP_GOAL = 10000;

// ============================================
// VIEW MODEL
// ============================================

export const useMoveViewModel = createViewModel(() => {
  const { isReady: dbReady } = useDatabase();
  const { t } = useLanguage();

  // ── Hooks ──
  const pedometer = usePedometer();
  const sensor = useSensorFusion();

  // ── State ──
  const [stepHistory, setStepHistory] = useState<DailySteps[]>([]);
  const [jogHistory, setJogHistory] = useState<JogSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [jogElapsed, setJogElapsed] = useState('0:00');

  const [showJogComplete, setShowJogComplete] = useState(false);
  const [jogCompletionData, setJogCompletionData] = useState<JogCompletionData | null>(null);
  const [jogError, setJogError] = useState<string | null>(null);

  const [showLiveMap, setShowLiveMap] = useState(true);
  const [reviewJogId, setReviewJogId] = useState<string | null>(null);
  const [reviewRoute, setReviewRoute] = useState<[number, number][] | null>(null);
  const [reviewJog, setReviewJog] = useState<JogSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Refs ──
  const mountedRef = useRef(true);
  const startingJogRef = useRef(false);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // ── Helpers ──
  const formatDuration = useCallback((start: Date, end: Date): string => {
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatPace = useCallback((secondsPerKm?: number): string => {
    if (!secondsPerKm) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  }, []);

  // ── Data loading ──
  const loadHistory = useCallback(async () => {
    setLoadError(null);
    try {
      const steps = await pedometer.getStepHistory(7);
      const jogs = await pedometer.getJogHistory(10);
      if (!mountedRef.current) return;
      setStepHistory(steps);
      setJogHistory(jogs);
    } catch (e) {
      if (__DEV__) console.warn('[Move] History load error:', e);
      if (mountedRef.current) setLoadError(t('move.loadFailed') || 'Failed to load activity history.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dbReady) loadHistory();
  }, [dbReady, loadHistory]);

  // Live jog timer
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (pedometer.isJogging && pedometer.currentJog) {
      iv = setInterval(() => {
        setJogElapsed(formatDuration(pedometer.currentJog!.startTime, new Date()));
      }, 1000);
    }
    return () => clearInterval(iv);
  }, [pedometer.isJogging, pedometer.currentJog, formatDuration]);

  // Data sync subscriptions
  useDataSync('workout_completed', loadHistory);
  useDataSync('xp_awarded', loadHistory);

  // ── Handlers ──
  const handleStartTracking = useCallback(async () => {
    await pedometer.startTracking();
  }, [pedometer]);

  const handleStopTracking = useCallback(async () => {
    try {
      await pedometer.stopTracking();
      await awardStepXP(pedometer.todaySteps);
      notifyStepsUpdated(pedometer.todaySteps);
    } catch (e) {
      if (__DEV__) console.warn('[Move] Stop tracking error:', e);
    }
  }, [pedometer]);

  const handleStartJog = useCallback(async () => {
    if (!dbReady) {
      setJogError('Database is still loading. Please wait a moment and try again.');
      return;
    }
    if (startingJogRef.current) return;
    startingJogRef.current = true;
    setJogError(null);
    setShowLiveMap(true);

    try {
      await pedometer.startJog();
      try {
        if (!pedometer.isTracking) await pedometer.startTracking();
      } catch (e) {
        if (__DEV__) console.warn('[Move] Step tracking start failed (non-critical):', e);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Move] Failed to start jog:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('FOREIGN KEY') || msg.includes('user_profile')) {
        setJogError('Profile not ready. Please complete onboarding first, then try again.');
      } else if (msg.includes('permission') || msg.includes('location')) {
        setJogError('Unable to start jog. Please ensure location permissions are granted and try again.');
      } else {
        setJogError('Unable to start jog session. Please try again.');
      }
    } finally {
      startingJogRef.current = false;
    }
  }, [dbReady, pedometer]);

  const handleStopJog = useCallback(async () => {
    try {
      const session = await pedometer.stopJog();
      if (!mountedRef.current) return;
      if (session) {
        const xpResult = await awardJogXP(session.distanceMeters);
        setJogCompletionData({
          distance: session.distanceMeters / 1000,
          duration: session.startTime && session.endTime ? formatDuration(session.startTime, session.endTime) : '0:00',
          calories: session.caloriesEstimate || 0,
          xpEarned: xpResult?.xpEarned || 0,
        });
        setShowJogComplete(true);

        const durationSeconds =
          session.startTime && session.endTime
            ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
            : 0;
        notifyJogCompleted(session.distanceMeters, durationSeconds);
        void logEvent('jog_completed', {
          distance_meters: session.distanceMeters,
          duration_seconds: durationSeconds,
          calories: session.caloriesEstimate || 0,
        });

        loadHistory();
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (__DEV__) console.warn('[Move] Failed to stop jog:', error);
      setJogError(t('move.jogStopError') || 'Something went wrong stopping your jog. Please try again.');
    }
  }, [pedometer, formatDuration, loadHistory, t]);

  const handleReviewJog = useCallback(async (jog: JogSession) => {
    try {
      setReviewJog(jog);
      const route = await getJogRoute(jog.id);
      setReviewRoute(route);
      setReviewJogId(jog.id);
    } catch (e) {
      if (__DEV__) console.warn('[Move] Failed to load jog route:', e);
    }
  }, []);

  const closeRouteReview = useCallback(() => {
    setReviewJogId(null);
    setReviewRoute(null);
    setReviewJog(null);
  }, []);

  const dismissJogComplete = useCallback(() => {
    setShowJogComplete(false);
    setJogCompletionData(null);
  }, []);

  const toggleHistory = useCallback(() => setShowHistory((prev) => !prev), []);
  const toggleLiveMap = useCallback((show: boolean) => setShowLiveMap(show), []);

  const retryJog = useCallback(() => {
    setJogError(null);
    handleStartJog();
  }, [handleStartJog]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    loadHistory();
  }, [loadHistory]);

  // ── Derived ──
  const stepProgress = Math.min(pedometer.todaySteps / DAILY_STEP_GOAL, 1);
  const distKm = (pedometer.todaySteps * 0.0008).toFixed(1);
  const calories = Math.round(pedometer.todaySteps * 0.04);
  const activeMin = Math.round(pedometer.todaySteps / 100);

  return {
    // Constants
    DAILY_STEP_GOAL,
    // Pedometer pass-through
    todaySteps: pedometer.todaySteps,
    isAvailable: pedometer.isAvailable,
    isTracking: pedometer.isTracking,
    currentJog: pedometer.currentJog,
    isJogging: pedometer.isJogging,
    jogStats: pedometer.jogStats,
    cadence: pedometer.cadence,
    estimatedDistance: pedometer.estimatedDistance,
    // Sensor fusion pass-through
    sensorSnapshot: sensor.snapshot,
    sensorActive: sensor.isActive,
    startSensor: sensor.start,
    stopSensor: sensor.stop,
    // State
    dbReady,
    stepHistory,
    jogHistory,
    showHistory,
    jogElapsed,
    showJogComplete,
    jogCompletionData,
    jogError,
    showLiveMap,
    reviewJogId,
    reviewRoute,
    reviewJog,
    loadError,
    // Derived
    stepProgress,
    distKm,
    calories,
    activeMin,
    // Handlers
    handleStartTracking,
    handleStopTracking,
    handleStartJog,
    handleStopJog,
    handleReviewJog,
    closeRouteReview,
    dismissJogComplete,
    toggleHistory,
    toggleLiveMap,
    retryJog,
    retryLoad,
    // Helpers (needed by JSX)
    formatDuration,
    formatPace,
  };
});

export type MoveViewModel = ReturnType<typeof useMoveViewModel>;
