/**
 * WorkoutActiveView — IN_PROGRESS state render for FitQuest.
 * Extracted from fitquest.tsx. Owns all rest/get-ready/instructions state internally.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Vibration, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { ScreenContainer } from '../ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { GlassCard, GradientButton, PulseDot } from '../ui/GlassUI';
import ThemedText from '../ThemedText';
import ExerciseImage from '../ExerciseImage';
import RestTimerOverlay from '../RestTimerOverlay';
import GetReadyOverlay from '../GetReadyOverlay';
import ExerciseCompleteBadge from '../ExerciseCompleteBadge';
import { PhaseTag } from './FitQuestParts';
import { haptic } from '../../utils/haptics';
import { typography, spacing, radius } from '../../design/theme-system';
import type { GeneratedWorkoutDisplay, WorkoutExerciseDisplay } from '../../hooks/workout/types';

interface TimerState {
  progress: number;
  formattedRemaining: string;
  remaining: number;
  state: string;
}

interface WorkoutActiveViewProps {
  workout: GeneratedWorkoutDisplay;
  currentExercise: WorkoutExerciseDisplay;
  currentExerciseIndex: number;
  sessionStartRef: React.MutableRefObject<number | null>;
  restTimer: TimerState;
  startRest: (seconds: number) => void;
  skipRest: () => void;
  extendRest: (seconds: number) => void;
  stopAll: () => void;
  completeExercise: (difficulty: number) => void;
  skipExercise: () => void;
  cancelWorkout: () => void;
  onLastExerciseFinish: () => void;
  vm: {
    voiceEnabled: boolean;
    isSpeaking: boolean;
    toggleVoice: () => void;
    cancelNarration: () => void;
    speakExercise: (exercise: WorkoutExerciseDisplay) => void;
    playTransitionAudio: (exercise: WorkoutExerciseDisplay) => Promise<void>;
  };
}

/** Self-contained session clock — re-renders only itself every second */
function SessionClock({
  startRef,
  active,
  style,
}: {
  startRef: React.MutableRefObject<number | null>;
  active: boolean;
  style: any;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startRef.current) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, startRef]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <ThemedText style={style}>{`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}</ThemedText>;
}

export default function WorkoutActiveView({
  workout,
  currentExercise,
  currentExerciseIndex,
  sessionStartRef,
  restTimer,
  startRest,
  skipRest,
  extendRest,
  stopAll,
  completeExercise,
  skipExercise,
  cancelWorkout,
  onLastExerciseFinish,
  vm,
}: WorkoutActiveViewProps) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isCompactScreen = width < 390;
  const isLastExercise = currentExerciseIndex === workout.exercises.length - 1;

  // Internal state — only used during active workout
  const [isResting, setIsResting] = useState(false);
  const [showCompleteBadge, setShowCompleteBadge] = useState(false);
  const [showAllInstructions, setShowAllInstructions] = useState(false);
  const [isGetReady, setIsGetReady] = useState(false);
  const [getReadyExercise, setGetReadyExercise] = useState<{
    exerciseId: string;
    name: string;
    category: string;
    sets: number;
    reps: string;
    setupCue?: string;
    audioSetup?: string;
    equipmentChanged?: boolean;
  } | null>(null);
  const pendingExerciseAdvanceRef = useRef(false);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    },
    [],
  );

  const advanceAfterRest = useCallback(
    async (reason: 'timer' | 'skip') => {
      if (!pendingExerciseAdvanceRef.current) return;
      pendingExerciseAdvanceRef.current = false;
      skipRest();
      setIsResting(false);
      setShowAllInstructions(false);

      const nextIdx = currentExerciseIndex + 1;
      const hasNext = nextIdx < workout.exercises.length;

      if (reason === 'timer' && hasNext) {
        const next = workout.exercises[nextIdx];
        const curr = workout.exercises[currentExerciseIndex];
        const currentPhase = curr?.phase || 'main';

        if (currentPhase === 'warmup' || currentPhase === 'cooldown') {
          completeExercise(5);
          Vibration.vibrate(20);
          return;
        }

        if (!next) {
          completeExercise(5);
          return;
        }
        const categoryChanged = curr && curr.category !== next.category;
        setGetReadyExercise({
          exerciseId: next.exerciseId,
          name: next.name,
          category: next.category,
          sets: next.sets,
          reps: next.reps,
          setupCue: next.instructions?.[0],
          audioSetup: next.audioSetup,
          equipmentChanged: !!categoryChanged,
        });
        setIsGetReady(true);
      } else {
        completeExercise(5);
        Vibration.vibrate(20);
      }
    },
    [currentExerciseIndex, workout, skipRest, completeExercise],
  );

  const handleGetReadyDone = useCallback(() => {
    setIsGetReady(false);
    setGetReadyExercise(null);
    completeExercise(5);
    Vibration.vibrate(20);
  }, [completeExercise]);

  // Auto-advance when rest timer completes
  useEffect(() => {
    if (isResting && pendingExerciseAdvanceRef.current && restTimer.state === 'completed') {
      void advanceAfterRest('timer');
    }
  }, [isResting, restTimer.state, advanceAfterRest]);

  const showBadge = () => {
    setShowCompleteBadge(true);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => setShowCompleteBadge(false), 1300);
  };

  const handleComplete = async () => {
    if (isResting) return;
    vm.cancelNarration();
    stopAll();
    setShowAllInstructions(false);

    if (isLastExercise) {
      completeExercise(5);
      onLastExerciseFinish();
    } else {
      const currentPhase = currentExercise.phase || 'main';
      const nextExercise = workout.exercises[currentExerciseIndex + 1];

      if (currentPhase === 'warmup' || currentPhase === 'cooldown') {
        haptic(currentPhase === 'warmup' ? 'warmupComplete' : 'cooldownComplete');
        showBadge();

        const nextPhase = nextExercise?.phase || 'main';
        const phaseChanging = nextPhase !== currentPhase;

        if (phaseChanging) {
          completeExercise(5);
          haptic('phaseTransition');
        } else if (nextExercise) {
          setGetReadyExercise({
            exerciseId: nextExercise.exerciseId,
            name: nextExercise.name,
            category: nextExercise.category,
            sets: nextExercise.sets,
            reps: nextExercise.reps,
            setupCue: nextExercise.instructions?.[0],
            audioSetup: nextExercise.audioSetup,
            equipmentChanged: false,
          });
          pendingExerciseAdvanceRef.current = true;
          setIsResting(true);
          startRest(currentPhase === 'warmup' ? 10 : 8);
        }
      } else {
        await vm.playTransitionAudio(currentExercise);
        haptic('exerciseComplete');
        showBadge();
        pendingExerciseAdvanceRef.current = true;
        setIsResting(true);
        startRest(currentExercise.restSeconds || 60);
      }
    }
  };

  // Phase banner helper
  const renderPhaseBanner = () => {
    if (currentExercise.phase === 'warmup') {
      const warmups = workout.exercises.filter((e) => e.phase === 'warmup');
      const pos = warmups.findIndex((e) => e.id === currentExercise.id) + 1;
      return (
        <PhaseTag
          icon="fire"
          label={`${t('fitquest.warmUp') || 'Warm Up'} ${pos}/${warmups.length}`}
          color={theme.colors.success}
          centered
        />
      );
    }
    if (currentExercise.phase === 'cooldown') {
      const cooldowns = workout.exercises.filter((e) => e.phase === 'cooldown');
      const pos = cooldowns.findIndex((e) => e.id === currentExercise.id) + 1;
      return (
        <PhaseTag
          icon="snowflake"
          label={`${t('fitquest.coolDown') || 'Cool Down'} ${pos}/${cooldowns.length}`}
          color={theme.colors.blue}
          centered
        />
      );
    }
    return null;
  };

  // Segmented progress bar data
  const warmupCount = workout.exercises.filter((e) => e.phase === 'warmup').length;
  const mainCount = workout.exercises.filter((e) => e.phase === 'main' || !e.phase).length;
  const cooldownCount = workout.exercises.filter((e) => e.phase === 'cooldown').length;
  const total = workout.exercises.length;
  const completedInPhase = (phase: string) =>
    workout.exercises.filter((e) => (e.phase || 'main') === phase && e.completed).length;
  const phaseTotal = (phase: string) => workout.exercises.filter((e) => (e.phase || 'main') === phase).length;
  const currentPhase = currentExercise.phase || 'main';

  return (
    <ScreenContainer>
      {/* REST TIMER OVERLAY */}
      <RestTimerOverlay
        visible={!!isResting}
        progress={restTimer.progress}
        formattedRemaining={restTimer.formattedRemaining}
        remaining={restTimer.remaining}
        phase={currentExercise.phase || 'main'}
        nextExercise={(() => {
          const ne = workout.exercises[currentExerciseIndex + 1];
          return ne
            ? { exerciseId: ne.exerciseId, name: ne.name, category: ne.category, sets: ne.sets, reps: ne.reps }
            : undefined;
        })()}
        onSkip={() => {
          haptic('restOver');
          void advanceAfterRest('skip');
        }}
        onExtend={(s: number) => extendRest(s)}
      />

      {/* GET READY OVERLAY */}
      <GetReadyOverlay
        visible={isGetReady}
        exercise={getReadyExercise}
        equipmentChanged={getReadyExercise?.equipmentChanged}
        onReady={handleGetReadyDone}
      />

      {/* Session Clock Bar */}
      <View
        style={[
          styles.sessionClockBar,
          {
            backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.clockLeft}>
          <PulseDot color={theme.colors.success} size={5} active={true} />
          <SessionClock
            startRef={sessionStartRef}
            active={true}
            style={[styles.clockText, { color: theme.colors.accent }]}
          />
        </View>

        <View style={styles.clockCenter}>
          <TouchableOpacity
            onPress={vm.toggleVoice}
            accessibilityRole="switch"
            accessibilityLabel={vm.voiceEnabled ? 'Disable voice guidance' : 'Enable voice guidance'}
            accessibilityState={{ checked: vm.voiceEnabled }}
            style={[
              styles.voiceToggle,
              { backgroundColor: vm.voiceEnabled ? theme.colors.accent + '15' : theme.colors.textMuted + '10' },
            ]}
          >
            <MaterialCommunityIcons
              name={vm.voiceEnabled ? 'volume-high' : 'volume-off'}
              size={16}
              color={vm.voiceEnabled ? theme.colors.accent : theme.colors.textMuted}
            />
            {vm.isSpeaking && <PulseDot color={theme.colors.success} size={4} active={true} />}
          </TouchableOpacity>
        </View>

        <ThemedText style={[styles.clockExerciseCount, { color: theme.colors.textMuted }]}>
          {currentExerciseIndex + 1} / {workout.exercises.length}
          {currentExercise.phase === 'warmup'
            ? ` · ${t('fitquest.warmUp')}`
            : currentExercise.phase === 'cooldown'
              ? ` · ${t('fitquest.coolDown')}`
              : ''}
        </ThemedText>
      </View>

      {/* Segmented Progress Bar */}
      <View style={styles.segmentedBarWrap}>
        {warmupCount > 0 && (
          <View style={[styles.segmentedBarSegment, { flex: warmupCount / total }]}>
            <View
              style={[
                styles.segmentedBarFill,
                {
                  width: `${phaseTotal('warmup') > 0 ? (completedInPhase('warmup') / phaseTotal('warmup')) * 100 : 0}%`,
                  backgroundColor: theme.colors.success,
                  borderRadius: completedInPhase('warmup') === phaseTotal('warmup') ? 0 : 2,
                },
              ]}
            />
            {currentPhase === 'warmup' && !workout.exercises[currentExerciseIndex]?.completed && (
              <View style={[styles.segmentedBarPulse, { backgroundColor: theme.colors.success + '60' }]} />
            )}
          </View>
        )}
        {mainCount > 0 && (
          <View style={[styles.segmentedBarSegment, { flex: mainCount / total }]}>
            <View
              style={[
                styles.segmentedBarFill,
                {
                  width: `${phaseTotal('main') > 0 ? (completedInPhase('main') / phaseTotal('main')) * 100 : 0}%`,
                  backgroundColor: theme.colors.accent,
                },
              ]}
            />
            {currentPhase === 'main' && !workout.exercises[currentExerciseIndex]?.completed && (
              <View style={[styles.segmentedBarPulse, { backgroundColor: theme.colors.accent + '60' }]} />
            )}
          </View>
        )}
        {cooldownCount > 0 && (
          <View style={[styles.segmentedBarSegment, { flex: cooldownCount / total }]}>
            <View
              style={[
                styles.segmentedBarFill,
                {
                  width: `${phaseTotal('cooldown') > 0 ? (completedInPhase('cooldown') / phaseTotal('cooldown')) * 100 : 0}%`,
                  backgroundColor: theme.colors.blue,
                },
              ]}
            />
            {currentPhase === 'cooldown' && !workout.exercises[currentExerciseIndex]?.completed && (
              <View style={[styles.segmentedBarPulse, { backgroundColor: theme.colors.blue + '60' }]} />
            )}
          </View>
        )}
      </View>

      {/* Exercise Complete Badge */}
      <ExerciseCompleteBadge
        visible={showCompleteBadge}
        message={
          currentExercise.phase === 'warmup'
            ? '🔥 Warmed Up!'
            : currentExercise.phase === 'cooldown'
              ? '❄️ Recovery!'
              : ['Nice!', 'Strong!', 'Crushed it!', 'Beast mode!', 'Solid!'][currentExerciseIndex % 5]
        }
        color={
          currentExercise.phase === 'warmup'
            ? theme.colors.success
            : currentExercise.phase === 'cooldown'
              ? theme.colors.blue
              : theme.colors.success
        }
      />

      {/* EXERCISE CONTENT */}
      <ScrollView
        contentContainerStyle={[styles.exerciseContent, isCompactScreen && styles.exerciseContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        {renderPhaseBanner()}

        {/* Current Exercise */}
        <Animated.View entering={FadeIn.duration(150)} style={styles.currentExercise}>
          <Animated.View entering={ZoomIn.duration(200)} style={{ alignItems: 'center', marginBottom: spacing[4] }}>
            <ExerciseImage
              exerciseId={currentExercise.exerciseId}
              category={currentExercise.category}
              variant="detail"
              animate={true}
            />
          </Animated.View>

          <Animated.View entering={ZoomIn.duration(150)}>
            <ThemedText style={[styles.currentExName, { color: theme.colors.text }]}>{currentExercise.name}</ThemedText>
          </Animated.View>

          <View style={styles.prescriptionRow}>
            {[
              { val: currentExercise.sets, label: t('fitquest.sets') },
              { val: currentExercise.reps, label: t('fitquest.reps') },
              { val: `${currentExercise.restSeconds}s`, label: t('train.rest') },
            ].map((p, i) => (
              <Animated.View
                key={p.label}
                entering={FadeInUp.delay(i * 60).duration(150)}
                style={styles.prescriptionItem}
              >
                <ThemedText style={[styles.prescriptionVal, { color: theme.colors.text }]}>{p.val}</ThemedText>
                <ThemedText style={[styles.prescriptionLabel, { color: theme.colors.textMuted }]}>{p.label}</ThemedText>
              </Animated.View>
            ))}
          </View>

          {/* Instructions */}
          {currentExercise.instructions.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(150)}
              style={{ width: '100%', marginTop: spacing[6] }}
            >
              <GlassCard>
                <ThemedText style={[styles.instTitle, { color: theme.colors.text }]}>
                  {t('fitquest.formTips')}
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
                    accessibilityLabel={showAllInstructions ? 'Show less instructions' : 'Show all instructions'}
                  >
                    <ThemedText
                      style={{ color: theme.colors.accent, fontSize: typography.sizes.caption, fontWeight: '600' }}
                    >
                      {showAllInstructions
                        ? t('fitquest.showLess')
                        : `+${currentExercise.instructions.length - 3} ${t('fitquest.more')}`}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </GlassCard>
            </Animated.View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <View style={[styles.actionRow, isCompactScreen && styles.actionRowCompact]}>
          <TouchableOpacity
            style={[
              styles.skipButton,
              isCompactScreen && styles.skipButtonCompact,
              { borderColor: theme.colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('train.skip')}
            onPress={() => {
              vm.cancelNarration();
              stopAll();
              setShowAllInstructions(false);
              skipExercise();
            }}
          >
            <ThemedText style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>{t('train.skip')}</ThemedText>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <GradientButton
              title={
                isLastExercise
                  ? t('fitquest.finishWorkout')
                  : currentExercise.phase === 'warmup' || currentExercise.phase === 'cooldown'
                    ? 'Done →'
                    : t('fitquest.completeSet')
              }
              icon={
                isLastExercise
                  ? 'check-all'
                  : currentExercise.phase === 'warmup' || currentExercise.phase === 'cooldown'
                    ? 'arrow-right'
                    : 'check'
              }
              onPress={handleComplete}
              variant={isLastExercise ? 'success' : 'primary'}
            />
          </View>
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={{ marginTop: spacing[6], alignItems: 'center' }}
          onPress={() => {
            Alert.alert(t('fitquest.cancelTitle'), t('fitquest.cancelBody'), [
              { text: t('fitquest.keepGoing'), style: 'cancel' },
              {
                text: t('common.cancel'),
                style: 'destructive',
                onPress: () => {
                  vm.cancelNarration();
                  stopAll();
                  cancelWorkout();
                },
              },
            ]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel workout"
        >
          <ThemedText style={{ color: theme.colors.textMuted, fontSize: typography.sizes.label }}>
            {t('fitquest.cancelWorkout')}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sessionClockBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
  },
  clockLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  clockCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  clockText: { fontSize: typography.sizes.h3, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  clockExerciseCount: { fontSize: typography.sizes.label, fontWeight: '500' },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
  },
  segmentedBarWrap: { flexDirection: 'row', height: 5, gap: spacing[0.5], paddingHorizontal: spacing[0] },
  segmentedBarSegment: {
    height: 5,
    backgroundColor: 'rgba(128,128,128,0.12)',
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentedBarFill: { height: 5, borderRadius: radius.sm },
  segmentedBarPulse: { position: 'absolute', right: 0, top: 0, width: 8, height: 5, borderRadius: radius.sm },
  exerciseContent: { padding: spacing[4], paddingBottom: spacing[25] },
  exerciseContentCompact: { paddingBottom: spacing[25] },
  currentExercise: { alignItems: 'center', marginTop: spacing[6] },
  currentExName: { fontSize: typography.sizes.h2, fontWeight: '700', textAlign: 'center' },
  prescriptionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: spacing[7] },
  prescriptionItem: { alignItems: 'center' },
  prescriptionVal: { fontSize: typography.sizes.h1Sm, fontWeight: '700' },
  prescriptionLabel: { fontSize: typography.sizes.caption, marginTop: spacing[1], fontWeight: '400' },
  instTitle: { fontSize: typography.sizes.bodySmall, fontWeight: '600', marginBottom: spacing[2] },
  instStep: { fontSize: typography.sizes.bodySmall, marginBottom: spacing[1], lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[10], paddingHorizontal: spacing[3] },
  actionRowCompact: {
    flexDirection: 'column-reverse',
    gap: spacing[2.5],
    marginTop: spacing[7],
    paddingHorizontal: spacing[0],
  },
  skipButton: {
    width: 80,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonCompact: { width: '100%', borderRadius: radius.lg, height: 48 },
});
