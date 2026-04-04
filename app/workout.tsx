/**
 * FitQuest Workout Screen
 *
 * Active workout execution view with real engine integration.
 * Renders the current workout from useFitQuestWorkout with GlassUI.
 * If no workout is active, redirects to FitQuest (Train) tab.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ScreenTutorial from '../src/components/ScreenTutorial';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useFitQuestWorkout, WorkoutExerciseDisplay } from '../src/hooks/useFitQuestWorkout';
import { useWorkoutViewModel } from '../src/viewmodels/useWorkoutViewModel';
import { useTimer } from '../src/hooks/useTimer';
import { haptic } from '../src/utils/haptics';
import { useToast } from '../src/context/ToastContext';
import ThemedText from '../src/components/ThemedText';
import ExerciseCompleteBadge from '../src/components/ExerciseCompleteBadge';
import ExerciseImage from '../src/components/ExerciseImage';
import RestTimerOverlay from '../src/components/RestTimerOverlay';
import { typography, spacing, radius } from '../src/design/theme-system';

import {
  GlassCard,
  GradientButton,
  ProgressRing,
  PulseDot,
  SectionHeader,
  AnimatedListItem,
} from '../src/components/ui/GlassUI';

// ─── Main Component ───

export default function WorkoutScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const vm = useWorkoutViewModel();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const {
    status,
    workout,
    currentExercise,
    currentExerciseIndex,
    error,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
    loadCustomWorkout,
    generateNewWorkout,
    startWorkout,
  } = useFitQuestWorkout();

  const { exerciseTimer, startExercise, restTimer, startRest, skipRest, extendRest, stopAll } = useTimer();

  // Session elapsed
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionStartRef = useRef<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteBadge, setShowCompleteBadge] = useState(false);
  const prevExerciseIndexRef = useRef<number>(0);
  const [showAllInstructions, setShowAllInstructions] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const mountedRef = useRef(true);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    };
  }, []);

  // Pulse animation for active exercise
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (status === 'in_progress') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
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

  // Load custom workout if sessionId is provided, otherwise redirect if idle
  useEffect(() => {
    if (sessionId && status === 'idle' && !workout) {
      loadCustomWorkout(sessionId);
    } else if (!sessionId && status === 'idle' && !workout) {
      // Delay briefly to avoid flash
      const t = setTimeout(() => {
        if (mountedRef.current) router.replace('/fitquest' as any);
      }, 200); // debounce
      return () => clearTimeout(t);
    }
  }, [status, workout, sessionId]);

  // Auto-start custom workout when it becomes ready
  useEffect(() => {
    if (sessionId && status === 'ready' && workout) {
      startWorkout();
    }
  }, [sessionId, status, workout]);

  // Haptic feedback when exercise changes (exercise start)
  useEffect(() => {
    if (status === 'in_progress' && currentExerciseIndex !== prevExerciseIndexRef.current) {
      haptic('exerciseStart');
      setShowAllInstructions(false);
      prevExerciseIndexRef.current = currentExerciseIndex;
      // Narrate exercise name
      if (currentExercise) {
        vm.speakNarration(`${currentExercise.name}. ${currentExercise.sets} sets, ${currentExercise.reps} reps.`);
      }
      // Start exercise timer for timed exercises (e.g. "60s hold", "3 min", "1:30")
      if (currentExercise) {
        if (currentExercise.mindTimeline?.totalDuration) {
          // Focus/mind exercises use the mind timeline duration
          startExercise(currentExercise.mindTimeline.totalDuration);
        } else {
          // Parse various timed rep formats: "60s", "30s hold", "3 min", "1:30", "60 sec"
          const reps = currentExercise.reps || '';
          let seconds = 0;
          const secMatch = reps.match(/^(\d+)\s*s(?:ec)?\b/i);
          const minMatch = reps.match(/^(\d+)\s*min/i);
          const colonMatch = reps.match(/^(\d+):(\d{2})$/);
          const holdMatch = reps.match(/(\d+)\s*s?\s*hold/i);
          if (secMatch) seconds = parseInt(secMatch[1]!, 10);
          else if (minMatch) seconds = parseInt(minMatch[1]!, 10) * 60;
          else if (colonMatch) seconds = parseInt(colonMatch[1]!, 10) * 60 + parseInt(colonMatch[2]!, 10);
          else if (holdMatch) seconds = parseInt(holdMatch[1]!, 10);
          if (seconds > 0) startExercise(seconds * currentExercise.sets);
        }
      }
    }
  }, [currentExerciseIndex, status, currentExercise]);

  // Rest timer completion
  useEffect(() => {
    if (isResting && restTimer.state === 'completed') {
      setIsResting(false);
      haptic('restOver');
    }
  }, [isResting, restTimer.state]);

  const handleComplete = useCallback(async () => {
    vm.stopAudio();
    setShowCompleteBadge(true);
    haptic('exerciseComplete');
    setShowAllInstructions(false);
    await completeExercise(4);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => setShowCompleteBadge(false), 1300);
    // Start rest timer if not the last exercise
    const exs = workout?.exercises ?? [];
    const isLast = currentExerciseIndex === exs.length - 1;
    if (!isLast && currentExercise?.restSeconds) {
      setIsResting(true);
      startRest(currentExercise.restSeconds);
    }
  }, [completeExercise, currentExerciseIndex, workout, currentExercise, startRest]);

  // Exercise timer completion (auto-complete timed exercises)
  useEffect(() => {
    if (exerciseTimer.state === 'completed' && currentExercise) {
      handleComplete();
    }
  }, [exerciseTimer.state, handleComplete, currentExercise]);

  const handleSkipRest = useCallback(() => {
    skipRest();
    setIsResting(false);
    haptic('restOver');
  }, [skipRest]);

  const handleExtendRest = useCallback(
    (seconds: number) => {
      extendRest(seconds);
    },
    [extendRest],
  );

  const handleSkip = useCallback(async () => {
    haptic('phaseTransition');
    vm.stopAudio();
    setIsResting(false);
    stopAll();
    setShowAllInstructions(false);
    await skipExercise();
  }, [skipExercise, stopAll]);

  const handleFinish = useCallback(async () => {
    haptic('workoutComplete');
    vm.stopAudio();
    setIsResting(false);
    stopAll();
    sessionStartRef.current = null;
    showToast({ message: t('workout.completed') ?? 'Workout complete!', type: 'success', vibrate: true });
    await finishWorkout();
    router.replace('/fitquest' as any);
  }, [finishWorkout, router, showToast, t]);

  const handleCancel = useCallback(async () => {
    vm.stopAudio();
    setIsResting(false);
    stopAll();
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
  const completedCount = exercises.filter((e: WorkoutExerciseDisplay) => e.completed).length;
  const progress = totalExercises > 0 ? completedCount / totalExercises : 0;
  const isLastExercise = currentExerciseIndex === totalExercises - 1;
  const isWorkoutComplete = status === 'completed';

  // ─── Auto-finish when workout is completed ───
  useEffect(() => {
    if (isWorkoutComplete && workout) {
      // Trigger haptic for workout complete
      haptic('workoutComplete');
      // Auto-finish after a short delay to show the completion visual
      const timer = setTimeout(() => {
        // debounce
        handleFinish();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isWorkoutComplete, workout, handleFinish]);

  // ─── If generating workout, show loading ───

  if (status === 'generating' || (sessionId && status === 'idle' && !workout)) {
    return (
      <ScreenContainer>
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="loading" size={48} color={theme.colors.accent} />
          <ThemedText style={[styles.emptyTitle, { color: theme.colors.text }]}>
            {t('workout.generating') ?? 'Generating workout…'}
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  // ─── If error from workout engine ───

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <ThemedText style={[styles.emptyTitle, { color: theme.colors.text }]}>
            {t('common.error') ?? 'Something went wrong'}
          </ThemedText>
          <ThemedText style={[styles.emptySub, { color: theme.colors.textMuted }]}>{error}</ThemedText>
          <View style={{ marginTop: spacing[6], width: '60%' }}>
            <GradientButton
              title={t('common.retry') ?? 'Try Again'}
              onPress={() => generateNewWorkout()}
              variant="primary"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ─── If waiting or no workout, show minimal state ───

  if (!workout || status === 'idle') {
    return (
      <ScreenContainer>
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="dumbbell" size={56} color={theme.colors.textMuted} />
          <ThemedText style={[styles.emptyTitle, { color: theme.colors.text }]}>{t('workout.noActive')}</ThemedText>
          <ThemedText style={[styles.emptySub, { color: theme.colors.textMuted }]}>
            {t('workout.generateFromTrain')}
          </ThemedText>
          <View style={{ marginTop: spacing[6], width: '60%' }}>
            <GradientButton
              title={t('workout.goToTrain')}
              onPress={() => router.replace('/fitquest' as any)}
              variant="primary"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenErrorBoundary
      screenName="Workout"
      onGoBack={() => (router.canGoBack() ? router.back() : router.replace('/fitquest' as any))}
    >
      <ScreenTutorial
        screenKey="workout"
        icon="arm-flex"
        title="Workout Session"
        description="Follow along exercise by exercise. Swipe through sets, tap to complete, and rest between exercises. Your progress is saved automatically."
      />
      <ScreenContainer>
        {/* ── REST TIMER OVERLAY ── */}
        <RestTimerOverlay
          visible={isResting}
          progress={restTimer.progress}
          formattedRemaining={restTimer.formattedRemaining}
          remaining={restTimer.remaining}
          nextExercise={(() => {
            const ne = exercises[currentExerciseIndex + 1];
            return ne
              ? { exerciseId: ne.exerciseId, name: ne.name, category: ne.category, sets: ne.sets, reps: ne.reps }
              : undefined;
          })()}
          onSkip={handleSkipRest}
          onExtend={handleExtendRest}
        />

        {/* ── EXERCISE COMPLETE BADGE ── */}
        <ExerciseCompleteBadge
          visible={showCompleteBadge}
          message={t('workout.nice') || 'Nice!'}
          color={theme.colors.success}
        />

        {/* ── TOP BAR ── */}
        <Animated.View entering={FadeIn.duration(150)}>
          <LinearGradient
            colors={
              theme.isDark ? [theme.colors.accent + '12', 'transparent'] : [theme.colors.accent + '08', 'transparent']
            }
            style={styles.topBar}
          >
            <View style={styles.topBarRow}>
              <TouchableOpacity
                onPress={() => setShowCancelConfirm(true)}
                style={[styles.backBtn, { backgroundColor: theme.colors.error + '15' }]}
                accessibilityRole="button"
                accessibilityLabel="Cancel workout"
              >
                <MaterialCommunityIcons name="close" size={18} color={theme.colors.error} />
              </TouchableOpacity>

              <View style={styles.topBarCenter}>
                <ThemedText style={[styles.workoutName, { color: theme.colors.text }]} numberOfLines={1}>
                  {workout.explanation || 'Active Workout'}
                </ThemedText>
                <View style={styles.topBarMeta}>
                  <PulseDot color={theme.colors.success} size={6} />
                  <ThemedText style={[styles.metaText, { color: theme.colors.textMuted }]}>
                    {formatElapsed(sessionElapsed)}
                  </ThemedText>
                  <ThemedText style={[styles.metaText, { color: theme.colors.accent }]}>
                    {completedCount}/{totalExercises}
                  </ThemedText>
                </View>
              </View>

              <View
                style={[
                  styles.diffBadge,
                  { backgroundColor: (workout.isDeload ? theme.colors.accent3 : theme.colors.accent) + '20' },
                ]}
              >
                <ThemedText
                  style={[
                    styles.diffBadgeText,
                    { color: workout.isDeload ? theme.colors.accent3 : theme.colors.accent },
                  ]}
                >
                  {workout.isDeload ? 'DELOAD' : 'ACTIVE'}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── PROGRESS RING ── */}
          <Animated.View entering={ZoomIn.delay(100).duration(200)} style={styles.progressSection}>
            <Animated.View style={pulseStyle}>
              <ProgressRing progress={progress} size={140} color={theme.colors.accent} strokeWidth={8}>
                <ThemedText style={[styles.progressPercent, { color: theme.colors.text }]}>
                  {Math.round(progress * 100)}%
                </ThemedText>
                <ThemedText style={[styles.progressLabel, { color: theme.colors.textMuted }]}>complete</ThemedText>
              </ProgressRing>
            </Animated.View>
          </Animated.View>

          {/* ── CURRENT EXERCISE ── */}
          {!!currentExercise && (
            <Animated.View entering={SlideInDown.delay(150).duration(200)}>
              <GlassCard style={styles.currentCard} gradient glowColor={theme.colors.accent}>
                {/* Exercise Image */}
                <Animated.View
                  entering={ZoomIn.duration(200)}
                  style={{ alignItems: 'center', marginBottom: spacing[4], width: '100%' }}
                >
                  <ExerciseImage
                    exerciseId={currentExercise.exerciseId}
                    category={currentExercise.category}
                    variant="hero"
                    animate={true}
                  />
                </Animated.View>

                {/* Exercise Name */}
                <ThemedText
                  style={[styles.currentName, { color: theme.colors.text, textAlign: 'center' }]}
                  numberOfLines={2}
                >
                  {currentExercise.name}
                </ThemedText>

                {/* Prescription Row: sets / reps / rest */}
                <View style={styles.prescriptionRow}>
                  {[
                    { val: currentExercise.sets, label: t('fitquest.sets') || 'Sets' },
                    { val: currentExercise.reps, label: t('fitquest.reps') || 'Reps' },
                    { val: `${currentExercise.restSeconds || 60}s`, label: t('train.rest') || 'Rest' },
                  ].map((p, i) => (
                    <Animated.View
                      key={p.label}
                      entering={FadeInUp.delay(i * 60).duration(150)}
                      style={styles.prescriptionItem}
                    >
                      <ThemedText style={[styles.prescriptionVal, { color: theme.colors.text }]}>{p.val}</ThemedText>
                      <ThemedText style={[styles.prescriptionLabel, { color: theme.colors.textMuted }]}>
                        {p.label}
                      </ThemedText>
                    </Animated.View>
                  ))}
                </View>

                {/* Exercise countdown timer for timed exercises */}
                {exerciseTimer.state === 'running' && (
                  <View style={styles.exerciseTimerWrap}>
                    <ProgressRing
                      progress={exerciseTimer.progress}
                      size={120}
                      color={theme.colors.accent}
                      strokeWidth={8}
                    >
                      <ThemedText
                        style={[styles.exerciseTimerText, { color: theme.colors.text, fontSize: typography.sizes.h1 }]}
                      >
                        {exerciseTimer.formattedRemaining}
                      </ThemedText>
                      <ThemedText style={[styles.exerciseTimerLabel, { color: theme.colors.textMuted }]}>
                        remaining
                      </ThemedText>
                    </ProgressRing>
                  </View>
                )}

                {/* Category badge */}
                {!!currentExercise.category && (
                  <View style={styles.targetRow}>
                    <View style={[styles.targetPill, { backgroundColor: theme.colors.accent2 + '15' }]}>
                      <ThemedText style={[styles.targetText, { color: theme.colors.accent2 }]}>
                        {currentExercise.category.replace(/_/g, ' ')}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {/* Instructions card */}
                {currentExercise.instructions && currentExercise.instructions.length > 0 && (
                  <Animated.View entering={FadeInDown.delay(200).duration(150)} style={{ marginTop: spacing[3] }}>
                    <GlassCard>
                      <ThemedText style={[styles.instTitle, { color: theme.colors.text }]}>
                        {t('fitquest.formTips') || 'Form Tips'}
                      </ThemedText>
                      {currentExercise.instructions
                        .slice(0, showAllInstructions ? undefined : 3)
                        .map((inst: string, idx: number) => (
                          <ThemedText key={idx} style={[styles.instStep, { color: theme.colors.textSecondary }]}>
                            {idx + 1}. {inst}
                          </ThemedText>
                        ))}
                      {currentExercise.instructions.length > 3 && (
                        <TouchableOpacity
                          onPress={() => setShowAllInstructions(!showAllInstructions)}
                          style={{ marginTop: spacing[2] }}
                          accessibilityRole="button"
                          accessibilityLabel={showAllInstructions ? 'Show fewer instructions' : 'Show all instructions'}
                        >
                          <ThemedText
                            style={{
                              color: theme.colors.accent,
                              fontSize: typography.sizes.caption,
                              fontWeight: '600',
                            }}
                          >
                            {showAllInstructions
                              ? t('fitquest.showLess') || 'Show less'
                              : `+${currentExercise.instructions.length - 3} ${t('fitquest.more') || 'more'}`}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </GlassCard>
                  </Animated.View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={[
                      styles.skipBtn,
                      {
                        backgroundColor: theme.colors.warning + '12',
                        borderColor: theme.colors.warning + '30',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Skip exercise"
                  >
                    <MaterialCommunityIcons name="skip-next" size={20} color={theme.colors.warning} />
                    <ThemedText style={[styles.skipText, { color: theme.colors.warning }]}>
                      {t('common.skip')}
                    </ThemedText>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <GradientButton
                      title={isLastExercise ? t('workout.completeWorkout') : t('workout.completeSet')}
                      onPress={handleComplete}
                      variant="success"
                    />
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {/* ── EXERCISE LIST ── */}
          <SectionHeader title={t('workout.exercises')} delay={200} />

          {exercises.map((ex: WorkoutExerciseDisplay, i: number) => {
            const isActive = i === currentExerciseIndex && !ex.completed;
            const isDone = ex.completed;
            const statusColor = isDone ? theme.colors.success : isActive ? theme.colors.accent : theme.colors.textMuted;

            return (
              <AnimatedListItem
                key={ex.id || `ex-${i}`}
                index={i}
                style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}
              >
                <View
                  style={[
                    styles.exListItem,
                    {
                      backgroundColor: isActive
                        ? theme.isDark
                          ? theme.colors.accent + '10'
                          : theme.colors.accent + '08'
                        : theme.isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.02)',
                      borderColor: isActive ? theme.colors.accent + '30' : 'transparent',
                      borderWidth: isActive ? 1 : 0,
                    },
                  ]}
                >
                  <View style={[styles.exStatusDot, { backgroundColor: statusColor }]}>
                    {isDone ? (
                      <MaterialCommunityIcons name="check" size={12} color={theme.colors.onAccent} />
                    ) : isActive ? (
                      <PulseDot color={theme.colors.accent} size={8} />
                    ) : (
                      <ThemedText style={[styles.exNumber, { color: theme.colors.text }]}>{i + 1}</ThemedText>
                    )}
                  </View>

                  <ExerciseImage exerciseId={ex.exerciseId} category={ex.category} variant="card" />

                  <View style={[styles.exDetails, { marginLeft: spacing[3] }]}>
                    <ThemedText
                      style={[
                        styles.exName,
                        { color: isDone ? theme.colors.textMuted : theme.colors.text },
                        isDone && styles.exNameDone,
                      ]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </ThemedText>
                    <ThemedText style={[styles.exSets, { color: theme.colors.textMuted }]}>
                      {ex.sets}×{ex.reps}
                      {ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ''}
                    </ThemedText>
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
                title={completedCount >= totalExercises ? t('workout.completeWorkout') : t('workout.finishEarly')}
                onPress={handleFinish}
                variant={completedCount >= totalExercises ? 'success' : 'warning'}
              />
            </Animated.View>
          )}

          {/* Extra scroll space to ensure finish button is reachable */}
          <View style={{ height: 120 }} />
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
              <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                <LinearGradient colors={[theme.colors.error + '20', 'transparent']} style={styles.modalGlow} />
                <View style={[styles.modalIconWrap, { backgroundColor: theme.colors.error + '18' }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.error} />
                </View>
                <ThemedText style={[styles.modalTitle, { color: theme.colors.text }]}>Cancel Workout?</ThemedText>
                <ThemedText style={[styles.modalDesc, { color: theme.colors.textMuted }]}>
                  You've completed {completedCount} of {totalExercises} exercises. Progress won't be saved.
                </ThemedText>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => setShowCancelConfirm(false)}
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Keep going"
                  >
                    <ThemedText style={[styles.modalBtnText, { color: theme.colors.text }]}>Keep Going</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCancel}
                    style={[styles.modalBtn, { backgroundColor: theme.colors.error }]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel workout and discard progress"
                  >
                    <ThemedText style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[2],
  },
  emptyTitle: { fontSize: typography.sizes.h3, fontWeight: '700', marginTop: spacing[4] },
  emptySub: { fontSize: typography.sizes.bodySmall, textAlign: 'center', lineHeight: 20 },
  topBar: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3] },
  topBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  backBtn: { width: 36, height: 36, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  topBarCenter: { flex: 1 },
  workoutName: { fontSize: typography.sizes.h4, fontWeight: '700' },
  topBarMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[0.5] },
  metaText: { fontSize: typography.sizes.caption, fontWeight: '600', fontVariant: ['tabular-nums'] as any },
  diffBadge: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radius.md },
  diffBadgeText: { fontSize: typography.sizes.xs, fontWeight: '700', letterSpacing: 0.5 },
  scrollContent: { paddingBottom: spacing[8] },
  progressSection: { alignItems: 'center', paddingVertical: spacing[5] },
  progressPercent: { fontSize: typography.sizes.h1Sm, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  progressLabel: { fontSize: typography.sizes.captionSm, fontWeight: '500', marginTop: -2 },
  currentCard: { marginHorizontal: spacing[4], padding: spacing[5] },
  currentName: { fontSize: typography.sizes.h3, fontWeight: '700', lineHeight: 24 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1.5], marginTop: spacing[3.5] },
  targetPill: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radius.md },
  targetText: { fontSize: typography.sizes.captionSm, fontWeight: '600', textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], marginTop: spacing[4.5] },
  prescriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  prescriptionItem: { alignItems: 'center', flex: 1 },
  prescriptionVal: { fontSize: typography.sizes.h3, fontWeight: '800' },
  prescriptionLabel: { fontSize: typography.sizes.captionSm, fontWeight: '500', marginTop: spacing[0.5] },
  exerciseTimerWrap: { alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[2] },
  exerciseTimerText: { fontSize: typography.sizes.h3, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  exerciseTimerLabel: { fontSize: typography.sizes.xs, fontWeight: '500', marginTop: -2 },
  instTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '700', marginBottom: spacing[2.5] },
  instStep: { fontSize: typography.sizes.label, lineHeight: 20, marginBottom: spacing[1] },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  skipText: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },
  exListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  exStatusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exNumber: { fontSize: typography.sizes.captionSm, fontWeight: '700' },
  exDetails: { flex: 1 },
  exName: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  exNameDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  exSets: { fontSize: typography.sizes.caption, marginTop: spacing[0.5] },
  finishSection: { paddingHorizontal: spacing[4], marginTop: spacing[5] },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: spacing[7],
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
    marginBottom: spacing[4],
  },
  modalTitle: { fontSize: typography.sizes.h3, fontWeight: '800', marginBottom: spacing[2] },
  modalDesc: { fontSize: typography.sizes.bodySmall, textAlign: 'center', lineHeight: 20, marginBottom: spacing[6] },
  modalActions: { flexDirection: 'row', gap: spacing[2.5], width: '100%' },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnText: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
});
