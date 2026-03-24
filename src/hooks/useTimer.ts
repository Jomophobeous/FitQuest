/**
 * FitQuest Timer Hook
 * React hook for timer integration in workout screens
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  timerService,
  formatTime,
  formatTimeHuman,
  TimerEvent,
  TimerState as ServiceTimerState,
} from '../services/timerService';

export interface TimerHookState {
  state: ServiceTimerState;
  remaining: number;
  elapsed: number;
  total: number;
  formattedRemaining: string;
  formattedElapsed: string;
  progress: number; // 0-1
}

export interface UseTimerReturn {
  // Exercise timer
  exerciseTimer: TimerHookState;
  startExercise: (seconds: number) => void;

  // Rest timer
  restTimer: TimerHookState;
  startRest: (seconds: number) => void;
  skipRest: () => void;
  extendRest: (seconds: number) => void;

  // Session timer
  sessionTimer: TimerHookState;
  startSession: (maxMinutes?: number) => void;
  endSession: () => { totalMinutes: number };

  // Control
  pauseAll: () => void;
  resumeAll: () => void;
  stopAll: () => void;

  // State
  isActive: boolean;
}

function createTimerState(timerState: {
  state: ServiceTimerState;
  remaining: number;
  elapsed: number;
  total: number;
}): TimerHookState {
  return {
    ...timerState,
    formattedRemaining: formatTime(timerState.remaining),
    formattedElapsed: formatTime(timerState.elapsed),
    progress: timerState.total > 0 ? timerState.elapsed / timerState.total : 0,
  };
}

export function useTimer(): UseTimerReturn {
  const [exerciseState, setExerciseState] = useState<TimerHookState>(
    createTimerState(timerService.getExerciseTimer().getState()),
  );
  const [restState, setRestState] = useState<TimerHookState>(createTimerState(timerService.getRestTimer().getState()));
  const [sessionState, setSessionState] = useState<TimerHookState>(
    createTimerState(timerService.getSessionTimer().getState()),
  );
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Subscribe to exercise timer
    const unsubExercise = timerService.getExerciseTimer().subscribe((event) => {
      setExerciseState(createTimerState(timerService.getExerciseTimer().getState()));
    });

    // Subscribe to rest timer
    const unsubRest = timerService.getRestTimer().subscribe((event) => {
      setRestState(createTimerState(timerService.getRestTimer().getState()));
    });

    // Subscribe to session timer
    const unsubSession = timerService.getSessionTimer().subscribe((event) => {
      setSessionState(createTimerState(timerService.getSessionTimer().getState()));
    });

    return () => {
      unsubExercise();
      unsubRest();
      unsubSession();
    };
  }, []);

  const startExercise = useCallback((seconds: number) => {
    timerService.startExercise(seconds);
    setIsActive(true);
  }, []);

  const startRest = useCallback((seconds: number) => {
    timerService.completeExerciseAndRest(seconds);
  }, []);

  const skipRest = useCallback(() => {
    timerService.skipRest();
  }, []);

  const extendRest = useCallback((seconds: number) => {
    timerService.extendRest(seconds);
  }, []);

  const startSession = useCallback((maxMinutes: number = 60) => {
    timerService.startSession(maxMinutes);
    setIsActive(true);
  }, []);

  const endSession = useCallback(() => {
    const result = timerService.endSession();
    setIsActive(false);
    return result;
  }, []);

  const pauseAll = useCallback(() => {
    timerService.pauseAll();
  }, []);

  const resumeAll = useCallback(() => {
    timerService.resumeAll();
  }, []);

  const stopAll = useCallback(() => {
    timerService.stopAll();
    setIsActive(false);
  }, []);

  return {
    exerciseTimer: exerciseState,
    startExercise,
    restTimer: restState,
    startRest,
    skipRest,
    extendRest,
    sessionTimer: sessionState,
    startSession,
    endSession,
    pauseAll,
    resumeAll,
    stopAll,
    isActive,
  };
}

// Re-export formatters for convenience
export { formatTime, formatTimeHuman };
