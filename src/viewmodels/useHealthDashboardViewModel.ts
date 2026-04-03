/**
 * useHealthDashboardViewModel — Health Dashboard screen ViewModel
 *
 * Owns: health data loading, sleep logging, alert dismissal, health sync/connect,
 * all state, trend data, and debounced refresh logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { createViewModel } from './createViewModel';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { backgroundHealth } from '../engines/BackgroundHealthEngine';
import { sleepEngine } from '../engines/SleepAnalysisEngine';
import { encryptedDB } from '../security/EncryptedDatabase';
import { getStepHistory, getWorkoutCountSince, getWorkoutStreakCurrent } from '../database/service';
import { getHealthAdapter, initializeHealthIntegration, syncHealthData } from '../services/healthAdapters';
import { captureHealthError } from '../services/errorTelemetry';
import { useDataSync } from '../services/dataSyncService';
import type { HealthAlert, TrendPoint } from '../components/health/HealthWidgets';

// ============================================
// TYPES (exported for screen)
// ============================================

export interface HealthData {
  healthScore: number;
  steps: number;
  stepsGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  calories: number;
  caloriesGoal: number;
  heartRate: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  recoveryScore: number;
  workoutsThisWeek: number;
  workoutsGoal: number;
  streakDays: number;
  anomalyCount: number;
  alerts: HealthAlert[];
}

const DEFAULT_HEALTH_DATA: HealthData = {
  healthScore: 0, steps: 0, stepsGoal: 10000, activeMinutes: 0, activeMinutesGoal: 30,
  calories: 0, caloriesGoal: 2000, heartRate: null, sleepHours: null, sleepQuality: null,
  recoveryScore: 0, workoutsThisWeek: 0, workoutsGoal: 4, streakDays: 0, anomalyCount: 0,
  alerts: [],
};

// ============================================
// VIEW MODEL
// ============================================

export const useHealthDashboardViewModel = createViewModel(() => {
  const { isReady: dbReady } = useDatabase();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [healthActionBusy, setHealthActionBusy] = useState(false);
  const [healthProviderCode, setHealthProviderCode] = useState<
    'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown' | 'unavailable'
  >('none');
  const [healthLastSyncLabel, setHealthLastSyncLabel] = useState<string>('');
  const [healthData, setHealthData] = useState<HealthData>(DEFAULT_HEALTH_DATA);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [stepsTrend, setStepsTrend] = useState<TrendPoint[]>([]);
  const [sleepTrend, setSleepTrend] = useState<TrendPoint[]>([]);

  // Sleep modal
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepBedHour, setSleepBedHour] = useState(22);
  const [sleepBedMin, setSleepBedMin] = useState(0);
  const [sleepWakeHour, setSleepWakeHour] = useState(6);
  const [sleepWakeMin, setSleepWakeMin] = useState(30);
  const [sleepSaving, setSleepSaving] = useState(false);

  // ── Refs ──
  const isLoadingHealthRef = useRef(false);
  const mountedRef = useRef(true);
  const lastHealthLoadAt = useRef(0);
  const healthLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HEALTH_LOAD_COOLDOWN_MS = 2000;

  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Data loading ──
  const loadHealthData = useCallback(async () => {
    if (isLoadingHealthRef.current) return;
    isLoadingHealthRef.current = true;
    lastHealthLoadAt.current = Date.now();
    try {
      try {
        const adapter = await getHealthAdapter();
        if (adapter) {
          const status = await adapter.getStatus();
          setHealthProviderCode((status.provider || 'unknown') as typeof healthProviderCode);
          setHealthLastSyncLabel(
            status.lastSyncTime ? status.lastSyncTime.toLocaleString() : t('health.lastSyncNever'),
          );
        } else {
          setHealthProviderCode('none');
          setHealthLastSyncLabel(t('health.lastSyncNever'));
        }
      } catch {
        setHealthProviderCode('unavailable');
      }

      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const [score, snapshot, sleepResult, alertsResult, workoutResult, trendsResult] = await Promise.all([
        backgroundHealth.calculateHealthScore().catch(() => 0),
        backgroundHealth.getSnapshot().catch(() => ({
          steps: 0, activeMinutes: 0, calories: 0, restingHeartRate: null, recoveryScore: 0,
        })),
        sleepEngine.getAnalytics(7).catch(() => ({ avgDurationMs: 0, avgQualityScore: 0 })),
        encryptedDB.getActiveAlerts().catch(() => [] as any[]),
        Promise.all([
          getWorkoutCountSince(weekStart).catch(() => 0),
          getWorkoutStreakCurrent('user_local_001').catch(() => 0),
        ]),
        Promise.all([
          getStepHistory('user_local_001', 7).catch(() => []),
          encryptedDB.getRecentHealthData('sleep_session', 7).catch(() => []),
        ]),
      ]);

      let sleepHrs: number | null = null;
      let sleepQual: number | null = null;
      if (sleepResult.avgDurationMs > 0) {
        sleepHrs = Math.round((sleepResult.avgDurationMs / 3600000) * 10) / 10;
        sleepQual = sleepResult.avgQualityScore;
      }

      const alerts: HealthAlert[] = alertsResult.map((a: any) => ({
        id: a.id ?? String(Date.now()),
        type: a.alertType ?? 'health',
        severity: a.severity ?? 'LOW',
        message: String((a.data as any)?.message ?? t('health.alert')),
        created_at: a.created_at ?? Date.now(),
      }));

      const [workoutsThisWeek, streakDays] = workoutResult;

      const [rows, sleepData] = trendsResult;
      const stepTrend: TrendPoint[] = [];
      const sleepTrendPts: TrendPoint[] = [];
      const dayNames = [
        t('day.sun'), t('day.mon'), t('day.tue'), t('day.wed'),
        t('day.thu'), t('day.fri'), t('day.sat'),
      ];
      for (const row of ((rows as any[]) ?? []).reverse()) {
        const d = new Date(row.date);
        stepTrend.push({ label: dayNames[d.getDay()]!, value: row.steps });
      }
      for (const entry of (sleepData as any[]) ?? []) {
        try {
          const parsed = typeof entry === 'object' ? entry : JSON.parse(String(entry));
          sleepTrendPts.push({ label: t('common.day'), value: (parsed as any)?.qualityScore ?? 0 });
        } catch { /* skip */ }
      }

      setStepsTrend(stepTrend);
      setSleepTrend(sleepTrendPts);

      if (!mountedRef.current) return;

      setHealthData({
        healthScore: score,
        steps: snapshot.steps ?? 0,
        stepsGoal: 10000,
        activeMinutes: snapshot.activeMinutes ?? 0,
        activeMinutesGoal: 30,
        calories: snapshot.calories ?? 0,
        caloriesGoal: 2000,
        heartRate: snapshot.restingHeartRate ?? null,
        sleepHours: sleepHrs,
        sleepQuality: sleepQual,
        recoveryScore: snapshot.recoveryScore ?? 0,
        workoutsThisWeek,
        workoutsGoal: 4,
        streakDays,
        anomalyCount: alerts.length,
        alerts,
      });
    } catch (error) {
      if (__DEV__) console.error('[HealthDashboard] Failed to load data:', error);
      if (mountedRef.current) setLoadError(t('common.errorLoadingData') ?? 'Failed to load health data');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
      isLoadingHealthRef.current = false;
      lastHealthLoadAt.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedLoadHealth = useCallback(() => {
    if (!dbReady) return;
    if (healthLoadTimer.current) clearTimeout(healthLoadTimer.current);
    healthLoadTimer.current = setTimeout(() => {
      if (Date.now() - lastHealthLoadAt.current < HEALTH_LOAD_COOLDOWN_MS) return;
      loadHealthData();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  useEffect(() => {
    if (dbReady) loadHealthData();
  }, [dbReady, loadHealthData]);

  useDataSync('workout_completed', debouncedLoadHealth);
  useDataSync('jog_completed', debouncedLoadHealth);
  useDataSync('steps_updated', debouncedLoadHealth);
  useDataSync('health_data_updated', debouncedLoadHealth);

  // ── Refresh ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHealthData();
    if (mountedRef.current) setRefreshing(false);
  }, [loadHealthData]);

  // ── Alert dismiss ──
  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await encryptedDB.acknowledgeAlert(alertId);
      setHealthData((prev) => ({
        ...prev,
        alerts: prev.alerts.filter((a) => a.id !== alertId),
        anomalyCount: Math.max(0, prev.anomalyCount - 1),
      }));
    } catch (e) {
      if (__DEV__) console.error('[HealthDashboard] Failed to dismiss alert:', e);
    }
  }, []);

  // ── Health connect/sync ──
  const handleConnectHealth = useCallback(async () => {
    if (healthActionBusy) return;
    setHealthActionBusy(true);
    try {
      const result = await initializeHealthIntegration();
      if (!result.success) {
        showToast({ message: result.error || t('health.providerConnectFailed'), type: 'error' });
        return;
      }
      showToast({ message: t('health.providerConnected'), type: 'success' });
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (adapter?.provider === 'health_connect' || adapter?.provider === 'healthkit' || adapter?.provider === 'google_fit') {
          provider = adapter.provider;
        }
      } catch { /* fallback */ }
      await captureHealthError(error instanceof Error ? error : String(error), { provider, action: 'auth' });
      showToast({ message: t('health.providerConnectFailed'), type: 'error' });
    } finally {
      setHealthActionBusy(false);
    }
  }, [healthActionBusy, loadHealthData, t, showToast]);

  const handleSyncHealth = useCallback(async () => {
    if (healthActionBusy) return;
    setHealthActionBusy(true);
    try {
      const result = await syncHealthData({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        categories: ['steps', 'calories', 'heart_rate', 'sleep', 'workout'],
      });
      showToast({
        message: `${t('health.synced')}: ${result.synced}, ${t('health.errors')}: ${result.errors}`,
        type: result.errors > 0 ? 'warning' : 'success',
      });
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (adapter?.provider === 'health_connect' || adapter?.provider === 'healthkit' || adapter?.provider === 'google_fit') {
          provider = adapter.provider;
        }
      } catch { /* fallback */ }
      await captureHealthError(error instanceof Error ? error : String(error), { provider, action: 'sync' });
      showToast({ message: t('health.syncFailed'), type: 'error' });
    } finally {
      setHealthActionBusy(false);
    }
  }, [healthActionBusy, loadHealthData, t, showToast]);

  // ── Sleep logging ──
  const openSleepModal = useCallback(() => setShowSleepModal(true), []);
  const closeSleepModal = useCallback(() => setShowSleepModal(false), []);

  const handleSaveSleep = useCallback(async () => {
    if (sleepSaving) return;
    const now = new Date();
    const bedtime = new Date(now);
    bedtime.setHours(sleepBedHour, sleepBedMin, 0, 0);
    const wakeTime = new Date(now);
    wakeTime.setHours(sleepWakeHour, sleepWakeMin, 0, 0);
    if (bedtime.getTime() >= wakeTime.getTime()) {
      bedtime.setDate(bedtime.getDate() - 1);
    }
    const durationMs = wakeTime.getTime() - bedtime.getTime();
    if (durationMs <= 0) {
      showToast({ message: t('health.sleepInvalidTimes'), type: 'warning' });
      return;
    }
    if (durationMs > 24 * 60 * 60 * 1000) {
      showToast({ message: t('health.sleepTooLong'), type: 'warning' });
      return;
    }
    setSleepSaving(true);
    try {
      await sleepEngine.recordManualSession(bedtime, wakeTime);
      setShowSleepModal(false);
      showToast({ message: t('health.sleepSaved'), type: 'success' });
      await loadHealthData();
    } catch (e) {
      if (__DEV__) console.error('[HealthDashboard] Sleep log failed:', e);
      showToast({ message: String(e), type: 'error' });
    } finally {
      setSleepSaving(false);
    }
  }, [sleepBedHour, sleepBedMin, sleepWakeHour, sleepWakeMin, sleepSaving, loadHealthData, t, showToast]);

  // ── Retry ──
  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    loadHealthData();
  }, [loadHealthData]);

  // ── Derived ──
  const hasAnyMetrics = hasLoadedOnce && (
    healthData.healthScore > 0 || healthData.steps > 0 ||
    healthData.activeMinutes > 0 || healthData.calories > 0 ||
    healthData.workoutsThisWeek > 0
  );

  return {
    // State
    loading, loadError, refreshing, healthActionBusy,
    healthProviderCode, healthLastSyncLabel,
    healthData, hasLoadedOnce, hasAnyMetrics,
    stepsTrend, sleepTrend,
    // Sleep modal
    showSleepModal, sleepBedHour, setSleepBedHour,
    sleepBedMin, setSleepBedMin, sleepWakeHour, setSleepWakeHour,
    sleepWakeMin, setSleepWakeMin, sleepSaving,
    // Actions
    onRefresh, dismissAlert, handleConnectHealth, handleSyncHealth,
    handleSaveSleep, openSleepModal, closeSleepModal, retryLoad,
  };
});

export type HealthDashboardViewModel = ReturnType<typeof useHealthDashboardViewModel>;
