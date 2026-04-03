/**
 * Create Workout Screen ViewModel
 * Encapsulates exercise loading, workout persistence, audio narration, and sync notification.
 */
import { useState, useCallback, useRef } from 'react';
import { createViewModel } from './createViewModel';
import { getExercises, createWorkoutSession, addSessionExercise } from '../database/service';
import { notifyCustomWorkoutCreated } from '../services/dataSyncService';
import { audioService } from '../services/audioService';
import type { ExerciseWithDetails } from '../database/types';

interface SelectedExercise {
  exercise: ExerciseWithDetails;
  sets: number;
  reps: string;
  restSeconds: number;
}

export const useCreateWorkoutViewModel = createViewModel(() => {
  const [allExercises, setAllExercises] = useState<ExerciseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const savingRef = useRef(false);

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      const exercises = await getExercises();
      setAllExercises(exercises);
    } catch (error) {
      if (__DEV__) console.error('[CreateWorkout] Failed to load exercises:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWorkout = useCallback(
    async (opts: {
      selected: SelectedExercise[];
      workoutName: string;
      estimatedDuration: number;
      t: (key: string) => string;
    }): Promise<string | null> => {
      const { selected, workoutName, estimatedDuration, t } = opts;
      if (selected.length === 0) return null;
      if (savingRef.current) return null;
      savingRef.current = true;

      const name =
        workoutName.trim() ||
        `${t('createWorkout.customWorkout')} (${selected.length} ${t('createWorkout.exercises')})`;
      const sessionId = `custom_${Date.now()}`;

      try {
        await createWorkoutSession({
          id: sessionId,
          user_id: 'user_local_001',
          duration_minutes: Math.round(estimatedDuration),
          total_exercises: selected.length,
          completed_exercises: 0,
          success: false,
          notes: `Custom: ${name}`,
        });

        for (let i = 0; i < selected.length; i++) {
          const s = selected[i];
          if (!s) continue;
          await addSessionExercise({
            id: `${sessionId}_ex_${i}`,
            session_id: sessionId,
            exercise_id: s.exercise.id,
            order_in_session: i + 1,
            prescribed_sets: s.sets,
            prescribed_reps: s.reps,
            completed_sets: 0,
            skipped: false,
          });
        }

        notifyCustomWorkoutCreated(sessionId);
        return sessionId;
      } catch (error) {
        if (__DEV__) console.error('[CreateWorkout] Failed to save:', error);
        return null;
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  /** Speak exercise instructions aloud */
  const speakNarration = useCallback((text: string) => {
    audioService.speakNarration(text);
  }, []);

  return {
    allExercises,
    loading,
    loadExercises,
    saveWorkout,
    speakNarration,
  };
});
