/**
 * Workout Session Persistence — Hardened
 * Non-blocking DB writes with error capture (no silent swallowing).
 * Replaces original fire-and-forget `.catch(() => {})` pattern.
 */

import { setAppState, getAppState, updateSessionExerciseProgress } from '../../database/service';

export const ACTIVE_WORKOUT_KEY = 'active_workout_state';

/**
 * Persist workout progress marker. Non-blocking, but logs failures.
 * Single retry on transient DB errors.
 */
export function persistWorkoutProgress(sessionId: string, exerciseIndex: number, startTime: string): void {
  const payload = JSON.stringify({ sessionId, exerciseIndex, startTime });
  setAppState(ACTIVE_WORKOUT_KEY, payload).catch((err) => {
    if (__DEV__) console.warn('[Persistence] persistWorkoutProgress failed, retrying once:', err);
    // Single retry — covers transient SQLITE_BUSY
    setAppState(ACTIVE_WORKOUT_KEY, payload).catch((retryErr) => {
      if (__DEV__) console.warn('[Persistence] persistWorkoutProgress retry failed:', retryErr);
    });
  });
}

/**
 * Persist exercise completion/skip to session_exercises row. Non-blocking.
 */
export function persistExerciseCompletion(sessionExerciseId: string, sets: number, skipped: boolean): void {
  updateSessionExerciseProgress(sessionExerciseId, sets, skipped).catch((err) => {
    if (__DEV__) console.warn('[Persistence] persistExerciseCompletion failed, retrying once:', err);
    updateSessionExerciseProgress(sessionExerciseId, sets, skipped).catch((retryErr) => {
      if (__DEV__) console.warn('[Persistence] persistExerciseCompletion retry failed:', retryErr);
    });
  });
}

/**
 * Clear active workout marker. Non-blocking.
 */
export function clearActiveWorkout(): void {
  setAppState(ACTIVE_WORKOUT_KEY, '').catch((err) => {
    if (__DEV__) console.warn('[Persistence] clearActiveWorkout failed:', err);
  });
}

/**
 * Read raw active workout state from app_state.
 * Returns null if no active workout or invalid data.
 */
export async function readActiveWorkout(): Promise<{
  sessionId: string;
  exerciseIndex: number;
  startTime: string;
} | null> {
  try {
    const raw = await getAppState(ACTIVE_WORKOUT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { sessionId: string; exerciseIndex: number; startTime: string };
    if (!saved.sessionId) return null;
    return saved;
  } catch {
    return null;
  }
}
