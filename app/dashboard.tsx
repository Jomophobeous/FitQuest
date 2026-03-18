import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { spacing } from '../src/design/theme-system';
import { useLanguage } from '../src/context/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemedText from '../src/components/ThemedText';
import FitQuestLogo from '../src/components/FitQuestLogo';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { SkeletonDashboard } from '../src/components/ui/Skeleton';
import { useDatabase } from '../src/context/DatabaseContext';
import { getUserProgress, getMuscleFatigue, getRecentSessions, getStreak, getDailyStepsForDate, getStepHistory, getAppState } from '../src/database/service';
import { getCachedReadiness, getStatusDisplay, type ReadinessSnapshot } from '../src/engines/ReadinessEngine';
import { getXPData } from '../src/services/xpService';
import { getCurrentRank } from '../src/services/rankingService';
import { RankBadge } from '../src/components/RankDisplay';
import { useDataSync } from '../src/services/dataSyncService';
import {
  GlassCard,
  WeekCalendar,
  ProgressRing,
  SectionHeader,
  GradientButton,
  PulseDot,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';

// Spacing uses canonical theme tokens: spacing[2]=8, [4]=16, [6]=24, [8]=32

interface RecentWorkout {
  id: string;
  name: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  exercises: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();
  const isCompactScreen = width < 420;
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [fatigueLevel, setFatigueLevel] = useState(0); // 0-100 scale
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkout | null>(null);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [todaySteps, setTodaySteps] = useState(0);
  const [todayActiveMinutes, setTodayActiveMinutes] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [todayExercisesDone, setTodayExercisesDone] = useState(0);
  const [todayExercisesTarget, setTodayExercisesTarget] = useState(0);
  const [realLevel, setRealLevel] = useState(1);
  const [realXP, setRealXP] = useState(0);
  const [displayName, setDisplayName] = useState<string>('Athlete');
  const [levelUpShown, setLevelUpShown] = useState(false);
  const prevLevelRef = useRef<number>(0);

  // Animated values
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  // Debounce loadProgress to prevent triple-calls from focus + sync events
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoad = useCallback(() => {
    if (!dbReady) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => { loadProgress(); }, 300);
  }, [dbReady]);

  // Reload data every time screen gains focus (e.g. after completing a workout)
  useFocusEffect(
    useCallback(() => {
      debouncedLoad();
    }, [debouncedLoad])
  );

  // Also reload when data sync events fire (workout completed, XP awarded, etc.)
  useDataSync(
    ['workout_completed', 'xp_awarded', 'steps_updated', 'streak_updated', 'level_up'],
    debouncedLoad
  );

  const loadProgress = async () => {
    console.log('[Dashboard] loadProgress:start');
    try {
      // Parallel data loading — all independent queries at once
      const [savedName, progress, streakData, fatigue, sessions, stepsData, xpData, readinessSnap] = await Promise.all([
        getAppState('user.display_name').catch(() => null as string | null),
        getUserProgress().catch(() => null),
        getStreak('user_local_001').catch(() => null),
        getMuscleFatigue('user_local_001').catch(() => []),
        getRecentSessions('user_local_001', 5).catch(() => []),
        getDailyStepsForDate('user_local_001', new Date().toISOString().split('T')[0]!).catch(() => null),
        getXPData().catch(() => ({ level: 1, totalXP: 0 })),
        getCachedReadiness('user_local_001').catch(() => null),
      ]);

      if (savedName) setDisplayName(savedName);
      
      // Progress
      const prog = progress ?? { weekly_xp: 0, total_workouts: 0, completed_workouts: 0 };
      if (streakData) {
        setUserProgress({ ...prog, current_streak: streakData.current, longest_streak: streakData.longest });
      } else {
        setUserProgress(prog);
      }
      
      // Fatigue
      if (fatigue && fatigue.length > 0) {
        const avgFatigue = fatigue.reduce((sum: number, m: any) => sum + (m.fatigue_level || 0), 0) / fatigue.length;
        setFatigueLevel(Math.round(avgFatigue));
      } else {
        setFatigueLevel(0);
      }

      // Sessions
      if (sessions && sessions.length > 0) {
        const latest = sessions[0]!;
        const sessionDate = new Date(latest.started_at);
        const isToday = sessionDate.toDateString() === new Date().toDateString();
        const isYesterday = sessionDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
        const dateLabel = isToday ? t('common.today') : isYesterday ? t('common.yesterday') : sessionDate.toLocaleDateString();
        
        setRecentWorkout({
          id: latest.id,
          name: latest.completed_exercises > 0
            ? `${latest.completed_exercises} ${t('dashboard.of')} ${latest.total_exercises} ${t('library.exercises').toLowerCase()}`
            : t('dashboard.incompleteSession'),
          date: dateLabel,
          duration: latest.duration_minutes || 0,
          caloriesBurned: latest.completed_exercises > 0
            ? Math.round((latest.duration_minutes || 0) * 5 + (latest.completed_exercises || 0) * 8)
            : 0,
          exercises: latest.completed_exercises || 0,
          icon: 'arm-flex' as any,
        });

        const todaySessions = sessions.filter(s => {
          const d = new Date(s.started_at);
          return d.toDateString() === new Date().toDateString() && (s.completed_exercises || 0) > 0;
        });
        setTotalCalories(todaySessions.reduce((sum, s) => sum + Math.round((s.duration_minutes || 0) * 5 + (s.completed_exercises || 0) * 8), 0));
        setTotalMinutes(todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0));

        const todayDone = todaySessions.reduce((sum, s) => sum + (s.completed_exercises || 0), 0);
        const allTodaySessions = sessions.filter(s => new Date(s.started_at).toDateString() === new Date().toDateString());
        const fullTarget = allTodaySessions.reduce((sum, s) => sum + (s.total_exercises || 0), 0);
        setTodayExercisesDone(todayDone);
        setTodayExercisesTarget(fullTarget);

        const completedCount = sessions.filter(s => s.completed_at).length;
        setCompletionRate(sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0);
        const dates = sessions.map(s => s.started_at.split('T')[0]!);
        setWorkoutDates([...new Set(dates)]);
      }

      // Steps
      if (stepsData) {
        setTodaySteps(stepsData.steps);
        setTodayActiveMinutes(stepsData.active_minutes);
      }

      // XP
      if (prevLevelRef.current > 0 && xpData.level > prevLevelRef.current) {
        setLevelUpShown(true);
        setTimeout(() => setLevelUpShown(false), 3500);
      }
      prevLevelRef.current = xpData.level;
      setRealLevel(xpData.level);
      setRealXP(xpData.totalXP);

      // Readiness
      if (readinessSnap) setReadiness(readinessSnap);
    } catch (error) {
      console.error('[Dashboard] Failed to load progress:', error);
    } finally {
      setLoading(false);
      console.log('[Dashboard] loadProgress:complete');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProgress();
    setRefreshing(false);
  };

  // State-driven UI: use readiness engine when available, fallback to fatigue
  const readinessScore = readiness?.score ?? (100 - fatigueLevel);
  const isRecoveryBad = readinessScore < 30;
  const isRecoveryGood = readinessScore >= 65;
  const recoveryPercent = readinessScore;
  const statusDisplay = readiness ? getStatusDisplay(readiness) : null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SkeletonDashboard />
      </SafeAreaView>
    );
  }

  const streak = userProgress?.current_streak ?? 0;
  const totalWorkouts = userProgress?.completed_workouts ?? 0;
  const weeklyXP = userProgress?.weekly_xp ?? 0;
  // Today's progress: based on actual exercises completed today (not weekly XP)
  // If no workouts today, check if any minutes/steps activity exists for a small baseline
  const todayProgress = todayExercisesTarget > 0
    ? Math.min(1, todayExercisesDone / todayExercisesTarget)
    : (totalMinutes > 0 ? Math.min(1, totalMinutes / 30) : 0); // fallback: 30min as full goal
  const level = realLevel;

  return (
    <ScreenErrorBoundary screenName="Dashboard" onGoBack={() => router.canGoBack() ? router.back() : undefined}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenTutorial
        screenKey="dashboard"
        icon="view-dashboard"
        title="Your Dashboard"
        description="Track your daily progress, workout streaks, steps, and XP all in one place. Pull down to refresh your stats."
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* ── LEVEL UP CELEBRATION ── */}
        {levelUpShown && (
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.levelUpBanner, { backgroundColor: theme.colors.accent }]}>
            <MaterialCommunityIcons name="arrow-up-bold-circle" size={22} color="#FFFFFF" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.levelUpTitle}>Level Up!</Text>
              <Text style={styles.levelUpSub}>You reached Level {realLevel} 🎉</Text>
            </View>
          </Animated.View>
        )}

        {/* ── COMPACT HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <View style={[styles.heroHeader, { backgroundColor: theme.colors.background }]}>
            <View style={styles.heroTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FitQuestLogo size={36} />
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
                <View style={[styles.statPill, { backgroundColor: theme.colors.warning + '15' }]}>
                  <ThemedText variant="bodySmall" weight="800" style={[styles.statValue, { color: theme.colors.warning }]}>{streak}</ThemedText>
                  <ThemedText variant="caption" color="muted">🔥</ThemedText>
                </View>
                <View style={[styles.statPill, { backgroundColor: theme.colors.accent + '15' }]}>
                  <RankBadge level={level} size="sm" />
                </View>
                <View style={[styles.statPill, { backgroundColor: theme.colors.surfaceVariant }] }>
                  <ThemedText variant="bodySmall" weight="800" style={[styles.statValue, { color: theme.colors.text }]}>{realXP}</ThemedText>
                  <ThemedText variant="caption" color="muted">{t('dashboard.xp')}</ThemedText>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 1: TODAY'S GOAL - LARGEST CARD, MOST PROMINENT
        ══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(100).duration(150)}>
          <GlassCard style={styles.todayGoalCard} delay={100}>
            <View style={[styles.todayGoalInner, isCompactScreen && styles.todayGoalInnerCompact]}>
              <View style={styles.todayGoalLeft}>
                <ProgressRing progress={todayProgress} size={120} color={theme.colors.accent}>
                  <ThemedText variant="h2" weight="800" color="accent" style={styles.todayGoalPercent}>
                    {Math.round(todayProgress * 100)}%
                  </ThemedText>
                </ProgressRing>
              </View>
              <View style={styles.todayGoalRight}>
                <ThemedText variant="h3" color="primary" style={styles.todayGoalTitle} numberOfLines={1} adjustsFontSizeToFit>
                  {t('dashboard.todaysGoal')}
                </ThemedText>
                <ThemedText variant="bodySmall" color="secondary" style={styles.todayGoalSub} numberOfLines={2}>
                  {todayProgress >= 1 ? (t('dashboard.completed') || 'Completed! 🎉') : (t('dashboard.keepPushing') || 'Keep pushing — you got this!')}
                </ThemedText>
                <View style={styles.todayGoalMeta}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="fire" size={16} color={theme.colors.warning} />
                    <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.text }}> {totalCalories}</ThemedText>
                    <ThemedText variant="caption" color="muted"> {t('dashboard.kcal')}</ThemedText>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textMuted} />
                    <ThemedText variant="bodySmall" weight="700" style={{ color: theme.colors.text }}> {totalMinutes}</ThemedText>
                    <ThemedText variant="caption" color="muted"> {t('fitquest.minShort')}</ThemedText>
                  </View>
                </View>
                {/* PRIMARY ACTION: Start Workout - MOST PROMINENT */}
                <View style={styles.primaryActionContainer}>
                  <GradientButton
                    title={t('dashboard.startWorkout')}
                    icon="lightning-bolt"
                    onPress={() => {
                      console.log('[Dashboard] CTA:startWorkout');
                      router.push('/fitquest');
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
        ══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(200).duration(150)}>
          <View style={[
            styles.recoveryCard,
            {
              backgroundColor: isRecoveryBad 
                ? theme.colors.error + '15'
                : (theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface),
              borderColor: isRecoveryBad ? theme.colors.error + '40' : theme.colors.border,
            }
          ]}>
            <View style={styles.recoveryInner}>
              <View style={styles.recoveryLeft}>
                <MaterialCommunityIcons 
                  name={(statusDisplay?.icon || (isRecoveryBad ? 'battery-low' : isRecoveryGood ? 'battery-high' : 'battery-medium')) as any} 
                  size={24} 
                  color={isRecoveryBad ? theme.colors.error : isRecoveryGood ? theme.colors.success : theme.colors.warning} 
                />
                <View>
                  <ThemedText variant="bodySmall" weight="600" style={[
                    styles.recoveryTitle,
                    { color: isRecoveryBad ? theme.colors.error : theme.colors.text }
                  ]}>
                    {statusDisplay?.label || t('dashboard.recovery')}
                  </ThemedText>
                  {readiness?.timeSinceLastWorkoutMinutes != null && (
                    <ThemedText variant="caption" color="muted" style={{ marginLeft: 8 }}>
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
                <ThemedText variant="h3" weight="800" style={[
                  styles.recoveryValue,
                  { color: isRecoveryBad ? theme.colors.error : isRecoveryGood ? theme.colors.success : theme.colors.warning }
                ]}>
                  {recoveryPercent}%
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {isRecoveryBad ? t('dashboard.restRecommended') : isRecoveryGood ? t('dashboard.readyToTrain') : t('dashboard.recoveryModerate')}
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

        {/* ── WEEK CALENDAR (Minimal) ── */}
        <WeekCalendar
          activeDate={selectedDate}
          workoutDates={workoutDates}
          onDatePress={setSelectedDate}
        />

        {/* ══════════════════════════════════════════════════════════════════
            DAILY ACTIVITY STATS — Steps, Active Mins, Completion Rate
        ══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInUp.delay(250).duration(150)}>
          <View style={styles.dailyStatsRow}>
            <View style={[styles.dailyStatCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="shoe-print" size={20} color={theme.colors.blue} />
              <ThemedText variant="h4" weight="800" style={{ color: theme.colors.blue, marginTop: 4 }}>
                {todaySteps > 0 ? todaySteps.toLocaleString() : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">{t('dashboard.stepsToday') || 'Steps'}</ThemedText>
            </View>
            <View style={[styles.dailyStatCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.purple} />
              <ThemedText variant="h4" weight="800" style={{ color: theme.colors.purple, marginTop: 4 }}>
                {todayActiveMinutes > 0 ? `${todayActiveMinutes}` : totalMinutes > 0 ? `${totalMinutes}` : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">{t('dashboard.activeMin') || 'Active min'}</ThemedText>
            </View>
            <View style={[styles.dailyStatCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.success} />
              <ThemedText variant="h4" weight="800" style={{ color: theme.colors.success, marginTop: 4 }}>
                {completionRate > 0 ? `${completionRate}%` : '—'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">{t('dashboard.completionRate') || 'Completion'}</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 3: LAST WORKOUT - Summary only (reduced)
        ══════════════════════════════════════════════════════════════════ */}
        <SectionHeader title={t('dashboard.lastWorkout')} delay={300} />
        {recentWorkout ? (
          <AnimatedListItem key={recentWorkout.id} index={0} style={styles.workoutItem}>
            <GlassCard
              onPress={() => router.push('/saved-workouts')}
              style={styles.workoutCard}
            >
              <View style={styles.workoutRow}>
                <View style={[styles.workoutIcon, { backgroundColor: theme.colors.accent + '15' }]}>
                  <MaterialCommunityIcons name={recentWorkout.icon} size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.workoutInfo}>
                  <ThemedText variant="bodySmall" weight="600" color="primary" style={styles.workoutName}>{recentWorkout.name}</ThemedText>
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
          <View style={[styles.workoutItem, { paddingHorizontal: spacing[4] }]}>
            <GlassCard style={[styles.workoutCard, { alignItems: 'center', paddingVertical: spacing[6] }]}>
              <MaterialCommunityIcons name="dumbbell" size={32} color={theme.colors.textMuted} />
              <ThemedText variant="caption" color="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                {t('dashboard.noWorkoutsYet')}
              </ThemedText>
            </GlassCard>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 4: SECONDARY ACTION (minimal)
        ══════════════════════════════════════════════════════════════════ */}
        <View style={styles.secondaryActions}>
          <GradientButton
            title={t('dashboard.createCustom')}
            icon="playlist-plus"
            onPress={() => router.push('/create-workout' as any)}
            variant="success"
            style={styles.secondaryButton}
          />
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            QUICK ACCESS TILES — Key features at a glance
        ══════════════════════════════════════════════════════════════════ */}
        <SectionHeader title={t('dashboard.explore') || 'Explore'} delay={350} />
        <Animated.View entering={FadeInUp.delay(350).duration(150)}>
          <View style={styles.exploreGrid}>
            {[
              { label: t('dashboard.health') || 'Health', desc: t('dashboard.healthDesc') || 'Track vitals & wellness', icon: 'heart-pulse' as const, color: theme.colors.error, route: '/health-dashboard' },
              { label: t('dashboard.analytics') || 'Analytics', desc: t('dashboard.analyticsDesc') || 'Progress insights', icon: 'chart-bar' as const, color: theme.colors.blue, route: '/analytics' },
              { label: t('dashboard.coach') || 'Coach', desc: t('dashboard.coachDesc') || 'AI fitness guidance', icon: 'robot-happy' as const, color: theme.colors.purple, route: '/coach' },
              { label: 'Professor', desc: 'Coming Soon', icon: 'school' as const, color: theme.colors.purple, route: '/professor', comingSoon: true },
              { label: t('dashboard.mealPrep') || 'Meal Prep', desc: t('dashboard.mealPrepDesc') || 'Nutrition planning', icon: 'food-variant' as const, color: theme.colors.accent, route: '/meal-prep' },
              { label: t('dashboard.exercises') || 'Exercises', desc: t('dashboard.exercisesDesc') || 'Exercise library', icon: 'dumbbell' as const, color: theme.colors.warning, route: '/exercises' },
              { label: t('dashboard.myWorkouts') || 'My Workouts', desc: t('dashboard.myWorkoutsDesc') || 'Saved routines', icon: 'folder-star' as const, color: theme.colors.pink, route: '/saved-workouts' },
              { label: 'Craft My Mind', desc: 'Coming Soon', icon: 'brain' as const, color: theme.colors.skyBlue, route: '/fitmind-library', comingSoon: true },
            ].map((tile, idx) => (
              <AnimatedListItem
                key={tile.route}
                index={idx}
                style={styles.exploreTileWrap}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={!!(tile as any).comingSoon}
                  accessibilityRole="button"
                  accessibilityLabel={tile.label}
                  accessibilityHint={tile.desc}
                  onPress={() => {
                    if ((tile as any).comingSoon) return;
                    console.log('[Dashboard] Explore:open', { route: tile.route, label: tile.label });
                    router.push(tile.route as any);
                  }}
                  style={[
                    styles.exploreTile,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      opacity: (tile as any).comingSoon ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={[styles.exploreTileIcon, { backgroundColor: tile.color + '18' }]}> 
                    <MaterialCommunityIcons name={tile.icon} size={26} color={tile.color} />
                  </View>
                  <View style={styles.exploreTileContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText variant="bodySmall" weight="700" color="primary" style={styles.exploreTileLabel}>{tile.label}</ThemedText>
                      {!!(tile as any).comingSoon && (
                        <View style={{ backgroundColor: theme.colors.warning + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: theme.colors.warning, fontSize: 9, fontWeight: '700' }}>SOON</Text>
                        </View>
                      )}
                    </View>
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
                    <MaterialCommunityIcons name={(tile as any).comingSoon ? "lock" : "arrow-right"} size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        </Animated.View>

        {/* ── LIVE STATUS (Minimal) ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(150)}>
          <View style={[styles.updatesBanner, { backgroundColor: theme.colors.accent + '10', borderColor: theme.colors.accent + '25' }]}>
            <MaterialCommunityIcons name="rocket-launch-outline" size={18} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="bodySmall" weight="600" style={{ color: theme.colors.accent }}>
                {t('dashboard.updatesTitle') || 'Updates Coming Soon'}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {t('dashboard.updatesDesc') || 'Social features, wearable sync, and AI Professor are on the way.'}
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(450).duration(150)}>
          <View style={styles.liveCard}>
            <PulseDot color={theme.colors.success} size={6} active={true} />
            <ThemedText variant="caption" color="muted" style={styles.liveText}>
              {t('dashboard.recoveryTrackingActive')}
            </ThemedText>
          </View>
        </Animated.View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },

  // ── LEVEL UP BANNER ──
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  levelUpTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' } as const,
  levelUpSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500', marginTop: 1 } as const,
  
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
  greeting: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  heroTitle: { fontSize: 24, fontWeight: '700' },
  
  // Stats in header - Numbers heavier than labels
  headerStats: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statValue: { 
    fontSize: 16, 
    fontWeight: '800', 
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: { 
    fontSize: 10, 
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
    fontSize: 24, 
    fontWeight: '800',
  },
  todayGoalTitle: { 
    fontSize: 20, 
    fontWeight: '700',
  },
  todayGoalSub: { 
    fontSize: 14,
    marginTop: 4, 
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
    fontSize: 14, 
    fontWeight: '700',
  },
  metaLabel: { 
    fontSize: 11, 
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
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '600',
  },
  recoveryValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
  },
  recoveryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  recoveryWarning: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.15)',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 3: LAST WORKOUT - Reduced, summary only
  // ══════════════════════════════════════════════════════════════════
  workoutItem: { 
    paddingHorizontal: spacing[4], 
    marginBottom: spacing[2],
  },
  workoutCard: { 
    padding: spacing[2] + 2, // ~10px (within rhythm: closest to 8)
  },
  workoutRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing[2],
  },
  workoutIcon: { 
    width: 36, // Reduced from 44
    height: 36, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  workoutInfo: { flex: 1 },
  workoutName: { fontSize: 14, fontWeight: '600' },
  workoutMeta: { fontSize: 11, marginTop: 2 },
  workoutCalValue: { 
    fontSize: 14, 
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
    borderRadius: 12,
  },
  liveText: { 
    fontSize: 11, 
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
    borderRadius: 12,
    borderWidth: 1,
  },

  // ── UPDATES BANNER ──
  updatesBanner: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 74,
  },
  exploreTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  exploreTileContent: {
    flex: 1,
    gap: 2,
  },
  exploreTileArrowRow: {
    marginLeft: spacing[2],
    alignItems: 'center',
  },
  exploreTileLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  exploreTileDesc: {
    fontSize: 12,
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
