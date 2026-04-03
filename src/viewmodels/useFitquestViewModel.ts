/**
 * FitQuest Screen ViewModel
 * Encapsulates audio management, trial gating, and workout state persistence.
 * Screen handles workout lifecycle (useFitQuestWorkout), timer (useTimer), and all UI state.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { createViewModel } from './createViewModel';
import { audioService } from '../services/audioService';
import { setAppState } from '../database/service';
import { getTrialSnapshot, type TrialSnapshot } from '../engines/TrialProgressionEngine';

interface NarrableExercise {
  id: string;
  phase?: string;
  audioIntro?: string;
  audioSetup?: string;
  audioExecution?: string;
  audioTransition?: string;
}

interface ComplimentData {
  completedCount: number;
  totalCount: number;
  durationSeconds: number;
  streakDays: number;
  xpEarned: number;
  levelUp: boolean;
  newLevel?: number;
  progressions: number;
  exerciseNames: string[];
}

interface CompletionResult {
  completedCount: number;
  totalCount: number;
  durationSeconds: number;
  streak?: { current: number };
  xpEarned: number;
  exerciseNames?: string[];
}

export type { TrialSnapshot };

export const useFitquestViewModel = createViewModel(() => {
  // --- Audio state ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const speakCancelRef = useRef(0);
  const lastSpokenExerciseRef = useRef<string | null>(null);
  const lastAnnouncedPhaseRef = useRef<string | null>(null);

  // --- Trial state ---
  const [trialSnapshot, setTrialSnapshot] = useState<TrialSnapshot | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    audioService
      .initialize('user_local_001')
      .then(() => {
        const settings = audioService.getSettings();
        setVoiceEnabled(settings.voiceEnabled);
      })
      .catch((e) => {
        if (__DEV__) console.warn('[FitQuest] Audio init skipped:', e);
      });
    return () => {
      audioService.stop();
    };
  }, []);

  /** Cancel any in-flight narration and stop audio output */
  const cancelNarration = useCallback(() => {
    speakCancelRef.current++;
    audioService.stop();
    setIsSpeaking(false);
  }, []);

  /** Reset narration tracking for new workout or new cycle */
  const resetNarrationState = useCallback(() => {
    lastSpokenExerciseRef.current = null;
    lastAnnouncedPhaseRef.current = null;
  }, []);

  /** Full narration chain for current exercise (intro → setup → execution) */
  const speakExercise = useCallback(
    async (exercise: NarrableExercise) => {
      if (!voiceEnabled) return;
      if (lastSpokenExerciseRef.current === exercise.id) return;
      lastSpokenExerciseRef.current = exercise.id;
      const token = ++speakCancelRef.current;

      try {
        setIsSpeaking(true);

        // Phase transition announcement
        const currentPhase = exercise.phase || 'main';
        if (lastAnnouncedPhaseRef.current !== currentPhase) {
          const fromPhase = lastAnnouncedPhaseRef.current as 'warmup' | 'main' | 'cooldown' | null;
          lastAnnouncedPhaseRef.current = currentPhase;
          await audioService.playPhaseTransition(fromPhase, currentPhase as 'warmup' | 'main' | 'cooldown');
          if (speakCancelRef.current !== token) return;
          await new Promise((r) => setTimeout(r, 800));
          if (speakCancelRef.current !== token) return;
        }

        const audioData = {
          intro: exercise.audioIntro ?? '',
          setup: exercise.audioSetup ?? '',
          execution: exercise.audioExecution ?? '',
          transition: exercise.audioTransition ?? '',
        };
        await audioService.playIntro(audioData);
        if (speakCancelRef.current !== token) return;
        await audioService.playSetup(audioData);
        if (speakCancelRef.current !== token) return;
        await new Promise((r) => setTimeout(r, 600));
        if (speakCancelRef.current !== token) return;
        await audioService.playExecution(audioData);
        if (speakCancelRef.current !== token) return;
        setIsSpeaking(false);
      } catch (e) {
        if (__DEV__) console.warn('[FitQuest] Narration error (non-fatal):', e);
        setIsSpeaking(false);
      }
    },
    [voiceEnabled],
  );

  /** Toggle voice guidance on/off */
  const toggleVoice = useCallback(async () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    await audioService.updateSettings('user_local_001', { voiceEnabled: newValue });
    if (!newValue) audioService.stop();
  }, [voiceEnabled]);

  /** Load trial snapshot for feature gating */
  const loadTrialSnapshot = useCallback(async (isSubscribed: boolean) => {
    try {
      const snap = await getTrialSnapshot('user_local_001', isSubscribed);
      setTrialSnapshot(snap);
    } catch (e) {
      if (__DEV__) console.warn('[FitQuest] trial snapshot failed', e);
    }
  }, []);

  /** Play transition audio between exercises */
  const playTransitionAudio = useCallback(async (exercise: NarrableExercise) => {
    audioService.stop();
    try {
      await audioService.playTransition({
        intro: exercise.audioIntro ?? '',
        setup: exercise.audioSetup ?? '',
        execution: exercise.audioExecution ?? '',
        transition: exercise.audioTransition ?? '',
      });
    } catch (e) {
      if (__DEV__) console.warn('[FitQuest] Transition audio error (non-fatal):', e);
    }
  }, []);

  /** Play context-aware workout completion compliment */
  const playWorkoutCompliment = useCallback((data: ComplimentData) => {
    try {
      audioService.playWorkoutCompliment(data);
    } catch (e) {
      if (__DEV__) console.warn('[FitQuest] Compliment narration error (non-fatal):', e);
    }
  }, []);

  /** Persist last workout summary for AI Coach context */
  const storeLastWorkout = useCallback((result: CompletionResult) => {
    setAppState(
      'last_completed_workout',
      JSON.stringify({
        completedCount: result.completedCount,
        totalCount: result.totalCount,
        durationSeconds: result.durationSeconds,
        streakDays: result.streak?.current ?? 0,
        xpEarned: result.xpEarned,
        exerciseNames: result.exerciseNames,
        completedAt: Date.now(),
      }),
    ).catch((e) => {
      if (__DEV__) console.warn('[FitQuest] Failed to store last workout:', e);
    });
  }, []);

  return {
    isSpeaking,
    voiceEnabled,
    trialSnapshot,
    cancelNarration,
    speakExercise,
    toggleVoice,
    loadTrialSnapshot,
    playTransitionAudio,
    playWorkoutCompliment,
    storeLastWorkout,
    resetNarrationState,
  };
});
