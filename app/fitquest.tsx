/**
 * FitQuest Workout Screen
 * Premium glass UI with animated transitions
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  useWindowDimensions,
  Vibration,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  SlideInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useFitQuestWorkout, WorkoutExerciseDisplay } from '../src/hooks/useFitQuestWorkout';
import { useTimer } from '../src/hooks/useTimer';
import { audioService } from '../src/services/audioService';
import {
  GlassCard,
  GradientButton,
  ProgressRing,
  PulseDot,
  SectionHeader,
} from '../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ExerciseImage from '../src/components/ExerciseImage';
import { useRouter } from 'expo-router';

function FitQuestScreenInner() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isReady, isLoading: dbLoading, error: dbError, userProfile, resetAll } = useDatabase();
  const {
    status,
    workout,
    currentExercise,
    currentExerciseIndex,
    progressPercentage,
    error,
    fatigueSnapshot,
    deloadStatus,
    generateNewWorkout,
    startWorkout,
    completeExercise,
    skipExercise,
    finishWorkout,
    cancelWorkout,
  } = useFitQuestWorkout();

  const [completionResult, setCompletionResult] = useState<{
    summary: string;
    streak: { current: number; longest: number };
  } | null>(null);

  // Timer integration
  const {
    restTimer,
    sessionTimer,
    startRest,
    skipRest,
    startSession,
    endSession,
    pauseAll,
    resumeAll,
    stopAll,
    isActive: timerActive,
  } = useTimer();

  // Session clock (elapsed time)
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionStartRef = useRef<number | null>(null);
  
  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenExerciseRef = useRef<string | null>(null);
  const isCompactScreen = width < 390;

  // Initialize audio service
  useEffect(() => {
    const initAudio = async () => {
      try {
        await audioService.initialize('user_local_001');
        const settings = audioService.getSettings();
        setVoiceEnabled(settings.voiceEnabled);
      } catch (e) {
        console.log('[FitQuest] Audio init skipped:', e);
      }
    };
    initAudio();

    // Cleanup on unmount
    return () => {
      audioService.stop();
    };
  }, []);

  // Speak exercise instructions when transitioning to new exercise
  useEffect(() => {
    if (status === 'in_progress' && currentExercise && voiceEnabled) {
      // Avoid re-speaking the same exercise
      if (lastSpokenExerciseRef.current !== currentExercise.id) {
        lastSpokenExerciseRef.current = currentExercise.id;

        const speakExercise = async () => {
          setIsSpeaking(true);
          const audioData = {
            intro: currentExercise.audioIntro,
            setup: currentExercise.audioSetup,
            execution: currentExercise.audioExecution,
            transition: currentExercise.audioTransition,
          };
          
          // Full narration sequence: intro → setup → (pause) → execution cues
          await audioService.playIntro(audioData);
          await audioService.playSetup(audioData);
          // Brief pause before execution cues to let user get into position
          await new Promise(resolve => setTimeout(resolve, 1500));
          await audioService.playExecution(audioData);
          setIsSpeaking(false);
        };

        speakExercise();
      }
    }
  }, [status, currentExercise?.id, voiceEnabled]);

  // Toggle voice
  const toggleVoice = async () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    await audioService.updateSettings('user_local_001', { voiceEnabled: newValue });
    if (!newValue) {
      audioService.stop();
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'in_progress' && sessionStartRef.current) {
      interval = setInterval(() => {
        setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current!) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Rest timer state
  const [isResting, setIsResting] = useState(false);
  const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingExerciseAdvanceRef = useRef(false);
  // Collapsible instructions
  const [showAllInstructions, setShowAllInstructions] = useState(false);

  // Auto-generate on mount if ready and idle
  useEffect(() => {
    if (isReady && status === 'idle' && !completionResult) {
      // Small delay to let UI render first
      console.log('[FitQuest] Auto-generating workout (idle state, no completion result)');
      const timer = setTimeout(() => generateNewWorkout(), 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, status, completionResult]);

  // Workout rating state (shown after completion)
  const [workoutRating, setWorkoutRating] = useState<number | null>(null);

  // Auto-trigger finish when workout reaches completed status
  useEffect(() => {
    if (status === 'completed' && workout && !completionResult) {
      handleFinish();
    }
  }, [status, workout, completionResult]);

  // Cleanup rest timer on unmount
  useEffect(() => {
    return () => {
      if (restTimerRef.current) clearTimeout(restTimerRef.current);
    };
  }, []);

  const advanceAfterRest = async (reason: 'timer' | 'skip') => {
    if (!pendingExerciseAdvanceRef.current) return;
    pendingExerciseAdvanceRef.current = false;
    if (restTimerRef.current) {
      clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
    skipRest();
    setIsResting(false);
    setShowAllInstructions(false);
    completeExercise(5);
    Vibration.vibrate(20);
    console.log('[FitQuest] Rest ended — advancing exercise', { reason });
  };

  const handleFinish = async () => {
    console.log('[FitQuest] handleFinish called — processing workout completion');
    const result = await finishWorkout();
    if (result) {
      console.log('[FitQuest] Workout finished successfully — showing completion screen');
      setCompletionResult({
        summary: result.summary,
        streak: result.streak,
      });
      setWorkoutRating(null); // Reset rating for new workout
    } else {
      console.warn('[FitQuest] finishWorkout returned null — may have already been called');
    }
  };

  const handleNewWorkout = () => {
    setCompletionResult(null);
    setWorkoutRating(null);
    cancelWorkout(); // Reset hook state to idle
    setTimeout(() => generateNewWorkout(), 100); // Small delay for state to settle
  };

  const handleReset = () => {
    Alert.alert(
      t('fitquest.reset.title'),
      t('fitquest.reset.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('fitquest.reset.confirm'), style: 'destructive', onPress: resetAll },
      ]
    );
  };

  // ===== LOADING STATE =====
  if (dbLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <View style={[styles.loadingIcon, { backgroundColor: theme.colors.accent + '15' }]}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(50).duration(150)} style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {t('fitquest.initializing')}
          </Animated.Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== ERROR STATE =====
  if (dbError || error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <MaterialCommunityIcons name="alert-circle" size={64} color={theme.colors.error} />
          </Animated.View>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            {t('fitquest.errorTitle')}
          </Text>
          <Text style={[styles.errorSub, { color: theme.colors.textSecondary }]}>
            {dbError || error}
          </Text>
          <GradientButton title={t('fitquest.resetAndRetry')} icon="refresh" onPress={handleReset} colors={[theme.colors.error, '#B91C1C']} />
        </View>
      </SafeAreaView>
    );
  }

  // ===== COMPLETION STATE =====
  if (completionResult) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.completionContainer}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <View
              style={[
                styles.trophyGlow,
                { backgroundColor: theme.colors.success + '15' },
              ]}
            >
              <MaterialCommunityIcons name="trophy" size={72} color={theme.colors.success} />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeInUp.delay(50).duration(150)} style={[styles.completeTitle, { color: theme.colors.text }]}>
            {t('fitquest.workoutComplete')}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(80).duration(150)} style={{ width: '100%' }}>
            <GlassCard style={{ padding: 20, marginTop: 16 }}>
              <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
                {completionResult.summary}
              </Text>
            </GlassCard>
          </Animated.View>

          {/* WORKOUT RATING - after entire workout */}
          <Animated.View entering={FadeInDown.delay(100).duration(150)} style={{ width: '100%' }}>
            <GlassCard style={{ padding: 16, marginTop: 12 }}>
              <Text style={[styles.ratingTitle, { color: theme.colors.text }]}>
                {t('fitquest.rateWorkout')}
              </Text>
              <Text style={[styles.ratingSub, { color: theme.colors.textMuted }]}>
                {t('fitquest.rateWorkoutSub')}
              </Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setWorkoutRating(star)}
                    style={styles.ratingButton}
                  >
                    <MaterialCommunityIcons
                      name={workoutRating && workoutRating >= star ? 'star' : 'star-outline'}
                      size={36}
                      color={workoutRating && workoutRating >= star ? theme.colors.warning : theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {!!workoutRating && (
                <Text style={[styles.ratingFeedback, { color: theme.colors.success }]}>
                  {workoutRating <= 2 ? t('fitquest.feedback.low') : workoutRating <= 3 ? t('fitquest.feedback.mid') : workoutRating === 4 ? t('fitquest.feedback.high') : t('fitquest.feedback.top')}
                </Text>
              )}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(150)} style={{ width: '100%' }}>
            <GlassCard style={{ padding: 16, marginTop: 12 }}>
              <View style={styles.streakRow}>
                <MaterialCommunityIcons name="fire" size={32} color={theme.colors.warning} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.streakTitle, { color: theme.colors.text }]}>
                    {completionResult.streak.current} {t('fitquest.dayStreak')}
                  </Text>
                  <Text style={[styles.streakSub, { color: theme.colors.textMuted }]}>
                    {t('fitquest.best')}: {completionResult.streak.longest} {t('common.days')}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(140).duration(150)} style={{ marginTop: 28, width: '100%' }}>
            <GradientButton title={t('fitquest.generateNewWorkout')} icon="refresh" onPress={handleNewWorkout} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===== GENERATING STATE =====
  if (status === 'generating') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <View style={[styles.loadingIcon, { backgroundColor: theme.colors.accent + '15' }]}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(50).duration(150)} style={[styles.genTitle, { color: theme.colors.text }]}>
            {t('fitquest.craftingWorkout')}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(80).duration(150)} style={[styles.genSub, { color: theme.colors.textMuted }]}>
            {t('fitquest.craftingSub')}
          </Animated.Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== READY STATE (Preview) =====
  if (status === 'ready' && workout) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View entering={FadeIn.duration(150)}>
            <View
              style={[
                styles.readyHeader,
                {
                  backgroundColor: theme.isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.readyHeaderRow}>
                <Text style={[styles.readyTitle, { color: theme.colors.text }]}>{t('fitquest.todaysWorkout')}</Text>
                {!!workout.isDeload && (
                  <View
                    style={[styles.deloadBadge, { backgroundColor: theme.colors.warning }]}
                  >
                    <Text style={[styles.deloadBadgeText, { color: theme.colors.text }]}>{t('fitquest.deload')}</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Explanation */}
          <Animated.View entering={FadeInDown.delay(100).duration(150)}>
            <GlassCard style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.hintIcon, { backgroundColor: theme.colors.accent + '12' }]}>
                <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.accent} />
              </View>
              <Text style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
                {workout.explanation}
              </Text>
            </GlassCard>
          </Animated.View>

          {/* Warnings */}
          {workout.warnings.length > 0 && (
            <Animated.View entering={FadeInDown.delay(150).duration(150)}>
              <GlassCard
                style={{ marginHorizontal: 16, marginTop: 8 }}
              >
                {workout.warnings.map((warning: string, idx: number) => (
                  <Text key={idx} style={[styles.warningText, { color: theme.colors.warning }]}>
                    ⚠️ {warning}
                  </Text>
                ))}
              </GlassCard>
            </Animated.View>
          )}

          {/* Deload Status */}
          {!!deloadStatus && (
            <Animated.View entering={FadeInDown.delay(200).duration(150)}>
              <GlassCard style={{ marginHorizontal: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MaterialCommunityIcons
                  name={deloadStatus.needed ? "battery-low" : "battery-high"}
                  size={24}
                  color={deloadStatus.needed ? theme.colors.warning : theme.colors.success}
                />
                <View>
                  <Text style={[styles.recoveryLabel, { color: theme.colors.text }]}>{t('fitquest.recoveryStatus')}</Text>
                  <Text style={[styles.recoverySub, { color: theme.colors.textMuted }]}>{deloadStatus.reason}</Text>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {/* Exercise Count */}
          <SectionHeader
            title={`${workout.exercises.length} ${t('library.exercises')} · ~${workout.totalDuration} ${t('fitquest.minShort')}`}
            delay={250}
          />

          {/* Exercise List */}
          {workout.exercises.map((exercise: WorkoutExerciseDisplay, index: number) => (
            <Animated.View
              key={exercise.id}
              entering={FadeInRight.delay(250 + index * 40).duration(150)}
              style={{ paddingHorizontal: 16, marginBottom: 8 }}
            >
              <View style={[
                styles.exercisePreviewCard,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.border,
                },
              ]}>
                <ExerciseImage
                  exerciseId={exercise.exerciseId}
                  category={exercise.category}
                  variant="thumbnail"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.exercisePreviewName, { color: theme.colors.text }]}>{exercise.name}</Text>
                  <Text style={[styles.exercisePreviewMeta, { color: theme.colors.textMuted }]}>
                    {exercise.sets}× ({exercise.reps}) · {exercise.restSeconds}s
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}

          {/* Start Button */}
          <Animated.View entering={FadeInUp.delay(400).duration(150)} style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <GradientButton
              title={t('train.startWorkout')}
              icon="play"
              onPress={() => {
                startWorkout();
                startSession(60);
                sessionStartRef.current = Date.now();
                setSessionElapsed(0);
              }}
              variant="success"
              size="lg"
            />
          </Animated.View>

          {/* Regenerate */}
          <Animated.View entering={FadeIn.delay(450).duration(150)} style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity style={[styles.regenBtn, { borderColor: theme.colors.border }]} onPress={generateNewWorkout}>
              <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.text} />
              <Text style={[styles.regenBtnText, { color: theme.colors.text }]}>{t('fitquest.regenerate')}</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===== IN PROGRESS STATE =====
  if (status === 'in_progress' && workout && currentExercise) {
    const isLastExercise = currentExerciseIndex === workout.exercises.length - 1;

    const clockMinutes = Math.floor(sessionElapsed / 60);
    const clockSeconds = sessionElapsed % 60;
    const clockDisplay = `${clockMinutes.toString().padStart(2, '0')}:${clockSeconds.toString().padStart(2, '0')}`;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* ═══ FULL-SCREEN REST TIMER OVERLAY ═══ */}
        <Modal
          visible={!!isResting}
          animationType="fade"
          transparent={false}
          statusBarTranslucent
        >
          <View style={[styles.restOverlay, { backgroundColor: theme.colors.background }]}>
            <SafeAreaView style={styles.restOverlayInner}>
              <Animated.View entering={ZoomIn.duration(200)} style={styles.restOverlayContent}>
                <View style={[styles.restTimerIconWrap, { backgroundColor: theme.colors.warning + '18' }]}>
                  <MaterialCommunityIcons name="timer-sand" size={48} color={theme.colors.warning} />
                </View>
                <Text style={[styles.restOverlayLabel, { color: theme.colors.textMuted }]}>
                  {t('fitquest.restTime')}
                </Text>
                <Text style={[styles.restOverlayTimer, { color: theme.colors.warning }]}>
                  {restTimer.formattedRemaining}
                </Text>
                
                {/* Next exercise preview */}
                <View style={[styles.restNextCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.restNextLabel, { color: theme.colors.textMuted }]}>
                    {t('fitquest.nextUp')}
                  </Text>
                  {workout.exercises[currentExerciseIndex + 1] && (
                    <View style={{ alignItems: 'center', marginVertical: 8 }}>
                      <ExerciseImage
                        exerciseId={workout.exercises[currentExerciseIndex + 1].exerciseId}
                        category={workout.exercises[currentExerciseIndex + 1].category}
                        variant="thumbnail"
                      />
                    </View>
                  )}
                  <Text style={[styles.restNextName, { color: theme.colors.text }]}>
                    {workout.exercises[currentExerciseIndex + 1]?.name || ''}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.skipRestOverlayBtn, { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + '12' }]}
                  onPress={() => {
                    console.log('[FitQuest] Rest skipped by user');
                    void advanceAfterRest('skip');
                  }}
                >
                  <MaterialCommunityIcons name="skip-next" size={20} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                    {t('fitquest.skipRest')}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </SafeAreaView>
          </View>
        </Modal>

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
            <Text style={[styles.clockText, { color: theme.colors.accent }]}>{clockDisplay}</Text>
          </View>
          
          <View style={styles.clockCenter}>
            <TouchableOpacity
              onPress={toggleVoice}
              style={[styles.voiceToggle, { backgroundColor: voiceEnabled ? theme.colors.accent + '15' : theme.colors.textMuted + '10' }]}
            >
              <MaterialCommunityIcons
                name={voiceEnabled ? 'volume-high' : 'volume-off'}
                size={16}
                color={voiceEnabled ? theme.colors.accent : theme.colors.textMuted}
              />
              {isSpeaking && <PulseDot color={theme.colors.success} size={4} active={true} />}
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.clockExerciseCount, { color: theme.colors.textMuted }]}>
            {currentExerciseIndex + 1} / {workout.exercises.length}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarWrap}>
          <View
            style={[styles.progressBarFill, { width: `${progressPercentage}%`, backgroundColor: theme.colors.accent }]}
          />
        </View>

        <ScrollView contentContainerStyle={[styles.exerciseContent, isCompactScreen && styles.exerciseContentCompact]} showsVerticalScrollIndicator={false}>
          {/* Current Exercise */}
          <Animated.View entering={FadeIn.duration(150)} style={styles.currentExercise}>
            {/* Exercise Image — auto-alternating between start/end position */}
            <Animated.View entering={ZoomIn.duration(200)} style={{ alignItems: 'center', marginBottom: 16 }}>
              <ExerciseImage
                exerciseId={currentExercise.exerciseId}
                category={currentExercise.category}
                variant="detail"
                animate={true}
              />
            </Animated.View>

            <Animated.View entering={ZoomIn.duration(150)}>
              <Text style={[styles.currentExName, { color: theme.colors.text }]}>
                {currentExercise.name}
              </Text>
            </Animated.View>

            <View style={styles.prescriptionRow}>
              {[
                { val: currentExercise.sets, label: t('fitquest.sets') },
                { val: currentExercise.reps, label: t('fitquest.reps') },
                { val: `${currentExercise.restSeconds}s`, label: t('train.rest') },
              ].map((p, i) => (
                <Animated.View key={p.label} entering={FadeInUp.delay(i * 60).duration(150)} style={styles.prescriptionItem}>
                  <Text style={[styles.prescriptionVal, { color: theme.colors.text }]}>{p.val}</Text>
                  <Text style={[styles.prescriptionLabel, { color: theme.colors.textMuted }]}>{p.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Instructions (show first 3, collapsible) */}
            {currentExercise.instructions.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200).duration(150)} style={{ width: '100%', marginTop: 24 }}>
                <GlassCard>
                  <Text style={[styles.instTitle, { color: theme.colors.text }]}>{t('fitquest.formTips')}</Text>
                  {currentExercise.instructions
                    .slice(0, showAllInstructions ? undefined : 3)
                    .map((inst: string, idx: number) => (
                    <Text key={idx} style={[styles.instStep, { color: theme.colors.textSecondary }]}>
                      {idx + 1}. {inst}
                    </Text>
                  ))}
                  {currentExercise.instructions.length > 3 && (
                    <TouchableOpacity onPress={() => setShowAllInstructions(!showAllInstructions)} style={{ marginTop: 8 }}>
                      <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>
                        {showAllInstructions ? t('fitquest.showLess') : `+${currentExercise.instructions.length - 3} ${t('fitquest.more')}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </GlassCard>
              </Animated.View>
            )}
          </Animated.View>

          {/* Action Buttons — always visible, no RPE interruption */}
          <View style={[styles.actionRow, isCompactScreen && styles.actionRowCompact]}>
            <TouchableOpacity
              style={[styles.skipButton, isCompactScreen && styles.skipButtonCompact, { borderColor: theme.colors.border }]}
              onPress={() => {
                audioService.stop();
                stopAll();
                setShowAllInstructions(false);
                skipExercise();
              }}
            >
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>{t('train.skip')}</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <GradientButton
                title={isLastExercise ? t('fitquest.finishWorkout') : t('fitquest.completeSet')}
                icon={isLastExercise ? "check-all" : "check"}
                onPress={async () => {
                  if (isResting) return;
                  console.log('[FitQuest] Action:complete_or_next', {
                    isLastExercise,
                    index: currentExerciseIndex,
                    total: workout.exercises.length,
                  });
                  audioService.stop();
                  stopAll();
                  setShowAllInstructions(false);

                  if (isLastExercise) {
                    // Complete with default difficulty (skip RPE — user rates at the end)
                    completeExercise(5);
                    // Last exercise — play completion sound
                    // handleFinish is triggered by useEffect when status === 'completed'
                    await audioService.playWorkoutComplete();
                    console.log('[FitQuest] Last exercise completed — waiting for useEffect to trigger handleFinish');
                  } else {
                    // Show rest immediately, then advance after rest ends/skip
                    const nextExercise = workout.exercises[currentExerciseIndex + 1];
                    // Play transition narration (rich: "Well done! Rest for Xs. Up next: Y")
                    audioService.stop(); // Stop any ongoing narration first
                    const transitionAudio = {
                      intro: currentExercise.audioIntro,
                      setup: currentExercise.audioSetup,
                      execution: currentExercise.audioExecution,
                      transition: currentExercise.audioTransition,
                    };
                    await audioService.playTransition(transitionAudio);
                    console.log('[FitQuest] Set complete — entering rest overlay immediately', {
                      currentExercise: currentExercise.name,
                      nextExercise: nextExercise?.name,
                    });
                    Vibration.vibrate(25);
                    pendingExerciseAdvanceRef.current = true;
                    setIsResting(true);
                    const restDuration = currentExercise.restSeconds || 60;
                    startRest(restDuration);
                    if (restTimerRef.current) clearTimeout(restTimerRef.current);
                    restTimerRef.current = setTimeout(() => {
                      void advanceAfterRest('timer');
                    }, restDuration * 1000);
                  }
                }}
                variant={isLastExercise ? "success" : "primary"}
              />
            </View>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={{ marginTop: 24, alignItems: 'center' }}
            onPress={() => {
              Alert.alert(t('fitquest.cancelTitle'), t('fitquest.cancelBody'), [
                { text: t('fitquest.keepGoing'), style: 'cancel' },
                { text: t('common.cancel'), style: 'destructive', onPress: () => { audioService.stop(); stopAll(); cancelWorkout(); } },
              ]);
            }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{t('fitquest.cancelWorkout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ===== COMPLETED STATE (before processing) =====
  if (status === 'completed' && workout) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Animated.View entering={ZoomIn.duration(150)}>
            <View style={[styles.loadingIcon, { backgroundColor: theme.colors.success + '15' }]}>
              <ActivityIndicator size="large" color={theme.colors.success} />
            </View>
          </Animated.View>
          <Text style={[styles.genTitle, { color: theme.colors.text }]}>{t('fitquest.recordingProgress')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== DEFAULT/IDLE STATE =====
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.centered}>
        <Animated.View entering={ZoomIn.duration(150)}>
          <View
            style={[
              styles.idleIconWrap,
              { backgroundColor: theme.colors.accent + '12' },
            ]}
          >
            <MaterialCommunityIcons name="dumbbell" size={56} color={theme.colors.accent} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeInUp.delay(150).duration(150)} style={[styles.idleTitle, { color: theme.colors.text }]}>
          FitQuest
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(300).duration(150)} style={[styles.idleSub, { color: theme.colors.textSecondary }]}>
          {t('fitquest.idleSub')}
        </Animated.Text>

        {!!userProfile && (
          <Animated.View entering={FadeInDown.delay(400).duration(150)} style={{ width: '100%', maxWidth: 280 }}>
            <GlassCard style={{ alignItems: 'center', padding: 16, marginTop: 20 }}>
              <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]}>{t('fitquest.currentProfile')}</Text>
              <Text style={[styles.profileGoal, { color: theme.colors.text }]}>{userProfile.goal}</Text>
              <Text style={[styles.profileMeta, { color: theme.colors.textSecondary }]}> 
                {userProfile.experience} · {userProfile.time_per_session_minutes}{t('fitquest.minShort')} {t('fitquest.sessions')}
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(500).duration(150)} style={{ marginTop: 24, width: '100%', maxWidth: 280 }}>
          <GradientButton title={t('fitquest.generateWorkout')} icon="lightning-bolt" onPress={generateNewWorkout} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrollContent: { paddingBottom: 32 },
  loadingIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  errorSub: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  genTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  genSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  completeTitle: { fontSize: 28, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  trophyGlow: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  summaryText: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakTitle: { fontSize: 18, fontWeight: '600' },
  streakSub: { fontSize: 13, marginTop: 2 },
  ratingTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  ratingSub: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  ratingButton: { padding: 4 },
  ratingFeedback: { textAlign: 'center', marginTop: 12, fontSize: 14, fontWeight: '600' },
  completionContainer: { alignItems: 'center', padding: 24, paddingBottom: 60 },
  readyHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  readyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readyTitle: { fontSize: 24, fontWeight: '700' },
  deloadBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  deloadBadgeText: { fontSize: 11, fontWeight: '700' },
  hintIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  explanationText: { flex: 1, fontSize: 14, lineHeight: 21 },
  warningText: { fontSize: 13, marginBottom: 4 },
  recoveryLabel: { fontSize: 14, fontWeight: '500' },
  recoverySub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  exercisePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  exerciseNum: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  exerciseNumText: { fontWeight: '700', fontSize: 14 },
  exercisePreviewName: { fontSize: 15, fontWeight: '600' },
  exercisePreviewMeta: { fontSize: 12, marginTop: 3, fontWeight: '400' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  regenBtnText: { fontSize: 15, fontWeight: '600' },
  sessionClockBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  clockLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clockText: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  clockExerciseCount: { fontSize: 13, fontWeight: '500' },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressBarWrap: {
    height: 4,
    backgroundColor: 'rgba(128,128,128,0.15)',
    overflow: 'hidden',
  },
  progressBarFill: { height: 4, borderRadius: 2 },
  exerciseContent: { padding: 16, paddingBottom: 32 },
  exerciseContentCompact: { paddingBottom: 56 },
  // ═══ FULL-SCREEN REST OVERLAY ═══
  restOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  restOverlayInner: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  restOverlayContent: { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
  restTimerIconWrap: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  restOverlayLabel: { fontSize: 16, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  restOverlayTimer: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'] as any, marginBottom: 32 },
  restNextCard: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', width: '100%', maxWidth: 300, marginBottom: 40 },
  restNextLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  restNextName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  skipRestOverlayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, borderWidth: 1.5 },
  restTimerCard: { alignItems: 'center', padding: 24, marginBottom: 16, gap: 6 },
  restTimerValue: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  restTimerLabel: { fontSize: 13 },
  skipRestButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  currentExercise: { alignItems: 'center', marginTop: 24 },
  currentExName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  prescriptionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 28 },
  prescriptionItem: { alignItems: 'center' },
  prescriptionVal: { fontSize: 28, fontWeight: '700' },
  prescriptionLabel: { fontSize: 12, marginTop: 4, fontWeight: '400' },
  instTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  instStep: { fontSize: 14, marginBottom: 4, lineHeight: 20 },
  diffPrompt: { textAlign: 'center', marginTop: 24, fontSize: 13 },
  difficultyRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  difficultyButton: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  difficultyText: { fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 40, paddingHorizontal: 12 },
  actionRowCompact: { flexDirection: 'column-reverse', gap: 10, marginTop: 28, paddingHorizontal: 0 },
  skipButton: { 
    width: 80, 
    height: 56, 
    borderRadius: 28, // Circular/Pill shape
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  skipButtonCompact: {
    width: '100%',
    borderRadius: 14,
    height: 48,
  },
  idleIconWrap: { width: 140, height: 140, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  idleTitle: { fontSize: 32, fontWeight: '800', marginTop: 24 },
  idleSub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  profileLabel: { fontSize: 12 },
  profileGoal: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  profileMeta: { fontSize: 12, marginTop: 2 },
});

export default function FitQuestScreen() {
  const router = useRouter();
  return (
    <ScreenErrorBoundary screenName="FitQuest" onGoBack={() => router.back()}>
      <FitQuestScreenInner />
    </ScreenErrorBoundary>
  );
}
