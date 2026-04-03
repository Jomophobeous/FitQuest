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

import React from 'react';

import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Text,
  Modal,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import { GlassCard, GradientButton, SectionHeader, AnimatedCounter, PulseDot } from '../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useRouter } from 'expo-router';
import { haptic } from '../src/utils/haptics';
import {
  MetricRing,
  AlertCard,
  TrendBar,
} from '../src/components/health/HealthWidgets';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';
import { typography, spacing } from '../src/design/theme-system';
import { useHealthDashboardViewModel } from '../src/viewmodels/useHealthDashboardViewModel';


const { width: _SCREEN_WIDTH } = Dimensions.get('window');

function HealthDashboardScreenInner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const vm = useHealthDashboardViewModel();

  // Health score color (pure UI derivation)
  const scoreColor = !vm.hasAnyMetrics
    ? theme.colors.textMuted
    : vm.healthData.healthScore >= 80
      ? theme.colors.accent
      : vm.healthData.healthScore >= 60
        ? theme.colors.warning
        : theme.colors.error;
  if (vm.loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <ThemedText variant="body" color="muted" style={{ marginTop: spacing[4] }}>
            {t('health.loading')}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>{vm.loadError}</ThemedText>
          <GradientButton title={t('common.retry') ?? 'Retry'} onPress={vm.retryLoad} style={{ marginTop: spacing[4] }} />
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
          <RefreshControl refreshing={vm.refreshing} onRefresh={vm.onRefresh} tintColor={theme.colors.accent} />
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
                {`${t(`health.provider.${vm.healthProviderCode}`)} · ${t('health.lastSync')}: ${vm.healthLastSyncLabel || t('health.lastSyncNever')}`}
              </ThemedText>
            </View>
            {vm.healthData.anomalyCount > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: theme.colors.error + '20' }]}>
                <PulseDot color={theme.colors.error} size={8} />
                <ThemedText variant="caption" style={{ color: theme.colors.error, marginLeft: spacing[1] }}>
                  {vm.healthData.anomalyCount} {vm.healthData.anomalyCount > 1 ? t('health.alerts') : t('health.alert')}
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
                  {vm.hasAnyMetrics ? (
                    <AnimatedCounter
                      value={vm.healthData.healthScore}
                      style={{
                        fontSize: typography.sizes.display, 
                        fontWeight: '800',
                        color: scoreColor,
                      }}
                    />
                  ) : (
                    <Text style={{ fontSize: typography.sizes.display, fontWeight: '800', color: scoreColor }}>—</Text>
                  )}
                </View>
                <ThemedText variant="caption" color="muted" style={{ marginTop: spacing[2] }}>
                  {vm.hasAnyMetrics ? t('health.healthScore') : t('health.noDataYet') || 'Start a workout to track'}
                </ThemedText>
              </View>

              <View style={styles.scoreDetails}>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: spacing[1.5] }}>
                    {t('health.recovery')}: {vm.healthData.recoveryScore}%
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="fire" size={16} color={theme.colors.warning} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: spacing[1.5] }}>
                    {t('health.streakDays')}: {vm.healthData.streakDays}
                  </ThemedText>
                </View>
                <View style={styles.scoreDetailRow}>
                  <MaterialCommunityIcons name="dumbbell" size={16} color={theme.colors.accent} />
                  <ThemedText variant="caption" color="secondary" style={{ marginLeft: spacing[1.5] }}>
                    {t('health.workoutsCount')}: {vm.healthData.workoutsThisWeek}/{vm.healthData.workoutsGoal}
                  </ThemedText>
                </View>
                {!!vm.healthData.heartRate && (
                  <View style={styles.scoreDetailRow}>
                    <MaterialCommunityIcons name="heart-pulse" size={16} color={theme.colors.error} />
                    <ThemedText variant="caption" color="secondary" style={{ marginLeft: spacing[1.5] }}>
                      {t('health.heartRate')}: {vm.healthData.heartRate} {t('health.bpm')}
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
              value={vm.healthData.steps}
              max={vm.healthData.stepsGoal}
              color={theme.colors.blue}
              icon="shoe-print"
              label={t('health.steps')}
              unit=""
              theme={theme}
            />
            <MetricRing
              value={vm.healthData.activeMinutes}
              max={vm.healthData.activeMinutesGoal}
              color={theme.colors.blue}
              icon="run"
              label={t('health.active')}
              unit=" min"
              theme={theme}
            />
            <MetricRing
              value={vm.healthData.calories}
              max={vm.healthData.caloriesGoal}
              color={theme.colors.warning}
              icon="fire"
              label={t('health.calories')}
              unit=""
              theme={theme}
            />
            {vm.healthData.sleepHours !== null && (
              <MetricRing
                value={vm.healthData.sleepHours}
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
        {vm.healthData.alerts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <SectionHeader title={t('health.activeAlerts')} />
            {vm.healthData.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} theme={theme} onDismiss={vm.dismissAlert} />
            ))}
          </Animated.View>
        )}

        {/* ── STEPS TREND ── */}
        {vm.stepsTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(300)}>
            <SectionHeader title={t('health.stepsLast7Days')} />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={vm.stepsTrend} color={theme.colors.blue} theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP TREND ── */}
        {vm.sleepTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(300)}>
            <SectionHeader title={t('health.sleepQualityRecent')} />
            <GlassCard style={styles.trendCard}>
              <TrendBar data={vm.sleepTrend} color={theme.colors.purple} theme={theme} />
            </GlassCard>
          </Animated.View>
        )}

        {/* ── SLEEP & RECOVERY DETAIL ── */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)}>
          <SectionHeader title={t('health.recoverySleep')} />
          <View style={styles.detailGrid}>
            <GlassCard style={{ ...styles.detailCard, flex: 1, marginRight: spacing[2] }}>
              <MaterialCommunityIcons
                name="shield-check"
                size={24}
                color={
                  vm.hasAnyMetrics && vm.healthData.recoveryScore > 70
                    ? theme.colors.accent
                    : vm.hasAnyMetrics
                      ? theme.colors.warning
                      : theme.colors.textMuted
                }
              />
              <ThemedText
                variant="h3"
                style={{
                  marginTop: spacing[2],
                  color:
                    vm.hasAnyMetrics && vm.healthData.recoveryScore > 70
                      ? theme.colors.accent
                      : vm.hasAnyMetrics
                        ? theme.colors.warning
                        : theme.colors.textMuted,
                }}
              >
                {vm.hasAnyMetrics ? `${vm.healthData.recoveryScore}%` : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('dashboard.recovery')}
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ fontSize: typography.sizes.xs, marginTop: spacing[1] }}>
                {!vm.hasAnyMetrics
                  ? t('health.noDataYet') || 'No data yet'
                  : vm.healthData.recoveryScore > 80
                    ? t('health.recoveryReady')
                    : vm.healthData.recoveryScore > 60
                      ? t('health.recoveryModerate')
                      : t('health.recoveryRest')}
              </ThemedText>
            </GlassCard>

            <TouchableOpacity onPress={() => vm.openSleepModal()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Log sleep session">
              <GlassCard style={{ ...styles.detailCard, flex: 1, marginLeft: spacing[2] }}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={theme.colors.purple} />
                <ThemedText variant="h3" style={{ marginTop: spacing[2], color: theme.colors.purple }}>
                  {vm.healthData.sleepQuality !== null ? `${vm.healthData.sleepQuality}%` : '—'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {t('health.sleepQuality')}
                </ThemedText>
                <ThemedText variant="caption" color="muted" style={{ fontSize: typography.sizes.xs, marginTop: spacing[1] }}>
                  {vm.healthData.sleepHours !== null
                    ? `${vm.healthData.sleepHours}${t('health.avgThisWeek')}`
                    : t('health.logSleep')}
                </ThemedText>
              </GlassCard>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── WEARABLE FEATURES — COMING SOON ── */}
        <Animated.View entering={FadeInDown.delay(700).duration(300)}>
          <SectionHeader title={t('common.comingSoon') || 'Coming Soon'} />
          <GlassCard style={{ padding: spacing[4], marginBottom: spacing[4] }}>
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
                  paddingVertical: spacing[3],
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
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] }}>
                    <ThemedText variant="bodySmall" weight="600" color="primary">
                      {item.label}
                    </ThemedText>
                    <View
                      style={{
                        backgroundColor: theme.colors.warning + '25',
                        paddingHorizontal: spacing[1.5],
                        paddingVertical: spacing[0.5],
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: theme.colors.warning, fontSize: typography.sizes.micro, fontWeight: '700' }}>SOON</Text>
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
              onPress={() => vm.openSleepModal()}
              style={{ flex: 1, marginRight: spacing[2] }}
            />
            <GradientButton
              title={vm.healthActionBusy ? t('health.loading') : t('health.syncNow')}
              variant="success"
              size="sm"
              onPress={() => {
                void vm.handleSyncHealth();
              }}
              style={{ flex: 1, marginLeft: spacing[2] }}
            />
          </View>
        </Animated.View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── SLEEP LOG MODAL ── */}
      <Modal visible={vm.showSleepModal} transparent animationType="fade" onRequestClose={() => vm.closeSleepModal()}>
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
              <TimeWheel value={vm.sleepBedHour} max={23} onChange={vm.setSleepBedHour} theme={theme} />
              <Text style={[sleepModalStyles.colon, { color: theme.colors.text }]}>:</Text>
              <TimeWheel value={vm.sleepBedMin} max={59} step={5} onChange={vm.setSleepBedMin} theme={theme} />
            </View>

            {/* Wake time picker */}
            <Text style={[sleepModalStyles.label, { color: theme.colors.textSecondary, marginTop: spacing[4] }]}>
              {t('health.sleepWakeTime')}
            </Text>
            <View style={sleepModalStyles.timeRow}>
              <TimeWheel value={vm.sleepWakeHour} max={23} onChange={vm.setSleepWakeHour} theme={theme} />
              <Text style={[sleepModalStyles.colon, { color: theme.colors.text }]}>:</Text>
              <TimeWheel value={vm.sleepWakeMin} max={59} step={5} onChange={vm.setSleepWakeMin} theme={theme} />
            </View>

            {/* Duration preview */}
            <SleepDurationPreview
              bedHour={vm.sleepBedHour}
              bedMin={vm.sleepBedMin}
              wakeHour={vm.sleepWakeHour}
              wakeMin={vm.sleepWakeMin}
              theme={theme}
            />

            {/* Actions */}
            <View style={sleepModalStyles.actions}>
              <TouchableOpacity
                onPress={() => vm.closeSleepModal()}
                style={[sleepModalStyles.btn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Cancel sleep log"
              >
                <Text style={[sleepModalStyles.btnText, { color: theme.colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void vm.handleSaveSleep()}
                disabled={vm.sleepSaving}
                style={[sleepModalStyles.btn, { backgroundColor: theme.colors.purple, opacity: vm.sleepSaving ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Save sleep log"
              >
                <Text style={[sleepModalStyles.btnText, { color: theme.colors.onAccent }]}>
                  {vm.sleepSaving ? '...' : t('common.save')}
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
      <TouchableOpacity onPress={() => { haptic('buttonPress'); inc(); }} hitSlop={8} accessibilityLabel="Increase">
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
        <Text style={{ fontSize: typography.sizes.h3, fontWeight: '700', color: theme.colors.text }}>{display}</Text>
      </View>
      <TouchableOpacity onPress={() => { haptic('buttonPress'); dec(); }} hitSlop={8} accessibilityLabel="Decrease">
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
    <View style={{ alignItems: 'center', marginTop: spacing[4] }}>
      <Text style={{ fontSize: typography.sizes.bodySmall, color: theme.colors.textMuted }}>
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
    padding: spacing[6],
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: spacing[6],
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.sizes.h3, 
    fontWeight: '800',
    marginBottom: spacing[5],
  },
  label: {
    fontSize: typography.sizes.label, 
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  colon: {
    fontSize: typography.sizes.h2, 
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2.5],
    width: '100%',
    marginTop: spacing[6],
  },
  btn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: typography.sizes.bodyMid, 
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scoreCard: {
    marginBottom: spacing[4],
    padding: spacing[5],
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
    marginLeft: spacing[6],
    flex: 1,
    gap: spacing[2],
  },
  scoreDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  trendCard: {
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  detailGrid: {
    flexDirection: 'row',
    marginBottom: spacing[4],
  },
  detailCard: {
    padding: spacing[4],
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: spacing[4],
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
