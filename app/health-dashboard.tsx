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

import React, { useState, useEffect, useCallback } from 'react';

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
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import {
  GlassCard,
  GradientButton,
  SectionHeader,
  AnimatedCounter,
  PulseDot,
} from '../src/components/ui/GlassUI';
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
  const [healthProviderCode, setHealthProviderCode] = useState<'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown' | 'unavailable'>('none');
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
    recoveryScore: 75,
    workoutsThisWeek: 0,
    workoutsGoal: 4,
    streakDays: 0,
    anomalyCount: 0,
    alerts: [],
  });
  const [stepsTrend, setStepsTrend] = useState<TrendPoint[]>([]);
  const [sleepTrend, setSleepTrend] = useState<TrendPoint[]>([]);

  const loadHealthData = useCallback(async () => {
    try {
      try {
        const adapter = await getHealthAdapter();
        if (adapter) {
          const status = await adapter.getStatus();
          setHealthProviderCode((status.provider || 'unknown') as typeof healthProviderCode);
          setHealthLastSyncLabel(status.lastSyncTime ? status.lastSyncTime.toLocaleString() : t('health.lastSyncNever'));
        } else {
          setHealthProviderCode('none');
          setHealthLastSyncLabel(t('health.lastSyncNever'));
        }
      } catch {
        setHealthProviderCode('unavailable');
      }

      // Get composite health score from engine
      const score = await backgroundHealth.calculateHealthScore();
      const snapshot = await backgroundHealth.getSnapshot();

      // Get sleep data
      let sleepHrs: number | null = null;
      let sleepQual: number | null = null;
      try {
        const sleepAnalytics = await sleepEngine.getAnalytics(7);
        if (sleepAnalytics.avgDurationMs > 0) {
          sleepHrs = Math.round((sleepAnalytics.avgDurationMs / 3600000) * 10) / 10;
          sleepQual = sleepAnalytics.avgQualityScore;
        }
      } catch (e) {
        // Sleep data not available yet
      }

      // Get active alerts
      let alerts: HealthAlert[] = [];
      let anomalyCount = 0;
      try {
        const rawAlerts = await encryptedDB.getActiveAlerts();
        alerts = rawAlerts.map((a) => ({
          id: a.id ?? String(Date.now()),
          type: a.alertType ?? 'health',
          severity: a.severity ?? 'LOW',
          message: String((a.data as any)?.message ?? t('health.alert')),
          created_at: a.created_at ?? Date.now(),
        }));
        anomalyCount = alerts.length;
      } catch (e) {
        // No alerts
      }

      // Get weekly workout count from DB
      let workoutsThisWeek = 0;
      let streakDays = 0;
      try {
        const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
        workoutsThisWeek = await getWorkoutCountSince(weekStart);
        streakDays = await getWorkoutStreakCurrent('user_local_001');
      } catch (e) {
        // DB not ready
      }

      // Build step trend (last 7 days)
      const stepTrend: TrendPoint[] = [];
      const sleepTrendPts: TrendPoint[] = [];
      try {
        const dayNames = [t('day.sun'), t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'), t('day.fri'), t('day.sat')];
        const rows = await getStepHistory('user_local_001', 7);
        for (const row of (rows ?? []).reverse()) {
          const d = new Date(row.date);
          stepTrend.push({ label: dayNames[d.getDay()]!, value: row.steps });
        }

        // Sleep trend from encrypted storage
        const sleepData = await encryptedDB.getRecentHealthData('sleep_session', 7);
        for (const entry of sleepData ?? []) {
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
      } catch (e) {
        // Trends not available
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
      console.error('[HealthDashboard] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dbReady) loadHealthData();
  }, [dbReady, loadHealthData]);

  // Subscribe to health data events from other screens
  useDataSync('workout_completed', loadHealthData);
  useDataSync('jog_completed', loadHealthData);
  useDataSync('steps_updated', loadHealthData);
  useDataSync('health_data_updated', loadHealthData);

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
      console.error('[HealthDashboard] Failed to dismiss alert:', e);
    }
  }, []);

  const handleConnectHealth = useCallback(async () => {
    if (healthActionBusy) return;
    setHealthActionBusy(true);
    try {
      const result = await initializeHealthIntegration();
      if (!result.success) {
        Alert.alert(
          t('health.connectProvider'),
          result.error || t('health.providerConnectFailed')
        );
        return;
      }
      Alert.alert(
        t('health.connectProvider'),
        t('health.providerConnected')
      );
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (adapter?.provider === 'health_connect' || adapter?.provider === 'healthkit' || adapter?.provider === 'google_fit') {
          provider = adapter.provider;
        }
      } catch {
        // fallback provider stays default
      }
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'auth',
      });
      Alert.alert(
        t('health.connectProvider'),
        t('health.providerConnectFailed')
      );
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
        `${t('health.synced')}: ${result.synced}\n${t('health.errors')}: ${result.errors}`
      );
      await loadHealthData();
    } catch (error) {
      let provider: 'health_connect' | 'healthkit' | 'google_fit' = 'health_connect';
      try {
        const adapter = await getHealthAdapter();
        if (adapter?.provider === 'health_connect' || adapter?.provider === 'healthkit' || adapter?.provider === 'google_fit') {
          provider = adapter.provider;
        }
      } catch {
        // fallback provider stays default
      }
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider,
        action: 'sync',
      });
      Alert.alert(
        t('health.syncNow'),
        t('health.syncFailed')
      );
    } finally {
      setHealthActionBusy(false);
    }
  }, [healthActionBusy, loadHealthData, t]);

  // Health score color
  const scoreColor =
    healthData.healthScore >= 80
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
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
                  <AnimatedCounter
                    value={healthData.healthScore}
                    style={{
                      fontSize: 36,
                      fontWeight: '800',
                      color: scoreColor,
                    }}
                  />
                </View>
                <ThemedText variant="caption" color="muted" style={{ marginTop: 8 }}>
                  {t('health.healthScore')}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
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
              <AlertCard
                key={alert.id}
                alert={alert}
                theme={theme}
                onDismiss={dismissAlert}
              />
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
                color={healthData.recoveryScore > 70 ? theme.colors.accent : theme.colors.warning}
              />
              <ThemedText variant="h3" style={{ marginTop: 8, color: healthData.recoveryScore > 70 ? theme.colors.accent : theme.colors.warning }}>
                {healthData.recoveryScore}%
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('dashboard.recovery')}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {healthData.recoveryScore > 80
                  ? t('health.recoveryReady')
                  : healthData.recoveryScore > 60
                  ? t('health.recoveryModerate')
                  : t('health.recoveryRest')}
              </ThemedText>
            </GlassCard>

            <GlassCard style={{ ...styles.detailCard, flex: 1, marginLeft: 8 }}>
              <MaterialCommunityIcons
                name="moon-waning-crescent"
                size={24}
                color={theme.colors.purple}
              />
              <ThemedText variant="h3" style={{ marginTop: 8, color: theme.colors.purple }}>
                {healthData.sleepQuality !== null
                  ? `${healthData.sleepQuality}%`
                  : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('health.sleepQuality')}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {healthData.sleepHours !== null
                  ? `${healthData.sleepHours}${t('health.avgThisWeek')}`
                  : t('health.noSleepData')}
              </ThemedText>
            </GlassCard>
          </View>
        </Animated.View>

        {/* ── WEARABLE FEATURES — COMING SOON ── */}
        <Animated.View entering={FadeInDown.delay(700).duration(300)}>
          <SectionHeader title={t('common.comingSoon') || 'Coming Soon'} />
          <GlassCard style={{ padding: 16, marginBottom: 16 }}>
            {[
              { icon: 'heart-pulse' as const, label: t('health.heartRate') || 'Heart Rate Monitoring', desc: t('health.comingSoonDetail'), color: theme.colors.error },
              { icon: 'sleep' as const, label: t('health.sleep') || 'Auto Sleep Tracking', desc: t('health.sleepComingSoon'), color: theme.colors.purple },
              { icon: 'watch' as const, label: 'Wearable Sync', desc: 'Connect your smartwatch for real-time health data.', color: theme.colors.blue },
            ].map((item, idx) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: theme.colors.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText variant="bodySmall" weight="600" color="primary">{item.label}</ThemedText>
                    <View style={{ backgroundColor: theme.colors.warning + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: theme.colors.warning, fontSize: 9, fontWeight: '700' }}>SOON</Text>
                    </View>
                  </View>
                  <ThemedText variant="caption" color="muted" numberOfLines={2}>{item.desc}</ThemedText>
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
              title={healthActionBusy ? t('health.loading') : t('health.connectProvider')}
              variant="primary"
              size="sm"
              onPress={() => {
                void handleConnectHealth();
              }}
              style={{ flex: 1, marginRight: 8 }}
            />
            <GradientButton
              title={healthActionBusy ? t('health.loading') : t('health.syncNow')}
              variant="primary"
              size="sm"
              onPress={() => {
                void handleSyncHealth();
              }}
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
        </Animated.View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    <ScreenErrorBoundary screenName="Health Dashboard" onGoBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}>
      <ScreenTutorial
        screenKey="health-dashboard"
        icon="heart-pulse"
        title="Health Dashboard"
        description="Monitor your overall health with composite scores, daily metrics, sleep trends, and anomaly alerts. Your health data stays encrypted on-device."
      />
      <HealthDashboardScreenInner />
    </ScreenErrorBoundary>
  );
}
