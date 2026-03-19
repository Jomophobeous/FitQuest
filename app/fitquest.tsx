/**
 * FitQuest Workout Screen
 * Premium glass UI with animated transitions
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Vibration,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  ZoomIn,
  SlideInDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useFitQuestWorkout, WorkoutExerciseDisplay, WorkoutCompletionData } from '../src/hooks/useFitQuestWorkout';
import WorkoutSummaryView from '../src/components/WorkoutSummaryView';
import { useTimer } from '../src/hooks/useTimer';
import { audioService } from '../src/services/audioService';
import { setAppState } from '../src/database/service';
import {
  GlassCard,
  GradientButton,
  ProgressRing,
  PulseDot,
  SectionHeader,
} from '../src/components/ui/GlassUI';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import ExerciseImage from '../src/components/ExerciseImage';
import RestTimerOverlay from '../src/components/RestTimerOverlay';
import GetReadyOverlay from '../src/components/GetReadyOverlay';
import ConfettiBurst from '../src/components/ConfettiBurst';
import ExerciseCompleteBadge from '../src/components/ExerciseCompleteBadge';
import MindExerciseView from '../src/components/MindExerciseView';
import { haptic } from '../src/utils/haptics';
import { useRouter } from 'expo-router';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';

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

  const [completionResult, setCompletionResult] = useState<WorkoutCompletionData | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCompleteBadge, setShowCompleteBadge] = useState(false);

  // Timer integration
  const {
    restTimer,
    sessionTimer,
    startRest,
    skipRest,
    extendRest,
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
  const speakCancelRef = useRef(0); // Cancellation token for async narration chains
  const lastAnnouncedPhaseRef = useRef<string | null>(null); // Track phase transitions
  const isCompactScreen = width < 390;

  // Initialize audio service
  useEffect(() => {
    const initAudio = async () => {
      try {
        await audioService.initialize('user_local_001');
        const settings = audioService.getSettings();
        setVoiceEnabled(settings.voiceEnabled);
      } catch (e) {
        if (__DEV__) console.log('[FitQuest] Audio init skipped:', e);
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
        // Increment cancellation token — any in-flight chain with an older token will abort
        const token = ++speakCancelRef.current;

        const speakExercise = async () => {
          try {
            setIsSpeaking(true);

            // Phase transition announcement (warmup→main→cooldown)
            const currentPhase = currentExercise.phase || 'main';
            if (lastAnnouncedPhaseRef.current !== currentPhase) {
              const fromPhase = lastAnnouncedPhaseRef.current as 'warmup' | 'main' | 'cooldown' | null;
              lastAnnouncedPhaseRef.current = currentPhase;
              await audioService.playPhaseTransition(fromPhase, currentPhase);
              if (speakCancelRef.current !== token) return;
              // Brief pause after phase announcement to let it land
              await new Promise(resolve => setTimeout(resolve, 800));
              if (speakCancelRef.current !== token) return;
            }

            const audioData = {
              intro: currentExercise.audioIntro,
              setup: currentExercise.audioSetup,
              execution: currentExercise.audioExecution,
              transition: currentExercise.audioTransition,
            };
          
            // Full narration sequence with cancellation checks between each step
            await audioService.playIntro(audioData);
            if (speakCancelRef.current !== token) return;
            await audioService.playSetup(audioData);
            if (speakCancelRef.current !== token) return;
            await new Promise(resolve => setTimeout(resolve, 600));
            if (speakCancelRef.current !== token) return;
            await audioService.playExecution(audioData);
            if (speakCancelRef.current !== token) return;
            setIsSpeaking(false);
          } catch (e) {
            if (__DEV__) console.warn('[FitQuest] Narration error (non-fatal):', e);
            setIsSpeaking(false);
          }
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
  const pendingExerciseAdvanceRef = useRef(false);
  // Get-Ready overlay state (P3: exercise transitions)
  const [isGetReady, setIsGetReady] = useState(false);
  const [getReadyExercise, setGetReadyExercise] = useState<{
    exerciseId: string; name: string; category: string;
    sets: number; reps: string; setupCue?: string; audioSetup?: string;
    equipmentChanged?: boolean;
  } | null>(null);
  // Collapsible instructions
  const [showAllInstructions, setShowAllInstructions] = useState(false);

  // Stable ref for generateNewWorkout to prevent re-triggering on identity changes
  const generateNewWorkoutRef = useRef(generateNewWorkout);
  generateNewWorkoutRef.current = generateNewWorkout;

  // Auto-generate on mount if ready and idle
  useEffect(() => {
    if (isReady && userProfile && status === 'idle' && !completionResult) {
      // Small delay to let UI render first
      if (__DEV__) console.log('[FitQuest] Auto-generating workout (idle state, no completion result)');
      const timer = setTimeout(() => generateNewWorkoutRef.current(), 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, userProfile, status, completionResult]);

  // Workout rating state (shown after completion)
  const [workoutRating, setWorkoutRating] = useState<number | null>(null);

  // Auto-trigger finish when workout reaches completed status
  const finishTriggeredRef = useRef(false);
  useEffect(() => {
    if (status === 'completed' && workout && !completionResult && !finishTriggeredRef.current) {
      finishTriggeredRef.current = true;
      // Ensure audio is fully stopped before processing completion
      audioService.stop();
      handleFinish().finally(() => {
        finishTriggeredRef.current = false;
      });
    }
  }, [status, workout, completionResult]);

  // Stop audio whenever we leave in_progress state (safety net)
  useEffect(() => {
    if (status !== 'in_progress') {
      speakCancelRef.current++;
      audioService.stop();
      setIsSpeaking(false);
    }
  }, [status]);

  // Auto-advance when rest timer completes (replaces setTimeout backup)
  useEffect(() => {
    if (isResting && pendingExerciseAdvanceRef.current && restTimer.state === 'completed') {
      void advanceAfterRest('timer');
    }
  }, [isResting, restTimer.state]);

  const advanceAfterRest = async (reason: 'timer' | 'skip') => {
    if (!pendingExerciseAdvanceRef.current) return;
    pendingExerciseAdvanceRef.current = false;
    skipRest();
    setIsResting(false);
    setShowAllInstructions(false);

    const nextIdx = currentExerciseIndex + 1;
    const hasNext = nextIdx < (workout?.exercises.length ?? 0);

    if (reason === 'timer' && hasNext) {
      const next = workout!.exercises[nextIdx];
      const curr = workout!.exercises[currentExerciseIndex];
      const currentPhase = curr?.phase || 'main';

      // Warmup/cooldown: skip Get-Ready overlay — just advance immediately for pace
      if (currentPhase === 'warmup' || currentPhase === 'cooldown') {
        completeExercise(5);
        Vibration.vibrate(20);
        if (__DEV__) console.log(`[FitQuest] ${currentPhase} rest ended — quick advance`, { next: next?.name });
        return;
      }

      // Main exercises: full Get-Ready countdown before next exercise
      if (!next) { completeExercise(5); return; }
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
      if (__DEV__) console.log('[FitQuest] Rest ended — showing Get Ready', { nextExercise: next.name, categoryChanged });
    } else {
      // Skipped rest or no next exercise → advance immediately
      completeExercise(5);
      Vibration.vibrate(20);
      if (__DEV__) console.log('[FitQuest] Rest ended — advancing immediately', { reason });
    }
  };

  const handleGetReadyDone = useCallback(() => {
    setIsGetReady(false);
    setGetReadyExercise(null);
    completeExercise(5);
    Vibration.vibrate(20);
    if (__DEV__) console.log('[FitQuest] Get-Ready done — next exercise');
  }, [completeExercise]);

  const handleExtendRest = useCallback((seconds: number) => {
    extendRest(seconds);
    if (__DEV__) console.log('[FitQuest] Rest extended +' + seconds + 's');
  }, [extendRest]);

  const handleFinish = async () => {
    if (__DEV__) console.log('[FitQuest] handleFinish called — processing workout completion');
    // Cancel any in-flight narration chain AND stop current audio
    speakCancelRef.current++;
    audioService.stop();
    lastSpokenExerciseRef.current = null;
    lastAnnouncedPhaseRef.current = null;
    setIsSpeaking(false);

    let result: WorkoutCompletionData | null = null;
    try {
      result = await finishWorkout();
    } catch (e) {
      if (__DEV__) console.error('[FitQuest] finishWorkout threw (non-fatal):', e);
    }

    if (result) {
      if (__DEV__) console.log('[FitQuest] Workout finished successfully — showing completion screen');
      setCompletionResult(result);
      setWorkoutRating(null);

      // Narrator compliments the user with context-aware praise (non-blocking)
      try {
        audioService.playWorkoutCompliment({
          completedCount: result.completedCount,
          totalCount: result.totalCount,
          durationSeconds: result.durationSeconds,
          streakDays: result.streak?.current ?? 0,
          xpEarned: result.xpEarned,
          levelUp: result.levelUp,
          newLevel: result.newLevel,
          progressions: result.progressions,
          exerciseNames: result.exerciseNames,
        });
      } catch (e) {
        if (__DEV__) console.warn('[FitQuest] Compliment narration error (non-fatal):', e);
      }

      // Store last workout summary so AI Coach can reference it
      setAppState('last_completed_workout', JSON.stringify({
        completedCount: result.completedCount,
        totalCount: result.totalCount,
        durationSeconds: result.durationSeconds,
        streakDays: result.streak?.current ?? 0,
        xpEarned: result.xpEarned,
        exerciseNames: result.exerciseNames,
        completedAt: Date.now(),
      })).catch(e => { if (__DEV__) console.warn('[FitQuest] Failed to store last workout:', e); });
    } else {
      if (__DEV__) console.warn('[FitQuest] finishWorkout returned null — may have already been called');
    }
  };

  const handleNewWorkout = () => {
    setCompletionResult(null);
    setWorkoutRating(null);
    lastAnnouncedPhaseRef.current = null;
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
          <GradientButton title={t('fitquest.resetAndRetry')} icon="refresh" onPress={handleReset} colors={[theme.colors.error, theme.colors.error]} />
        </View>
      </SafeAreaView>
    );
  }

  // ===== DB NOT READY YET (retry in progress) =====
  if (!isReady) {
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

  // ===== COMPLETION STATE =====
  if (completionResult) {
    return (
      <>
        <ConfettiBurst active={showConfetti} onComplete={() => setShowConfetti(false)} />
        <WorkoutSummaryView
          data={completionResult}
          rating={workoutRating}
          onRate={setWorkoutRating}
          onNewWorkout={handleNewWorkout}
        />
      </>
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
          {workout.warnings?.length > 0 && (
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
            title={`${(workout.exercises ?? []).filter(e => e.phase === 'main' || !e.phase).length} ${t('library.exercises')} · ~${workout.totalDuration} ${t('fitquest.minShort')}`}
            delay={250}
          />

          {/* Warm-Up Section (P6) */}
          {workout.warmup && workout.warmup.length > 0 && (
            <>
              <Animated.View entering={FadeInDown.delay(260).duration(150)} style={{ paddingHorizontal: 16, marginBottom: 4 }}>
                <View style={[styles.phaseTag, { backgroundColor: theme.colors.success + '18' }]}>
                  <MaterialCommunityIcons name="fire" size={16} color={theme.colors.success} />
                  <Text style={[styles.phaseTagText, { color: theme.colors.success }]}>
                    {t('fitquest.warmUp') || 'Warm Up'} · {workout.warmup.length} {t('library.exercises')}
                  </Text>
                </View>
              </Animated.View>
              {workout.warmup.map((exercise: WorkoutExerciseDisplay, index: number) => (
                <Animated.View
                  key={exercise.id}
                  entering={FadeInRight.delay(270 + index * 30).duration(120)}
                  style={{ paddingHorizontal: 16, marginBottom: 6 }}
                >
                  <View style={[
                    styles.exercisePreviewCard,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.success + '30' },
                  ]}>
                    <ExerciseImage exerciseId={exercise.exerciseId} category={exercise.category} variant="thumbnail" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.exercisePreviewName, { color: theme.colors.text }]}>{exercise.name}</Text>
                      <Text style={[styles.exercisePreviewMeta, { color: theme.colors.textMuted }]}>
                        {exercise.sets}× ({exercise.reps})
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </>
          )}

          {/* Main Workout Section Header */}
          {workout.warmup && workout.warmup.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(150)} style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 4 }}>
              <View style={[styles.phaseTag, { backgroundColor: theme.colors.accent + '18' }]}>
                <MaterialCommunityIcons name="dumbbell" size={16} color={theme.colors.accent} />
                <Text style={[styles.phaseTagText, { color: theme.colors.accent }]}>
                  {t('fitquest.mainWorkout') || 'Main Workout'}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Exercise List (main exercises only — warmup/cooldown shown above/below) */}
          {(workout.exercises ?? []).filter(e => e.phase === 'main' || !e.phase).map((exercise: WorkoutExerciseDisplay, index: number) => (
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

          {/* Cool-Down Section (P6) */}
          {workout.cooldown && workout.cooldown.length > 0 && (
            <>
              <Animated.View entering={FadeInDown.delay(380).duration(150)} style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 4 }}>
                <View style={[styles.phaseTag, { backgroundColor: theme.colors.blue + '18' }]}>
                  <MaterialCommunityIcons name="snowflake" size={16} color={theme.colors.blue} />
                  <Text style={[styles.phaseTagText, { color: theme.colors.blue }]}>
                    {t('fitquest.coolDown') || 'Cool Down'} · {workout.cooldown.length} {t('library.exercises')}
                  </Text>
                </View>
              </Animated.View>
              {workout.cooldown.map((exercise: WorkoutExerciseDisplay, index: number) => (
                <Animated.View
                  key={exercise.id}
                  entering={FadeInRight.delay(390 + index * 30).duration(120)}
                  style={{ paddingHorizontal: 16, marginBottom: 6 }}
                >
                  <View style={[
                    styles.exercisePreviewCard,
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.blue + '30' },
                  ]}>
                    <ExerciseImage exerciseId={exercise.exerciseId} category={exercise.category} variant="thumbnail" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.exercisePreviewName, { color: theme.colors.text }]}>{exercise.name}</Text>
                      <Text style={[styles.exercisePreviewMeta, { color: theme.colors.textMuted }]}>
                        {exercise.sets}× ({exercise.reps})
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </>
          )}

          {/* Start Button */}
          <Animated.View entering={FadeInUp.delay(400).duration(150)} style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <GradientButton
              title={t('train.startWorkout')}
              icon="play"
              onPress={() => {
                haptic('workoutStart');
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
            <TouchableOpacity style={[styles.regenBtn, { borderColor: theme.colors.border }]} onPress={generateNewWorkout} accessibilityRole="button" accessibilityLabel={t('fitquest.regenerate')}>
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
        {/* ═══ REST TIMER OVERLAY (P2) ═══ */}
        <RestTimerOverlay
          visible={!!isResting}
          progress={restTimer.progress}
          formattedRemaining={restTimer.formattedRemaining}
          remaining={restTimer.remaining}
          phase={currentExercise.phase || 'main'}
          nextExercise={(() => {
            const ne = workout.exercises[currentExerciseIndex + 1];
            return ne ? { exerciseId: ne.exerciseId, name: ne.name, category: ne.category, sets: ne.sets, reps: ne.reps } : undefined;
          })()}
          onSkip={() => {
            if (__DEV__) console.log('[FitQuest] Rest skipped by user');
            haptic('restOver');
            void advanceAfterRest('skip');
          }}
          onExtend={handleExtendRest}
        />

        {/* ═══ GET READY OVERLAY (P3) ═══ */}
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
            <Text style={[styles.clockText, { color: theme.colors.accent }]}>{clockDisplay}</Text>
          </View>
          
          <View style={styles.clockCenter}>
            <TouchableOpacity
              onPress={toggleVoice}
              accessibilityRole="switch"
              accessibilityLabel={voiceEnabled ? 'Disable voice guidance' : 'Enable voice guidance'}
              accessibilityState={{ checked: voiceEnabled }}
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
            {currentExercise.phase === 'warmup' ? ' · Warm Up' : currentExercise.phase === 'cooldown' ? ' · Cool Down' : ''}
          </Text>
        </View>

        {/* Segmented Progress Bar (warmup → main → cooldown) */}
        {(() => {
          const warmupCount = workout.exercises.filter(e => e.phase === 'warmup').length;
          const mainCount = workout.exercises.filter(e => e.phase === 'main' || !e.phase).length;
          const cooldownCount = workout.exercises.filter(e => e.phase === 'cooldown').length;
          const total = workout.exercises.length;
          const completedInPhase = (phase: string) =>
            workout.exercises.filter(e => (e.phase || 'main') === phase && e.completed).length;
          const phaseTotal = (phase: string) =>
            workout.exercises.filter(e => (e.phase || 'main') === phase).length;

          // Current exercise counts as "in progress" — show partial fill
          const currentPhase = currentExercise.phase || 'main';
          const isInPhase = (phase: string) => currentPhase === phase;

          return (
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
                  {isInPhase('warmup') && !workout.exercises[currentExerciseIndex]?.completed && (
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
                  {isInPhase('main') && !workout.exercises[currentExerciseIndex]?.completed && (
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
                  {isInPhase('cooldown') && !workout.exercises[currentExerciseIndex]?.completed && (
                    <View style={[styles.segmentedBarPulse, { backgroundColor: theme.colors.blue + '60' }]} />
                  )}
                </View>
              )}
            </View>
          );
        })()}

        {/* Exercise Complete Badge (P7) */}
        <ExerciseCompleteBadge
          visible={showCompleteBadge}
          message={
            currentExercise.phase === 'warmup' ? '🔥 Warmed Up!'
              : currentExercise.phase === 'cooldown' ? '❄️ Recovery!'
              : ['Nice!', 'Strong!', 'Crushed it!', 'Beast mode!', 'Solid!'][currentExerciseIndex % 5]
          }
          color={
            currentExercise.phase === 'warmup' ? theme.colors.success
              : currentExercise.phase === 'cooldown' ? theme.colors.blue
              : theme.colors.success
          }
        />

        {/* ═══ MIND EXERCISE: completely different experience ═══ */}
        {currentExercise.mindTimeline ? (
          <MindExerciseView
            exerciseName={currentExercise.name}
            timeline={currentExercise.mindTimeline}
            voiceEnabled={voiceEnabled}
            onComplete={() => {
              if (__DEV__) console.log('[FitQuest] Mind exercise completed:', currentExercise.name);
              haptic('exerciseComplete');
              setShowCompleteBadge(true);
              setTimeout(() => setShowCompleteBadge(false), 1300);
              completeExercise(5);
            }}
            onCancel={() => {
              speakCancelRef.current++;
              audioService.stop();
              Alert.alert(
                'End Mind Session?',
                'Your progress for this exercise will be saved.',
                [
                  { text: 'Continue', style: 'cancel' },
                  { text: 'End', style: 'destructive', onPress: () => {
                    completeExercise(5);
                  }},
                ]
              );
            }}
          />
        ) : (
        <ScrollView contentContainerStyle={[styles.exerciseContent, isCompactScreen && styles.exerciseContentCompact]} showsVerticalScrollIndicator={false}>
          {/* Phase Banner for warmup/cooldown — shows phase + position within phase */}
          {currentExercise.phase === 'warmup' && (() => {
            const warmups = workout.exercises.filter(e => e.phase === 'warmup');
            const posInPhase = warmups.findIndex(e => e.id === currentExercise.id) + 1;
            return (
              <Animated.View entering={FadeIn.duration(150)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <View style={[styles.phaseTag, { backgroundColor: theme.colors.success + '18', alignSelf: 'center' }]}>
                  <MaterialCommunityIcons name="fire" size={16} color={theme.colors.success} />
                  <Text style={[styles.phaseTagText, { color: theme.colors.success }]}>
                    {t('fitquest.warmUp') || 'Warm Up'} {posInPhase}/{warmups.length}
                  </Text>
                </View>
              </Animated.View>
            );
          })()}
          {currentExercise.phase === 'cooldown' && (() => {
            const cooldowns = workout.exercises.filter(e => e.phase === 'cooldown');
            const posInPhase = cooldowns.findIndex(e => e.id === currentExercise.id) + 1;
            return (
              <Animated.View entering={FadeIn.duration(150)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <View style={[styles.phaseTag, { backgroundColor: theme.colors.blue + '18', alignSelf: 'center' }]}>
                  <MaterialCommunityIcons name="snowflake" size={16} color={theme.colors.blue} />
                  <Text style={[styles.phaseTagText, { color: theme.colors.blue }]}>
                    {t('fitquest.coolDown') || 'Cool Down'} {posInPhase}/{cooldowns.length}
                  </Text>
                </View>
              </Animated.View>
            );
          })()}

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
                    <TouchableOpacity onPress={() => setShowAllInstructions(!showAllInstructions)} style={{ marginTop: 8 }} accessibilityRole="button" accessibilityLabel={showAllInstructions ? 'Show less instructions' : 'Show all instructions'}>
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
              accessibilityRole="button"
              accessibilityLabel={t('train.skip')}
              onPress={() => {
                speakCancelRef.current++;
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
                title={
                  isLastExercise ? t('fitquest.finishWorkout')
                    : (currentExercise.phase === 'warmup' || currentExercise.phase === 'cooldown')
                      ? 'Done →'
                      : t('fitquest.completeSet')
                }
                icon={isLastExercise ? "check-all" : (currentExercise.phase === 'warmup' || currentExercise.phase === 'cooldown') ? "arrow-right" : "check"}
                onPress={async () => {
                  if (isResting) return;
                  if (__DEV__) {
                    console.log('[FitQuest] Action:complete_or_next', {
                    isLastExercise,
                    index: currentExerciseIndex,
                    total: workout.exercises.length,
                    });
                  }
                  speakCancelRef.current++;
                  audioService.stop();
                  stopAll();
                  setShowAllInstructions(false);

                  if (isLastExercise) {
                    // Complete with default difficulty (skip RPE — user rates at the end)
                    completeExercise(5);
                    haptic('workoutComplete');
                    setShowConfetti(true);
                    // Stop ALL narration immediately — no yapping on completion
                    speakCancelRef.current++;
                    audioService.stop();
                    // Light completion: just vibration, no voice (user requested instant silence)
                    Vibration.vibrate([0, 100, 80, 100, 80, 200]);
                    if (__DEV__) console.log('[FitQuest] Last exercise completed — waiting for useEffect to trigger handleFinish');
                  } else {
                    const currentPhase = currentExercise.phase || 'main';
                    const nextExercise = workout.exercises[currentExerciseIndex + 1];

                    // Warmup & Cooldown: lighter flow — quick transition, no heavy rest
                    if (currentPhase === 'warmup' || currentPhase === 'cooldown') {
                      haptic(currentPhase === 'warmup' ? 'warmupComplete' : 'cooldownComplete');
                      setShowCompleteBadge(true);
                      setTimeout(() => setShowCompleteBadge(false), 1300);

                      // Detect phase boundary (warmup→main or main→cooldown)
                      const nextPhase = nextExercise?.phase || 'main';
                      const phaseChanging = nextPhase !== currentPhase;

                      if (phaseChanging) {
                        // Phase transition: brief pause then auto-advance (phase announcement handles narration)
                        completeExercise(5);
                        haptic('phaseTransition');
                      } else if (nextExercise) {
                        // Same phase: quick 2-second "Get Ready" then advance
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
                        // Short auto-rest for warmup/cooldown (keeps pace up)
                        setIsResting(true);
                        startRest(currentPhase === 'warmup' ? 10 : 8);
                      }
                      if (__DEV__) {
                        console.log(`[FitQuest] ${currentPhase} exercise done`, {
                        phaseChanging,
                        nextPhase,
                        next: nextExercise?.name,
                        });
                      }
                    } else {
                      // Main exercises: full rest timer with breathing guide
                      // Play transition narration (rich: "Well done! Rest for Xs. Up next: Y")
                      audioService.stop(); // Stop any ongoing narration first
                      const transitionAudio = {
                        intro: currentExercise.audioIntro,
                        setup: currentExercise.audioSetup,
                        execution: currentExercise.audioExecution,
                        transition: currentExercise.audioTransition,
                      };
                      try {
                        await audioService.playTransition(transitionAudio);
                      } catch (e) {
                        if (__DEV__) console.warn('[FitQuest] Transition audio error (non-fatal):', e);
                      }
                      if (__DEV__) {
                        console.log('[FitQuest] Set complete — entering rest overlay immediately', {
                        currentExercise: currentExercise.name,
                        nextExercise: nextExercise?.name,
                        });
                      }
                      haptic('exerciseComplete');
                      setShowCompleteBadge(true);
                      setTimeout(() => setShowCompleteBadge(false), 1300);
                      pendingExerciseAdvanceRef.current = true;
                      setIsResting(true);
                      const restDuration = currentExercise.restSeconds || 60;
                      startRest(restDuration);
                    }
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
                { text: t('common.cancel'), style: 'destructive', onPress: () => { speakCancelRef.current++; audioService.stop(); stopAll(); cancelWorkout(); } },
              ]);
            }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{t('fitquest.cancelWorkout')}</Text>
          </TouchableOpacity>
        </ScrollView>
        )}
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
  scrollContent: { paddingBottom: 100 },
  loadingIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  errorSub: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  genTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  genSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
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
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  phaseTagText: { fontSize: 13, fontWeight: '600' },
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
  segmentedBarWrap: {
    flexDirection: 'row',
    height: 5,
    gap: 2,
    paddingHorizontal: 0,
  },
  segmentedBarSegment: {
    height: 5,
    backgroundColor: 'rgba(128,128,128,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentedBarFill: {
    height: 5,
    borderRadius: 3,
  },
  segmentedBarPulse: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: 5,
    borderRadius: 3,
  },
  exerciseContent: { padding: 16, paddingBottom: 100 },
  exerciseContentCompact: { paddingBottom: 110 },
  // ═══ REST / GET-READY overlays are in separate components ═══
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
    <ScreenErrorBoundary screenName="FitQuest" onGoBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}>
      <PremiumGate featureName="AI Workout Generator">
        <ScreenTutorial
          screenKey="fitquest"
          icon="sword-cross"
          title="FitQuest Training"
          description="Your personalized workout generator. Tap 'Generate Workout' to get an AI-tailored exercise session based on your goals, equipment, and recovery status."
        />
        <FitQuestScreenInner />
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}
