/**
 * useDashboardViewModel — Dashboard screen ViewModel.
 *
 * Encapsulates ALL data loading, state management, and derived computations
 * for the Dashboard screen. The screen component receives ONLY this ViewModel's
 * return value — no direct DB, service, or engine imports.
 *
 * Data sources (hidden from UI):
 *   - database/service: getUserProgress, getMuscleFatigue, getRecentSessions, etc.
 *   - engines: ReadinessEngine, BehavioralSignalEngine, AdaptiveMemoryEngine, etc.
 *   - services: xpService, dataSyncService
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../context/DatabaseContext';
import { useSubscription } from '../purchases/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useMountedGuard } from '../hooks/useMountedGuard';
import {
  getUserProgress,
  getMuscleFatigue,
  getRecentSessions,
  getStreak,
  getDailyStepsForDate,
  getAppState,
  getUserProfile,
} from '../database/service';
import { RealisticHealthEngine } from '../engines/RealisticHealthEngine';
import {
  getCachedReadiness,
  invalidateReadinessCache,
  getStatusDisplay,
  type ReadinessSnapshot,
} from '../engines/ReadinessEngine';
import { needsRecoveryTick, applyDailyRecoveryTick } from '../engines/recoveryEngine';
import { getXPData } from '../services/xpService';
import { useDataSync } from '../services/dataSyncService';
import { createViewModel } from './createViewModel';
import { featureFlags as featureFlagsService } from '../services/featureFlags';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

// ── Types ──

interface BehavioralSignal {
  colorKey: string;
  icon: string;
  headline: string;
  subtext: string;
  pulse: boolean;
}

interface LastImpact {
  hasHistory: boolean;
  trend: string;
  trendStatement: string;
}

interface TrialMessage {
  type: string;
  headline: string;
  subtext: string;
  actionRoute?: string;
  actionLabel?: string;
}

interface TrialSnapshot {
  phase: string;
  message: TrialMessage;
}

interface GoalProgress {
  overallProgress: number;
  workoutsDone: number;
  activeMinutesDone: number;
  goals: { workoutsTarget: number; activeMinutesTarget: number };
}

export interface RecentWorkout {
  id: string;
  name: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  exercises: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface ConsistencyProfile {
  mode: string;
  statusLine: string;
}

export interface DashboardState {
  loading: boolean;
  loadError: string | null;
  refreshing: boolean;
  displayName: string;
  userProgress: any;
  fatigueLevel: number | null;
  readiness: ReadinessSnapshot | null;
  behavioralSignal: BehavioralSignal | null;
  lastImpact: LastImpact | null;
  trialSnapshot: TrialSnapshot | null;
  consistencyProfile: ConsistencyProfile | null;
  recentWorkout: RecentWorkout | null;
  workoutDates: string[];
  totalCalories: number;
  totalMinutes: number;
  todaySteps: number;
  todayActiveMinutes: number;
  completionRate: number;
  todayExercisesDone: number;
  todayExercisesTarget: number;
  realLevel: number;
  realXP: number;
  levelUpShown: boolean;
  selectedDate: Date;
  hasInterruptedSession: boolean;
  goalProgress: GoalProgress | null;
  userState: Record<string, unknown> | null;
}

export interface DashboardDerived {
  streak: number;
  todayProgress: number;
  readinessScore: number | null;
  hasReadinessData: boolean;
  isRecoveryBad: boolean;
  isRecoveryGood: boolean;
  recoveryPercent: number;
  statusDisplay: ReturnType<typeof getStatusDisplay> | null;
  isSubscribed: boolean;
  /** Memoized style arrays for stat pills */
  statPillWarning: ViewStyle[];
  statPillAccent: ViewStyle[];
  statPillSurface: ViewStyle[];
  signalCardBg: ViewStyle | undefined;
  exploreTiles: Array<{ label: string; desc: string; icon: string; color: string; route: string }>;
  nextAction: { type: string; label: string; route: string; icon: string };
}

export interface DashboardActions {
  handleRefresh: () => void;
  setSelectedDate: (date: Date) => void;
  retryLoad: () => void;
}

export type DashboardViewModel = DashboardState & DashboardDerived & DashboardActions;

// ── ViewModel ──

