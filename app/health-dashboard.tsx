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
import ThemedText from '../src/components/ThemedText';
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
import { getDatabase } from '../src/database/schema';

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

interface HealthAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function MetricRing({
  value,
  max,
  size = 80,
  strokeWidth = 6,
  color,
  icon,
  label,
  unit,
  theme,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  icon: string;
  label: string;
  unit: string;
  theme: any;
}) {
  const progress = Math.min(1, value / Math.max(1, max));
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ alignItems: 'center', width: size + 16 }}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {/* Background ring */}
        <View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color + '20',
            },
          ]}
        />
        {/* Progress ring (simplified — full SVG ring would need react-native-svg) */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderRightColor: progress < 0.75 ? 'transparent' : color,
            borderBottomColor: progress < 0.5 ? 'transparent' : color,
            borderLeftColor: progress < 0.25 ? 'transparent' : color,
            transform: [{ rotate: '-90deg' }],
          }}
        />
        <MaterialCommunityIcons
          name={icon as any}
          size={size * 0.3}
          color={color}
        />
      </View>
      <ThemedText
        variant="caption"
        color="muted"
        style={{ marginTop: 4, textAlign: 'center' }}
      >
        {label}
      </ThemedText>
      <ThemedText
        variant="body"
        style={{ color, fontWeight: '700', textAlign: 'center' }}
      >
        {value.toLocaleString()}{unit}
      </ThemedText>
    </View>
  );
}

