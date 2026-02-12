import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUserProgress, getMuscleFatigue, getRecentSessions, getStreak } from '../src/database/service';
import {
  GlassCard,
  WeekCalendar,
  ProgressRing,
  SectionHeader,
  GradientButton,
  PulseDot,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Spacing rhythm: ONLY 8, 16, 24, 32
const SPACING = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
} as const;

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
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [fatigueLevel, setFatigueLevel] = useState(0); // 0-100 scale
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkout | null>(null);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  // Animated values
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300 });
  }, []);


  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progress = await getUserProgress();
      setUserProgress(progress);

      // Load real streak data
      try {
        const streakData = await getStreak('user_local_001');
        if (streakData) {
          setUserProgress((prev: any) => ({
            ...prev,
            current_streak: streakData.current,
            longest_streak: streakData.longest,
          }));
        }
      } catch (e) {
        // Streak not available
      }
      
      // Calculate overall fatigue from muscle fatigue data
      try {
        const fatigue = await getMuscleFatigue('user_local_001');
        if (fatigue && fatigue.length > 0) {
          const avgFatigue = fatigue.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / fatigue.length;
          setFatigueLevel(Math.round(avgFatigue));
        } else {
          setFatigueLevel(0); // No fatigue data = fully recovered
        }
      } catch (e) {
        setFatigueLevel(0); // No fatigue data = fully recovered
      }

      // Load recent workout sessions for real data
      try {
        const sessions = await getRecentSessions('user_local_001', 5);
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          const sessionDate = new Date(latest.started_at);
          const isToday = sessionDate.toDateString() === new Date().toDateString();
          const isYesterday = sessionDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
          const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : sessionDate.toLocaleDateString();
          
          setRecentWorkout({
            id: latest.id,
            name: latest.completed_exercises > 0
              ? `${latest.completed_exercises} of ${latest.total_exercises} exercises`
              : 'Incomplete Session',
            date: dateLabel,
            duration: latest.duration_minutes || 0,
            caloriesBurned: latest.completed_exercises > 0
              ? Math.round((latest.duration_minutes || 0) * 6.5)
              : 0, // No calories if no exercises completed
            exercises: latest.completed_exercises || 0,
            icon: 'arm-flex' as any,
          });

          // Calculate real totals from today's sessions (only count sessions with completed exercises)
          const todaySessions = sessions.filter(s => {
            const d = new Date(s.started_at);
            return d.toDateString() === new Date().toDateString() && (s.completed_exercises || 0) > 0;
          });
          setTotalCalories(todaySessions.reduce((sum, s) => sum + Math.round((s.duration_minutes || 0) * 6.5), 0));
          setTotalMinutes(todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0));

          // Collect workout dates for week calendar
          const dates = sessions.map(s => s.started_at.split('T')[0]);
          setWorkoutDates([...new Set(dates)]);
        }
      } catch (e) {
        console.log('[Dashboard] No workout sessions yet');
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // State-driven UI: determine if recovery is bad (>70% fatigue)
  const isRecoveryBad = fatigueLevel > 70;
  const isRecoveryGood = fatigueLevel < 30;
  const recoveryPercent = 100 - fatigueLevel;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const streak = userProgress?.current_streak ?? 0;
  const totalWorkouts = userProgress?.total_workouts ?? 0;
  const weeklyXP = userProgress?.weekly_xp ?? 0;
  const todayProgress = userProgress ? Math.min(1, (userProgress.weekly_xp || 0) / 1000) : 0;
  const level = userProgress?.level ?? 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── COMPACT HEADER ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <View style={[styles.heroHeader, { backgroundColor: theme.colors.background }]}>
            <View style={styles.heroTop}>
              <View>
                <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
                  {t('dashboard.welcomeBack') || 'Welcome back'}
                </Text>
                <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                  {t('tab.home')}
                </Text>
              </View>
              {/* Stats row: Numbers visually heavier than labels */}
              <View style={styles.headerStats}>
                <View style={styles.statPill}>
                  <Text style={[styles.statValue, { color: theme.colors.warning }]}>{streak}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>🔥</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={[styles.statValue, { color: theme.colors.accent }]}>{level}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>Lv</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{weeklyXP}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>XP</Text>
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
            <View style={styles.todayGoalInner}>
              <View style={styles.todayGoalLeft}>
                <ProgressRing progress={todayProgress} size={120} color={theme.colors.accent}>
                  <Text style={[styles.todayGoalPercent, { color: theme.colors.accent }]}>
                    {Math.round(todayProgress * 100)}%
                  </Text>
                </ProgressRing>
              </View>
              <View style={styles.todayGoalRight}>
                <Text style={[styles.todayGoalTitle, { color: theme.colors.text }]}>
                  {t('dashboard.todaysGoal')}
                </Text>
                <Text style={[styles.todayGoalSub, { color: theme.colors.textSecondary }]}>
                  {todayProgress >= 1 ? (t('dashboard.completed') || 'Completed! 🎉') : (t('dashboard.keepPushing') || 'Keep pushing — you got this!')}
                </Text>
                <View style={styles.todayGoalMeta}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="fire" size={16} color={theme.colors.warning} />
                    <Text style={[styles.metaValue, { color: theme.colors.text }]}> {totalCalories}</Text>
                    <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}> kcal</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textMuted} />
                    <Text style={[styles.metaValue, { color: theme.colors.text }]}> {totalMinutes}</Text>
                    <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}> min</Text>
                  </View>
                </View>
                {/* PRIMARY ACTION: Start Workout - MOST PROMINENT */}
                <View style={styles.primaryActionContainer}>
                  <GradientButton
                    title={t('dashboard.startWorkout')}
                    icon="lightning-bolt"
                    onPress={() => router.push('/fitquest')}
                    variant="primary"
                    style={styles.primaryButton}
                  />
                </View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 2: RECOVERY STATUS - Full width, warning colors if bad
        ══════════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(200).duration(150)}>
          <View style={[
            styles.recoveryCard,
            {
              backgroundColor: isRecoveryBad 
                ? (theme.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
                : (theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface),
              borderColor: isRecoveryBad ? theme.colors.error + '40' : theme.colors.border,
            }
          ]}>
            <View style={styles.recoveryInner}>
              <View style={styles.recoveryLeft}>
                <MaterialCommunityIcons 
                  name={isRecoveryBad ? 'battery-low' : isRecoveryGood ? 'battery-high' : 'battery-medium'} 
                  size={24} 
                  color={isRecoveryBad ? theme.colors.error : isRecoveryGood ? theme.colors.success : theme.colors.warning} 
                />
                <Text style={[
                  styles.recoveryTitle,
                  { color: isRecoveryBad ? theme.colors.error : theme.colors.text }
                ]}>
                  Recovery
                </Text>
              </View>
              <View style={styles.recoveryRight}>
                <Text style={[
                  styles.recoveryValue,
                  { color: isRecoveryBad ? theme.colors.error : isRecoveryGood ? theme.colors.success : theme.colors.warning }
                ]}>
                  {recoveryPercent}%
                </Text>
                <Text style={[styles.recoveryLabel, { color: theme.colors.textMuted }]}>
                  {isRecoveryBad ? 'Rest recommended' : isRecoveryGood ? 'Ready to train' : 'Moderate'}
                </Text>
              </View>
            </View>
            {isRecoveryBad && (
              <Text style={[styles.recoveryWarning, { color: theme.colors.error }]}>
                ⚠️ High fatigue detected. Consider a lighter workout or rest day.
              </Text>
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
            PRIORITY 3: LAST WORKOUT - Summary only (reduced)
        ══════════════════════════════════════════════════════════════════ */}
        <SectionHeader title="Last Workout" delay={300} />
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
                  <Text style={[styles.workoutName, { color: theme.colors.text }]}>{recentWorkout.name}</Text>
                  <Text style={[styles.workoutMeta, { color: theme.colors.textMuted }]}>
                    {recentWorkout.duration}m · {recentWorkout.exercises} exercises · {recentWorkout.date}
                  </Text>
                </View>
                <Text style={[styles.workoutCalValue, { color: theme.colors.warning }]}>
                  {recentWorkout.caloriesBurned}
                </Text>
              </View>
            </GlassCard>
          </AnimatedListItem>
        ) : (
          <View style={[styles.workoutItem, { paddingHorizontal: SPACING.sm }]}>
            <GlassCard style={[styles.workoutCard, { alignItems: 'center', paddingVertical: SPACING.md }]}>
              <MaterialCommunityIcons name="dumbbell" size={32} color={theme.colors.textMuted} />
              <Text style={[styles.workoutMeta, { color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' }]}>
                No workouts yet. Start your first one!
              </Text>
            </GlassCard>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PRIORITY 4: SECONDARY ACTION (minimal)
        ══════════════════════════════════════════════════════════════════ */}
        <View style={styles.secondaryActions}>
          <GradientButton
            title="Create Custom"
            icon="playlist-plus"
            onPress={() => router.push('/create-workout' as any)}
            variant="success"
            style={styles.secondaryButton}
          />
        </View>

        {/* ── LIVE STATUS (Minimal) ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(150)}>
          <View style={styles.liveCard}>
            <PulseDot color={theme.colors.success} size={6} active={true} />
            <Text style={[styles.liveText, { color: theme.colors.textMuted }]}>
              Recovery tracking active
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: SPACING.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: SPACING.lg },
  
  // ── HEADER (Compact) ──
  heroHeader: { 
    paddingHorizontal: SPACING.sm, 
    paddingTop: SPACING.xs, 
    paddingBottom: SPACING.sm,
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
    gap: SPACING.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
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
    marginHorizontal: SPACING.sm, 
    marginTop: SPACING.xs, 
    padding: SPACING.md,
    minHeight: 180, // Tall card
  },
  todayGoalInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.md,
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
    fontSize: 13, 
    marginTop: 4, 
    lineHeight: 18,
  },
  todayGoalMeta: { 
    flexDirection: 'row', 
    gap: SPACING.sm, 
    marginTop: SPACING.xs,
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
    marginTop: SPACING.sm,
  },
  primaryButton: {
    paddingVertical: SPACING.sm,
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 2: RECOVERY STATUS - Full width, state-driven colors
  // ══════════════════════════════════════════════════════════════════
  recoveryCard: {
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
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
    gap: SPACING.xs,
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
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.2)',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRIORITY 3: LAST WORKOUT - Reduced, summary only
  // ══════════════════════════════════════════════════════════════════
  workoutItem: { 
    paddingHorizontal: SPACING.sm, 
    marginBottom: SPACING.xs,
  },
  workoutCard: { 
    padding: SPACING.xs + 2, // ~10px (within rhythm: closest to 8)
  },
  workoutRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.xs,
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
    paddingHorizontal: SPACING.sm, 
    marginTop: SPACING.sm,
  },
  secondaryButton: {
    opacity: 0.85, // Visually de-emphasized
  },

  // ── LIVE STATUS (Minimal) ──
  liveCard: { 
    marginHorizontal: SPACING.sm, 
    marginTop: SPACING.sm, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  liveText: { 
    fontSize: 11, 
    fontWeight: '500',
  },
});
