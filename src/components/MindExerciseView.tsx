/**
 * MindExerciseView
 *
 * A completely different exercise experience for focus/mindfulness exercises.
 * Instead of reps, sets, and rest timers, this shows:
 *   - A breathing circle that pulses with the prescribed pattern
 *   - Phase indicator (Prepare → Guided Practice → Silent Practice → Return)
 *   - Elapsed time (subtle, non-intrusive)
 *   - Narration delivered via TTS at the right moments
 *   - No countdown, no reps, no urgency
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, Vibration } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { audioService } from '../services/audioService';
import type { MindTimeline, MindPhase, MindPhaseType, BreathingPattern } from '../engines/MindSessionEngine';
import { typography, spacing } from '../design/theme-system';


// Grandmaster-style breathing narration — short, calm, varied
const BREATH_CUES = {
  inhale: [
    'Breathe in',
    'Inhale',
    'Draw the breath in',
    'In through the nose',
    'Fill your lungs',
    'Breathe in, deeply',
  ],
  holdIn: ['Hold', 'Hold gently', 'Pause here', 'Stay', 'Hold it in'],
  exhale: ['Release', 'Let it go', 'Exhale slowly', 'Breathe out', 'Let the breath flow out', 'Release, gently'],
  holdOut: ['Rest', 'Be still', 'Wait', 'Empty and still', 'Pause'],
} as const;

type BreathPhaseKey = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

/** Get detailed breath phase from elapsed time within a breathing pattern. */
function getDetailedBreathPhase(elapsed: number, b: BreathingPattern): BreathPhaseKey | null {
  const cycle = b.inhale + b.holdIn + b.exhale + b.holdOut;
  if (cycle === 0) return null;
  const pos = elapsed % cycle;
  if (pos < b.inhale) return 'inhale';
  if (pos < b.inhale + b.holdIn) return 'holdIn';
  if (pos < b.inhale + b.holdIn + b.exhale) return 'exhale';
  return 'holdOut';
}

interface MindExerciseViewProps {
  exerciseName: string;
  timeline: MindTimeline;
  onComplete: () => void;
  onCancel: () => void;
  voiceEnabled: boolean;
}

