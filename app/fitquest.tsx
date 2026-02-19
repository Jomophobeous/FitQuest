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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDatabase } from '../src/context/DatabaseContext';
import { useFitQuestWorkout, WorkoutExerciseDisplay, WorkoutCompletionData } from '../src/hooks/useFitQuestWorkout';
import WorkoutSummaryView from '../src/components/WorkoutSummaryView';
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
import RestTimerOverlay from '../src/components/RestTimerOverlay';
import GetReadyOverlay from '../src/components/GetReadyOverlay';
import ConfettiBurst from '../src/components/ConfettiBurst';
import ExerciseCompleteBadge from '../src/components/ExerciseCompleteBadge';
import { haptic } from '../src/utils/haptics';
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
      // Timer ended naturally → show Get-Ready countdown before next exercise
      const next = workout!.exercises[nextIdx];
      const curr = workout!.exercises[currentExerciseIndex];
      // Detect category change as proxy for equipment change
      const categoryChanged = curr && next && curr.category !== next.category;
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
      console.log('[FitQuest] Rest ended — showing Get Ready', { nextExercise: next.name, categoryChanged });
    } else {
      // Skipped rest or no next exercise → advance immediately
      completeExercise(5);
      Vibration.vibrate(20);
      console.log('[FitQuest] Rest ended — advancing immediately', { reason });
    }
  };

  const handleGetReadyDone = useCallback(() => {
    setIsGetReady(false);
    setGetReadyExercise(null);
    completeExercise(5);
    Vibration.vibrate(20);
    console.log('[FitQuest] Get-Ready done — next exercise');
  }, [completeExercise]);

  const handleExtendRest = useCallback((seconds: number) => {
    extendRest(seconds);
    console.log('[FitQuest] Rest extended +' + seconds + 's');
  }, [extendRest]);

  const handleFinish = async () => {
    console.log('[FitQuest] handleFinish called — processing workout completion');
    const result = await finishWorkout();
    if (result) {
      console.log('[FitQuest] Workout finished successfully — showing completion screen');
      setCompletionResult(result);
      setWorkoutRating(null);
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

          {/* Cool-Down Section (P6) */}
          {workout.cooldown && workout.cooldown.length > 0 && (
            <>
              <Animated.View entering={FadeInDown.delay(380).duration(150)} style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 4 }}>
                <View style={[styles.phaseTag, { backgroundColor: '#3B82F6' + '18' }]}>
                  <MaterialCommunityIcons name="snowflake" size={16} color="#3B82F6" />
                  <Text style={[styles.phaseTagText, { color: '#3B82F6' }]}>
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
                    { backgroundColor: theme.colors.surfaceVariant, borderColor: '#3B82F6' + '30' },
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
        {/* ═══ REST TIMER OVERLAY (P2) ═══ */}
        <RestTimerOverlay
          visible={!!isResting}
          progress={restTimer.progress}
          formattedRemaining={restTimer.formattedRemaining}
          remaining={restTimer.remaining}
          nextExercise={workout.exercises[currentExerciseIndex + 1] ? {
            exerciseId: workout.exercises[currentExerciseIndex + 1].exerciseId,
            name: workout.exercises[currentExerciseIndex + 1].name,
            category: workout.exercises[currentExerciseIndex + 1].category,
            sets: workout.exercises[currentExerciseIndex + 1].sets,
            reps: workout.exercises[currentExerciseIndex + 1].reps,
          } : undefined}
          onSkip={() => {
            console.log('[FitQuest] Rest skipped by user');
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

        {/* Exercise Complete Badge (P7) */}
        <ExerciseCompleteBadge visible={showCompleteBadge} message="Nice!" color={theme.colors.success} />

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
                    haptic('workoutComplete');
                    setShowConfetti(true);
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
                    haptic('exerciseComplete');
                    setShowCompleteBadge(true);
                    setTimeout(() => setShowCompleteBadge(false), 1300);
                    pendingExerciseAdvanceRef.current = true;
                    setIsResting(true);
                    const restDuration = currentExercise.restSeconds || 60;
                    startRest(restDuration);
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
  exerciseContent: { padding: 16, paddingBottom: 32 },
  exerciseContentCompact: { paddingBottom: 56 },
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
    <ScreenErrorBoundary screenName="FitQuest" onGoBack={() => router.back()}>
      <FitQuestScreenInner />
    </ScreenErrorBoundary>
  );
}
