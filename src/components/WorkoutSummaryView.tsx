/**
 * WorkoutSummaryView — Rich post-workout summary screen.
 *
 * Features:
 *  • Trophy celebration with animated glow
 *  • Animated XP counter rolling up
 *  • Level-up banner
 *  • Stat cards: duration, exercises, muscles hit, progressions
 *  • Muscles-worked tag cloud
 *  • Streak display
 *  • Star rating (1-5)
 *  • "Generate New Workout" CTA
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Animated, {
  ZoomIn,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  GlassCard,
  GradientButton,
} from '../components/ui/GlassUI';
import type { WorkoutCompletionData } from '../hooks/useFitQuestWorkout';

// ─── Types ────────────────────────────────────────────
interface WorkoutSummaryViewProps {
  data: WorkoutCompletionData;
  rating: number | null;
  onRate: (star: number) => void;
  onNewWorkout: () => void;
}

// ─── Animated XP counter ──────────────────────────────
function AnimatedXPCounter({ target, color }: { target: number; color: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target <= 0) return;
    const duration = 1200;
    const steps = 30;
    const stepMs = duration / steps;
    const increment = target / steps;
    let current = 0;
    const iv = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(iv);
      }
      setDisplay(Math.round(current));
    }, stepMs);
    return () => clearInterval(iv);
  }, [target]);

  return (
    <Text style={[styles.xpValue, { color }]}>
      +{display}
    </Text>
  );
}

// ─── Component ────────────────────────────────────────
export default function WorkoutSummaryView({
  data,
  rating,
  onRate,
  onNewWorkout,
}: WorkoutSummaryViewProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  // Pulsing glow behind trophy
  const glowScale = useSharedValue(1);
  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  const durationMin = Math.max(1, Math.round(data.durationSeconds / 60));
  const completionPct = data.totalCount > 0 ? Math.round((data.completedCount / data.totalCount) * 100) : 0;

  const ratingLabels = [
    t('fitquest.ratingTooEasy') ?? 'Too Easy',
    t('fitquest.ratingEasy') ?? 'Easy',
    t('fitquest.ratingJustRight') ?? 'Just Right',
    t('fitquest.ratingHard') ?? 'Hard',
    t('fitquest.ratingBrutal') ?? 'Brutal',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Trophy + Title ── */}
        <Animated.View entering={ZoomIn.duration(250)} style={styles.trophyWrap}>
          <Animated.View style={[styles.trophyGlow, { backgroundColor: theme.colors.success + '12' }, glowStyle]}>
            <MaterialCommunityIcons name="trophy" size={72} color={theme.colors.success} />
          </Animated.View>
        </Animated.View>

        <Animated.Text entering={FadeInUp.delay(100).duration(200)} style={[styles.title, { color: theme.colors.text }]}>
          {t('fitquest.workoutComplete') ?? 'Workout Complete!'}
        </Animated.Text>

        {/* ── Level Up Banner ── */}
        {data.levelUp && (
          <Animated.View entering={ZoomIn.delay(150).duration(300)} style={[styles.levelUpBanner, { backgroundColor: theme.colors.warning + '18' }]}>
            <MaterialCommunityIcons name="star-four-points" size={24} color={theme.colors.warning} />
            <Text style={[styles.levelUpText, { color: theme.colors.warning }]}>
              {t('fitquest.levelUp') ?? 'LEVEL UP!'} Level {data.newLevel ?? data.level}
            </Text>
            <MaterialCommunityIcons name="star-four-points" size={24} color={theme.colors.warning} />
          </Animated.View>
        )}

        {/* ── XP Earned ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(200)}>
          <GlassCard style={styles.xpCard}>
            <AnimatedXPCounter target={data.xpEarned} color={theme.colors.accent} />
            <Text style={[styles.xpLabel, { color: theme.colors.textMuted }]}>XP Earned</Text>
            <View style={[styles.levelBadge, { backgroundColor: theme.colors.accent + '15' }]}>
              <Text style={[styles.levelBadgeText, { color: theme.colors.accent }]}>
                Level {data.level}
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Stat Grid ── */}
        <Animated.View entering={FadeInDown.delay(280).duration(200)} style={styles.statGrid}>
          <StatTile icon="clock-outline" value={`${durationMin} min`} label={t('fitquest.duration') ?? 'Duration'} color={theme.colors.accent} theme={theme} />
          <StatTile icon="dumbbell" value={`${data.completedCount}/${data.totalCount}`} label={t('library.exercises') ?? 'Exercises'} color={theme.colors.success} theme={theme} />
          <StatTile icon="percent" value={`${completionPct}%`} label={t('fitquest.completion') ?? 'Completion'} color={completionPct >= 80 ? theme.colors.success : theme.colors.warning} theme={theme} />
          <StatTile icon="trending-up" value={`${data.progressions}`} label={t('fitquest.progressions') ?? 'Levelled Up'} color={theme.colors.accent} theme={theme} />
        </Animated.View>

        {/* ── Phase Breakdown ── */}
        {data.phaseBreakdown && (data.phaseBreakdown.warmup.total > 0 || data.phaseBreakdown.cooldown.total > 0) && (
          <Animated.View entering={FadeInDown.delay(320).duration(200)}>
            <GlassCard style={styles.phaseCard}>
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Session Breakdown
              </Text>
              {data.phaseBreakdown.warmup.total > 0 && (
                <PhaseRow
                  icon="fire"
                  label="Warm-up"
                  completed={data.phaseBreakdown.warmup.completed}
                  total={data.phaseBreakdown.warmup.total}
                  color={theme.colors.success}
                  theme={theme}
                />
              )}
              <PhaseRow
                icon="dumbbell"
                label="Workout"
                completed={data.phaseBreakdown.main.completed}
                total={data.phaseBreakdown.main.total}
                color={theme.colors.accent}
                theme={theme}
              />
              {data.phaseBreakdown.cooldown.total > 0 && (
                <PhaseRow
                  icon="snowflake"
                  label="Cool-down"
                  completed={data.phaseBreakdown.cooldown.completed}
                  total={data.phaseBreakdown.cooldown.total}
                  color={theme.colors.blue}
                  theme={theme}
                />
              )}
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Muscles Worked ── */}
        {data.musclesWorked.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(200)}>
            <GlassCard style={styles.musclesCard}>
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                {t('fitquest.musclesWorked') ?? 'Muscles Worked'}
              </Text>
              <View style={styles.tagCloud}>
                {data.musclesWorked.map((muscle, i) => (
                  <Animated.View
                    key={muscle}
                    entering={FadeIn.delay(350 + i * 30).duration(150)}
                    style={[styles.muscleTag, { backgroundColor: theme.colors.accent + '12', borderColor: theme.colors.accent + '30' }]}
                  >
                    <Text style={[styles.muscleTagText, { color: theme.colors.accent }]}>{formatMuscleName(muscle)}</Text>
                  </Animated.View>
                ))}
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Streak ── */}
        <Animated.View entering={FadeInDown.delay(420).duration(200)}>
          <GlassCard style={styles.streakCard}>
            <View style={styles.streakRow}>
              <MaterialCommunityIcons name="fire" size={32} color={theme.colors.warning} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.streakValue, { color: theme.colors.text }]}>
                  {data.streak.current} {t('fitquest.dayStreak') ?? 'Day Streak'}
                </Text>
                <Text style={[styles.streakBest, { color: theme.colors.textMuted }]}>
                  {t('fitquest.best') ?? 'Best'}: {data.streak.longest} {t('common.days') ?? 'days'}
                </Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Rating ── */}
        <Animated.View entering={FadeInDown.delay(480).duration(200)}>
          <GlassCard style={styles.ratingCard}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
              {t('fitquest.rateWorkout') ?? 'How was it?'}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = rating !== null && star <= rating;
                return (
                  <Animated.View key={star} entering={FadeIn.delay(480 + star * 50).duration(100)}>
                    <MaterialCommunityIcons
                      name={filled ? 'star' : 'star-outline'}
                      size={40}
                      color={filled ? theme.colors.warning : theme.colors.textMuted}
                      onPress={() => onRate(star)}
                      suppressHighlighting
                    />
                  </Animated.View>
                );
              })}
            </View>
            {rating !== null && (
              <Animated.Text entering={FadeIn.duration(150)} style={[styles.ratingFeedback, { color: theme.colors.accent }]}>
                {ratingLabels[rating - 1]}
              </Animated.Text>
            )}
          </GlassCard>
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View entering={FadeInUp.delay(550).duration(200)} style={styles.ctaWrap}>
          <GradientButton title={t('fitquest.generateNewWorkout') ?? 'New Workout'} icon="refresh" onPress={onNewWorkout} />
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stat Tile ────────────────────────────────────────
function StatTile({ icon, value, label, color, theme }: {
  icon: string; value: string; label: string; color: string; theme: any;
}) {
  return (
    <GlassCard style={styles.statTile}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{label}</Text>
    </GlassCard>
  );
}