function MindExerciseView({
  exerciseName,
  timeline,
  onComplete,
  onCancel,
  voiceEnabled,
}: MindExerciseViewProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [hasSpokenPhase, setHasSpokenPhase] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakCancelRef = useRef(0);

  // Breathing narration tracking
  const prevBreathPhaseRef = useRef<BreathPhaseKey | null>(null);
  const breathCueIndexRef = useRef<Record<BreathPhaseKey, number>>({
    inhale: 0,
    holdIn: 0,
    exhale: 0,
    holdOut: 0,
  });

  // Reset all state when exercise changes (prevents timer bug on 2nd+ exercise)
  const prevExerciseRef = useRef(exerciseName);
  useEffect(() => {
    if (prevExerciseRef.current !== exerciseName) {
      prevExerciseRef.current = exerciseName;
      setCurrentPhaseIndex(0);
      setPhaseElapsed(0);
      setTotalElapsed(0);
      setIsActive(true);
      setHasSpokenPhase(false);
      phaseStartRef.current = Date.now();
      sessionStartRef.current = Date.now();
      prevBreathPhaseRef.current = null;
      speakCancelRef.current++;
      audioService.stop();
    }
  }, [exerciseName]);

  const currentPhase = React.useMemo(() => {
    return timeline.phases[currentPhaseIndex];
  }, [timeline.phases, currentPhaseIndex]);
  const breathingCircleSize = Math.min(width * 0.55, 220);

  // Breathing animation
  const breathScale = useSharedValue(1);
  const breathOpacity = useSharedValue(0.4);

  const startBreathingAnimation = useCallback(
    (pattern: BreathingPattern) => {
      const _cycleDuration = (pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut) * 1000;
      const inhaleMs = pattern.inhale * 1000;
      const holdInMs = pattern.holdIn * 1000;
      const exhaleMs = pattern.exhale * 1000;
      const holdOutMs = pattern.holdOut * 1000;

      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: inhaleMs, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.35, { duration: holdInMs }),
          withTiming(1.0, { duration: exhaleMs, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: holdOutMs }),
        ),
        -1, // infinite repeat
        false,
      );
      breathOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: inhaleMs, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.7, { duration: holdInMs }),
          withTiming(0.3, { duration: exhaleMs, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: holdOutMs }),
        ),
        -1,
        false,
      );
    },
    [breathScale, breathOpacity],
  );

  const stopBreathingAnimation = useCallback(() => {
    cancelAnimation(breathScale);
    cancelAnimation(breathOpacity);
    breathScale.value = withTiming(1, { duration: 800 });
    breathOpacity.value = withTiming(0.3, { duration: 800 });
  }, [breathScale, breathOpacity]);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
    opacity: breathOpacity.value,
  }));

  // Speak narration for current phase
  useEffect(() => {
    if (!voiceEnabled || !currentPhase?.narration || hasSpokenPhase) return;

    const cancelToken = speakCancelRef.current;
    setHasSpokenPhase(true);

    // Slight delay for bell phases
    const delay = currentPhase.bellAtStart ? 800 : 200;
    const timer = setTimeout(() => { // debounce
      if (cancelToken !== speakCancelRef.current) return;
      if (currentPhase.narration) {
        audioService.speakNarration(currentPhase.narration);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentPhaseIndex, voiceEnabled, hasSpokenPhase, currentPhase]);

  // Start/stop breathing animation based on current phase
  useEffect(() => {
    if (currentPhase?.breathing) {
      startBreathingAnimation(currentPhase.breathing);
    } else {
      stopBreathingAnimation();
    }
    return () => stopBreathingAnimation();
  }, [currentPhaseIndex, currentPhase, startBreathingAnimation, stopBreathingAnimation]);

  // Vibrate gently for bell cues
  useEffect(() => {
    if (currentPhase?.bellAtStart) {
      Vibration.vibrate([0, 60, 40, 60]); // Gentle double-pulse (bell)
    }
  }, [currentPhaseIndex, currentPhase]);

  // Main timer
  // Track phase start time via ref to avoid stale state in interval callback
  const phaseStartRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());

  // Reset refs when phase changes
  useEffect(() => {
    if (currentPhaseIndex === 0) {
      sessionStartRef.current = Date.now();
    }
    phaseStartRef.current = Date.now();
  }, [currentPhaseIndex]);

  useEffect(() => {
    if (!isActive) return;

    if (__DEV__) {
      console.warn('[MindExercise] start timer', {
        currentPhaseIndex,
        phaseDuration: timeline.phases[currentPhaseIndex]?.duration,
        isActive,
      });
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const newTotal = Math.floor((now - sessionStartRef.current) / 1000);
      const newPhaseElapsed = Math.floor((now - phaseStartRef.current) / 1000);

      setTotalElapsed(newTotal);
      setPhaseElapsed(newPhaseElapsed);

      // Speak breathing cues when the breath phase transitions
      const phase = timeline.phases[currentPhaseIndex];
      if (voiceEnabled && phase?.breathing) {
        const currentBreathPhase = getDetailedBreathPhase(newPhaseElapsed, phase.breathing);
        if (currentBreathPhase && currentBreathPhase !== prevBreathPhaseRef.current) {
          prevBreathPhaseRef.current = currentBreathPhase;
          const cues = BREATH_CUES[currentBreathPhase];
          const idx = breathCueIndexRef.current[currentBreathPhase] % cues.length;
          breathCueIndexRef.current[currentBreathPhase] = idx + 1;
          const cue = cues[idx];
          if (cue) audioService.speakNarration(cue);
        }
      }

      // Check if current phase is complete
      if (phase && newPhaseElapsed >= phase.duration) {
        // End bell
        if (phase.bellAtEnd) {
          Vibration.vibrate([0, 80, 50, 80]);
        }

        const nextIndex = currentPhaseIndex + 1;
        if (nextIndex >= timeline.phases.length) {
          // Session complete
          setIsActive(false);
          if (timerRef.current) clearInterval(timerRef.current);
          speakCancelRef.current++;
          audioService.stop();
          Vibration.vibrate([0, 100, 80, 100, 80, 200]);
          onComplete();
        } else {
          // Advance to next phase — ref update happens in the phase change effect
          setCurrentPhaseIndex(nextIndex);
          setPhaseElapsed(0);
          setHasSpokenPhase(false);
          prevBreathPhaseRef.current = null;
        }
      }
    }, 250); // Update 4x/sec for smooth progress

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, currentPhaseIndex, timeline.phases, onComplete, voiceEnabled]);

  // Cleanup on unmount

  useEffect(() => {
    return () => {
      speakCancelRef.current++;
      audioService.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Progress within current phase (0-1)
  const _phaseProgress = currentPhase ? Math.min(phaseElapsed / currentPhase.duration, 1) : 0;
  // Overall progress (0-1)
  const overallProgress = timeline.totalDuration > 0 ? Math.min(totalElapsed / timeline.totalDuration, 1) : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Phase icon
  const phaseIcon = (type: MindPhaseType): string => {
    switch (type) {
      case 'intro':
        return 'meditation';
      case 'guided':
        return 'account-voice';
      case 'silence':
        return 'ear-hearing-off';
      case 'breathing':
        return 'weather-windy';
      case 'closing':
        return 'white-balance-sunny';
      default:
        return 'meditation';
    }
  };

  // Archetype color
  const accentColor = (() => {
    switch (timeline.archetype) {
      case 'breathing':
        return theme.colors.accent;
      case 'meditation':
        return theme.colors.purple;
      case 'body_awareness':
        return theme.colors.blue;
      case 'grounding':
        return theme.colors.warning;
    }
  })();

  // Breathing label (inhale/hold/exhale indicator)
  const getBreathingLabel = (): string | null => {
    if (!currentPhase?.breathing) return null;
    const p = currentPhase.breathing;
    const cycleTime = p.inhale + p.holdIn + p.exhale + p.holdOut;
    if (cycleTime === 0) return null;
    const pos = phaseElapsed % cycleTime;
    if (pos < p.inhale) return 'Inhale';
    if (pos < p.inhale + p.holdIn) return 'Hold';
    if (pos < p.inhale + p.holdIn + p.exhale) return 'Exhale';
    return 'Hold';
  };

  const breathLabel = getBreathingLabel();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Subtle background glow */}
      <LinearGradient colors={[accentColor + '08', 'transparent', 'transparent']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Phase progress dots */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.phaseDots}>
          {timeline.phases.map((phase: MindPhase, i: number) => (
            <View key={i} style={styles.phaseDotWrap}>
              <View
                style={[
                  styles.phaseDot,
                  {
                    backgroundColor:
                      i < currentPhaseIndex ? accentColor : i === currentPhaseIndex ? accentColor : theme.colors.border,
                    opacity: i <= currentPhaseIndex ? 1 : 0.4,
                    width: i === currentPhaseIndex ? 24 : 8,
                  },
                ]}
              />
            </View>
          ))}
        </Animated.View>

        {/* Phase label */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.phaseHeader}>
          <MaterialCommunityIcons
            name={phaseIcon(currentPhase?.type || 'intro') as any}
            size={18}
            color={accentColor}
          />
          <Text style={[styles.phaseLabel, { color: accentColor }]}>{currentPhase?.label || 'Prepare'}</Text>
        </Animated.View>

        {/* Breathing circle */}
        <View style={[styles.circleContainer, { width: breathingCircleSize + 60, height: breathingCircleSize + 60 }]}>
          {/* Outer ring (overall progress) */}
          <View
            style={[
              styles.outerRing,
              { width: breathingCircleSize + 40, height: breathingCircleSize + 40, borderColor: accentColor + '15' },
            ]}
          />

          {/* Animated breathing circle */}
          <Animated.View
            style={[
              breathingStyle,
              styles.breathingCircle,
              {
                width: breathingCircleSize,
                height: breathingCircleSize,
                borderRadius: breathingCircleSize / 2,
              },
            ]}
          >
            <LinearGradient
              colors={[accentColor + '20', accentColor + '08']}
              style={[styles.breathingGradient, { borderRadius: breathingCircleSize / 2 }]}
            />
          </Animated.View>

          {/* Center content */}
          <View style={styles.circleCenter}>
            {breathLabel ? (
              <Text style={[styles.breathText, { color: accentColor }]}>{breathLabel}</Text>
            ) : currentPhase?.type === 'silence' ? (
              <MaterialCommunityIcons name="meditation" size={36} color={accentColor + '60'} />
            ) : (
              <MaterialCommunityIcons
                name={phaseIcon(currentPhase?.type || 'intro') as any}
                size={32}
                color={accentColor + '50'}
              />
            )}

            {/* Phase remaining */}
            {currentPhase && (
              <Text style={[styles.phaseTime, { color: theme.colors.textMuted }]}>
                {formatTime(Math.max(0, currentPhase.duration - phaseElapsed))}
              </Text>
            )}
          </View>
        </View>

        {/* Exercise name */}
        <Text style={[styles.exerciseName, { color: theme.colors.text }]}>{exerciseName}</Text>

        {/* Intention text */}
        <Text style={[styles.intentionText, { color: theme.colors.textMuted }]}>{timeline.intention}</Text>
      </ScrollView>

      {/* Fixed bottom: progress bar + cancel */}
      <View style={styles.bottomSection}>
        {/* Bottom bar: elapsed + progress */}
        <View style={styles.bottomBar}>
          <Text style={[styles.elapsedText, { color: theme.colors.textMuted }]}>{formatTime(totalElapsed)}</Text>

          {/* Overall progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${overallProgress * 100}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>

          <Text style={[styles.elapsedText, { color: theme.colors.textMuted }]}>
            {formatTime(timeline.totalDuration)}
          </Text>
        </View>

        {/* End early button */}
        <TouchableOpacity style={[styles.endButton, { borderColor: theme.colors.border }]} onPress={onCancel}>
          <Text style={[styles.endButtonText, { color: theme.colors.textMuted }]}>End Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },

  // Phase dots
  phaseDots: {
    flexDirection: 'row',
    gap: spacing[1.5],
    marginBottom: spacing[6],
  },
  phaseDotWrap: {
    justifyContent: 'center',
  },
  phaseDot: {
    height: 8,
    borderRadius: 4,
  },

  // Phase header
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[8],
  },
  phaseLabel: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Breathing circle
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[8],
  },
  outerRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  breathingCircle: {
    position: 'absolute',
    overflow: 'hidden',
  },
  breathingGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  circleCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathText: {
    fontSize: typography.sizes.h3, 
    fontWeight: '800',
    letterSpacing: 1,
  },
  phaseTime: {
    fontSize: typography.sizes.label, 
    fontWeight: '600',
    marginTop: spacing[1.5],
  },

  // Exercise info
  exerciseName: {
    fontSize: typography.sizes.h3, 
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  intentionText: {
    fontSize: typography.sizes.label, 
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[2],
    paddingHorizontal: spacing[5],
    lineHeight: 18,
  },

  // Bottom section (fixed)
  bottomSection: {
    paddingBottom: spacing[6],
    paddingTop: spacing[2],
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  elapsedText: {
    fontSize: typography.sizes.caption, 
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // End button
  endButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: 20,
    borderWidth: 1,
  },
  endButtonText: {
    fontSize: typography.sizes.label, 
    fontWeight: '600',
  },
});

export default React.memo(MindExerciseView);
