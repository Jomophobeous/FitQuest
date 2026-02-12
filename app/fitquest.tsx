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
import { useTimer, formatTime } from '../src/hooks/useTimer';
import { audioService, generateDefaultAudio } from '../src/services/audioService';
import {
  GlassCard,
  GradientButton,
  ProgressRing,
  PulseDot,
  SectionHeader,
} from '../src/components/ui/GlassUI';

export default function FitQuestScreen() {
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
    exerciseTimer,
    restTimer,
    sessionTimer,
    startExercise,
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

  // Initialize audio service
  useEffect(() => {
    const initAudio = async () => {
      try {
        await audioService.initialize('default_user');
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
          
          // Speak intro and setup sequentially
          await audioService.playIntro(audioData);
          await audioService.playSetup(audioData);
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
    await audioService.updateSettings('default_user', { voiceEnabled: newValue });
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
  
  // RPE rating shown AFTER completing a set (not during)
  const [showRPE, setShowRPE] = useState(false);
  // Collapsible instructions
  const [showAllInstructions, setShowAllInstructions] = useState(false);

  // Auto-generate on mount if ready and idle
  useEffect(() => {
    if (isReady && status === 'idle' && !completionResult) {
      // Small delay to let UI render first
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

  const handleFinish = async () => {
    const result = await finishWorkout();
    if (result) {
      setCompletionResult({
        summary: result.summary,
        streak: result.streak,
      });
      setWorkoutRating(null); // Reset rating for new workout
    }
  };

  const handleNewWorkout = () => {
    setCompletionResult(null);
    setWorkoutRating(null);
    generateNewWorkout();
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Database',
      'This will clear all data and start fresh. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetAll },
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
            Initializing FitQuest...
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
            Something went wrong
          </Text>
          <Text style={[styles.errorSub, { color: theme.colors.textSecondary }]}>
            {dbError || error}
          </Text>
          <GradientButton title="Reset & Retry" icon="refresh" onPress={handleReset} colors={[theme.colors.error, '#B91C1C']} />
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
            Workout Complete! 🎉
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
                Rate this workout
              </Text>
              <Text style={[styles.ratingSub, { color: theme.colors.textMuted }]}>
                How did the overall session feel?
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
              {workoutRating && (
                <Text style={[styles.ratingFeedback, { color: theme.colors.success }]}>
                  {workoutRating <= 2 ? 'Thanks for the feedback!' : workoutRating <= 3 ? 'Good workout!' : workoutRating === 4 ? 'Great session!' : 'Excellent! 💪'}
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
                    {completionResult.streak.current} Day Streak
                  </Text>
                  <Text style={[styles.streakSub, { color: theme.colors.textMuted }]}>
                    Best: {completionResult.streak.longest} days
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(140).duration(150)} style={{ marginTop: 28, width: '100%' }}>
            <GradientButton title="Generate New Workout" icon="refresh" onPress={handleNewWorkout} />
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
            Crafting your workout...
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(80).duration(150)} style={[styles.genSub, { color: theme.colors.textMuted }]}>
            Analyzing fatigue · Balancing patterns · Optimizing
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
                <Text style={[styles.readyTitle, { color: theme.colors.text }]}>Today's Workout</Text>
                {workout.isDeload && (
                  <View
                    style={[styles.deloadBadge, { backgroundColor: theme.colors.warning }]}
                  >
                    <Text style={styles.deloadBadgeText}>DELOAD</Text>
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
          {deloadStatus && (
            <Animated.View entering={FadeInDown.delay(200).duration(150)}>
              <GlassCard style={{ marginHorizontal: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MaterialCommunityIcons
                  name={deloadStatus.needed ? "battery-low" : "battery-high"}
                  size={24}
                  color={deloadStatus.needed ? theme.colors.warning : theme.colors.success}
                />
                <View>
                  <Text style={[styles.recoveryLabel, { color: theme.colors.text }]}>Recovery Status</Text>
                  <Text style={[styles.recoverySub, { color: theme.colors.textMuted }]}>{deloadStatus.reason}</Text>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {/* Exercise Count */}
          <SectionHeader
            title={`${workout.exercises.length} Exercises · ~${workout.totalDuration} min`}
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
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                },
              ]}>
                <View
                  style={[styles.exerciseNum, { backgroundColor: theme.colors.accent }]}
                >
                  <Text style={styles.exerciseNumText}>{index + 1}</Text>
                </View>
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
              title="Start Workout"
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
              <Text style={[styles.regenBtnText, { color: theme.colors.text }]}>Regenerate</Text>
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

        <ScrollView contentContainerStyle={styles.exerciseContent} showsVerticalScrollIndicator={false}>
          {/* Rest Timer Overlay */}
          {isResting && (
            <Animated.View entering={SlideInDown.duration(180)}>
              <GlassCard style={styles.restTimerCard}>
                <MaterialCommunityIcons name="timer-sand" size={28} color={theme.colors.warning} />
                <Text style={[styles.restTimerValue, { color: theme.colors.warning }]}>
                  {restTimer.formattedRemaining}
                </Text>
                <Text style={[styles.restTimerLabel, { color: theme.colors.textMuted }]}>Rest Time</Text>
                <TouchableOpacity
                  style={[styles.skipRestButton, { borderColor: theme.colors.border }]}
                  onPress={() => { skipRest(); setIsResting(false); }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 13 }}>Skip Rest →</Text>
                </TouchableOpacity>
              </GlassCard>
            </Animated.View>
          )}

          {/* Current Exercise */}
          <Animated.View entering={FadeIn.duration(150)} style={styles.currentExercise}>
            <Animated.View entering={ZoomIn.duration(150)}>
              <Text style={[styles.currentExName, { color: theme.colors.text }]}>
                {currentExercise.name}
              </Text>
            </Animated.View>

            <View style={styles.prescriptionRow}>
              {[
                { val: currentExercise.sets, label: 'Sets' },
                { val: currentExercise.reps, label: 'Reps' },
                { val: `${currentExercise.restSeconds}s`, label: 'Rest' },
              ].map((p, i) => (
                <Animated.View key={p.label} entering={FadeInUp.delay(i * 60).duration(150)} style={styles.prescriptionItem}>
                  <Text style={[styles.prescriptionVal, { color: theme.colors.text }]}>{p.val}</Text>
                  <Text style={[styles.prescriptionLabel, { color: theme.colors.textMuted }]}>{p.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Exercise Timer */}
            {exerciseTimer.state === 'running' && (
              <Animated.View entering={FadeIn.duration(180)} style={styles.exerciseTimerRow}>
                <MaterialCommunityIcons name="timer" size={18} color={theme.colors.success} />
                <Text style={[styles.exerciseTimerText, { color: theme.colors.success }]}>
                  {exerciseTimer.formattedRemaining}
                </Text>
              </Animated.View>
            )}

            {/* Instructions (show first 3, collapsible) */}
            {currentExercise.instructions.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200).duration(150)} style={{ width: '100%', marginTop: 24 }}>
                <GlassCard>
                  <Text style={[styles.instTitle, { color: theme.colors.text }]}>Form Tips</Text>
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
                        {showAllInstructions ? 'Show less' : `+${currentExercise.instructions.length - 3} more`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </GlassCard>
              </Animated.View>
            )}
          </Animated.View>

          {/* Start Exercise Timer */}
          {exerciseTimer.state !== 'running' && !isResting && (
            <Animated.View entering={FadeIn.delay(250).duration(150)}>
              <TouchableOpacity
                style={[styles.timerStartButton, { borderColor: theme.colors.accent }]}
                onPress={() => startExercise(currentExercise.restSeconds || 30)}
              >
                <MaterialCommunityIcons name="timer-outline" size={16} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.accent, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>
                  Start Timer ({currentExercise.restSeconds || 30}s)
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* RPE Rating - shown AFTER tapping Complete/Finish */}
          {showRPE && (
            <Animated.View entering={FadeInDown.duration(200)}>
              <Text style={[styles.diffPrompt, { color: theme.colors.text, fontWeight: '600', fontSize: 15 }]}>
                {isLastExercise ? 'Rate & Finish' : 'Rate this set'}
              </Text>
              <Text style={[{ color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 12 }]}>
                How hard did that feel? (1 = easy, 9 = max effort)
              </Text>
              <View style={styles.difficultyRow}>
                {[
                  { level: 1, label: '1' },
                  { level: 3, label: '3' },
                  { level: 5, label: '5' },
                  { level: 7, label: '7' },
                  { level: 9, label: '9' },
                ].map(({ level, label }) => {
                  const btnColor = level <= 3 ? theme.colors.success : level <= 5 ? theme.colors.warning : theme.colors.error;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.difficultyButton, { backgroundColor: btnColor }]}
                      onPress={async () => {
                        setShowRPE(false);
                        setShowAllInstructions(false);
                        
                        // Play completion sound
                        const nextExercise = !isLastExercise ? workout.exercises[currentExerciseIndex + 1] : null;
                        
                        // Complete the exercise with the RPE rating
                        completeExercise(level);
                        
                        if (isLastExercise) {
                          // Last exercise — play workout complete sound then finish
                          await audioService.playWorkoutComplete();
                          // Small delay to let state update (completeExercise sets status='completed')
                          setTimeout(() => handleFinish(), 100);
                        } else {
                          await audioService.playExerciseFinished(nextExercise?.name);
                          setIsResting(true);
                          startRest(currentExercise.restSeconds || 60);
                          setTimeout(() => setIsResting(false), (currentExercise.restSeconds || 60) * 1000);
                        }
                      }}
                    >
                      <Text style={styles.difficultyText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Action Buttons - shown when NOT rating RPE */}
          {!showRPE && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: theme.colors.border }]}
              onPress={() => {
                // Stop voice and timer when skipping
                audioService.stop();
                stopAll();
                setShowAllInstructions(false);
                skipExercise();
              }}
            >
              <Text style={{ color: theme.colors.textMuted, fontWeight: '600' }}>Skip</Text>
            </TouchableOpacity>

            <View style={{ flex: 2 }}>
              <GradientButton
                title={isLastExercise ? "Finish Workout" : "Complete Set"}
                icon={isLastExercise ? "check-all" : "check"}
                onPress={() => {
                  // Stop voice and timer immediately
                  audioService.stop();
                  stopAll();
                  // Show RPE rating (same flow for ALL exercises including last)
                  setShowRPE(true);
                }}
                variant={isLastExercise ? "success" : "primary"}
              />
            </View>
          </View>
          )}

          {/* Cancel */}
          <TouchableOpacity
            style={{ marginTop: 24, alignItems: 'center' }}
            onPress={() => {
              Alert.alert('Cancel Workout', 'Are you sure? Progress will be lost.', [
                { text: 'Keep Going', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: () => { audioService.stop(); stopAll(); cancelWorkout(); } },
              ]);
            }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Cancel Workout</Text>
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
          <Text style={[styles.genTitle, { color: theme.colors.text }]}>Recording progress...</Text>
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
          Intelligent workout generation powered by{'\n'}three engines working in harmony
        </Animated.Text>

        {userProfile && (
          <Animated.View entering={FadeInDown.delay(400).duration(150)} style={{ width: '100%', maxWidth: 280 }}>
            <GlassCard style={{ alignItems: 'center', padding: 16, marginTop: 20 }}>
              <Text style={[styles.profileLabel, { color: theme.colors.textMuted }]}>Current Profile</Text>
              <Text style={[styles.profileGoal, { color: theme.colors.text }]}>{userProfile.goal}</Text>
              <Text style={[styles.profileMeta, { color: theme.colors.textMuted }]}>
                {userProfile.experience} · {userProfile.time_per_session_minutes}min sessions
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(500).duration(150)} style={{ marginTop: 24, width: '100%', maxWidth: 280 }}>
          <GradientButton title="Generate Workout" icon="lightning-bolt" onPress={generateNewWorkout} />
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
  completionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  readyHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  readyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readyTitle: { fontSize: 24, fontWeight: '700' },
  deloadBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  deloadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  exerciseNumText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  exerciseTimerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
  exerciseTimerText: { fontSize: 20, fontWeight: '700' },
  instTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  instStep: { fontSize: 14, marginBottom: 4, lineHeight: 20 },
  timerStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 16,
  },
  diffPrompt: { textAlign: 'center', marginTop: 24, fontSize: 13 },
  difficultyRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  difficultyButton: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  difficultyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  skipButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  idleIconWrap: { width: 120, height: 120, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  idleTitle: { fontSize: 28, fontWeight: '700', marginTop: 20 },
  idleSub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  profileLabel: { fontSize: 12 },
  profileGoal: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  profileMeta: { fontSize: 12, marginTop: 2 },
});