// ─── Phase Row ────────────────────────────────────────
function PhaseRow({ icon, label, completed, total, color, theme }: {
  icon: string; label: string; completed: number; total: number; color: string; theme: any;
}) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <View style={styles.phaseRow}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={[styles.phaseLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.phaseBar, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.phaseBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.phaseCount, { color: theme.colors.textMuted }]}>
        {completed}/{total}
      </Text>
      {completed >= total && (
        <MaterialCommunityIcons name="check-circle" size={16} color={color} />
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────
function formatMuscleName(muscle: string): string {
  return muscle
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  // Trophy
  trophyWrap: { marginBottom: 4 },
  trophyGlow: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16 },

  // Level-up
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  levelUpText: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },

  // XP card
  xpCard: { alignItems: 'center', paddingVertical: 20, width: '100%', marginBottom: 12 },
  xpValue: { fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  xpLabel: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  levelBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  levelBadgeText: { fontSize: 13, fontWeight: '700' },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', gap: 8, marginBottom: 12 },
  statTile: { width: '48%', alignItems: 'center', paddingVertical: 16, gap: 6 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },

  // Phase breakdown
  phaseCard: { width: '100%', padding: 16, marginBottom: 12, gap: 12 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phaseLabel: { fontSize: 13, fontWeight: '600', width: 72 },
  phaseBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  phaseBarFill: { height: 6, borderRadius: 3 },
  phaseCount: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] as any, width: 30, textAlign: 'right' as const },

  // Muscles
  musclesCard: { width: '100%', padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  muscleTagText: { fontSize: 12, fontWeight: '600' },

  // Streak
  streakCard: { width: '100%', padding: 16, marginBottom: 12 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakValue: { fontSize: 20, fontWeight: '700' },
  streakBest: { fontSize: 13, marginTop: 2 },

  // Rating
  ratingCard: { width: '100%', alignItems: 'center', padding: 16, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ratingFeedback: { marginTop: 10, fontSize: 14, fontWeight: '600' },

  // CTA
  ctaWrap: { width: '100%', marginTop: 8 },
});
