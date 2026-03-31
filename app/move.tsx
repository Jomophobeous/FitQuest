/**
 * FitQuest Move Tab
 * Step counting and jog/walk tracking with premium glass UI
 *
 * CRITICAL: This is utility mode, NOT training logic.
 * - No fatigue impact
 * - No progression
 * Walking 10k steps must NOT affect the workout engine.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeInRight, ZoomIn, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { usePedometer, DailySteps, JogSession } from '../src/hooks/usePedometer';
import { useSensorFusion, type ActivityType } from '../src/engines/SensorFusionEngine';
import { awardJogXP, awardStepXP } from '../src/services/xpService';
import { logEvent } from '../src/services/telemetry';
import { useDataSync, notifyStepsUpdated, notifyJogCompleted } from '../src/services/dataSyncService';
import {
  GlassCard,
  GradientButton,
  SectionHeader,
  ProgressRing,
  PulseDot,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import JogMap from '../src/components/JogMap';
import { getJogRoute } from '../src/database/service';

const DAILY_STEP_GOAL = 10000;

interface JogCompletionData {
  distance: number;
  duration: string;
  calories: number;
  xpEarned: number;
}

export default function MoveScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady: dbReady } = useDatabase();
  const {
    todaySteps,
    isAvailable,
    isTracking,
    currentJog,
    isJogging,
    jogStats,
    cadence,
    estimatedDistance,
    startTracking,
    stopTracking,
    startJog,
    stopJog,
    getStepHistory,
    getJogHistory,
  } = usePedometer();

  const [stepHistory, setStepHistory] = useState<DailySteps[]>([]);
  const [jogHistory, setJogHistory] = useState<JogSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [jogElapsed, setJogElapsed] = useState('0:00');

  // Sensor Fusion — activity detection
  const { snapshot, isActive: sensorActive, start: startSensor, stop: stopSensor } = useSensorFusion();

  // Jog completion modal state
  const [showJogComplete, setShowJogComplete] = useState(false);
  const [jogCompletionData, setJogCompletionData] = useState<JogCompletionData | null>(null);
  const [jogError, setJogError] = useState<string | null>(null);

  // Map state
  const [showLiveMap, setShowLiveMap] = useState(true);
  const [reviewJogId, setReviewJogId] = useState<string | null>(null);
  const [reviewRoute, setReviewRoute] = useState<[number, number][] | null>(null);
  const [reviewJog, setReviewJog] = useState<JogSession | null>(null);

  // Load step and jog history from database
  const loadHistory = useCallback(async () => {
    const steps = await getStepHistory(7);
    const jogs = await getJogHistory(10);
    setStepHistory(steps);
    setJogHistory(jogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getStepHistory/getJogHistory are stable hook-returned functions
  }, []);

  // Live jog timer
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (isJogging && currentJog) {
      iv = setInterval(() => {
        setJogElapsed(formatDuration(currentJog.startTime, new Date()));
      }, 1000);
    }
    return () => clearInterval(iv);
  }, [isJogging, currentJog]);

  useEffect(() => {
    if (dbReady) loadHistory();
  }, [dbReady, loadHistory]);

  // Subscribe to data sync events from other screens
  useDataSync('workout_completed', loadHistory);
  useDataSync('xp_awarded', loadHistory);

  const handleStartTracking = async () => {
    // Start tracking — uses native pedometer if available, SensorFusion fallback otherwise
    await startTracking();
    // XP is awarded when tracking stops (via the stop button), not on start
  };

  const handleStartJog = async () => {
    if (!dbReady) {
      setJogError('Database is still loading. Please wait a moment and try again.');
      return;
    }
    setJogError(null);
    setShowLiveMap(true); // Reset map visibility for new jog

    try {
      await startJog();
      // Start step tracking if not already active (non-critical — wrap separately)
      try {
        if (!isTracking) await startTracking();
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
    }
  };

  const handleStopJog = async () => {
    try {
      const session = await stopJog();
      if (session) {
        const xpResult = await awardJogXP(session.distanceMeters);
        // Use glass modal instead of Alert
        setJogCompletionData({
          distance: session.distanceMeters / 1000,
          duration: session.startTime && session.endTime ? formatDuration(session.startTime, session.endTime) : '0:00',
          calories: session.caloriesEstimate || 0,
          xpEarned: xpResult?.xpEarned || 0,
        });
        setShowJogComplete(true);

        // Notify other screens about the jog completion
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
      if (__DEV__) console.warn('[Move] Failed to stop jog:', error);
      setJogError('Something went wrong stopping your jog. Please try again.');
    }
  };

  const formatDuration = (start: Date, end: Date): string => {
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm?: number): string => {
    if (!secondsPerKm) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  const stepProgress = Math.min(todaySteps / DAILY_STEP_GOAL, 1);
  const distKm = (todaySteps * 0.0008).toFixed(1);
  const calories = Math.round(todaySteps * 0.04);
  const activeMin = Math.round(todaySteps / 100);

  if (!dbReady) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <ScreenErrorBoundary screenName="Move" onGoBack={() => {}}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScreenTutorial
          screenKey="move"
          icon="shoe-print"
          title="Move & Track"
          description="Track your daily steps, distance, and active minutes. Start a jog session to log your route and pace."
        />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── HEADER ── */}
          <Animated.View entering={FadeIn.duration(150)}>
            <LinearGradient
              colors={
                theme.isDark
                  ? [theme.colors.accent3 + '15', 'transparent']
                  : [theme.colors.accent3 + '08', 'transparent']
              }
              style={styles.headerGradient}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('tab.move')}</Text>
                <TouchableOpacity
                  onPress={() => setShowHistory(!showHistory)}
                  accessibilityRole="button"
                  accessibilityLabel={showHistory ? 'Hide history' : 'Show history'}
                  style={[styles.historyToggle, { backgroundColor: theme.colors.accent + '12' }]}
                >
                  <MaterialCommunityIcons
                    name={showHistory ? 'chart-line' : 'history'}
                    size={18}
                    color={theme.colors.accent}
                  />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>

          {jogError && (
            <GlassCard style={styles.errorCard} glowColor={theme.colors.error} delay={150}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{jogError}</Text>
              <GradientButton
                title={t('common.tryAgain')}
                variant="warning"
                size="sm"
                onPress={() => {
                  setJogError(null);
                  handleStartJog();
                }}
                style={{ marginTop: 8 }}
              />
            </GlassCard>
          )}

          {/* ── STEP COUNTER HERO ── */}
          <GlassCard style={styles.stepHero} gradient glowColor={theme.colors.accent3} delay={100}>
            <View style={styles.stepHeroInner}>
              <ProgressRing progress={stepProgress} size={110} color={theme.colors.accent3} strokeWidth={7}>
                <MaterialCommunityIcons name="shoe-print" size={28} color={theme.colors.accent3} />
              </ProgressRing>

              <View style={styles.stepDetails}>
                <Animated.View entering={ZoomIn.delay(200).duration(150)}>
                  <Text style={[styles.stepCount, { color: theme.colors.text }]}>{todaySteps.toLocaleString()}</Text>
                </Animated.View>
                <Text style={[styles.stepGoal, { color: theme.colors.textMuted }]}>
                  / {DAILY_STEP_GOAL.toLocaleString()} {t('move.goal')}
                </Text>

                <View style={styles.stepMiniStats}>
                  <View style={[styles.miniStat, { backgroundColor: theme.colors.accent + '15' }]}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={theme.colors.accent} />
                    <Text style={[styles.miniStatText, { color: theme.colors.accent }]}>{distKm} km</Text>
                  </View>
                  <View style={[styles.miniStat, { backgroundColor: theme.colors.accent2 + '15' }]}>
                    <MaterialCommunityIcons name="fire" size={14} color={theme.colors.accent2} />
                    <Text style={[styles.miniStatText, { color: theme.colors.accent2 }]}>{calories} cal</Text>
                  </View>
                  <View style={[styles.miniStat, { backgroundColor: theme.colors.accent3 + '15' }]}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.accent3} />
                    <Text style={[styles.miniStatText, { color: theme.colors.accent3 }]}>{activeMin} min</Text>
                  </View>
                </View>
              </View>
            </View>

            {!isTracking ? (
              <View style={styles.trackingButtonWrap}>
                <GradientButton
                  title={t('move.startTracking')}
                  icon="play"
                  onPress={handleStartTracking}
                  variant="success"
                />
              </View>
            ) : (
              <Animated.View entering={FadeIn.delay(300).duration(150)} style={styles.trackingLiveRow}>
                <View style={styles.trackingStatusRow}>
                  <PulseDot color={theme.colors.success} />
                  <Text style={[styles.trackingText, { color: theme.colors.textSecondary }]}>
                    {t('move.trackingActive')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await stopTracking();
                      await awardStepXP(todaySteps);
                      notifyStepsUpdated(todaySteps);
                    } catch (e) {
                      if (__DEV__) console.warn('[Move] Stop tracking error:', e);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Stop step tracking"
                  style={[
                    styles.stopTrackingBtn,
                    { backgroundColor: theme.colors.error + '18', borderColor: theme.colors.error + '40' },
                  ]}
                >
                  <MaterialCommunityIcons name="stop" size={16} color={theme.colors.error} />
                  <Text style={[styles.stopTrackingText, { color: theme.colors.error }]}>{t('move.stop')}</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </GlassCard>

          {/* ── WEEKLY STEP TREND ── */}
          <Animated.View entering={FadeInDown.delay(150).duration(150)}>
            <GlassCard style={{ marginHorizontal: 16, marginTop: 12, padding: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>This Week</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
                  {t('move.goal')}: {(DAILY_STEP_GOAL / 1000).toFixed(0)}k
                </Text>
              </View>
              <View style={styles.weeklyBars}>
                {(() => {
                  const days = [];
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    const dayData = stepHistory.find((h) => h.date === dateStr);
                    days.push({
                      label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
                      steps: dayData?.steps || 0,
                      isToday: i === 0,
                    });
                  }
                  const maxVal = Math.max(DAILY_STEP_GOAL, ...days.map((d) => d.steps));
                  const goalPct = (DAILY_STEP_GOAL / maxVal) * 80;
                  return days.map((day, idx) => {
                    const barH = Math.max(4, (day.steps / maxVal) * 80);
                    const hitGoal = day.steps >= DAILY_STEP_GOAL;
                    return (
                      <View key={idx} style={styles.weeklyBarCol}>
                        <Text
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
                        </Text>
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
                        <Text
                          style={[
                            styles.weeklyBarLabel,
                            {
                              color: day.isToday ? theme.colors.accent : theme.colors.textMuted,
                              fontWeight: day.isToday ? '700' : '500',
                            },
                          ]}
                        >
                          {day.label}
                        </Text>
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
                        backgroundColor: sensorActive ? theme.colors.accent + '18' : theme.colors.textMuted + '12',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getActivityIcon(snapshot.activity)}
                      size={22}
                      color={sensorActive ? theme.colors.accent : theme.colors.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[sensorStyles.activityType, { color: theme.colors.text }]}>
                      {formatActivity(snapshot.activity, t)}
                    </Text>
                    <View style={sensorStyles.confidenceRow}>
                      {sensorActive && <PulseDot color={theme.colors.success} size={6} />}
                      <Text style={[sensorStyles.confidenceText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                        {sensorActive
                          ? `${Math.round(snapshot.confidence * 100)}% ${t('move.confidence')}`
                          : t('move.tapToEnable')}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={sensorActive ? stopSensor : () => startSensor()}
                  accessibilityRole="button"
                  accessibilityLabel={sensorActive ? 'Stop activity detection' : 'Start activity detection'}
                  style={[
                    sensorStyles.sensorToggle,
                    {
                      backgroundColor: sensorActive ? theme.colors.error + '15' : theme.colors.accent + '15',
                      borderColor: sensorActive ? theme.colors.error + '30' : theme.colors.accent + '30',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={sensorActive ? 'stop' : 'radar'}
                    size={16}
                    color={sensorActive ? theme.colors.error : theme.colors.accent}
                  />
                  <Text
                    style={[
                      sensorStyles.sensorToggleText,
                      {
                        color: sensorActive ? theme.colors.error : theme.colors.accent,
                      },
                    ]}
                  >
                    {sensorActive ? t('move.stop') : t('move.detect')}
                  </Text>
                </TouchableOpacity>
              </View>

              {sensorActive && snapshot.activity !== 'STATIONARY' && (
                <Animated.View entering={FadeInDown.duration(150)} style={sensorStyles.metricsRow}>
                  <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="speedometer" size={16} color={theme.colors.accent3} />
                    <Text style={[sensorStyles.metricValue, { color: theme.colors.text }]}>
                      {snapshot.intensity.toFixed(1)}
                    </Text>
                    <Text style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                      {t('move.intensity')}
                    </Text>
                  </View>
                  <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="metronome" size={16} color={theme.colors.accent} />
                    <Text style={[sensorStyles.metricValue, { color: theme.colors.text }]}>
                      {snapshot.currentCadence}
                    </Text>
                    <Text style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                      {t('move.cadence')}
                    </Text>
                  </View>
                  {snapshot.activity === 'EXERCISE' && (
                    <View style={[sensorStyles.metricBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name="repeat" size={16} color={theme.colors.accent2} />
                      <Text style={[sensorStyles.metricValue, { color: theme.colors.text }]}>{snapshot.repCount}</Text>
                      <Text style={[sensorStyles.metricLabel, { color: theme.colors.textMuted }]}>
                        {t('move.reps')}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              )}
              {sensorActive && snapshot.activity === 'STATIONARY' && (
                <Animated.View entering={FadeIn.duration(150)} style={sensorStyles.metricsRow}>
                  <Text
                    style={[
                      { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', flex: 1, paddingVertical: 8 },
                    ]}
                  >
                    {t('move.startMovingForMetrics')}
                  </Text>
                </Animated.View>
              )}
            </GlassCard>
          </Animated.View>

          {/* ── JOG / WALK SESSION ── */}
          <View>
            <GlassCard
              style={styles.jogCard}
              gradient={isJogging}
              gradientColors={isJogging ? [theme.colors.success + '20', theme.colors.success + '05'] : undefined}
              glowColor={isJogging ? theme.colors.success : undefined}
              delay={250}
            >
              <View style={styles.jogHeader}>
                <View
                  style={[
                    styles.jogIconWrap,
                    {
                      backgroundColor: isJogging ? theme.colors.success + '20' : theme.colors.textMuted + '15',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="run-fast"
                    size={22}
                    color={isJogging ? theme.colors.success : theme.colors.textMuted}
                  />
                </View>
                <View>
                  <Text style={[styles.jogTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {t('move.jogWalk')}
                  </Text>
                  <Text style={[styles.jogSub, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {isJogging ? t('move.sessionActive') : t('move.tapToStart')}
                  </Text>
                </View>
              </View>

              {isJogging && currentJog ? (
                <Animated.View entering={FadeInDown.duration(150)} style={styles.activeJog}>
                  <View style={styles.jogTimerDisplay}>
                    <Text style={[styles.jogTimerText, { color: theme.colors.success }]}>{jogElapsed}</Text>
                  </View>

                  <View style={styles.jogLiveStats}>
                    {/* Distance - prefer GPS when available */}
                    <View style={styles.jogStat}>
                      <Text style={[styles.jogStatValue, { color: theme.colors.accent }]}>
                        {jogStats
                          ? (jogStats.totalDistanceMeters / 1000).toFixed(2)
                          : (estimatedDistance / 1000).toFixed(2)}
                      </Text>
                      <Text style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>{t('move.km')}</Text>
                    </View>
                    <View style={[styles.jogStatDivider, { backgroundColor: theme.colors.border }]} />

                    {/* Pace - show when GPS available */}
                    {jogStats?.currentPaceSecondsPerKm ? (
                      <View style={styles.jogStat}>
                        <Text style={[styles.jogStatValue, { color: theme.colors.success }]}>
                          {formatPace(jogStats.currentPaceSecondsPerKm)}
                        </Text>
                        <Text style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>{t('move.pace')}</Text>
                      </View>
                    ) : (
                      <View style={styles.jogStat}>
                        <Text style={[styles.jogStatValue, { color: theme.colors.accent2 }]}>{cadence}</Text>
                        <Text style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                          {t('move.cadence')}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.jogStatDivider, { backgroundColor: theme.colors.border }]} />

                    {/* Elevation when GPS available, otherwise calories */}
                    {jogStats?.elevationGainMeters && jogStats.elevationGainMeters > 0 ? (
                      <View style={styles.jogStat}>
                        <Text style={[styles.jogStatValue, { color: theme.colors.accent3 }]}>
                          {Math.round(jogStats.elevationGainMeters)}
                        </Text>
                        <Text style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>↑m</Text>
                      </View>
                    ) : (
                      <View style={styles.jogStat}>
                        <Text style={[styles.jogStatValue, { color: theme.colors.accent2 }]}>
                          {Math.round((currentJog.distanceMeters ?? 0) * 0.06)}
                        </Text>
                        <Text style={[styles.jogStatLabel, { color: theme.colors.textMuted }]}>
                          {t('meal.unit.cal')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* GPS indicator */}
                  {jogStats && (
                    <View style={[styles.gpsIndicator, { backgroundColor: theme.colors.success + '15' }]}>
                      <MaterialCommunityIcons name="satellite-variant" size={12} color={theme.colors.success} />
                      <Text style={[styles.gpsIndicatorText, { color: theme.colors.success }]}>GPS Active</Text>
                    </View>
                  )}

                  {/* Live Map */}
                  {jogStats && showLiveMap && (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>
                          Route Map
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowLiveMap(false)}
                          accessibilityRole="button"
                          accessibilityLabel="Hide map"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="chevron-up" size={20} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <JogMap
                        routePoints={jogStats.routePoints}
                        isLive
                        height={220}
                        distanceMeters={jogStats.totalDistanceMeters}
                        pace={
                          jogStats.currentPaceSecondsPerKm ? formatPace(jogStats.currentPaceSecondsPerKm) : undefined
                        }
                      />
                    </Animated.View>
                  )}
                  {jogStats && !showLiveMap && (
                    <TouchableOpacity
                      onPress={() => setShowLiveMap(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Show map"
                      style={[
                        styles.showMapBtn,
                        { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '30' },
                      ]}
                    >
                      <MaterialCommunityIcons name="map-outline" size={16} color={theme.colors.accent} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.accent }}>Show Map</Text>
                    </TouchableOpacity>
                  )}

                  <GradientButton
                    title={t('move.stopSession')}
                    icon="stop"
                    onPress={handleStopJog}
                    colors={[theme.colors.error, (theme.colors as any).errorDark ?? '#B91C1C']}
                  />
                </Animated.View>
              ) : (
                <View style={styles.jogStartButtonWrap}>
                  <GradientButton title={t('move.startJog')} icon="play" onPress={handleStartJog} variant="success" />
                </View>
              )}
            </GlassCard>
          </View>

          {/* ── HISTORY ── */}
          {!!showHistory && (
            <Animated.View entering={FadeInDown.duration(150)}>
              <SectionHeader title={t('move.stepHistory')} delay={0} />
              {stepHistory.length === 0 ? (
                <GlassCard style={{ marginHorizontal: 16 }}>
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('move.noStepHistory')}</Text>
                </GlassCard>
              ) : (
                stepHistory.map((day, i) => {
                  const pct = Math.min(100, (day.steps / DAILY_STEP_GOAL) * 100);
                  const hitGoal = day.steps >= DAILY_STEP_GOAL;
                  return (
                    <AnimatedListItem key={day.date} index={i} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
                      <View
                        style={[
                          styles.historyRow,
                          {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={[styles.historyDate, { color: theme.colors.text }]}>{day.date}</Text>
                            <Text
                              style={[
                                styles.historySteps,
                                { color: hitGoal ? theme.colors.accent3 : theme.colors.accent },
                              ]}
                            >
                              {day.steps.toLocaleString()} {t('move.steps').toLowerCase()}
                            </Text>
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
                            style={{ marginLeft: 10 }}
                          />
                        )}
                      </View>
                    </AnimatedListItem>
                  );
                })
              )}

              <SectionHeader title={t('move.jogHistory')} delay={100} />
              {jogHistory.length === 0 ? (
                <GlassCard style={{ marginHorizontal: 16 }}>
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('move.noJogHistory')}</Text>
                </GlassCard>
              ) : (
                jogHistory.map((jog, i) => (
                  <AnimatedListItem key={jog.id} index={i} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={async () => {
                        try {
                          setReviewJog(jog);
                          const route = await getJogRoute(jog.id);
                          setReviewRoute(route);
                          setReviewJogId(jog.id);
                        } catch (e) {
                          if (__DEV__) console.warn('[Move] Failed to load jog route:', e);
                        }
                      }}
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
                          <Text style={[styles.historyDate, { color: theme.colors.text }]}>
                            {jog.startTime.toLocaleDateString()}
                          </Text>
                          <Text style={[styles.historySteps, { color: theme.colors.accent2 }]}>
                            ~{jog.caloriesEstimate} cal
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Text style={[{ fontSize: 11, color: theme.colors.textMuted }]}>
                            {(jog.distanceMeters / 1000).toFixed(2)} km · {formatPace(jog.avgPacePerKm)}
                          </Text>
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
              <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>{t('move.infoXpAndFatigue')}</Text>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── ROUTE REVIEW MODAL ── */}
        <Modal
          visible={reviewJogId !== null}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setReviewJogId(null);
            setReviewRoute(null);
            setReviewJog(null);
          }}
        >
          <View style={[styles.routeModalContainer, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <SafeAreaView edges={['top']}>
              <View style={styles.routeModalHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setReviewJogId(null);
                    setReviewRoute(null);
                    setReviewJog(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close route review"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.routeModalTitle, { color: theme.colors.text }]}>Route Review</Text>
                <View style={{ width: 24 }} />
              </View>
            </SafeAreaView>

            {/* Map */}
            <View style={{ flex: 1 }}>
              {reviewRoute && reviewRoute.length > 0 ? (
                <JogMap
                  routePoints={reviewRoute}
                  isLive={false}
                  height={400}
                  distanceMeters={reviewJog?.distanceMeters}
                  pace={reviewJog?.avgPacePerKm ? formatPace(reviewJog.avgPacePerKm) : undefined}
                />
              ) : (
                <View style={[styles.noRouteContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="map-marker-off" size={40} color={theme.colors.textMuted} />
                  <Text style={[styles.noRouteText, { color: theme.colors.textMuted }]}>
                    No route recorded for this jog
                  </Text>
                  <Text style={[styles.noRouteHint, { color: theme.colors.textMuted }]}>
                    Routes are saved when GPS is active during a jog
                  </Text>
                </View>
              )}
            </View>

            {/* Stats Footer */}
            {reviewJog && (
              <View
                style={[
                  styles.routeStatsFooter,
                  { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
                ]}
              >
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="map-marker-distance" size={18} color={theme.colors.accent} />
                  <Text style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {(reviewJog.distanceMeters / 1000).toFixed(2)} km
                  </Text>
                </View>
                <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="speedometer" size={18} color={theme.colors.success} />
                  <Text style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {formatPace(reviewJog.avgPacePerKm)}
                  </Text>
                </View>
                <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="fire" size={18} color={theme.colors.accent2} />
                  <Text style={[styles.routeStatValue, { color: theme.colors.text }]}>
                    {reviewJog.caloriesEstimate ?? 0} cal
                  </Text>
                </View>
                {reviewJog.endTime && (
                  <>
                    <View style={[styles.routeStatDivider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.routeStatItem}>
                      <MaterialCommunityIcons name="timer-outline" size={18} color={theme.colors.accent3} />
                      <Text style={[styles.routeStatValue, { color: theme.colors.text }]}>
                        {formatDuration(reviewJog.startTime, reviewJog.endTime)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </Modal>

        {/* ── JOG COMPLETION MODAL ── */}
        <Modal
          visible={showJogComplete}
          transparent
          animationType="fade"
          onRequestClose={() => setShowJogComplete(false)}
        >
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

                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('move.jogComplete')}</Text>

                {!!jogCompletionData && (
                  <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: theme.colors.accent + '12' }]}>
                      <MaterialCommunityIcons name="map-marker-distance" size={20} color={theme.colors.accent} />
                      <Text style={[styles.statValue, { color: theme.colors.accent }]}>
                        {jogCompletionData.distance.toFixed(2)}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{t('move.km')}</Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.accent2 + '12' }]}>
                      <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.accent2} />
                      <Text style={[styles.statValue, { color: theme.colors.accent2 }]}>
                        {jogCompletionData.duration}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{t('move.time')}</Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.warning + '12' }]}>
                      <MaterialCommunityIcons name="fire" size={20} color={theme.colors.warning} />
                      <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                        {jogCompletionData.calories}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{t('meal.unit.cal')}</Text>
                    </View>
                  </View>
                )}

                {/* XP Earned */}
                {jogCompletionData && jogCompletionData.xpEarned > 0 && (
                  <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.xpBadge}>
                    <LinearGradient
                      colors={[theme.colors.accent, theme.colors.indigo]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.xpGradient}
                    >
                      <MaterialCommunityIcons name="star" size={16} color={theme.colors.onAccent} />
                      <Text style={[styles.xpText, { color: theme.colors.text }]}>
                        +{jogCompletionData.xpEarned} XP
                      </Text>
                    </LinearGradient>
                  </Animated.View>
                )}

                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.colors.success }]}
                  onPress={() => {
                    setShowJogComplete(false);
                    setJogCompletionData(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss jog completion"
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>{t('move.awesome')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  historyToggle: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stepHero: { marginHorizontal: 16, padding: 20 },
  stepHeroInner: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  errorCard: { marginHorizontal: 16, padding: 16, borderRadius: 16, marginTop: 12 },
  errorText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  stepDetails: { flex: 1 },
  stepCount: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  stepGoal: { fontSize: 13, marginTop: 2 },
  stepMiniStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniStatText: { fontSize: 12, fontWeight: '600' },
  trackingButtonWrap: { marginTop: 16, minHeight: 48 },
  trackingLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    minHeight: 48,
  },
  trackingStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackingText: { fontSize: 13, fontWeight: '500' },
  stopTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  stopTrackingText: { fontSize: 13, fontWeight: '600' },
  jogCard: { marginHorizontal: 16, marginTop: 12, padding: 18 },
  jogHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  jogIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  jogTitle: { fontSize: 17, fontWeight: '700' },
  jogSub: { fontSize: 12, marginTop: 1 },
  activeJog: { marginTop: 16, gap: 16 },
  jogStartButtonWrap: { marginTop: 14, minHeight: 48 },
  jogTimerDisplay: { alignItems: 'center' },
  jogTimerText: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  jogLiveStats: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  jogStat: { alignItems: 'center' },
  jogStatValue: { fontSize: 22, fontWeight: '700' },
  jogStatLabel: { fontSize: 12, marginTop: 2 },
  jogStatDivider: { width: 1, height: 30 },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  gpsIndicatorText: { fontSize: 11, fontWeight: '600' },
  showMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyText: { textAlign: 'center', fontSize: 13 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyDate: { fontSize: 14, fontWeight: '500' },
  historySteps: { fontSize: 14, fontWeight: '700' },
  historyProgressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  historyProgressFill: { height: 4, borderRadius: 2 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Weekly trend styles
  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
  weeklyBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  weeklyBarTrack: { width: '100%', height: 80, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  weeklyBarFill: { width: '100%', borderRadius: 6 },
  weeklyBarCount: { fontSize: 10, fontWeight: '600' },
  weeklyBarLabel: { fontSize: 11 },
  weeklyGoalMark: { position: 'absolute', left: 0, right: 0, height: 1 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  trophyGlow: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  xpBadge: {
    marginBottom: 20,
  },
  xpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  xpText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalButton: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Route review modal
  routeModalContainer: {
    flex: 1,
  },
  routeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  noRouteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    borderRadius: 16,
    gap: 12,
    padding: 32,
  },
  noRouteText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  noRouteHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  routeStatsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  routeStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  routeStatValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  routeStatDivider: {
    width: 1,
    height: 28,
  },
});

// ── Sensor Fusion Helpers ──

function getActivityIcon(activity: ActivityType): keyof typeof MaterialCommunityIcons.glyphMap {
  const icons: Record<ActivityType, keyof typeof MaterialCommunityIcons.glyphMap> = {
    STATIONARY: 'human-handsdown',
    WALKING: 'walk',
    RUNNING: 'run-fast',
    CYCLING: 'bicycle',
    EXERCISE: 'dumbbell',
    UNKNOWN: 'help-circle-outline',
  };
  return icons[activity] || 'help-circle-outline';
}

function formatActivity(activity: ActivityType, t: (key: string) => string): string {
  const labels: Record<ActivityType, string> = {
    STATIONARY: t('move.activity.stationary'),
    WALKING: t('move.activity.walking'),
    RUNNING: t('move.activity.running'),
    CYCLING: t('move.activity.cycling'),
    EXERCISE: t('move.activity.exercising'),
    UNKNOWN: t('move.activity.detecting'),
  };
  return labels[activity] || t('move.activity.unknown');
}

const sensorStyles = StyleSheet.create({
  activityCard: { marginHorizontal: 16, marginTop: 12, padding: 16 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  activityIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityType: { fontSize: 17, fontWeight: '700' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  confidenceText: { fontSize: 12, fontWeight: '500' },
  sensorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  sensorToggleText: { fontSize: 13, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 10, fontWeight: '600' },
});
