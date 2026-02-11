/**
 * FitQuest Workout Screen
 * 
 * Active workout execution view with real engine integration.
 * Renders the current workout from useFitQuestWorkout with GlassUI.
 * If no workout is active, redirects to FitQuest (Train) tab.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  SlideInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useFitQuestWorkout, WorkoutExerciseDisplay } from '../src/hooks/useFitQuestWorkout';
import { audioService } from '../src/services/audioService';
import { useTimer, formatTime } from '../src/hooks/useTimer';
import {
  GlassCard,
  GradientButton,
  ProgressRing,
  PulseDot,
  SectionHeader,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';

// ─── Difficulty helpers ───

function getDifficultyColor(difficulty: string, theme: any): string {
  switch (difficulty) {
    case 'easy':
    case 'beginner':
      return theme.colors.success;
    case 'medium':
    case 'intermediate':
      return theme.colors.warning;
    case 'hard':
    case 'advanced':
      return theme.colors.error;
    default:
      return theme.colors.accent;
  }
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
    case 'beginner':
      return 'BEGINNER';
    case 'medium':
    case 'intermediate':
      return 'INTERMEDIATE';
    case 'hard':
    case 'advanced':
      return 'ADVANCED';
    default:
      return difficulty?.toUpperCase() || 'MODERATE';
  }
}

function getExerciseIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('bench') || lower.includes('press')) return 'weight-lifter';
  if (lower.includes('squat') || lower.includes('leg')) return 'human-handsdown';
  if (lower.includes('pull') || lower.includes('row')) return 'arm-flex';
  if (lower.includes('curl')) return 'arm-flex-outline';
  if (lower.includes('deadlift')) return 'weight';
  if (lower.includes('plank') || lower.includes('core')) return 'human';
  if (lower.includes('run') || lower.includes('cardio')) return 'run-fast';
  if (lower.includes('push')) return 'chevron-down';
  if (lower.includes('shoulder')) return 'human-greeting-variant';
  return 'dumbbell';
}

// ─── Main Component ───

export default function WorkoutScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    status,
    workout,
    currentExercise,
    currentExerciseIndex,
    progressPercentage,
    error,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
  } = useFitQuestWorkout();

  const { exerciseTimer, sessionTimer, startExercise, startSession, endSession } = useTimer();

  // Session elapsed
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionStartRef = useRef<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Pulse animation for active exercise
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (status === 'in_progress') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Session timer tick
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (status === 'in_progress') {
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
      iv = setInterval(() => {
        if (sessionStartRef.current) {
          setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
        }
      }, 1000);
    }
    return () => clearInterval(iv);
  }, [status]);

  // Stop narration on unmount
  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  // Redirect if no active workout
  useEffect(() => {
    if (status === 'idle' && !workout) {
      // Delay briefly to avoid flash
      const t = setTimeout(() => router.replace('/fitquest' as any), 200);
      return () => clearTimeout(t);
    }
  }, [status, workout]);

  const handleComplete = useCallback(async () => {
    audioService.stop(); // Stop narration voice immediately
    await completeExercise(4); // Default rating 4
  }, [completeExercise]);

  const handleSkip = useCallback(async () => {
    audioService.stop(); // Stop narration voice immediately
    await skipExercise();
  }, [skipExercise]);

  const handleFinish = useCallback(async () => {
    audioService.stop(); // Stop narration voice immediately
    sessionStartRef.current = null;
    await finishWorkout();
    router.replace('/fitquest' as any);
  }, [finishWorkout, router]);

  const handleCancel = useCallback(async () => {
    audioService.stop(); // Stop narration voice immediately
    setShowCancelConfirm(false);
    sessionStartRef.current = null;
    await cancelWorkout();
    router.replace('/fitquest' as any);
  }, [cancelWorkout, router]);

  const formatElapsed = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const exercises = workout?.exercises ?? [];
  const totalExercises = exercises.length;
  const completedCount = currentExerciseIndex;
  const progress = totalExercises > 0 ? completedCount / totalExercises : 0;

  // ─── If waiting or no workout, show minimal state ───

  if (!workout || status === 'idle') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="dumbbell" size={56} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Active Workout</Text>
          <Text style={[styles.emptySub, { color: theme.colors.textMuted }]}>
            Generate a workout from the Train tab
          </Text>
          <View style={{ marginTop: 24, width: '60%' }}>
            <GradientButton
              title="Go to Train"
              onPress={() => router.replace('/fitquest' as any)}
              variant="primary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── TOP BAR ── */}
      <Animated.View entering={FadeIn.duration(150)}>
        <LinearGradient
          colors={theme.isDark
            ? [theme.colors.accent + '12', 'transparent']
            : [theme.colors.accent + '08', 'transparent']
          }
          style={styles.topBar}
        >
          <View style={styles.topBarRow}>
            <TouchableOpacity
              onPress={() => setShowCancelConfirm(true)}
              style={[styles.backBtn, { backgroundColor: theme.colors.error + '15' }]}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.error} />
            </TouchableOpacity>

            <View style={styles.topBarCenter}>
              <Text style={[styles.workoutName, { color: theme.colors.text }]} numberOfLines={1}>
                {workout.explanation || 'Active Workout'}
              </Text>
              <View style={styles.topBarMeta}>
                <PulseDot color={theme.colors.success} size={6} />
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                  {formatElapsed(sessionElapsed)}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.accent }]}>
                  {completedCount}/{totalExercises}
                </Text>
              </View>
            </View>

            <View style={[styles.diffBadge, { backgroundColor: (workout.isDeload ? theme.colors.accent3 : theme.colors.accent) + '20' }]}>
              <Text style={[styles.diffBadgeText, { color: workout.isDeload ? theme.colors.accent3 : theme.colors.accent }]}>
                {workout.isDeload ? 'DELOAD' : 'ACTIVE'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── PROGRESS RING ── */}
        <Animated.View entering={ZoomIn.delay(100).duration(200)} style={styles.progressSection}>
          <Animated.View style={pulseStyle}>
            <ProgressRing progress={progress} size={140} color={theme.colors.accent} strokeWidth={8}>
              <Text style={[styles.progressPercent, { color: theme.colors.text }]}>
                {Math.round(progress * 100)}%
              </Text>
              <Text style={[styles.progressLabel, { color: theme.colors.textMuted }]}>
                complete
              </Text>
            </ProgressRing>
          </Animated.View>
        </Animated.View>

        {/* ── CURRENT EXERCISE ── */}
        {currentExercise && (
          <Animated.View entering={SlideInDown.delay(150).duration(200)}>
            <GlassCard
              style={styles.currentCard}
              gradient
              glowColor={theme.colors.accent}
            >
              <View style={styles.currentHeader}>
                <View style={[styles.exerciseIconWrap, { backgroundColor: theme.colors.accent + '18' }]}>
                  <MaterialCommunityIcons
                    name={getExerciseIcon(currentExercise.name)}
                    size={28}
                    color={theme.colors.accent}
                  />
                </View>
                <View style={styles.currentInfo}>
                  <Text style={[styles.nowPlaying, { color: theme.colors.accent }]}>NOW</Text>
                  <Text style={[styles.currentName, { color: theme.colors.text }]} numberOfLines={2}>
                    {currentExercise.name}
                  </Text>
                  <Text style={[styles.currentMeta, { color: theme.colors.textMuted }]}>
                    {currentExercise.sets} sets × {currentExercise.reps} reps
                    {currentExercise.restSeconds ? ` · ${currentExercise.restSeconds}s rest` : ''}
                  </Text>
                </View>
              </View>

              {/* Category badge */}
              {currentExercise.category && (
                <View style={styles.targetRow}>
                  <View style={[styles.targetPill, { backgroundColor: theme.colors.accent2 + '15' }]}>
                    <Text style={[styles.targetText, { color: theme.colors.accent2 }]}>
                      {currentExercise.category.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleSkip}
                  style={[styles.skipBtn, {
                    backgroundColor: theme.colors.warning + '12',
                    borderColor: theme.colors.warning + '30',
                  }]}
                >
                  <MaterialCommunityIcons name="skip-next" size={20} color={theme.colors.warning} />
                  <Text style={[styles.skipText, { color: theme.colors.warning }]}>Skip</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <GradientButton
                    title="Complete ✓"
                    onPress={handleComplete}
                    variant="success"
                  />
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── EXERCISE LIST ── */}
        <SectionHeader title="Exercises" delay={200} />

        {exercises.map((ex: WorkoutExerciseDisplay, i: number) => {
          const isActive = i === currentExerciseIndex;
          const isDone = i < currentExerciseIndex;
          const statusColor = isDone
            ? theme.colors.success
            : isActive
              ? theme.colors.accent
              : theme.colors.textMuted;

          return (
            <AnimatedListItem key={ex.id || `ex-${i}`} index={i} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
              <View style={[styles.exListItem, {
                backgroundColor: isActive
                  ? (theme.isDark ? theme.colors.accent + '10' : theme.colors.accent + '08')
                  : (theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                borderColor: isActive ? theme.colors.accent + '30' : 'transparent',
                borderWidth: isActive ? 1 : 0,
              }]}>
                <View style={[styles.exStatusDot, { backgroundColor: statusColor }]}>
                  {isDone ? (
                    <MaterialCommunityIcons name="check" size={12} color="#FFF" />
                  ) : isActive ? (
                    <PulseDot color={theme.colors.accent} size={8} />
                  ) : (
                    <Text style={styles.exNumber}>{i + 1}</Text>
                  )}
                </View>

                <View style={styles.exDetails}>
                  <Text style={[
                    styles.exName,
                    { color: isDone ? theme.colors.textMuted : theme.colors.text },
                    isDone && styles.exNameDone,
                  ]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={[styles.exSets, { color: theme.colors.textMuted }]}>
                    {ex.sets}×{ex.reps}{ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ''}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name={isDone ? 'check-circle' : isActive ? 'play-circle' : 'circle-outline'}
                  size={22}
                  color={statusColor}
                />
              </View>
            </AnimatedListItem>
          );
        })}

        {/* ── FINISH BUTTON ── */}
        {completedCount > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(150)} style={styles.finishSection}>
            <GradientButton
              title={completedCount >= totalExercises ? 'Complete Workout 🎉' : 'Finish Early'}
              onPress={handleFinish}
              variant={completedCount >= totalExercises ? 'success' : 'warning'}
            />
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── CANCEL CONFIRMATION MODAL ── */}
      <Modal
        visible={showCancelConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <View style={[styles.modalContent, { backgroundColor: theme.isDark ? '#151929' : '#FFFFFF' }]}>
              <LinearGradient
                colors={[theme.colors.error + '20', 'transparent']}
                style={styles.modalGlow}
              />
              <View style={[styles.modalIconWrap, { backgroundColor: theme.colors.error + '18' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.error} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Cancel Workout?</Text>
              <Text style={[styles.modalDesc, { color: theme.colors.textMuted }]}>
                You've completed {completedCount} of {totalExercises} exercises. Progress won't be saved.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowCancelConfirm(false)}
                  style={[styles.modalBtn, {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }]}
                >
                  <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Keep Going</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[styles.modalBtn, { backgroundColor: theme.colors.error }]}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  topBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  topBarCenter: { flex: 1 },
  workoutName: { fontSize: 17, fontWeight: '700' },
  topBarMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] as any },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  diffBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  scrollContent: { paddingBottom: 32 },
  progressSection: { alignItems: 'center', paddingVertical: 20 },
  progressPercent: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  progressLabel: { fontSize: 11, fontWeight: '500', marginTop: -2 },
  currentCard: { marginHorizontal: 16, padding: 20 },
  currentHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  exerciseIconWrap: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  currentInfo: { flex: 1 },
  nowPlaying: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  currentName: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  currentMeta: { fontSize: 13, marginTop: 4 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  targetPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  targetText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  skipText: { fontSize: 14, fontWeight: '600' },
  exListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  exStatusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exNumber: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  exDetails: { flex: 1 },
  exName: { fontSize: 15, fontWeight: '600' },
  exNameDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  exSets: { fontSize: 12, marginTop: 2 },
  finishSection: { paddingHorizontal: 16, marginTop: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    height: 100,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  modalDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