function AlertCard({
  alert,
  theme,
  onDismiss,
}: {
  alert: HealthAlert;
  theme: any;
  onDismiss: (id: string) => void;
}) {
  const severityColors: Record<string, string> = {
    LOW: theme.colors.textMuted,
    MEDIUM: '#F4A427',
    HIGH: '#F97316',
    CRITICAL: '#EF4444',
  };
  const bgColor = severityColors[alert.severity] ?? theme.colors.textMuted;

  return (
    <Animated.View entering={SlideInRight.duration(300)}>
      <TouchableOpacity
        onPress={() => onDismiss(alert.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: bgColor + '15',
              borderLeftColor: bgColor,
              borderLeftWidth: 3,
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons
              name={alert.severity === 'CRITICAL' ? 'alert-circle' : 'alert-outline'}
              size={18}
              color={bgColor}
            />
            <ThemedText variant="caption" style={{ color: bgColor, fontWeight: '700', marginLeft: 6, flex: 1 }}>
              {alert.severity} — {alert.type}
            </ThemedText>
            <MaterialCommunityIcons name="close" size={16} color={theme.colors.textMuted} />
          </View>
          <ThemedText variant="caption" color="secondary" style={{ marginTop: 4 }}>
            {alert.message}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function TrendBar({
  data,
  color,
  theme,
}: {
  data: TrendPoint[];
  color: string;
  theme: any;
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.trendContainer}>
      {data.map((point, i) => (
        <View key={i} style={styles.trendBarWrapper}>
          <View style={[styles.trendBarBg, { backgroundColor: color + '20' }]}>
            <Animated.View
              entering={FadeInUp.delay(i * 50).duration(300)}
              style={[
                styles.trendBarFill,
                {
                  backgroundColor: color,
                  height: `${Math.max(5, (point.value / maxVal) * 100)}%`,
                },
              ]}
            />
          </View>
          <ThemedText variant="caption" color="muted" style={{ fontSize: 9, marginTop: 2 }}>
            {point.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function HealthDashboardScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      let alerts: Alert[] = [];
      let anomalyCount = 0;
      try {
        const rawAlerts = await encryptedDB.getActiveAlerts();
        alerts = rawAlerts.map((a) => ({
          id: a.id ?? String(Date.now()),
          type: a.alertType ?? 'health',
          severity: a.severity ?? 'LOW',
          message: String((a.data as any)?.message ?? 'Health alert'),
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
        const db = await getDatabase();
        const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const wRow = await db.getFirstAsync<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM workout_sessions WHERE started_at >= ?`,
          [weekStart]
        );
        workoutsThisWeek = wRow?.cnt ?? 0;

        const sRow = await db.getFirstAsync<{ current_streak: number }>(
          `SELECT current_streak FROM workout_streaks ORDER BY updated_at DESC LIMIT 1`
        );
        streakDays = sRow?.current_streak ?? 0;
      } catch (e) {
        // DB not ready
      }

      // Build step trend (last 7 days)
      const stepTrend: TrendPoint[] = [];
      const sleepTrendPts: TrendPoint[] = [];
      try {
        const db = await getDatabase();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const rows = await db.getAllAsync<{ date: string; steps: number }>(
          `SELECT date, steps FROM daily_steps ORDER BY date DESC LIMIT 7`
        );
        for (const row of rows.reverse()) {
          const d = new Date(row.date);
          stepTrend.push({ label: dayNames[d.getDay()], value: row.steps });
        }

        // Sleep trend from encrypted storage
        const sleepData = await encryptedDB.getRecentHealthData('sleep_session', 7);
        for (const entry of sleepData) {
          try {
            const parsed = typeof entry === 'object' ? entry : JSON.parse(String(entry));
            sleepTrendPts.push({
              label: 'Day',
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
        steps: snapshot.steps,
        stepsGoal: 10000,
        activeMinutes: snapshot.activeMinutes,
        activeMinutesGoal: 30,
        calories: snapshot.calories,
        caloriesGoal: 2000,
        heartRate: snapshot.restingHeartRate || null,
        sleepHours: sleepHrs,
        sleepQuality: sleepQual,
        recoveryScore: snapshot.recoveryScore,
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
    loadHealthData();
  }, [loadHealthData]);

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

  // Health score color
  const scoreColor =
    healthData.healthScore >= 80
      ? '#10B981'
      : healthData.healthScore >= 60
      ? '#F4A427'
      : healthData.healthScore >= 40
      ? '#F97316'
      : '#EF4444';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <ThemedText variant="body" color="muted" style={{ marginTop: 16 }}>
            Loading health data...
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
        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={styles.header}>
            <View>
              <ThemedText variant="h2" color="primary">
                Health Dashboard
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                Your wellness at a glance
              </ThemedText>
            </View>
            {healthData.anomalyCount > 0 && (
              <View style={styles.alertBadge}>
                <PulseDot color="#EF4444" size={8} />
                <ThemedText variant="caption" style={{ color: '#EF4444', marginLeft: 4 }}>
                  {healthData.anomalyCount} alert{healthData.anomalyCount > 1 ? 's' : ''}
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
                  Health Score
                </ThemedText>
              </View>

              <View style={styles.scoreDetails}>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    Recovery: {healthData.recoveryScore}%
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="fire" size={16} color="#F97316" />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    Streak: {healthData.streakDays} days
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                    Workouts: {healthData.workoutsThisWeek}/{healthData.workoutsGoal}
                  </ThemedText>
                </View>
                {healthData.heartRate && (
                  <View style={styles.scoreDetailRow}>
                    <MaterialCommunityIcons name="heart-pulse" size={16} color="#EF4444" />
                    <ThemedText variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                      HR: {healthData.heartRate} bpm
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── DAILY METRICS RINGS ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <SectionHeader title="Today's Progress" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
            <MetricRing
              value={healthData.steps}
              max={healthData.stepsGoal}
              color="#10B981"
              icon="shoe-print"
              label="Steps"
              unit=""
              theme={theme}
            />
            <MetricRing
              value={healthData.activeMinutes}
              max={healthData.activeMinutesGoal}
              color="#3B82F6"
              icon="run"
              label="Active"
              unit=" min"
              theme={theme}
            />
            <MetricRing
              value={healthData.calories}
              max={healthData.caloriesGoal}
              color="#F97316"
              icon="fire"
              label="Calories"
              unit=""
              theme={theme}
            />
            {healthData.sleepHours !== null && (
              <MetricRing
                value={healthData.sleepHours}
                max={9}
                color="#8B5CF6"
                icon="moon-waning-crescent"
                label="Sleep"
                unit=" hrs"
                theme={theme}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* ── ALERTS ── */}
        {healthData.alerts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <SectionHeader title="Active Alerts" />
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
            <SectionHeader title="Steps — Last 7 Days" />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={stepsTrend} color="#10B981" theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP TREND ── */}
        {sleepTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(300)}>
            <SectionHeader title="Sleep Quality — Recent" />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={sleepTrend} color="#8B5CF6" theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP & RECOVERY DETAIL ── */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)}>
          <SectionHeader title="Recovery & Sleep" />
          <View style={styles.detailGrid}>
            <GlassCard style={{ ...styles.detailCard, flex: 1, marginRight: 8 }}>
              <MaterialCommunityIcons
                name="shield-check"
                size={24}
                color={healthData.recoveryScore > 70 ? '#10B981' : '#F4A427'}
              />
              <ThemedText variant="h3" style={{ marginTop: 8, color: healthData.recoveryScore > 70 ? '#10B981' : '#F4A427' }}>
                {healthData.recoveryScore}%
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                Recovery
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {healthData.recoveryScore > 80
                  ? 'Ready to push hard'
                  : healthData.recoveryScore > 60
                  ? 'Moderate — normal training'
                  : 'Consider rest or light work'}
              </ThemedText>
            </GlassCard>

            <GlassCard style={{ ...styles.detailCard, flex: 1, marginLeft: 8 }}>
              <MaterialCommunityIcons
                name="moon-waning-crescent"
                size={24}
                color="#8B5CF6"
              />
              <ThemedText variant="h3" style={{ marginTop: 8, color: '#8B5CF6' }}>
                {healthData.sleepQuality !== null
                  ? `${healthData.sleepQuality}%`
                  : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                Sleep Quality
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: 10, marginTop: 4 }}>
                {healthData.sleepHours !== null
                  ? `${healthData.sleepHours}h avg this week`
                  : 'No sleep data yet'}
              </ThemedText>
            </GlassCard>
          </View>
        </Animated.View>

        {/* ── QUICK ACTIONS ── */}
        <Animated.View entering={FadeInDown.delay(700).duration(300)}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsRow}>
            <GradientButton
              title="Log Heart Rate"
              variant="primary"
              size="sm"
              onPress={() => Alert.alert('Coming Soon', 'Heart rate logging will be available in the next update.')}
              style={{ flex: 1, marginRight: 8 }}
            />
            <GradientButton
              title="Log Sleep"
              variant="primary"
              size="sm"
              onPress={() => Alert.alert('Coming Soon', 'Sleep logging will be available in the next update.')}
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
    backgroundColor: '#EF444420',
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
  alertCard: {
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendCard: {
    padding: 16,
    marginBottom: 16,
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  trendBarWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  trendBarBg: {
    width: '80%',
    height: 60,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 4,
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
