import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../src/context/ThemeContext';
import { spacing, radius, typography } from '../src/design/theme-system';
import { MOTION, HIERARCHY } from '../src/design/motion';
import { useLanguage } from '../src/context/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../src/components/ThemedText';
import FQLogoMark from '../src/components/FQLogoMark';
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
import { useInteraction } from '../src/interactions/InteractionManager';
import { useNavigationGuard } from '../src/navigation/NavigationGuard';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { usePrefetch } from '../src/hooks/usePrefetch';

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const nav = useNavigationGuard();
  const isCompactScreen = width < 420;
  const exec = useInteraction();
  const vm = useDashboardViewModel();

  // Warm caches for adjacent screens (non-blocking)
  usePrefetch(vm.isSubscribed);

  // Destructure ViewModel for render
  const {
    loading, loadError, refreshing, displayName, readiness,
    behavioralSignal, lastImpact, trialSnapshot, consistencyProfile,
    recentWorkout, workoutDates, totalCalories, totalMinutes,
    todaySteps, todayActiveMinutes, completionRate, realLevel, realXP,
    levelUpShown, selectedDate, streak, todayProgress, hasReadinessData,
    isRecoveryBad, isRecoveryGood, recoveryPercent, statusDisplay,
    statPillWarning, statPillAccent, statPillSurface, signalCardBg,
    exploreTiles, handleRefresh, setSelectedDate, retryLoad,
    hasInterruptedSession, goalProgress, userState,
  } = vm;

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
          <ThemedText variant="h3" style={{ marginTop: spacing[4], textAlign: 'center' }}>{loadError}</ThemedText>
          <GradientButton title={t('common.retry') ?? 'Retry'} onPress={retryLoad} style={{ marginTop: spacing[4] }} />
        </View>
      </ScreenContainer>
    );
  }

  const level = realLevel;

  return (
    <ScreenErrorBoundary screenName="Dashboard" onGoBack={() => nav.back()}>
      <ScreenContainer scroll onRefresh={handleRefresh} refreshing={refreshing}>
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
                <ThemedText variant="body" weight="800" style={{ color: theme.colors.onAccent }}>Level Up!</ThemedText>
                <ThemedText variant="caption" weight="500" style={{ color: theme.colors.onAccent + 'CC', marginTop: spacing['px'] }}>
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
                onPress={() => exec('dash_resume_session', () => nav.push('/fitquest'), { haptic: 'light' })}
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
                  <FQLogoMark size={36} showGlow={false} />
                  <View>
                    <ThemedText variant="caption" color="secondary" style={styles.greeting}>
                      {(() => {
                        const hour = new Date().getHours();
                        if (hour < 12) return t('dashboard.goodMorning') || 'Good morning';
                        if (hour < 18) return t('dashboard.goodAfternoon') || 'Good afternoon';
                        return t('dashboard.goodEvening') || 'Good evening';
                      })()}
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
                    <GradientButton
                      title={t('dashboard.startNow') || 'START NOW'}
                      icon="lightning-bolt"
                      onPress={() => {
                        if (__DEV__) console.warn('[Dashboard] CTA:startNow → fitquest?autostart=1');
                        exec('dash_start_workout', () => nav.push('/fitquest?autostart=1'), { haptic: 'medium' });
                      }}
                      variant="primary"
                      style={styles.primaryButton}
                    />
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
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4).duration(MOTION.fast)} style={{ opacity: HIERARCHY.secondary }}>
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
                            ? `Last trained ${readiness.timeSinceLastWorkoutMinutes}m ago`
                            : readiness.timeSinceLastWorkoutMinutes < 1440
                              ? `Last trained ${Math.floor(readiness.timeSinceLastWorkoutMinutes / 60)}h ago`
                              : `Last trained ${Math.floor(readiness.timeSinceLastWorkoutMinutes / 1440)}d ago`}
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
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            SYSTEM SIGNAL — Behavioral intelligence + last session impact
        ══════════════════════════════════════════════════════════════════ */}
          {behavioralSignal && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 3.5).duration(MOTION.fast)} style={{ opacity: HIERARCHY.secondary }}>
              <View
                style={[
                  styles.signalCard,
                  {
                    backgroundColor: theme.colors[behavioralSignal.colorKey] + '10',
                    borderColor: theme.colors[behavioralSignal.colorKey] + '30',
                  },
                ]}
              >
                <View style={styles.signalInner}>
                  <View
                    style={[styles.signalIconWrap, { backgroundColor: theme.colors[behavioralSignal.colorKey] + '18' }]}
                  >
                    <MaterialCommunityIcons
                      name={behavioralSignal.icon as any}
                      size={20}
                      color={theme.colors[behavioralSignal.colorKey]}
                    />
                    {behavioralSignal.pulse && <PulseDot color={theme.colors[behavioralSignal.colorKey]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText
                      variant="bodySmall"
                      weight="700"
                      style={{ color: theme.colors[behavioralSignal.colorKey] }}
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
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            TRIAL MESSAGE — Progressive trial messaging + consistency status
        ══════════════════════════════════════════════════════════════════ */}
          {trialSnapshot?.message.type !== 'NONE' && trialSnapshot?.message.headline ? (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.5).duration(MOTION.fast)} style={{ opacity: HIERARCHY.tertiary }}>
              <TouchableOpacity
                activeOpacity={trialSnapshot.message.actionRoute ? 0.7 : 1}
                onPress={() => exec('dash_trial_action', () => {
                  if (trialSnapshot.message.actionRoute) {
                    nav.push(trialSnapshot.message.actionRoute as string);
                  }
                })}
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
            </Animated.View>
          ) : consistencyProfile ? (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.5).duration(MOTION.fast)} style={{ opacity: HIERARCHY.tertiary }}>
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
          <WeekCalendar activeDate={selectedDate} workoutDates={workoutDates} onDatePress={setSelectedDate} />

          {/* ══════════════════════════════════════════════════════════════════
            WEEKLY GOAL PROGRESS — Derived from goalTracker
        ══════════════════════════════════════════════════════════════════ */}
          {goalProgress && goalProgress.overallProgress > 0 && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.8).duration(MOTION.fast)} style={{ opacity: HIERARCHY.secondary }}>
              <View style={[styles.goalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                    {goalProgress.workoutsDone}/{goalProgress.goals.workoutsTarget} {t('dashboard.workouts') || 'workouts'}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {goalProgress.activeMinutesDone}/{goalProgress.goals.activeMinutesTarget} {t('fitquest.minShort') || 'min'}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            ADAPTIVE NUDGE — Churn risk or high fatigue guidance
        ══════════════════════════════════════════════════════════════════ */}
          {userState?.churnRisk && !hasInterruptedSession && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.9).duration(MOTION.fast)} style={{ opacity: HIERARCHY.secondary }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => exec('dash_quick_start', () => nav.push('/fitquest?autostart=1'), { haptic: 'light' })}
                style={[styles.nudgeCard, { backgroundColor: theme.colors.accent + '10', borderColor: theme.colors.accent + '30' }]}
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
            </Animated.View>
          )}

          {userState?.fatigueTier === 'HIGH' && !isRecoveryBad && (
            <Animated.View entering={FadeInDown.delay(MOTION.stagger * 4.9).duration(MOTION.fast)} style={{ opacity: HIERARCHY.tertiary }}>
              <View style={[styles.nudgeCard, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30' }]}>
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
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            DAILY ACTIVITY STATS — Steps, Active Mins, Completion Rate
        ══════════════════════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInUp.delay(MOTION.stagger * 5).duration(MOTION.fast)} style={{ opacity: HIERARCHY.secondary }}>
            <View style={styles.dailyStatsRow}>
              <View
                style={[
                  styles.dailyStatCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <MaterialCommunityIcons name="shoe-print" size={20} color={theme.colors.blue} />
                <ThemedText variant="h4" weight="800" style={{ color: theme.colors.blue, marginTop: spacing[1] }}>
                  {todaySteps > 0 ? todaySteps.toLocaleString() : '0'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {t('dashboard.stepsToday') || 'Steps'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.dailyStatCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.purple} />
                <ThemedText variant="h4" weight="800" style={{ color: theme.colors.purple, marginTop: spacing[1] }}>
                  {todayActiveMinutes > 0 ? `${todayActiveMinutes}` : totalMinutes > 0 ? `${totalMinutes}` : '0'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {t('dashboard.activeMin') || 'Active min'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.dailyStatCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.success} />
                <ThemedText variant="h4" weight="800" style={{ color: theme.colors.success, marginTop: spacing[1] }}>
                  {completionRate > 0 ? `${completionRate}%` : '0%'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {t('dashboard.completionRate') || 'Completion'}
                </ThemedText>
              </View>
            </View>
          </Animated.View>

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 3: LAST WORKOUT - Summary only (reduced)
        ══════════════════════════════════════════════════════════════════ */}
          <SectionHeader title={t('dashboard.lastWorkout')} delay={MOTION.stagger * 6} />
          {recentWorkout ? (
            <AnimatedListItem key={recentWorkout.id} index={0} style={styles.workoutItem}>
              <GlassCard onPress={() => nav.push('/saved-workouts')} style={styles.workoutCard}>
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
              onAction={() => exec('dash_empty_start', () => nav.push('/fitquest?autostart=1'), { haptic: 'light' })}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 4: SECONDARY ACTION (minimal)
        ══════════════════════════════════════════════════════════════════ */}
          <View style={styles.secondaryActions}>
            <GradientButton
              title={t('dashboard.createCustom')}
              icon="playlist-plus"
              onPress={() => nav.push('/create-workout')}
              variant="success"
              style={styles.secondaryButton}
            />
          </View>

          {/* ══════════════════════════════════════════════════════════════════
            QUICK ACCESS TILES — Key features at a glance
        ══════════════════════════════════════════════════════════════════ */}
          <SectionHeader title={t('dashboard.explore') || 'Explore'} delay={MOTION.stagger * 7} />
          <Animated.View entering={FadeInUp.delay(MOTION.stagger * 7).duration(MOTION.fast)} style={{ opacity: HIERARCHY.tertiary }}>
            <View style={styles.exploreGrid}>
              {exploreTiles.map((tile, idx) => (
                <AnimatedListItem key={tile.route} index={idx} style={styles.exploreTileWrap}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={tile.label}
                    accessibilityHint={tile.desc}
                    onPress={() => exec('dash_tile_' + tile.route, () => nav.push(tile.route))}
                    style={[
                      styles.exploreTile,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.exploreTileIcon, { backgroundColor: tile.color + '18' }]}>
                      <MaterialCommunityIcons name={tile.icon} size={26} color={tile.color} />
                    </View>
                    <View style={styles.exploreTileContent}>
                      <ThemedText variant="bodySmall" weight="700" color="primary" style={styles.exploreTileLabel}>
                        {tile.label}
                      </ThemedText>
                      <ThemedText variant="caption" color="secondary" style={styles.exploreTileDesc} numberOfLines={1}>
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
          </Animated.View>

          <Spacer size="xl" />
        </Animated.View>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: spacing[25] },

  // ── LEVEL UP BANNER ──
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── GOAL CARD ──
  goalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  goalBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  goalBarFill: {
    height: 6,
    borderRadius: 3,
  },
  goalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },

  // ── ADAPTIVE NUDGE ──
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── HEADER (Compact) ──
  heroHeader: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: typography.sizes.caption, fontWeight: '500', marginBottom: spacing[0.5] },
  heroTitle: { fontSize: typography.sizes.h2, fontWeight: '700' },

  // Stats in header - Numbers heavier than labels
  headerStats: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
  },
  statValue: {
    fontSize: typography.sizes.body, 
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontSize: typography.sizes.xs, 
    fontWeight: '500',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 1: TODAY'S GOAL - LARGEST, MOST PROMINENT
  // ══════════════════════════════════════════════════════════════════
  todayGoalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    padding: spacing[6],
    minHeight: 180, // Tall card
  },
  todayGoalInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[6],
  },
  todayGoalInnerCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[4],
  },
  todayGoalLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayGoalRight: {
    flex: 1,
  },
  todayGoalPercent: {
    fontSize: typography.sizes.h2, 
    fontWeight: '800',
  },
  todayGoalTitle: {
    fontSize: typography.sizes.h3, 
    fontWeight: '700',
  },
  todayGoalSub: {
    fontSize: typography.sizes.bodySmall, 
    marginTop: spacing[1],
    lineHeight: 20,
  },
  todayGoalMeta: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[2],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metaValue: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '700',
  },
  metaLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '400',
  },
  primaryActionContainer: {
    marginTop: spacing[4],
  },
  primaryButton: {
    paddingVertical: spacing[4],
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 2: RECOVERY STATUS - Full width, state-driven colors
  // ══════════════════════════════════════════════════════════════════
  recoveryCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  recoveryInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  recoveryRight: {
    alignItems: 'flex-end',
  },
  recoveryTitle: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
  },
  recoveryValue: {
    fontSize: typography.sizes.h3, 
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  recoveryLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
    marginTop: spacing[0.5],
  },
  recoveryWarning: {
    fontSize: typography.sizes.caption, 
    fontWeight: '500',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },

  // ── BEHAVIORAL SIGNAL CARD ──
  signalCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  signalInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  signalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  trialCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  trialIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 3: LAST WORKOUT - Reduced, summary only
  // ══════════════════════════════════════════════════════════════════
  workoutItem: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  workoutCard: {
    padding: spacing[3],
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  workoutIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutInfo: { flex: 1 },
  workoutName: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
  workoutMeta: { fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] },
  workoutCalValue: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '700',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 4: SECONDARY ACTIONS (minimal)
  // ══════════════════════════════════════════════════════════════════
  secondaryActions: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
  },
  secondaryButton: {
    opacity: 0.85, // Visually de-emphasized
  },

  // ── LIVE STATUS (Minimal) ──
  liveCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  liveText: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '500',
  },

  // ── DAILY ACTIVITY STATS ──
  dailyStatsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  dailyStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  // ── UPDATES BANNER ──
  updatesBanner: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  // ── EXPLORE GRID (2-column) ──
  exploreGrid: {
    flexDirection: 'column',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
  },
  exploreTileWrap: {
    width: '100%',
    marginBottom: spacing[4],
  },
  exploreTileWrapCompact: {
    width: '100%',
  },
  exploreTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 74,
  },
  exploreTileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  exploreTileContent: {
    flex: 1,
    gap: spacing[0.5],
  },
  exploreTileArrowRow: {
    marginLeft: spacing[2],
    alignItems: 'center',
  },
  exploreTileLabel: {
    fontSize: typography.sizes.bodyMid, 
    fontWeight: '700',
  },
  exploreTileDesc: {
    fontSize: typography.sizes.caption, 
    fontWeight: '500',
    lineHeight: 15,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  quickTileWrap: {
    width: '31%',
  },
  quickTile: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  quickTileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  quickTileLabel: {
    fontSize: typography.sizes.captionSm, 
    fontWeight: '600',
    textAlign: 'center',
  },
});
