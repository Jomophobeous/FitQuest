/**
 * FitQuest Move Tab
 * Step counting and jog/walk tracking with premium glass UI
 *
 * CRITICAL: This is utility mode, NOT training logic.
 * - No fatigue impact
 * - No progression
 * Walking 10k steps must NOT affect the workout engine.
 */

import React from 'react';
import { View, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeInRight, ZoomIn, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import {
  GlassCard,
  GradientButton,
  SectionHeader,
  ProgressRing,
  PulseDot,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import JogMap from '../src/components/JogMap';
import { typography, spacing, radius } from '../src/design/theme-system';
import { useMoveViewModel, type ActivityType } from '../src/viewmodels/useMoveViewModel';
import { moveStyles as styles, sensorStyles, getActivityIcon, formatActivity } from '../src/components/move/styles';

export default function MoveScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const vm = useMoveViewModel();

  if (!vm.dbReady) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </ScreenContainer>
    );
  }

  if (vm.loadError) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>
          {vm.loadError}
        </ThemedText>
        <GradientButton title={t('common.retry') ?? 'Retry'} onPress={vm.retryLoad} style={{ marginTop: spacing[4] }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Move" onGoBack={() => {}}>
      <ScreenContainer scroll>
        <ScreenTutorial
          screenKey="move"
          icon="shoe-print"
          title="Move & Track"
          description="Track your daily steps, distance, and active minutes. Start a jog session to log your route and pace."
        />
        {/* ── HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <LinearGradient
            colors={
              theme.isDark ? [theme.colors.accent3 + '15', 'transparent'] : [theme.colors.accent3 + '08', 'transparent']
            }
            style={styles.headerGradient}
          >
            <View style={styles.headerRow}>
              <ThemedText style={[styles.headerTitle, { color: theme.colors.text }]}>{t('tab.move')}</ThemedText>
              <TouchableOpacity
                onPress={() => vm.toggleHistory()}
                accessibilityRole="button"
                accessibilityLabel={vm.showHistory ? 'Hide history' : 'Show history'}
                style={[styles.historyToggle, { backgroundColor: theme.colors.accent + '12' }]}
              >
                <MaterialCommunityIcons
                  name={vm.showHistory ? 'chart-line' : 'history'}
                  size={18}
                  color={theme.colors.accent}
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {vm.jogError && (
          <GlassCard style={styles.errorCard} glowColor={theme.colors.error} delay={150}>
            <ThemedText style={[styles.errorText, { color: theme.colors.error }]}>{vm.jogError}</ThemedText>
            <GradientButton
              title={t('common.tryAgain')}
              variant="warning"
              size="sm"
              onPress={vm.retryJog}
              style={{ marginTop: spacing[2] }}
            />
          </GlassCard>
        )}

        {/* ── STEP COUNTER HERO ── */}
        <GlassCard style={styles.stepHero} gradient glowColor={theme.colors.accent3} delay={100}>
          <View style={styles.stepHeroInner}>
            <ProgressRing progress={vm.stepProgress} size={110} color={theme.colors.accent3} strokeWidth={7}>
              <MaterialCommunityIcons name="shoe-print" size={28} color={theme.colors.accent3} />
            </ProgressRing>

            <View style={styles.stepDetails}>
              <Animated.View entering={ZoomIn.delay(200).duration(150)}>
                <ThemedText style={[styles.stepCount, { color: theme.colors.text }]}>
                  {vm.todaySteps.toLocaleString()}
                </ThemedText>
              </Animated.View>
              <ThemedText style={[styles.stepGoal, { color: theme.colors.textMuted }]}>
                / {vm.DAILY_STEP_GOAL.toLocaleString()} {t('move.goal')}
              </ThemedText>

              <View style={styles.stepMiniStats}>
                <View style={[styles.miniStat, { backgroundColor: theme.colors.accent + '15' }]}>
                  <MaterialCommunityIcons name="map-marker-distance" size={14} color={theme.colors.accent} />
                  <ThemedText style={[styles.miniStatText, { color: theme.colors.accent }]}>{vm.distKm} km</ThemedText>
                </View>
                <View style={[styles.miniStat, { backgroundColor: theme.colors.accent2 + '15' }]}>
                  <MaterialCommunityIcons name="fire" size={14} color={theme.colors.accent2} />
                  <ThemedText style={[styles.miniStatText, { color: theme.colors.accent2 }]}>
                    {vm.calories} cal
                  </ThemedText>
                </View>
                <View style={[styles.miniStat, { backgroundColor: theme.colors.accent3 + '15' }]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.accent3} />
                  <ThemedText style={[styles.miniStatText, { color: theme.colors.accent3 }]}>
                    {vm.activeMin} min
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {!vm.isTracking ? (
            <View style={styles.trackingButtonWrap}>
              <GradientButton
                title={t('move.startTracking')}
                icon="play"
                onPress={vm.handleStartTracking}
                variant="success"
              />
            </View>
          ) : (
            <Animated.View entering={FadeIn.delay(300).duration(150)} style={styles.trackingLiveRow}>
              <View style={styles.trackingStatusRow}>
                <PulseDot color={theme.colors.success} />
                <ThemedText style={[styles.trackingText, { color: theme.colors.textSecondary }]}>
                  {t('move.trackingActive')}
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={vm.handleStopTracking}
                accessibilityRole="button"
                accessibilityLabel="Stop step tracking"
                style={[
                  styles.stopTrackingBtn,
                  { backgroundColor: theme.colors.error + '18', borderColor: theme.colors.error + '40' },
                ]}
              >
                <MaterialCommunityIcons name="stop" size={16} color={theme.colors.error} />
                <ThemedText style={[styles.stopTrackingText, { color: theme.colors.error }]}>
                  {t('move.stop')}
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          )}
        </GlassCard>

        {/* ── WEEKLY STEP TREND ── */}
        <Animated.View entering={FadeInDown.delay(150).duration(150)}>
          <GlassCard style={{ marginHorizontal: spacing[4], marginTop: spacing[3], padding: spacing[4] }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing[3.5],
              }}
            >
              <ThemedText style={{ fontSize: typography.sizes.bodyMid, fontWeight: '700', color: theme.colors.text }}>
                This Week
              </ThemedText>
              <ThemedText style={{ fontSize: typography.sizes.caption, color: theme.colors.textMuted }}>
                {t('move.goal')}: {(vm.DAILY_STEP_GOAL / 1000).toFixed(0)}k
              </ThemedText>
            </View>
            <View style={styles.weeklyBars}>
              {(() => {
                const days = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().split('T')[0];
                  const dayData = vm.stepHistory.find((h) => h.date === dateStr);
                  days.push({
                    label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
                    steps: dayData?.steps || 0,
                    isToday: i === 0,
                  });
                }
                const maxVal = Math.max(vm.DAILY_STEP_GOAL, ...days.map((d) => d.steps));
                const goalPct = (vm.DAILY_STEP_GOAL / maxVal) * 80;
                return days.map((day, idx) => {
                  const barH = Math.max(4, (day.steps / maxVal) * 80);
                  const hitGoal = day.steps >= vm.DAILY_STEP_GOAL;
                  return (
                    <View key={idx} style={styles.weeklyBarCol}>
                      <ThemedText
                        style={[
                          styles.weeklyBarCount,
                          {
                            color: hitGoal ? theme.colors.accent3 : theme.colors.textMuted,
                          },
                        ]}
                      >
                        {day.steps > 0
                          ? day.steps >= 1000
                            ? (day.steps / 1000).toFixed(1) + 'k'
                            : String(day.steps)
                          : '–'}
                      </ThemedText>
                      <View style={[styles.weeklyBarTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View
                          style={[
                            styles.weeklyGoalMark,
                            { bottom: goalPct, backgroundColor: theme.colors.accent3 + '40' },
                          ]}
                        />
                        <LinearGradient
                          colors={
                            hitGoal
                              ? [theme.colors.accent3, theme.colors.accent3 + '70']
                              : day.isToday
                                ? [theme.colors.accent, theme.colors.accent + '60']
                                : [theme.colors.accent + '80', theme.colors.accent + '40']
                          }
                          style={[styles.weeklyBarFill, { height: barH }]}
                        />
                      </View>
                      <ThemedText
                        style={[
                          styles.weeklyBarLabel,
                          {
                            color: day.isToday ? theme.colors.accent : theme.colors.textMuted,
                            fontWeight: day.isToday ? '700' : '500',
                          },
                        ]}
                      >
                        {day.label}
                      </ThemedText>
                    </View>
                  );
                });
              })()}
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── ACTIVITY DETECTION ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(150)}>
          <GlassCard style={sensorStyles.activityCard}>
            <View style={sensorStyles.activityHeader}>
              <View style={sensorStyles.activityLeft}>
                <View
                  style={[
                    sensorStyles.activityIconWrap,
                    {
                      backgroundColor: vm.sensorActive ? theme.colors.accent + '18' : theme.colors.textMuted + '12',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={getActivityIcon(vm.sensorSnapshot.activity)}
                    size={22}
                    color={vm.sensorActive ? theme.colors.accent : theme.colors.textMuted}
                  />
                </View>
                <View>
                  <ThemedText style={[sensorStyles.activityType, { color: theme.colors.text }]}>
                    {formatActivity(vm.sensorSnapshot.activity, t)}
                  </ThemedText>
                  <View style={sensorStyles.confidenceRow}>
                    {vm.sensorActive && <PulseDot color={theme.colors.success} size={6} />}
                    <ThemedText
                      style={[sensorStyles.confidenceText, { color: theme.colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {vm.sensorActive
                        ? `${Math.round(vm.sensorSnapshot.confidence * 100)}% ${t('move.confidence')}`
                        : t('move.tapToEnable')}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={vm.sensorActive ? vm.stopSensor : () => vm.startSensor()}
                accessibilityRole="button"
                accessibilityLabel={vm.sensorActive ? 'Stop activity detection' : 'Start activity detection'}
                style={[
                  sensorStyles.sensorToggle,
                  {
                    backgroundColor: vm.sensorActive ? theme.colors.error + '15' : theme.colors.accent + '15',
                    borderColor: vm.sensorActive ? theme.colors.error + '30' : theme.colors.accent + '30',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={vm.sensorActive ? 'stop' : 'radar'}
                  size={16}
                  color={vm.sensorActive ? theme.colors.error : theme.colors.accent}
                />
                <ThemedText
                  style={[
                    sensorStyles.sensorToggleText,
                    {
                      color: vm.sensorActive ? theme.colors.error : theme.colors.accent,
                    },
                  ]}
                >
                  {vm.sensorActive ? t('move.stop') : t('move.detect')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {vm.sensorActive && vm.sensorSnapshot.activity !== 'STATIONARY' && (
              <Animated.View entering={FadeInDown.duration(150)} style={sensorStyles.metricsRow}>
                <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="speedometer" size={16} color={theme.colors.accent3} />
                  <ThemedText style={[sensorStyles.metricValue, { color: theme.colors.text }]}>
                    {vm.sensorSnapshot.intensity.toFixed(1)}
                  </ThemedText>
                  <ThemedText style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                    {t('move.intensity')}
                  </ThemedText>
                </View>
                <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="metronome" size={16} color={theme.colors.accent} />
                  <ThemedText style={[sensorStyles.metricValue, { color: theme.colors.text }]}>
                    {vm.sensorSnapshot.currentCadence}
                  </ThemedText>
                  <ThemedText style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                    {t('move.vm.cadence')}
                  </ThemedText>
                </View>
                {vm.sensorSnapshot.activity === 'EXERCISE' && (
                  <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="repeat" size={16} color={theme.colors.accent2} />
                    <ThemedText style={[sensorStyles.metricValue, { color: theme.colors.text }]}>
                      {vm.sensorSnapshot.repCount}
                    </ThemedText>
                    <ThemedText style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                      {t('move.reps')}
                    </ThemedText>
                  </View>
                )}
              </Animated.View>
            )}
            {vm.sensorActive && vm.sensorSnapshot.activity === 'STATIONARY' && (
              <Animated.View entering={FadeIn.duration(150)} style={sensorStyles.metricsRow}>
                <ThemedText
                  style={[
                    {
                      color: theme.colors.textMuted,
                      fontSize: typography.sizes.caption,
                      textAlign: 'center',
                      flex: 1,
                      paddingVertical: spacing[2],
                    },
                  ]}
                >
                  {t('move.startMovingForMetrics')}
                </ThemedText>
              </Animated.View>
            )}
          </GlassCard>
        </Animated.View>

        {/* ── JOG / WALK SESSION ── */}
        <View>
          <GlassCard
            style={styles.jogCard}
            gradient={vm.isJogging}
            gradientColors={vm.isJogging ? [theme.colors.success + '20', theme.colors.success + '05'] : undefined}
            glowColor={vm.isJogging ? theme.colors.success : undefined}
            delay={250}
          >
            <View style={styles.jogHeader}>
              <View
                style={[
                  styles.jogIconWrap,
                  {
                    backgroundColor: vm.isJogging ? theme.colors.success + '20' : theme.colors.textMuted + '15',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="run-fast"
                  size={22}
                  color={vm.isJogging ? theme.colors.success : theme.colors.textMuted}
                />
              </View>
              <View>
                <ThemedText style={[styles.jogTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {t('move.jogWalk')}
                </ThemedText>
                <ThemedText style={[styles.jogSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
                  {vm.isJogging ? t('move.sessionActive') : t('move.tapToStart')}
                </ThemedText>
              </View>
            </View>

            {vm.isJogging && vm.currentJog ? (
              <Animated.View entering={FadeInDown.duration(150)} style={styles.activeJog}>
                <View style={styles.jogTimerDisplay}>
                  <ThemedText style={[styles.jogTimerText, { color: theme.colors.success }]}>
                    {vm.jogElapsed}
                  </ThemedText>
                </View>

                <View style={styles.jogLiveStats}>
                  {/* Distance - prefer GPS when available */}
                  <View style={styles.jogStat}>
                    <ThemedText style={[styles.jogStatValue, { color: theme.colors.accent }]}>
                      {vm.jogStats
                        ? (vm.jogStats.totalDistanceMeters / 1000).toFixed(2)
                        : (vm.estimatedDistance / 1000).toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                      {t('move.km')}
                    </ThemedText>
                  </View>
                  <View style={[styles.jogStatDivider, { backgroundColor: theme.colors.border }]} />

                  {/* Pace - show when GPS available */}
                  {vm.jogStats?.currentPaceSecondsPerKm ? (
                    <View style={styles.jogStat}>
                      <ThemedText style={[styles.jogStatValue, { color: theme.colors.success }]}>
                        {vm.formatPace(vm.jogStats.currentPaceSecondsPerKm)}
                      </ThemedText>
                      <ThemedText style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                        {t('move.pace')}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.jogStat}>
                      <ThemedText style={[styles.jogStatValue, { color: theme.colors.accent2 }]}>
                        {vm.cadence}
                      </ThemedText>
                      <ThemedText style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                        {t('move.vm.cadence')}
                      </ThemedText>
                    </View>
                  )}
                  <View style={[styles.jogStatDivider, { backgroundColor: theme.colors.border }]} />

                  {/* Elevation when GPS available, otherwise vm.calories */}
                  {vm.jogStats?.elevationGainMeters && vm.jogStats.elevationGainMeters > 0 ? (
                    <View style={styles.jogStat}>
                      <ThemedText style={[styles.jogStatValue, { color: theme.colors.accent3 }]}>
                        {Math.round(vm.jogStats.elevationGainMeters)}
                      </ThemedText>
                      <ThemedText style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>↑m</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.jogStat}>
                      <ThemedText style={[styles.jogStatValue, { color: theme.colors.accent2 }]}>
                        {Math.round((vm.currentJog.distanceMeters ?? 0) * 0.06)}
                      </ThemedText>
                      <ThemedText style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                        {t('meal.unit.cal')}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* GPS indicator */}
                {vm.jogStats && (
                  <View style={[styles.gpsIndicator, { backgroundColor: theme.colors.success + '15' }]}>
                    <MaterialCommunityIcons name="satellite-variant" size={12} color={theme.colors.success} />
                    <ThemedText style={[styles.gpsIndicatorText, { color: theme.colors.success }]}>
                      GPS Active
                    </ThemedText>
                  </View>
                )}

                {/* Live Map */}
                {vm.jogStats && vm.showLiveMap && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: spacing[2],
                      }}
                    >
                      <ThemedText
                        style={{
                          fontSize: typography.sizes.label,
                          fontWeight: '600',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Route Map
                      </ThemedText>
                      <TouchableOpacity
                        onPress={() => vm.toggleLiveMap(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Hide map"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="chevron-up" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <JogMap
                      routePoints={vm.jogStats.routePoints}
                      isLive
                      height={220}
                      distanceMeters={vm.jogStats.totalDistanceMeters}
                      pace={
                        vm.jogStats.currentPaceSecondsPerKm
                          ? vm.formatPace(vm.jogStats.currentPaceSecondsPerKm)
                          : undefined
                      }
                    />
                  </Animated.View>
                )}
                {vm.jogStats && !vm.showLiveMap && (
                  <TouchableOpacity
                    onPress={() => vm.toggleLiveMap(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Show map"
                    style={[
                      styles.showMapBtn,
                      { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '30' },
                    ]}
                  >
                    <MaterialCommunityIcons name="map-outline" size={16} color={theme.colors.accent} />
                    <ThemedText
                      style={{ fontSize: typography.sizes.label, fontWeight: '600', color: theme.colors.accent }}
                    >
                      Show Map
                    </ThemedText>
                  </TouchableOpacity>
                )}

                <GradientButton
                  title={t('move.stopSession')}
                  icon="stop"
                  onPress={vm.handleStopJog}
                  colors={[theme.colors.error, (theme.colors as any).errorDark ?? theme.colors.error]}
                />
              </Animated.View>
            ) : (
              <View style={styles.jogStartButtonWrap}>
                <GradientButton title={t('move.startJog')} icon="play" onPress={vm.handleStartJog} variant="success" />
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── HISTORY ── */}
        {!!vm.showHistory && (
          <Animated.View entering={FadeInDown.duration(150)}>
            <SectionHeader title={t('move.vm.stepHistory')} delay={0} />
            {vm.stepHistory.length === 0 ? (
              <GlassCard style={{ marginHorizontal: spacing[4] }}>
                <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  {t('move.noStepHistory')}
                </ThemedText>
              </GlassCard>
            ) : (
              vm.stepHistory.map((day, i) => {
                const pct = Math.min(100, (day.steps / vm.DAILY_STEP_GOAL) * 100);
                const hitGoal = day.steps >= vm.DAILY_STEP_GOAL;
                return (
                  <AnimatedListItem key={day.date} index={i} style={styles.historyItemWrap}>
                    <View
                      style={[
                        styles.historyRow,
                        {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.historyInner}>
                        <View style={styles.historyTopRow}>
                          <ThemedText style={[styles.historyDate, { color: theme.colors.text }]}>{day.date}</ThemedText>
                          <ThemedText
                            style={[
                              styles.historySteps,
                              { color: hitGoal ? theme.colors.accent3 : theme.colors.accent },
                            ]}
                          >
                            {day.steps.toLocaleString()} {t('move.steps').toLowerCase()}
                          </ThemedText>
                        </View>
                        <View style={[styles.historyProgressTrack, { backgroundColor: theme.colors.border }]}>
                          <LinearGradient
                            colors={
                              hitGoal
                                ? [theme.colors.accent3, theme.colors.accent3 + '80']
                                : [theme.colors.accent, theme.colors.accent + '60']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.historyProgressFill, { width: `${pct}%` as any }]}
                          />
                        </View>
                      </View>
                      {hitGoal && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={theme.colors.accent3}
                          style={{ marginLeft: spacing[2.5] }}
                        />
                      )}
                    </View>
                  </AnimatedListItem>
                );
              })
            )}

            <SectionHeader title={t('move.vm.jogHistory')} delay={100} />
            {vm.jogHistory.length === 0 ? (
              <GlassCard style={{ marginHorizontal: spacing[4] }}>
                <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  {t('move.noJogHistory')}
                </ThemedText>
              </GlassCard>
            ) : (
              vm.jogHistory.map((jog, i) => (
                <AnimatedListItem
                  key={jog.id}
                  index={i}
                  style={{ paddingHorizontal: spacing[4], marginBottom: spacing[1.5] }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => vm.handleReviewJog(jog)}
                    accessibilityRole="button"
                    accessibilityLabel={`Jog on ${jog.startTime.toLocaleDateString()}, ${(jog.distanceMeters / 1000).toFixed(2)} km`}
                    accessibilityHint="Double tap to view route"
                    style={[
                      styles.historyRow,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText style={[styles.historyDate, { color: theme.colors.text }]}>
                          {jog.startTime.toLocaleDateString()}
                        </ThemedText>
                        <ThemedText style={[styles.historySteps, { color: theme.colors.accent2 }]}>
                          ~{jog.caloriesEstimate} cal
                        </ThemedText>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing[1.5],
                          marginTop: spacing[0.5],
                        }}
                      >
                        <ThemedText style={[{ fontSize: typography.sizes.captionSm, color: theme.colors.textMuted }]}>
                          {(jog.distanceMeters / 1000).toFixed(2)} km · {vm.formatPace(jog.avgPacePerKm)}
                        </ThemedText>
                        <MaterialCommunityIcons name="map-marker-path" size={12} color={theme.colors.accent + '80'} />
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </AnimatedListItem>
              ))
            )}
          </Animated.View>
        )}

        {/* ── INFO NOTE ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(150)}>
          <GlassCard style={styles.infoCard} delay={500}>
            <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.accent} />
            <ThemedText style={[styles.infoText, { color: theme.colors.textMuted }]}>
              {t('move.infoXpAndFatigue')}
            </ThemedText>
          </GlassCard>
        </Animated.View>

        {/* ── ROUTE REVIEW MODAL ── */}
        <Modal visible={vm.reviewJogId !== null} transparent animationType="slide" onRequestClose={vm.closeRouteReview}>
          <View style={[styles.routeModalContainer, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <SafeAreaView edges={['top']}>
              <View style={styles.routeModalHeader}>
                <TouchableOpacity
                  onPress={vm.closeRouteReview}
                  accessibilityRole="button"
                  accessibilityLabel="Close route review"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <ThemedText style={[styles.routeModalTitle, { color: theme.colors.text }]}>Route Review</ThemedText>
                <View style={{ width: 24 }} />
              </View>
            </SafeAreaView>

            {/* Map */}
            <View style={{ flex: 1 }}>
              {vm.reviewRoute && vm.reviewRoute.length > 0 ? (
                <JogMap
                  routePoints={vm.reviewRoute}
                  isLive={false}
                  height={400}
                  distanceMeters={vm.reviewJog?.distanceMeters}
                  pace={vm.reviewJog?.avgPacePerKm ? vm.formatPace(vm.reviewJog.avgPacePerKm) : undefined}
                />
              ) : (
                <View style={[styles.noRouteContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="map-marker-off" size={40} color={theme.colors.textMuted} />
                  <ThemedText style={[styles.noRouteText, { color: theme.colors.textMuted }]}>
                    No route recorded for this jog
                  </ThemedText>
                  <ThemedText style={[styles.noRouteHint, { color: theme.colors.textMuted }]}>
                    Routes are saved when GPS is active during a jog
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Stats Footer */}
            {vm.reviewJog && (
              <View
                style={[
                  styles.routeStatsFooter,
                  { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
                ]}
              >
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="map-marker-distance" size={18} color={theme.colors.accent} />
                  <ThemedText style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {(vm.reviewJog.distanceMeters / 1000).toFixed(2)} km
                  </ThemedText>
                </View>
                <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="speedometer" size={18} color={theme.colors.success} />
                  <ThemedText style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {vm.formatPace(vm.reviewJog.avgPacePerKm)}
                  </ThemedText>
                </View>
                <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="fire" size={18} color={theme.colors.accent2} />
                  <ThemedText style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {vm.reviewJog.caloriesEstimate ?? 0} cal
                  </ThemedText>
                </View>
                {vm.reviewJog.endTime && (
                  <>
                    <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.routeStatItem}>
                      <MaterialCommunityIcons name="timer-outline" size={18} color={theme.colors.accent3} />
                      <ThemedText style={[styles.routeStatValue, { color: theme.colors.text }]}>
                        {vm.formatDuration(vm.reviewJog.startTime, vm.reviewJog.endTime)}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </Modal>

        {/* ── JOG COMPLETION MODAL ── */}
        <Modal visible={vm.showJogComplete} transparent animationType="fade" onRequestClose={vm.dismissJogComplete}>
          <View style={styles.modalOverlay}>
            <Animated.View entering={ZoomIn.duration(150)}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                {/* Glow backdrop */}
                <LinearGradient colors={[theme.colors.success + '25', 'transparent']} style={styles.modalGlow} />

                {/* Trophy icon */}
                <LinearGradient
                  colors={[theme.colors.success + '30', theme.colors.success + '08']}
                  style={styles.trophyGlow}
                >
                  <MaterialCommunityIcons name="run" size={48} color={theme.colors.success} />
                </LinearGradient>

                <ThemedText style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('move.jogComplete')}
                </ThemedText>

                {!!vm.jogCompletionData && (
                  <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: theme.colors.accent + '12' }]}>
                      <MaterialCommunityIcons name="map-marker-distance" size={20} color={theme.colors.accent} />
                      <ThemedText style={[styles.statValue, { color: theme.colors.accent }]}>
                        {vm.jogCompletionData.distance.toFixed(2)}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                        {t('move.km')}
                      </ThemedText>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.accent2 + '12' }]}>
                      <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.accent2} />
                      <ThemedText style={[styles.statValue, { color: theme.colors.accent2 }]}>
                        {vm.jogCompletionData.duration}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                        {t('move.time')}
                      </ThemedText>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.warning + '12' }]}>
                      <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
                      <ThemedText style={[styles.statValue, { color: theme.colors.warning }]}>
                        {vm.jogCompletionData.calories}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: theme.colors.textMuted }]}>
                        {t('meal.unit.cal')}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {/* XP Earned */}
                {vm.jogCompletionData && vm.jogCompletionData.xpEarned > 0 && (
                  <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.xpBadge}>
                    <LinearGradient
                      colors={[theme.colors.accent, theme.colors.indigo]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.xpGradient}
                    >
                      <MaterialCommunityIcons name="star" size={16} color={theme.colors.onAccent} />
                      <ThemedText style={[styles.xpText, { color: theme.colors.text }]}>
                        +{vm.jogCompletionData.xpEarned} XP
                      </ThemedText>
                    </LinearGradient>
                  </Animated.View>
                )}

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.colors.success }]}
                  onPress={vm.dismissJogComplete}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss jog completion"
                >
                  <ThemedText style={[styles.modalButtonText, { color: theme.colors.text }]}>
                    {t('move.awesome')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
