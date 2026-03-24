/**
 * HealthDashboard — Unified Health & Wellness Overview
 *
 * Composite screen aggregating data from:
 * - BackgroundHealthEngine (health score, daily summaries)
 * - SleepAnalysisEngine (sleep quality, trends)
 * - AnomalyDetector (active alerts)
 * - HealthMonitor (steps, active minutes, calories)
 * - RealisticHealthEngine (BMR, TDEE, body comp)
 *
 * Glass-morphism UI with animated metric rings and trend charts.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Text,
  Modal,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import { GlassCard, GradientButton, SectionHeader, AnimatedCounter, PulseDot } from '../src/components/ui/GlassUI';
import { backgroundHealth } from '../src/engines/BackgroundHealthEngine';
import { sleepEngine } from '../src/engines/SleepAnalysisEngine';
import { encryptedDB } from '../src/security/EncryptedDatabase';
import { getStepHistory, getWorkoutCountSince, getWorkoutStreakCurrent } from '../src/database/service';
import { getHealthAdapter, initializeHealthIntegration, syncHealthData } from '../src/services/healthAdapters';
import { captureHealthError } from '../src/services/errorTelemetry';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useDatabase } from '../src/context/DatabaseContext';
import { useRouter } from 'expo-router';
import { useDataSync } from '../src/services/dataSyncService';
import {
  MetricRing,
  AlertCard,
  TrendBar,
  type HealthAlert,
  type TrendPoint,
} from '../src/components/health/HealthWidgets';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface HealthData {
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

// ============================================
// MAIN SCREEN
// ============================================

function HealthDashboardScreenInner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthActionBusy, setHealthActionBusy] = useState(false);
  const [healthProviderCode, setHealthProviderCode] = useState<
    'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown' | 'unavailable'
  >('none');
  const [healthLastSyncLabel, setHealthLastSyncLabel] = useState<string>('');
  const [healthData, setHealthData] = useState<HealthData>({
    healthScore: 0,
    steps: 0,
    stepsGoal: 10000,
    activeMinutes: 0,
    activeMinutesGoal: 30,
    calories: 0,
    caloriesGoal: 2000,
    heartRate: null,
    sleepHours: null,
    sleepQuality: null,
    recoveryScore: 0,
    workoutsThisWeek: 0,
    workoutsGoal: 4,
    streakDays: 0,
    anomalyCount: 0,
    alerts: [],
  });
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [stepsTrend, setStepsTrend] = useState<TrendPoint[]>([]);
  const [sleepTrend, setSleepTrend] = useState<TrendPoint[]>([]);

  // Sleep log modal state
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepBedHour, setSleepBedHour] = useState(22);
  const [sleepBedMin, setSleepBedMin] = useState(0);
  const [sleepWakeHour, setSleepWakeHour] = useState(6);
  const [sleepWakeMin, setSleepWakeMin] = useState(30);
  const [sleepSaving, setSleepSaving] = useState(false);

  const isLoadingHealthRef = useRef(false);
  const lastHealthLoadAt = useRef(0);
  const HEALTH_LOAD_COOLDOWN_MS = 2000;
  const healthLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedLoadHealth = useCallback(() => {
    if (!dbReady) return;
    if (healthLoadTimer.current) clearTimeout(healthLoadTimer.current);
    healthLoadTimer.current = setTimeout(() => {
      if (Date.now() - lastHealthLoadAt.current < HEALTH_LOAD_COOLDOWN_MS) return;
      loadHealthData();
    }, 300);
  }, [dbReady]);

  const loadHealthData = useCallback(async () => {
    if (isLoadingHealthRef.current) {
      if (__DEV__) console.log('[HealthDashboard] loadHealthData:skipped (already loading)');
      return;
    }
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

      // Parallelize independent data fetches for faster loading
      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const [score, snapshot, sleepResult, alertsResult, workoutResult, trendsResult] = await Promise.all([
        backgroundHealth.calculateHealthScore().catch(() => 0),
        backgroundHealth
          .getSnapshot()
          .catch(() => ({ steps: 0, activeMinutes: 0, calories: 0, restingHeartRate: null, recoveryScore: 0 })),
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

      // Process sleep data
      let sleepHrs: number | null = null;
      let sleepQual: number | null = null;
      if (sleepResult.avgDurationMs > 0) {
        sleepHrs = Math.round((sleepResult.avgDurationMs / 3600000) * 10) / 10;
        sleepQual = sleepResult.avgQualityScore;
      }

      // Process alerts
      const alerts: HealthAlert[] = alertsResult.map((a: any) => ({
        id: a.id ?? String(Date.now()),
        type: a.alertType ?? 'health',
        severity: a.severity ?? 'LOW',
        message: String((a.data as any)?.message ?? t('health.alert')),
        created_at: a.created_at ?? Date.now(),
      }));
      const anomalyCount = alerts.length;

      // Unpack workout results
      const [workoutsThisWeek, streakDays] = workoutResult;

      // Build step trend (last 7 days)
      const [rows, sleepData] = trendsResult;
      const stepTrend: TrendPoint[] = [];
      const sleepTrendPts: TrendPoint[] = [];
      const dayNames = [
        t('day.sun'),
        t('day.mon'),
        t('day.tue'),
        t('day.wed'),
        t('day.thu'),
        t('day.fri'),
        t('day.sat'),
      ];
      for (const row of ((rows as any[]) ?? []).reverse()) {
        const d = new Date(row.date);
        stepTrend.push({ label: dayNames[d.getDay()]!, value: row.steps });
      }
      for (const entry of (sleepData as any[]) ?? []) {
        try {
          const parsed = typeof entry === 'object' ? entry : JSON.parse(String(entry));
          sleepTrendPts.push({
            label: t('common.day'),
            value: (parsed as any)?.qualityScore ?? 0,
          });
        } catch {
          // skip malformed
        }
      }

      setStepsTrend(stepTrend);
      setSleepTrend(sleepTrendPts);

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
        anomalyCount,
        alerts,
      });
    } catch (error) {
      if (__DEV__) console.error('[HealthDashboard] Failed to load data:', error);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
      isLoadingHealthRef.current = false;
      lastHealthLoadAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    if (dbReady) loadHealthData();
  }, [dbReady, loadHealthData]);

  // Subscribe to health data events from other screens (debounced)
  useDataSync('workout_completed', debouncedLoadHealth);
  useDataSync('jog_completed', debouncedLoadHealth);
  useDataSync('steps_updated', debouncedLoadHealth);
  useDataSync('health_data_updated', debouncedLoadHealth);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHealthData();
    setRefreshing(false);
  }, [loadHealthData]);

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

  const handleConnectHealth = useCallback(async () => {
    if (healthActionBusy) return;
    setHealthActionBusy(true);
    try {
      const result = await initializeHealthIntegration();
      if (!result.success) {
        Alert.alert(t('health.connectProvider'), result.error || t('health.providerConnectFailed'));
        return;
      }
      Alert.alert(t('health.connectProvider'), t('health.providerConnected'));
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (
          adapter?.provider === 'health_connect' ||
          adapter?.provider === 'healthkit' ||
          adapter?.provider === 'google_fit'
        ) {
          provider = adapter.provider;
        }
      } catch {
        // fallback provider stays default
      }
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'auth',
      });
      Alert.alert(t('health.connectProvider'), t('health.providerConnectFailed'));
    } finally {
      setHealthActionBusy(false);
    }
  }, [healthActionBusy, loadHealthData, t]);

  const handleSyncHealth = useCallback(async () => {
    if (healthActionBusy) return;
    setHealthActionBusy(true);
    try {
      const result = await syncHealthData({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        categories: ['steps', 'calories', 'heart_rate', 'sleep', 'workout'],
      });
      Alert.alert(
        t('health.syncNow'),
        `${t('health.synced')}: ${result.synced}\n${t('health.errors')}: ${result.errors}`,
      );
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (
          adapter?.provider === 'health_connect' ||
          adapter?.provider === 'healthkit' ||
          adapter?.provider === 'google_fit'
        ) {
          provider = adapter.provider;
        }
      } catch {
        // fallback provider stays default
      }
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'sync',
      });
      Alert.alert(t('health.syncNow'), t('health.syncFailed'));
    } finally {
      setHealthActionBusy(false);
    }
  }, [healthActionBusy, loadHealthData, t]);

  const handleSaveSleep = useCallback(async () => {
    if (sleepSaving) return;
    // Build Date objects: bedtime is "last night", wake is "this morning"
    const now = new Date();
    const bedtime = new Date(now);
    bedtime.setHours(sleepBedHour, sleepBedMin, 0, 0);
    const wakeTime = new Date(now);
    wakeTime.setHours(sleepWakeHour, sleepWakeMin, 0, 0);
    // If bedtime hour >= wake hour, bedtime was yesterday
    if (bedtime.getTime() >= wakeTime.getTime()) {
      bedtime.setDate(bedtime.getDate() - 1);
    }
    const durationMs = wakeTime.getTime() - bedtime.getTime();
    if (durationMs <= 0) {
      Alert.alert(t('health.logSleep'), t('health.sleepInvalidTimes'));
      return;
    }
    if (durationMs > 24 * 60 * 60 * 1000) {
      Alert.alert(t('health.logSleep'), t('health.sleepTooLong'));
      return;
    }
    setSleepSaving(true);
    try {
      await sleepEngine.recordManualSession(bedtime, wakeTime);
      setShowSleepModal(false);
      Alert.alert(t('health.logSleep'), t('health.sleepSaved'));
      await loadHealthData();
    } catch (e) {
      if (__DEV__) console.error('[HealthDashboard] Sleep log failed:', e);
      Alert.alert(t('health.logSleep'), String(e));
    } finally {
      setSleepSaving(false);
    }
  }, [sleepBedHour, sleepBedMin, sleepWakeHour, sleepWakeMin, sleepSaving, loadHealthData, t]);

  // Health score color
  const hasAnyMetrics =
    hasLoadedOnce &&
    (healthData.healthScore > 0 ||
      healthData.steps > 0 ||
      healthData.activeMinutes > 0 ||
      healthData.calories > 0 ||
      healthData.workoutsThisWeek > 0);
  const scoreColor = !hasAnyMetrics
    ? theme.colors.textMuted
    : healthData.healthScore >= 80
      ? theme.colors.accent
      : healthData.healthScore >= 60
        ? theme.colors.warning
        : healthData.healthScore >= 40
          ? theme.colors.error
          : theme.colors.error;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <ThemedText variant="body" color="muted" style={{ marginTop: 16 }}>
            {t('health.loading')}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
        }
      >
        {/* ── MEDICAL DISCLAIMER ── */}
        <MedicalDisclaimer screen="health-dashboard" />

        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.header}>
            <View>
              <ThemedText variant="h2" color="primary">
                {t('health.title')}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('health.subtitle')}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {`${t(`health.provider.${healthProviderCode}`)} · ${t('health.lastSync')}: ${healthLastSyncLabel || t('health.lastSyncNever')}`}
              </ThemedText>
            </View>
            {healthData.anomalyCount > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: theme.colors.error + '20' }]}>
                <PulseDot color={theme.colors.error} size={8} />
                <ThemedText variant="caption" style={{ color: theme.colors.error, marginLeft: 4 }}>
                  {healthData.anomalyCount} {healthData.anomalyCount > 1 ? t('health.alerts') : t('health.alert')}
                </ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── HEALTH SCORE RING ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={{ alignItems: 'center' }}>
                <View
                  style={[
                    styles.bigRing,
                    {
                      borderColor: scoreColor,
                      shadowColor: scoreColor,
                    },
                  ]}
                >
                  {hasAnyMetrics ? (
                    <AnimatedCounter
                      value={healthData.healthScore}
                      style={{
                        fontSize: 36,
                        fontWeight: '800',
                        color: scoreColor,
                      }}
                    />
                  ) : (
                    <Text style={{ fontSize: 36, fontWeight: '800', color: scoreColor }}>—</Text>
                  )}
                </View>
                <ThemedText variant="caption" color="muted" style={{ marginTop: 8 }}>
                  {hasAnyMetrics ? t('health.healthScore') : t('health.noDataYet') || 'Start a workout to track'}
                </ThemedText>
              </View>

              <View style={styles.scoreDetails}>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    {t('health.recovery')}: {healthData.recoveryScore}%
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="fire" size={16} color={theme.colors.warning} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    {t('health.streakDays')}: {healthData.streakDays}
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    {t('health.workoutsCount')}: {healthData.workoutsThisWeek}/{healthData.workoutsGoal}
                  </ThemedText>
                </View>
                {!!healthData.heartRate && (
                  <View style={styles.scoreDetailRow}>
                    <MaterialCommunityIcons name="heart-pulse" size={16} color={theme.colors.error} />
                    <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                      {t('health.heartRate')}: {healthData.heartRate} {t('health.bpm')}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── DAILY METRICS RINGS ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <SectionHeader title={t('health.todaysProgress')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
            <MetricRing
              value={healthData.steps}
              max={healthData.stepsGoal}
              color={theme.colors.blue}
              icon="shoe-print"
              label={t('health.steps')}
              unit=""
              theme={theme}
            />
            <MetricRing
              value={healthData.activeMinutes}
              max={healthData.activeMinutesGoal}
              color={theme.colors.blue}
              icon="run"
              label={t('health.active')}
              unit=" min"
              theme={theme}
            />
            <MetricRing
              value={healthData.calories}
              max={healthData.caloriesGoal}
              color={theme.colors.warning}
              icon="fire"
              label={t('health.calories')}
              unit=""
              theme={theme}
            />
            {healthData.sleepHours !== null && (
              <MetricRing
                value={healthData.sleepHours}
                max={9}
                color={theme.colors.purple}
                icon="moon-waning-crescent"
                label={t('health.sleep')}
                unit=" hrs"
                theme={theme}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* ── ALERTS ── */}
        {healthData.alerts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <SectionHeader title={t('health.activeAlerts')} />
            {healthData.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} theme={theme} onDismiss={dismissAlert} />
            ))}
          </Animated.View>
        )}

        {/* ── STEPS TREND ── */}
        {stepsTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(300)}>
            <SectionHeader title={t('health.stepsLast7Days')} />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={stepsTrend} color={theme.colors.blue} theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP TREND ── */}
        {sleepTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(300)}>
            <SectionHeader title={t('health.sleepQualityRecent')} />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={sleepTrend} color={theme.colors.purple} theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP & RECOVERY DETAIL ── */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)}>
          <SectionHeader title={t('health.recoverySleep')} />
          <View style={styles.detailGrid}>
            <GlassCard style={{ ...styles.detailCard, flex: 1, marginRight: 8 }}>
              <MaterialCommunityIcons
                name="shield-check"
                size={24}
                color={
                  hasAnyMetrics && healthData.recoveryScore > 70
                    ? theme.colors.accent
                    : hasAnyMetrics
                      ? theme.colors.warning
                      : theme.colors.textMuted
                }
              />
              <ThemedText
                variant="h3"
                style={{
                  marginTop: 8,
                  color:
                    hasAnyMetrics && healthData.recoveryScore > 70
                      ? theme.colors.accent
                      : hasAnyMetrics
                        ? theme.colors.warning
                        : theme.colors.textMuted,
                }}
              >
                {hasAnyMetrics ? `${healthData.recoveryScore}%` : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('dashboard.recovery')}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {!hasAnyMetrics
                  ? t('health.noDataYet') || 'No data yet'
                  : healthData.recoveryScore > 80
                    ? t('health.recoveryReady')
                    : healthData.recoveryScore > 60
                      ? t('health.recoveryModerate')
                      : t('health.recoveryRest')}
              </ThemedText>
            </GlassCard>

            <TouchableOpacity onPress={() => setShowSleepModal(true)} activeOpacity={0.7}>
              <GlassCard style={{ ...styles.detailCard, flex: 1, marginLeft: 8 }}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={theme.colors.purple} />
                <ThemedText variant="h3" style={{ marginTop: 8, color: theme.colors.purple }}>
                  {healthData.sleepQuality !== null ? `${healthData.sleepQuality}%` : '—'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {t('health.sleepQuality')}
                </ThemedText>
                <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                  {healthData.sleepHours !== null
                    ? `${healthData.sleepHours}${t('health.avgThisWeek')}`
                    : t('health.logSleep')}
                </ThemedText>
              </GlassCard>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── WEARABLE FEATURES — COMING SOON ── */}
        <Animated.View entering={FadeInDown.delay(700).duration(300)}>
          <SectionHeader title={t('common.comingSoon') || 'Coming Soon'} />
          <GlassCard style={{ padding: 16, marginBottom: 16 }}>
            {[
              {
                icon: 'heart-pulse' as const,
                label: t('health.heartRate') || 'Heart Rate Monitoring',
                desc: t('health.comingSoonDetail'),
                color: theme.colors.error,
              },
              {
                icon: 'watch' as const,
                label: 'Wearable Sync',
                desc: 'Connect your smartwatch for real-time health data.',
                color: theme.colors.blue,
              },
            ].map((item, idx) => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: theme.colors.border,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: item.color + '18',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText variant="bodySmall" weight="600" color="primary">
                      {item.label}
                    </ThemedText>
                    <View
                      style={{
                        backgroundColor: theme.colors.warning + '25',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: theme.colors.warning, fontSize: 9, fontWeight: '700' }}>SOON</Text>
                    </View>
                  </View>
                  <ThemedText variant="caption" color="muted" numberOfLines={2}>
                    {item.desc}
                  </ThemedText>
                </View>
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* ── QUICK ACTIONS ── */}
        <Animated.View entering={FadeInDown.delay(800).duration(300)}>
          <SectionHeader title={t('health.quickActions')} />
          <View style={styles.actionsRow}>
            <GradientButton
              title={t('health.logSleep')}
              icon="moon-waning-crescent"
              variant="primary"
              size="sm"
              onPress={() => setShowSleepModal(true)}
              style={{ flex: 1, marginRight: 4 }}
            />
            <GradientButton
              title={healthActionBusy ? t('health.loading') : t('health.connectProvider')}
              variant="primary"
              size="sm"
              onPress={() => {
                void handleConnectHealth();
              }}
              style={{ flex: 1, marginHorizontal: 4 }}
            />
            <GradientButton
              title={healthActionBusy ? t('health.loading') : t('health.syncNow')}
              variant="primary"
              size="sm"
              onPress={() => {
                void handleSyncHealth();
              }}
              style={{ flex: 1, marginLeft: 4 }}
            />
          </View>
        </Animated.View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── SLEEP LOG MODAL ── */}
      <Modal visible={showSleepModal} transparent animationType="fade" onRequestClose={() => setShowSleepModal(false)}>
        <View style={sleepModalStyles.overlay}>
          <View style={[sleepModalStyles.content, { backgroundColor: theme.colors.surface }]}>
            <View style={[sleepModalStyles.iconWrap, { backgroundColor: theme.colors.purple + '18' }]}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={28} color={theme.colors.purple} />
            </View>
            <Text style={[sleepModalStyles.title, { color: theme.colors.text }]}>{t('health.logSleep')}</Text>

            {/* Bedtime picker */}
            <Text style={[sleepModalStyles.label, { color: theme.colors.textSecondary }]}>
              {t('health.sleepBedtime')}
            </Text>
            <View style={sleepModalStyles.timeRow}>
              <TimeWheel value={sleepBedHour} max={23} onChange={setSleepBedHour} theme={theme} />
              <Text style={[sleepModalStyles.colon, { color: theme.colors.text }]}>:</Text>
              <TimeWheel value={sleepBedMin} max={59} step={5} onChange={setSleepBedMin} theme={theme} />
            </View>

            {/* Wake time picker */}
            <Text style={[sleepModalStyles.label, { color: theme.colors.textSecondary, marginTop: 16 }]}>
              {t('health.sleepWakeTime')}
            </Text>
            <View style={sleepModalStyles.timeRow}>
              <TimeWheel value={sleepWakeHour} max={23} onChange={setSleepWakeHour} theme={theme} />
              <Text style={[sleepModalStyles.colon, { color: theme.colors.text }]}>:</Text>
              <TimeWheel value={sleepWakeMin} max={59} step={5} onChange={setSleepWakeMin} theme={theme} />
            </View>

            {/* Duration preview */}
            <SleepDurationPreview
              bedHour={sleepBedHour}
              bedMin={sleepBedMin}
              wakeHour={sleepWakeHour}
              wakeMin={sleepWakeMin}
              theme={theme}
            />

            {/* Actions */}
            <View style={sleepModalStyles.actions}>
              <TouchableOpacity
                onPress={() => setShowSleepModal(false)}
                style={[sleepModalStyles.btn, { borderColor: theme.colors.border, borderWidth: 1 }]}
              >
                <Text style={[sleepModalStyles.btnText, { color: theme.colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleSaveSleep()}
                disabled={sleepSaving}
                style={[sleepModalStyles.btn, { backgroundColor: theme.colors.purple, opacity: sleepSaving ? 0.5 : 1 }]}
              >
                <Text style={[sleepModalStyles.btnText, { color: theme.colors.onAccent }]}>
                  {sleepSaving ? '...' : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================
// SLEEP MODAL HELPERS
// ============================================

function TimeWheel({
  value,
  max,
  step = 1,
  onChange,
  theme,
}: {
  value: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  theme: any;
}) {
  const inc = () => {
    const next = value + step;
    onChange(next > max ? 0 : next);
  };
  const dec = () => {
    const next = value - step;
    // Snap to the highest valid multiple of step within range
    onChange(next < 0 ? max - (max % step) : next);
  };
  const display = String(value).padStart(2, '0');
  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity onPress={inc} hitSlop={8} accessibilityLabel="Increase">
        <MaterialCommunityIcons name="chevron-up" size={28} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      <View
        style={{
          width: 56,
          height: 48,
          borderRadius: 12,
          backgroundColor: theme.colors.surfaceVariant,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}>{display}</Text>
      </View>
      <TouchableOpacity onPress={dec} hitSlop={8} accessibilityLabel="Decrease">
        <MaterialCommunityIcons name="chevron-down" size={28} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function SleepDurationPreview({
  bedHour,
  bedMin,
  wakeHour,
  wakeMin,
  theme,
}: {
  bedHour: number;
  bedMin: number;
  wakeHour: number;
  wakeMin: number;
  theme: any;
}) {
  let totalMin = wakeHour * 60 + wakeMin - (bedHour * 60 + bedMin);
  if (totalMin <= 0) totalMin += 24 * 60;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return (
    <View style={{ alignItems: 'center', marginTop: 16 }}>
      <Text style={{ fontSize: 14, color: theme.colors.textMuted }}>
        {hrs}h {mins > 0 ? `${mins}m` : ''}
      </Text>
    </View>
  );
}

const sleepModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colon: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scoreCard: {
    marginBottom: 16,
    padding: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  scoreDetails: {
    marginLeft: 24,
    flex: 1,
    gap: 8,
  },
  scoreDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  trendCard: {
    padding: 16,
    marginBottom: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailCard: {
    padding: 16,
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
});

export default function HealthDashboardScreen() {
  const router = useRouter();
  return (
    <ScreenErrorBoundary
      screenName="Health Dashboard"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
    >
      <PremiumGate featureName="Health Dashboard">
        <ScreenTutorial
          screenKey="health-dashboard"
          icon="heart-pulse"
          title="Health Dashboard"
          description="Monitor your overall health with composite scores, daily metrics, sleep trends, and anomaly alerts. Your health data stays encrypted on-device."
        />
        <HealthDashboardScreenInner />
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}