export const useDashboardViewModel = createViewModel((): DashboardViewModel => {
  const { isReady: dbReady } = useDatabase();
  const { accessState } = useSubscription();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isSubscribed = accessState === 'SUBSCRIBED';

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [userProgress, setUserProgress] = useState<any>(null);
  const [fatigueLevel, setFatigueLevel] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [behavioralSignal, setBehavioralSignal] = useState<BehavioralSignal | null>(null);
  const [lastImpact, setLastImpact] = useState<LastImpact | null>(null);
  const [trialSnapshot, setTrialSnapshot] = useState<TrialSnapshot | null>(null);
  const [consistencyProfile, setConsistencyProfile] = useState<ConsistencyProfile | null>(null);
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkout | null>(null);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [todaySteps, setTodaySteps] = useState(0);
  const [todayActiveMinutes, setTodayActiveMinutes] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [todayExercisesDone, setTodayExercisesDone] = useState(0);
  const [todayExercisesTarget, setTodayExercisesTarget] = useState(0);
  const [realLevel, setRealLevel] = useState(1);
  const [realXP, setRealXP] = useState(0);
  const [levelUpShown, setLevelUpShown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [hasInterruptedSession, setHasInterruptedSession] = useState(false);
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null);
  const [userState, setUserState] = useState<Record<string, unknown> | null>(null);

  // ── Refs ──
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const lastLoadedAt = useRef(0);
  const prevLevelRef = useRef<number>(0);
  const { mountedRef } = useMountedGuard();
  const LOAD_COOLDOWN_MS = 2000;

  // ── Core data loader ──
  const loadProgress = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    lastLoadedAt.current = Date.now();

    // Daily recovery tick (non-blocking)
    try {
      if (await needsRecoveryTick('user_local_001')) {
        await applyDailyRecoveryTick('user_local_001');
        invalidateReadinessCache();
      }
    } catch {}

    try {
      const [
        savedName,
        progress,
        streakData,
        fatigue,
        sessions,
        stepsData,
        xpData,
        readinessSnap,
        signal,
        impact,
        trialSnap,
        consistencySnap,
        profileSnap,
        activeWorkoutRaw,
        goalSnap,
      ] = await Promise.all([
        getAppState('user.display_name').catch(() => null as string | null),
        getUserProgress().catch(() => null),
        getStreak('user_local_001').catch(() => null),
        getMuscleFatigue('user_local_001').catch(() => []),
        getRecentSessions('user_local_001', 5).catch(() => []),
        getDailyStepsForDate('user_local_001', new Date().toISOString().split('T')[0]!).catch(() => null),
        getXPData().catch(() => ({ level: 1, totalXP: 0 })),
        getCachedReadiness('user_local_001').catch(() => null),
        Promise.resolve(null), // behavioralSignal (engine removed)
        Promise.resolve(null), // lastImpact (engine removed)
        Promise.resolve(null), // trialSnapshot (engine removed)
        Promise.resolve(null), // consistencyProfile (engine removed)
        getUserProfile('user_local_001').catch(() => null),
        getAppState('active_workout_state').catch(() => null as string | null),
        Promise.resolve(null), // goalProgress (service removed)
      ]);

      if (!mountedRef.current) return;

      // Session resume detection
      setHasInterruptedSession(!!activeWorkoutRaw && activeWorkoutRaw.length > 2);

      // Goal progress + cached user state (non-blocking, nullable)
      setGoalProgress(goalSnap);
      setUserState(null); // UserStateEngine removed

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
        setFatigueLevel(null);
      }

      // Sessions
      if (sessions && sessions.length > 0) {
        const latest = sessions[0]!;
        const sessionDate = new Date(latest.started_at);
        const isToday = sessionDate.toDateString() === new Date().toDateString();
        const isYesterday = sessionDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
        const dateLabel = isToday
          ? (t('common.today') ?? 'Today')
          : isYesterday
            ? (t('common.yesterday') ?? 'Yesterday')
            : sessionDate.toLocaleDateString();

        setRecentWorkout({
          id: latest.id,
          name:
            latest.completed_exercises > 0
              ? `${latest.completed_exercises} ${t('dashboard.of')} ${latest.total_exercises} ${(t('library.exercises') ?? 'exercises').toLowerCase()}`
              : (t('dashboard.incompleteSession') ?? 'Incomplete session'),
          date: dateLabel,
          duration: latest.duration_minutes || 0,
          caloriesBurned:
            latest.completed_exercises > 0
              ? RealisticHealthEngine.estimateCalories(
                  'weight_training_moderate',
                  latest.duration_minutes || 0,
                  profileSnap?.weight_kg || 70,
                ).grossCalories
              : 0,
          exercises: latest.completed_exercises || 0,
          icon: 'arm-flex' as any,
        });

        const todaySessions = sessions.filter((s) => {
          const d = new Date(s.started_at);
          return d.toDateString() === new Date().toDateString() && (s.completed_exercises || 0) > 0;
        });
        setTotalCalories(
          todaySessions.reduce(
            (sum, s) =>
              sum +
              RealisticHealthEngine.estimateCalories(
                'weight_training_moderate',
                s.duration_minutes || 0,
                profileSnap?.weight_kg || 70,
              ).grossCalories,
            0,
          ),
        );
        setTotalMinutes(todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0));

        const todayDone = todaySessions.reduce((sum, s) => sum + (s.completed_exercises || 0), 0);
        const allTodaySessions = sessions.filter(
          (s) => new Date(s.started_at).toDateString() === new Date().toDateString(),
        );
        const fullTarget = allTodaySessions.reduce((sum, s) => sum + (s.total_exercises || 0), 0);
        setTodayExercisesDone(todayDone);
        setTodayExercisesTarget(fullTarget);

        const completedCount = allTodaySessions.filter((s) => s.completed_at).length;
        setCompletionRate(
          allTodaySessions.length > 0 ? Math.round((completedCount / allTodaySessions.length) * 100) : 0,
        );

        const dates = sessions.map((s) => s.started_at.split('T')[0]!);
        setWorkoutDates([...new Set(dates)]);
      }

      // Steps
      if (stepsData) {
        setTodaySteps(stepsData.steps);
        setTodayActiveMinutes(stepsData.active_minutes);
      }

      // XP + level-up detection
      if (prevLevelRef.current > 0 && xpData.level > prevLevelRef.current) {
        setLevelUpShown(true);
        setTimeout(() => setLevelUpShown(false), 3500);
      }
      if (prevLevelRef.current === 0) prevLevelRef.current = xpData.level;
      else prevLevelRef.current = xpData.level;
      setRealLevel(xpData.level);
      setRealXP(xpData.totalXP);

      // Intelligence layers
      if (readinessSnap) setReadiness(readinessSnap);
      if (signal) setBehavioralSignal(signal);
      if (impact) setLastImpact(impact);
      if (trialSnap) setTrialSnapshot(trialSnap);
      if (consistencySnap) setConsistencyProfile(consistencySnap);
    } catch (error) {
      if (__DEV__) console.error('[Dashboard VM] loadProgress failed:', error);
      setLoadError(t('common.errorLoadingData') ?? 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      lastLoadedAt.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mountedRef is a stable ref
  }, [isSubscribed, t]);

  // ── Debounced loader ──
  const debouncedLoad = useCallback(() => {
    if (!dbReady) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      if (Date.now() - lastLoadedAt.current < LOAD_COOLDOWN_MS) return;
      loadProgress();
    }, 300);
  }, [dbReady, loadProgress]);

  // ── Focus reload ──
  useFocusEffect(
    useCallback(() => {
      debouncedLoad();
    }, [debouncedLoad]),
  );

  // ── Data sync events ──
  useDataSync(['workout_completed', 'xp_awarded', 'steps_updated', 'streak_updated', 'level_up'], debouncedLoad);

  // ── Actions ──
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    debouncedLoad();
    setTimeout(() => setRefreshing(false), 600);
  }, [debouncedLoad]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    debouncedLoad();
  }, [debouncedLoad]);

  // ── Derived state ──
  const streak = userProgress?.current_streak ?? 0;
  const readinessScore: number | null = readiness?.score ?? (fatigueLevel != null ? 100 - fatigueLevel : null);
  const hasReadinessData = readinessScore != null;
  const isRecoveryBad = hasReadinessData && readinessScore < 30;
  const isRecoveryGood = hasReadinessData && readinessScore >= 65;
  const recoveryPercent = readinessScore ?? 0;
  const statusDisplay = readiness ? getStatusDisplay(readiness) : null;

  const todayProgress =
    todayExercisesTarget > 0
      ? Math.min(1, todayExercisesDone / todayExercisesTarget)
      : totalMinutes > 0
        ? Math.min(1, totalMinutes / 30)
        : 0;

  // ── Memoized style values ──
  const statPillWarning = useMemo(
    (): ViewStyle[] => [{ backgroundColor: theme.colors.warning + '15' }],
    [theme.colors.warning],
  );
  const statPillAccent = useMemo(
    (): ViewStyle[] => [{ backgroundColor: theme.colors.accent + '15' }],
    [theme.colors.accent],
  );
  const statPillSurface = useMemo(
    (): ViewStyle[] => [{ backgroundColor: theme.colors.surfaceVariant }],
    [theme.colors.surfaceVariant],
  );
  const signalCardBg = useMemo(
    (): ViewStyle | undefined =>
      behavioralSignal && behavioralSignal.colorKey in theme.colors
        ? { backgroundColor: theme.colors[behavioralSignal.colorKey as keyof typeof theme.colors] + '18' }
        : undefined,
    [behavioralSignal, theme.colors],
  );

  // ── Explore tiles — filtered by feature flags ──
  const exploreTiles = useMemo(() => {
    const allTiles = [
      {
        label: t('dashboard.health') || 'Health',
        desc: t('dashboard.healthDesc') || 'Track vitals & wellness',
        icon: 'heart-pulse',
        color: theme.colors.error,
        route: '/health-dashboard',
        flag: 'HEALTH_DASHBOARD_MODULE' as const,
      },
      {
        label: t('dashboard.analytics') || 'Analytics',
        desc: t('dashboard.analyticsDesc') || 'Progress insights',
        icon: 'chart-bar',
        color: theme.colors.blue,
        route: '/analytics',
        flag: null,
      },
      {
        label: t('dashboard.coach') || 'Coach',
        desc: t('dashboard.coachDesc') || 'AI fitness guidance',
        icon: 'robot-happy',
        color: theme.colors.purple,
        route: '/coach',
        flag: null,
      },
      {
        label: t('dashboard.mealPrep') || 'Meal Prep',
        desc: t('dashboard.mealPrepDesc') || 'Nutrition planning',
        icon: 'food-variant',
        color: theme.colors.accent,
        route: '/meal-prep',
        flag: 'MEAL_PREP_MODULE' as const,
      },
    ];
    return allTiles.filter((tile) => !tile.flag || featureFlagsService.isEnabled(tile.flag));
  }, [t, theme.colors]);

  // ── Next Action (Block W) — prioritized single recommendation ──
  const nextAction = useMemo(() => {
    if (hasInterruptedSession)
      return {
        type: 'resume' as const,
        label: 'Resume your workout',
        route: '/fitquest' as const,
        icon: 'play-circle' as const,
      };
    if (isRecoveryBad)
      return {
        type: 'rest' as const,
        label: 'Take a rest day — recovery is low',
        route: '/dashboard' as const,
        icon: 'bed' as const,
      };
    if (userState?.fatigueTier === 'HIGH')
      return {
        type: 'mobility' as const,
        label: 'Try a light mobility session',
        route: '/fitquest' as const,
        icon: 'yoga' as const,
      };
    if (userState?.churnRisk)
      return {
        type: 'quick_start' as const,
        label: 'Quick 10-min session?',
        route: '/fitquest?autostart=1' as const,
        icon: 'lightning-bolt' as const,
      };
    if (todayProgress < 0.5)
      return {
        type: 'workout' as const,
        label: "Start today's workout",
        route: '/fitquest?autostart=1' as const,
        icon: 'dumbbell' as const,
      };
    if (todayProgress >= 0.5 && todayProgress < 1)
      return {
        type: 'finish' as const,
        label: "Finish today's goal",
        route: '/fitquest' as const,
        icon: 'flag-checkered' as const,
      };
    return {
      type: 'explore' as const,
      label: 'Explore your progress',
      route: '/analytics' as const,
      icon: 'chart-line' as const,
    };
  }, [hasInterruptedSession, isRecoveryBad, userState, todayProgress]);

  // Fire-and-forget analytics for next action
  return {
    // State
    loading,
    loadError,
    refreshing,
    displayName,
    userProgress,
    fatigueLevel,
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
    todayExercisesDone,
    todayExercisesTarget,
    realLevel,
    realXP,
    levelUpShown,
    selectedDate,
    hasInterruptedSession,
    goalProgress,
    userState,
    // Derived
    streak,
    todayProgress,
    readinessScore,
    hasReadinessData,
    isRecoveryBad,
    isRecoveryGood,
    recoveryPercent,
    statusDisplay,
    isSubscribed,
    statPillWarning,
    statPillAccent,
    statPillSurface,
    signalCardBg,
    exploreTiles,
    nextAction,
    // Actions
    handleRefresh,
    setSelectedDate,
    retryLoad,
  };
});
