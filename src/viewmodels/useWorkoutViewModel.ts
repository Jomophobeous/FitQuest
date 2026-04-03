/**
 * Workout ViewModel
 *
 * Wraps audio service calls (stop, speakNarration) used during active workout execution.
 * Screen keeps: all workout engine hooks, timer hooks, UI state, navigation.
 */

import { useCallback, useEffect } from 'react';
import { createViewModel } from './createViewModel';
import { audioService } from '../services/audioService';

export const useWorkoutViewModel = createViewModel(() => {
  // Stop narration on unmount
  useEffect(() => {
    return () => { audioService.stop(); };
  }, []);

  const stopAudio = useCallback(() => {
    audioService.stop();
  }, []);

  const speakNarration = useCallback((text: string) => {
    audioService.speakNarration(text);
  }, []);

  return { stopAudio, speakNarration };
});
