/**
 * FitQuest Audio Hook
 * React hook for audio instruction integration
 */

import { useState, useEffect, useCallback } from 'react';
import { audioService, AudioSettings, ExerciseAudio, generateDefaultAudio } from '../services/audioService';
import { DEFAULT_USER_ID } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';

export interface UseAudioReturn {
  settings: AudioSettings;
  isPlaying: boolean;
  currentPhase: string | null;
  updateSettings: (settings: Partial<AudioSettings>) => Promise<void>;
  playIntro: (audio: ExerciseAudio) => Promise<void>;
  playSetup: (audio: ExerciseAudio) => Promise<void>;
  playExecution: (audio: ExerciseAudio) => Promise<void>;
  playTransition: (audio: ExerciseAudio) => Promise<void>;
  playCountdown: (seconds: number) => Promise<void>;
  playComplete: () => Promise<void>;
  stop: () => void;
  generateAudio: (name: string, restSeconds?: number) => ExerciseAudio;
}

export function useAudio(): UseAudioReturn {
  const [settings, setSettings] = useState<AudioSettings>(audioService.getSettings());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const { language, t } = useLanguage();

  // Sync TTS language and translator whenever the app language changes
  useEffect(() => {
    audioService.setLanguage(language);
    audioService.setTranslator(t);
  }, [language, t]);

  useEffect(() => {
    // Initialize audio service
    audioService.initialize(DEFAULT_USER_ID);

    // Subscribe to audio events
    const unsubscribe = audioService.subscribe((event, text) => {
      setCurrentPhase(event);
      setIsPlaying(audioService.isPlaying());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AudioSettings>) => {
    await audioService.updateSettings(DEFAULT_USER_ID, newSettings);
    setSettings(audioService.getSettings());
  }, []);

  const playIntro = useCallback(async (audio: ExerciseAudio) => {
    await audioService.playIntro(audio);
  }, []);

  const playSetup = useCallback(async (audio: ExerciseAudio) => {
    await audioService.playSetup(audio);
  }, []);

  const playExecution = useCallback(async (audio: ExerciseAudio) => {
    await audioService.playExecution(audio);
  }, []);

  const playTransition = useCallback(async (audio: ExerciseAudio) => {
    await audioService.playTransition(audio);
  }, []);

  const playCountdown = useCallback(async (seconds: number) => {
    await audioService.playCountdown(seconds);
  }, []);

  const playComplete = useCallback(async () => {
    await audioService.playComplete();
  }, []);

  const stop = useCallback(() => {
    audioService.stop();
    setIsPlaying(false);
    setCurrentPhase(null);
  }, []);

  const generateAudio = useCallback(
    (name: string, restSeconds?: number) => {
      return generateDefaultAudio(name, restSeconds, t);
    },
    [t],
  );

  return {
    settings,
    isPlaying,
    currentPhase,
    updateSettings,
    playIntro,
    playSetup,
    playExecution,
    playTransition,
    playCountdown,
    playComplete,
    stop,
    generateAudio,
  };
}
