import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/context/ThemeContext';
import { spacing } from '../src/design/theme-system';
import { MOTION, HIERARCHY } from '../src/design/motion';
import { dashboardStyles as styles } from '../src/components/dashboard/styles';
import { useLanguage } from '../src/context/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../src/components/ThemedText';
import AnimatedFQLogoMark from '../src/components/AnimatedFQLogoMark';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { SkeletonDashboard } from '../src/components/ui/Skeleton';
import { RankBadge } from '../src/components/RankDisplay';
import {
  GlassCard,
  WeekCalendar,
  ProgressRing,
  SectionHeader,
  GradientButton,
  PulseDot,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';
import { ScreenContainer, Spacer } from '../src/components/ui/primitives';
import { EmptyState } from '../src/components/ui/FeedbackStates';
import { LongPressMenu } from '../src/components/ui/LongPressMenu';
import { useRouter } from 'expo-router';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { usePrefetch } from '../src/hooks/usePrefetch';
import { useNavigationState } from '../src/hooks/useNavigationState';

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const isCompactScreen = width < 420;

  // Type-safe color key accessor for dynamic theme color lookups
  const themeColor = (key: string) => (theme.colors as Record<string, string>)[key] ?? theme.colors.accent;
  const vm = useDashboardViewModel();

  // CTA breathing pulse animation
  const ctaScale = useSharedValue(1);
  useEffect(() => {
    ctaScale.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: MOTION.pulse, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: MOTION.pulse, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  // Warm caches for adjacent screens (non-blocking)
  usePrefetch(vm.isSubscribed);

  // Navigation state persistence — preserve selected date across tab switches
  const navState = useNavigationState('dashboard');
  const handleDateSelect = (date: Date) => {
    navState.setSelection('selectedDate', date.toISOString());
    vm.setSelectedDate(date);
  };

  // Destructure ViewModel for render
  const {
    loading,
    loadError,
    refreshing,
    displayName,
    readiness,
    behavioralSignal,
    lastImpact,
    trialSnapshot,
    consistencyProfile,
    recentWorkout,
    workoutDates,
    totalCalories,
    totalMinutes,
    todaySteps,
    todayActiveMinutes,
    completionRate,
    realLevel,
    realXP,
    levelUpShown,
    selectedDate,
    streak,
    todayProgress,
    hasReadinessData,
    isRecoveryBad,
    isRecoveryGood,
    recoveryPercent,
    statusDisplay,
    statPillWarning,
    statPillAccent,
    statPillSurface,
    exploreTiles,
    handleRefresh,
    setSelectedDate,
    retryLoad,
    hasInterruptedSession,
    goalProgress,
    userState,
  } = vm;

  // ── Typewriter greeting animation (hooks must be before early returns) ──
  const greetingText = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning') || 'Good morning';
    if (hour < 18) return t('dashboard.goodAfternoon') || 'Good afternoon';
    return t('dashboard.goodEvening') || 'Good evening';
  })();

  const [typedGreeting, setTypedGreeting] = useState('');
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTypedGreeting('');
    let index = 0;
    const type = () => {
      if (index <= greetingText.length) {
        setTypedGreeting(greetingText.slice(0, index));
        index++;
        typingRef.current = setTimeout(type, 45);
      }
    };
    typingRef.current = setTimeout(type, 300); // initial delay
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [greetingText]);

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonDashboard />
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>
            {loadError}
          </ThemedText>
          <GradientButton title={t('common.retry') ?? 'Retry'} onPress={retryLoad} style={{ marginTop: spacing[4] }} />
        </View>
      </ScreenContainer>
    );
  }

  const level = realLevel;

  return (
    <ScreenErrorBoundary screenName="Dashboard" onGoBack={() => router.back()}>
      <ScreenContainer scroll onRefresh={handleRefresh} refreshing={refreshing}>
        {/* ── AMBIENT HERO GLOW — subtle emerald radiance from top-right — */}
        <View
          style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: 200, zIndex: 0 }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[theme.colors.accent + '14', theme.colors.accent + '06', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
        <ScreenTutorial
          screenKey="dashboard"
          icon="view-dashboard"
          title="Your Dashboard"
          description="Track your daily progress, workout streaks, steps, and XP all in one place. Pull down to refresh your stats."
        />
        <Animated.View entering={FadeIn.duration(MOTION.base)}>
          {/* ── LEVEL UP CELEBRATION ── */}
          {levelUpShown && (
            <Animated.View
              entering={FadeInDown.duration(MOTION.slow)}
              style={[styles.levelUpBanner, { backgroundColor: theme.colors.accent }]}
            >
              <MaterialCommunityIcons name="arrow-up-bold-circle" size={22} color={theme.colors.onAccent} />
              <View style={{ marginLeft: spacing[3], flex: 1 }}>
                <ThemedText variant="body" weight="800" style={{ color: theme.colors.onAccent }}>
                  Level Up!
                </ThemedText>
                <ThemedText
                  variant="caption"
                  weight="500"
                  style={{ color: theme.colors.onAccent + 'CC', marginTop: spacing['px'] }}
                >
                  You reached Level {realLevel} 🎉
                </ThemedText>
              </View>
            </Animated.View>
          )}

          {/* ── RESUME INTERRUPTED SESSION ── */}
          {hasInterruptedSession && (
            <Animated.View entering={FadeInDown.duration(MOTION.fast)}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/fitquest')}
                style={[
                  styles.resumeBanner,
                  { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '40' },
                ]}
              >
                <MaterialCommunityIcons name="play-circle-outline" size={22} color={theme.colors.warning} />
                <View style={{ marginLeft: spacing[3], flex: 1 }}>
                  <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.warning }}>
                    {t('dashboard.resumeWorkout') || 'Resume Workout'}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted" style={{ marginTop: spacing['px'] }}>
                    {t('dashboard.resumeWorkoutSub') || 'You have an unfinished session'}
                  </ThemedText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.warning} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── COMPACT HEADER ── */}
          <Animated.View entering={FadeIn.duration(MOTION.fast)}>
            <View style={[styles.heroHeader, { backgroundColor: theme.colors.background }]}>
              <View style={styles.heroTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                  <AnimatedFQLogoMark size={56} showGlow={true} />
                  <View>
                    <ThemedText variant="caption" color="secondary" style={styles.greeting}>
                      {typedGreeting}
                      <ThemedText
                        variant="caption"
                        style={{
                          color: theme.colors.accent,
                          opacity: typedGreeting.length < greetingText.length ? 1 : 0,
                        }}
                      >
                        |
                      </ThemedText>
                    </ThemedText>
                    <ThemedText variant="h2" color="primary" style={styles.heroTitle}>
                      {displayName}
                    </ThemedText>
                  </View>
                </View>
                {/* Stats row: Numbers visually heavier than labels */}
                <View style={styles.headerStats}>
                  <View style={[styles.statPill, statPillWarning]}>
                    <ThemedText
                      variant="bodySmall"
                      weight="800"
                      style={[styles.statValue, { color: theme.colors.warning }]}
                    >
                      {streak}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      🔥
                    </ThemedText>
                  </View>
                  <View style={[styles.statPill, statPillAccent]}>
                    <RankBadge level={level} size="sm" />
                  </View>
                  <View style={[styles.statPill, statPillSurface]}>
                    <ThemedText
                      variant="bodySmall"
                      weight="800"
                      style={[styles.statValue, { color: theme.colors.text }]}
                    >
                      {realXP}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {t('dashboard.xp')}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 1: TODAY'S GOAL - LARGEST CARD, MOST PROMINENT
        ══════════════════════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInDown.delay(MOTION.stagger * 2).duration(MOTION.fast)}>
            <GlassCard style={styles.todayGoalCard} delay={MOTION.stagger * 2}>
              <View style={[styles.todayGoalInner, isCompactScreen && styles.todayGoalInnerCompact]}>
                <View style={styles.todayGoalLeft}>
                  <ProgressRing progress={todayProgress} size={120} color={theme.colors.accent}>
                    <ThemedText variant="h2" weight="800" color="accent" style={styles.todayGoalPercent}>
                      {Math.round(todayProgress * 100)}%
                    </ThemedText>
                  </ProgressRing>
                </View>
                <View style={styles.todayGoalRight}>
                  <ThemedText
                    variant="h3"
                    color="primary"
                    style={styles.todayGoalTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {t('dashboard.todaysGoal')}
                  </ThemedText>
                  <ThemedText variant="bodySmall" color="secondary" style={styles.todayGoalSub} numberOfLines={2}>
                    {todayProgress >= 1
                      ? t('dashboard.completed') || 'Completed! 🎉'
                      : t('dashboard.keepPushing') || 'Keep pushing — you got this!'}
                  </ThemedText>
                  <View style={styles.todayGoalMeta}>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="fire" size={16} color={theme.colors.warning} />
                      <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.text }}>
                        {' '}
                        {totalCalories}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {' '}
                        {t('dashboard.kcal')}
                      </ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textMuted} />
                      <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.text }}>
                        {' '}
                        {totalMinutes}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {' '}
                        {t('fitquest.minShort')}
                      </ThemedText>
                    </View>
                  </View>
                  {/* PRIMARY ACTION: Start Workout - MOST PROMINENT */}
                  <View style={styles.primaryActionContainer}>
                    <Animated.View style={ctaAnimStyle}>
                      <GradientButton
                        title={t('dashboard.startNow') || 'START NOW'}
                        icon="lightning-bolt"
                        onPress={() => {
                          if (__DEV__) console.warn('[Dashboard] CTA:startNow → fitquest?autostart=1');
                          router.push('/fitquest?autostart=1');
                        }}
                        variant="primary"
                        style={styles.primaryButton}
                      />
                    </Animated.View>
                  </View>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 2: CURRENT STATUS - Readiness score with recommendation
            Only shown when real data exists (workouts, fatigue records).
        ══════════════════════════════════════════════════════════════════ */}
          {hasReadinessData && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.secondary }}>
                <View
                  style={[
                    styles.recoveryCard,
                    {
                      backgroundColor: isRecoveryBad
                        ? theme.colors.error + '15'
                        : theme.isDark
                          ? theme.colors.surfaceVariant
                          : theme.colors.surface,
                      borderColor: isRecoveryBad ? theme.colors.error + '40' : theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.recoveryInner}>
                    <View style={styles.recoveryLeft}>
                      <MaterialCommunityIcons
                        name={
                          (statusDisplay?.icon ||
                            (isRecoveryBad ? 'battery-low' : isRecoveryGood ? 'battery-high' : 'battery-medium')) as any
                        }
                        size={24}
                        color={
                          isRecoveryBad
                            ? theme.colors.error
                            : isRecoveryGood
                              ? theme.colors.success
                              : theme.colors.warning
                        }
                      />
                      <View>
                        <ThemedText
                          variant="bodySmall"
                          weight="600"
                          style={[
                            styles.recoveryTitle,
                            { color: isRecoveryBad ? theme.colors.error : theme.colors.text },
                          ]}
                        >
                          {statusDisplay?.label || t('dashboard.recovery')}
                        </ThemedText>
                        {readiness?.timeSinceLastWorkoutMinutes != null && (
                          <ThemedText variant="caption" color="muted" style={{ marginLeft: spacing[2] }}>
                            {readiness.timeSinceLastWorkoutMinutes < 60
                              ? t('dashboard.lastTrainedMin').replace(
                                  '{{count}}',
                                  String(readiness.timeSinceLastWorkoutMinutes),
                                )
                              : readiness.timeSinceLastWorkoutMinutes < 1440
                                ? t('dashboard.lastTrainedHour').replace(
                                    '{{count}}',
                                    String(Math.floor(readiness.timeSinceLastWorkoutMinutes / 60)),
                                  )
                                : t('dashboard.lastTrainedDay').replace(
                                    '{{count}}',
                                    String(Math.floor(readiness.timeSinceLastWorkoutMinutes / 1440)),
                                  )}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <View style={styles.recoveryRight}>
                      <ThemedText
                        variant="h3"
                        weight="800"
                        style={[
                          styles.recoveryValue,
                          {
                            color: isRecoveryBad
                              ? theme.colors.error
                              : isRecoveryGood
                                ? theme.colors.success
                                : theme.colors.warning,
                          },
                        ]}
                      >
                        {recoveryPercent}%
                      </ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {isRecoveryBad
                          ? t('dashboard.restRecommended')
                          : isRecoveryGood
                            ? t('dashboard.readyToTrain')
                            : t('dashboard.recoveryModerate')}
                      </ThemedText>
                    </View>
                  </View>
                  {readiness?.recommendedIntensity && (
                    <ThemedText variant="caption" color="secondary" style={styles.recoveryWarning}>
                      {readiness.recommendation}
                    </ThemedText>
                  )}
                  {!readiness && !!isRecoveryBad && (
                    <ThemedText variant="caption" color="error" style={styles.recoveryWarning}>
                      {t('dashboard.recoveryWarning')}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            SYSTEM SIGNAL — Behavioral intelligence + last session impact
        ══════════════════════════════════════════════════════════════════ */}
          {behavioralSignal && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 3.5).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.secondary }}>
                <View
                  style={[
                    styles.signalCard,
                    {
                      backgroundColor: themeColor(behavioralSignal.colorKey) + '10',
                      borderColor: themeColor(behavioralSignal.colorKey) + '30',
                    },
                  ]}
                >
                  <View style={styles.signalInner}>
                    <View
                      style={[styles.signalIconWrap, { backgroundColor: themeColor(behavioralSignal.colorKey) + '18' }]}
                    >
                      <MaterialCommunityIcons
                        name={behavioralSignal.icon as any}
                        size={20}
                        color={themeColor(behavioralSignal.colorKey)}
                      />
                      {behavioralSignal.pulse && <PulseDot color={themeColor(behavioralSignal.colorKey)} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        variant="bodySmall"
                        weight="700"
                        style={{ color: themeColor(behavioralSignal.colorKey) }}
                      >
                        {behavioralSignal.headline}
                      </ThemedText>
                      <ThemedText variant="caption" color="muted" style={{ marginTop: spacing['px'] }}>
                        {behavioralSignal.subtext}
                      </ThemedText>
                    </View>
                  </View>
                  {lastImpact?.hasHistory && (
                    <View style={styles.signalImpact}>
                      <MaterialCommunityIcons
                        name={
                          lastImpact.trend === 'improving'
                            ? 'trending-up'
                            : lastImpact.trend === 'declining'
                              ? 'trending-down'
                              : ('trending-neutral' as any)
                        }
                        size={14}
                        color={
                          lastImpact.trend === 'improving'
                            ? theme.colors.success
                            : lastImpact.trend === 'declining'
                              ? theme.colors.warning
                              : theme.colors.textMuted
                        }
                      />
                      <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
                        {lastImpact.trendStatement}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            TRIAL MESSAGE — Progressive trial messaging + consistency status
        ══════════════════════════════════════════════════════════════════ */}
          {trialSnapshot?.message.type !== 'NONE' && trialSnapshot?.message.headline ? (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.5).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.tertiary }}>
                <TouchableOpacity
                  activeOpacity={trialSnapshot.message.actionRoute ? 0.7 : 1}
                  onPress={() => {
                    if (trialSnapshot.message.actionRoute) {
                      router.push(trialSnapshot.message.actionRoute as string);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={trialSnapshot.message.headline}
                >
                  <View
                    style={[
                      styles.trialCard,
                      {
                        backgroundColor: theme.colors.accent + '08',
                        borderColor:
                          trialSnapshot.phase === 'DECISION' ? theme.colors.warning + '40' : theme.colors.accent + '20',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] }}>
                      <View style={[styles.trialIconWrap, { backgroundColor: theme.colors.accent + '14' }]}>
                        <MaterialCommunityIcons
                          name={
                            trialSnapshot.phase === 'DECISION'
                              ? 'timer-sand'
                              : trialSnapshot.phase === 'EXPIRED'
                                ? 'lock-outline'
                                : 'shield-check'
                          }
                          size={18}
                          color={trialSnapshot.phase === 'DECISION' ? theme.colors.warning : theme.colors.accent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText variant="bodySmall" weight="600" color="primary">
                          {trialSnapshot.message.headline}
                        </ThemedText>
                        <ThemedText variant="caption" color="muted" style={{ marginTop: spacing['px'] }}>
                          {trialSnapshot.message.subtext}
                        </ThemedText>
                      </View>
                      {trialSnapshot.message.actionLabel && (
                        <ThemedText variant="caption" weight="700" style={{ color: theme.colors.accent }}>
                          {trialSnapshot.message.actionLabel}
                        </ThemedText>
                      )}
                    </View>
                    {consistencyProfile && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing[1.5],
                          marginTop: spacing[2],
                          paddingTop: spacing[2],
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.colors.border,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={consistencyProfile.mode === 'DISCIPLINED' ? 'chart-line' : 'tune-vertical'}
                          size={12}
                          color={theme.colors.textMuted}
                        />
                        <ThemedText variant="caption" color="muted">
                          {consistencyProfile.statusLine}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : consistencyProfile ? (
            <Animated.View
              entering={FadeInDown.delay(MOTION.stagger * 4.5).duration(MOTION.fast)}
              style={{ opacity: HIERARCHY.tertiary }}
            >
              <View
                style={[
                  styles.trialCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <MaterialCommunityIcons
                    name={consistencyProfile.mode === 'DISCIPLINED' ? 'chart-line' : 'tune-vertical'}
                    size={16}
                    color={consistencyProfile.mode === 'DISCIPLINED' ? theme.colors.success : theme.colors.blue}
                  />
                  <ThemedText variant="caption" color="secondary">
                    {consistencyProfile.statusLine}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* ── WEEK CALENDAR (Minimal) ── */}
          <WeekCalendar activeDate={selectedDate} workoutDates={workoutDates} onDatePress={handleDateSelect} />

          {/* ══════════════════════════════════════════════════════════════════
            WEEKLY GOAL PROGRESS — Derived from goalTracker
        ══════════════════════════════════════════════════════════════════ */}
          {goalProgress && goalProgress.overallProgress > 0 && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.8).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.secondary }}>
                <View
                  style={[styles.goalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  <View style={styles.goalHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <MaterialCommunityIcons name="target" size={16} color={theme.colors.accent} />
                      <ThemedText variant="bodySmall" weight="700" color="primary">
                        {t('dashboard.weeklyGoal') || 'Weekly Goal'}
                      </ThemedText>
                    </View>
                    <ThemedText variant="bodySmall" weight="800" style={{ color: theme.colors.accent }}>
                      {Math.round(goalProgress.overallProgress * 100)}%
                    </ThemedText>
                  </View>
                  <View style={[styles.goalBarBg, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.goalBarFill,
                        {
                          backgroundColor: theme.colors.accent,
                          width: `${Math.min(100, Math.round(goalProgress.overallProgress * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.goalDetails}>
                    <ThemedText variant="caption" color="muted">
                      {goalProgress.workoutsDone}/{goalProgress.goals.workoutsTarget}{' '}
                      {t('dashboard.workouts') || 'workouts'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {goalProgress.activeMinutesDone}/{goalProgress.goals.activeMinutesTarget}{' '}
                      {t('fitquest.minShort') || 'min'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            ADAPTIVE NUDGE — Churn risk or high fatigue guidance
        ══════════════════════════════════════════════════════════════════ */}
          {!!userState?.churnRisk && !hasInterruptedSession && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.9).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.secondary }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/fitquest?autostart=1')}
                  style={[
                    styles.nudgeCard,
                    { backgroundColor: theme.colors.accent + '10', borderColor: theme.colors.accent + '30' },
                  ]}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color={theme.colors.accent} />
                  <View style={{ flex: 1, marginLeft: spacing[2] }}>
                    <ThemedText variant="bodySmall" weight="600" style={{ color: theme.colors.accent }}>
                      {t('dashboard.quickStartNudge') || 'Quick 10-min session?'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted" style={{ marginTop: spacing['px'] }}>
                      {t('dashboard.quickStartSub') || 'A short workout keeps your momentum going'}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.accent} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {userState?.fatigueTier === 'HIGH' && !isRecoveryBad && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.9).duration(MOTION.fast)}>
              <View style={{ opacity: HIERARCHY.tertiary }}>
                <View
                  style={[
                    styles.nudgeCard,
                    { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30' },
                  ]}
                >
                  <MaterialCommunityIcons name="sleep" size={18} color={theme.colors.warning} />
                  <View style={{ flex: 1, marginLeft: spacing[2] }}>
                    <ThemedText variant="bodySmall" weight="600" style={{ color: theme.colors.warning }}>
                      {t('dashboard.recoveryDay') || 'Recovery recommended'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted" style={{ marginTop: spacing['px'] }}>
                      {t('dashboard.recoverySub') || 'Your muscles need rest — try a mobility session'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            DAILY ACTIVITY STATS — Steps, Active Mins, Completion Rate
        ══════════════════════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInUp.delay(MOTION.stagger * 5).duration(MOTION.fast)}>
            <View style={{ opacity: HIERARCHY.secondary }}>
              <View style={styles.dailyStatsRow}>
                <LongPressMenu
                  items={[
                    {
                      label: 'View Step History',
                      icon: 'shoe-print',
                      color: theme.colors.blue,
                      onPress: () => router.push('/health-dashboard'),
                    },
                  ]}
                  title="Steps"
                >
                  <GlassCard style={styles.dailyStatCard}>
                    <MaterialCommunityIcons name="shoe-print" size={20} color={theme.colors.blue} />
                    <ThemedText variant="h4" weight="800" style={{ color: theme.colors.blue, marginTop: spacing[1] }}>
                      {todaySteps > 0 ? todaySteps.toLocaleString() : '0'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {t('dashboard.stepsToday') || 'Steps'}
                    </ThemedText>
                  </GlassCard>
                </LongPressMenu>
                <LongPressMenu
                  items={[
                    {
                      label: 'View Activity',
                      icon: 'timer-outline',
                      color: theme.colors.purple,
                      onPress: () => router.push('/health-dashboard'),
                    },
                  ]}
                  title="Active Minutes"
                >
                  <GlassCard style={styles.dailyStatCard}>
                    <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.purple} />
                    <ThemedText variant="h4" weight="800" style={{ color: theme.colors.purple, marginTop: spacing[1] }}>
                      {todayActiveMinutes > 0 ? `${todayActiveMinutes}` : totalMinutes > 0 ? `${totalMinutes}` : '0'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {t('dashboard.activeMin') || 'Active min'}
                    </ThemedText>
                  </GlassCard>
                </LongPressMenu>
                <LongPressMenu
                  items={[
                    {
                      label: 'View All Workouts',
                      icon: 'check-circle-outline',
                      color: theme.colors.success,
                      onPress: () => router.push('/saved-workouts'),
                    },
                  ]}
                  title="Completion Rate"
                >
                  <GlassCard style={styles.dailyStatCard}>
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.success} />
                    <ThemedText
                      variant="h4"
                      weight="800"
                      style={{ color: theme.colors.success, marginTop: spacing[1] }}
                    >
                      {completionRate > 0 ? `${completionRate}%` : '0%'}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted">
                      {t('dashboard.completionRate') || 'Completion'}
                    </ThemedText>
                  </GlassCard>
                </LongPressMenu>
              </View>
            </View>
          </Animated.View>

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 3: LAST WORKOUT - Summary only (reduced)
        ══════════════════════════════════════════════════════════════════ */}
          <SectionHeader title={t('dashboard.lastWorkout')} delay={MOTION.stagger * 6} />
          {recentWorkout ? (
            <AnimatedListItem key={recentWorkout.id} index={0} style={styles.workoutItem}>
              <GlassCard onPress={() => router.push('/saved-workouts')} style={styles.workoutCard}>
                <View style={styles.workoutRow}>
                  <View style={[styles.workoutIcon, { backgroundColor: theme.colors.accent + '15' }]}>
                    <MaterialCommunityIcons name={recentWorkout.icon} size={18} color={theme.colors.accent} />
                  </View>
                  <View style={styles.workoutInfo}>
                    <ThemedText variant="bodySmall" weight="600" color="primary" style={styles.workoutName}>
                      {recentWorkout.name}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted" style={styles.workoutMeta}>
                      {recentWorkout.duration}m · {recentWorkout.exercises} exercises · {recentWorkout.date}
                    </ThemedText>
                  </View>
                  <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.warning }}>
                    {recentWorkout.caloriesBurned}
                  </ThemedText>
                </View>
              </GlassCard>
            </AnimatedListItem>
          ) : (
            <EmptyState
              icon="dumbbell"
              message={t('dashboard.noWorkoutsYet') || 'No workouts yet'}
              action={t('dashboard.startNow') || 'Start First Session'}
              onAction={() => router.push('/fitquest?autostart=1')}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 4: SECONDARY ACTION (minimal)
        ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.secondaryActions}>
            <GradientButton
              title={t('dashboard.createCustom')}
              icon="playlist-plus"
              onPress={() => router.push('/create-workout')}
              variant="success"
              style={styles.secondaryButton}
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════════
            QUICK ACCESS TILES — Key features at a glance
        ══════════════════════════════════════════════════════════════════ */}
          <SectionHeader title={t('dashboard.explore') || 'Explore'} delay={MOTION.stagger * 7} />
          <Animated.View entering={FadeInUp.delay(MOTION.stagger * 7).duration(MOTION.fast)}>
            <View style={{ opacity: HIERARCHY.tertiary }}>
              <View style={styles.exploreGrid}>
                {exploreTiles.map((tile, idx) => (
                  <AnimatedListItem key={tile.route} index={idx} style={styles.exploreTileWrap}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={tile.label}
                      accessibilityHint={tile.desc}
                      onPress={() => router.push(tile.route)}
                      style={[
                        styles.exploreTile,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.exploreTileIcon, { backgroundColor: tile.color + '18' }]}>
                        <MaterialCommunityIcons name={tile.icon as any} size={26} color={tile.color} />
                      </View>
                      <View style={styles.exploreTileContent}>
                        <ThemedText variant="bodySmall" weight="700" color="primary" style={styles.exploreTileLabel}>
                          {tile.label}
                        </ThemedText>
                        <ThemedText
                          variant="caption"
                          color="secondary"
                          style={styles.exploreTileDesc}
                          numberOfLines={1}
                        >
                          {tile.desc}
                        </ThemedText>
                      </View>
                      <View style={styles.exploreTileArrowRow}>
                        <MaterialCommunityIcons name="arrow-right" size={16} color={theme.colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  </AnimatedListItem>
                ))}
              </View>
            </View>
          </Animated.View>

          <Spacer size="xl" />
        </Animated.View>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
