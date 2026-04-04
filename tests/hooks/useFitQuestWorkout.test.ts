/**
 * @vitest-environment happy-dom
 */

/**
 * Tests: useFitQuestWorkout Hook — Orchestrator
 *
 * Target: src/hooks/useFitQuestWorkout.ts (771 LOC)
 * Strategy: renderHook with Context wrappers, mock all engines/services
 * Coverage zones:
 *   1. Initialization & return shape
 *   2. Generation flow (idle → generating → ready)
 *   3. Workout lifecycle (start → exercise complete → finish)
 *   4. Double-tap protection (guard refs)
 *   5. Error handling & recovery
 *   6. Cancel & reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import type { WorkoutExerciseDisplay, GeneratedWorkoutDisplay } from '../../src/hooks/workout/types';

// ============================================
// MOCK ALL EXTERNAL MODULES
// ============================================

vi.mock('../../src/context/DatabaseContext', () => ({
  useDatabase: vi.fn().mockReturnValue({
    isReady: true,
    userProfile: {
      id: 'user_local_001',
      goal: 'strength',
      experience: 'intermediate',
      training_days_per_week: 4,
      time_per_session_minutes: 30,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      locked: false,
    },
    getDatabase: vi.fn(),
  }),
  DEFAULT_USER_ID: 'user_local_001',
}));

// Database context profile for re-apply
const mockUserProfile = {
  id: 'user_local_001',
  goal: 'strength' as const,
  experience: 'intermediate' as const,
  training_days_per_week: 4,
  time_per_session_minutes: 30,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  locked: false,
};

vi.mock('../../src/context/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('../../src/i18n/TranslationResolver', () => ({
  translationResolver: {
    resolveBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

// Engine mocks
vi.mock('../../src/engines', () => ({
  createWorkout: vi.fn().mockResolvedValue(null),
  recordSessionPerformance: vi.fn().mockResolvedValue([]),
  getFatigueSnapshot: vi.fn().mockResolvedValue([]),
  checkDeloadStatus: vi.fn().mockResolvedValue({ severity: 'none', reasons: [] }),
  applyDailyRecoveryTick: vi.fn().mockResolvedValue(undefined),
  needsRecoveryTick: vi.fn().mockResolvedValue(false),
  accumulateFatigue: vi.fn().mockResolvedValue(undefined),
}));

const mockCreatedWorkout = {
  session_id: 'session_001',
  exercises: [
    {
      exercise: {
        id: 'ex_1', name: 'Push-ups', category: 'strength',
        instructions: ['Do push-ups'], primary_muscles: ['chest_mid'],
        secondary_muscles: [], audio_intro: '', audio_setup: '',
        audio_execution: '', audio_transition: '',
      },
      sets: 3, reps: '8-12', order: 1,
    },
    {
      exercise: {
        id: 'ex_2', name: 'Squats', category: 'strength',
        instructions: ['Do squats'], primary_muscles: ['quads'],
        secondary_muscles: [], audio_intro: '', audio_setup: '',
        audio_execution: '', audio_transition: '',
      },
      sets: 4, reps: '10-15', order: 2,
    },
  ],
  total_duration_estimate: 25,
  intent: { focus_pattern: 'push', training_types: ['hypertrophy', 'strength'] },
};

vi.mock('../../src/engines/warmupCooldownGenerator', () => ({
  generateWarmupCooldown: vi.fn().mockResolvedValue({ warmup: [], cooldown: [] }),
}));

vi.mock('../../src/engines/MindSessionEngine', () => ({
  isMindExercise: vi.fn().mockReturnValue(false),
  generateMindTimeline: vi.fn(),
  getMindDuration: vi.fn().mockReturnValue(300),
  formatMindDuration: vi.fn().mockReturnValue('5:00'),
}));

vi.mock('../../src/database/service', () => ({
  getExercisesByIds: vi.fn().mockResolvedValue(new Map()),
  completeWorkoutSession: vi.fn().mockResolvedValue(undefined),
  updateStreak: vi.fn().mockResolvedValue({ current: 1, longest: 1 }),
  getSessionExercises: vi.fn().mockResolvedValue([]),
  getWorkoutSession: vi.fn().mockResolvedValue(null),
  getActiveWorkoutSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/services/xpService', () => ({
  awardWorkoutXP: vi.fn().mockResolvedValue({
    xpEarned: 120,
    data: { level: 2, totalXP: 320, currentLevelXP: 120, xpForNextLevel: 300 },
    levelUp: false,
  }),
}));

vi.mock('../../src/services/audioService', () => ({
  generateRichAudio: vi.fn().mockReturnValue({
    intro: 'intro', setup: 'setup', execution: 'execution', transition: 'transition',
  }),
}));

vi.mock('../../src/services/adaptiveTrainingService', () => ({
  updateAdaptiveTrainingProfileFromSession: vi.fn().mockResolvedValue({
    fatigueSensitivity: 1.0,
    progressionAggressiveness: 1.0,
    volumeTolerance: 1.0,
  }),
}));

vi.mock('../../src/services/dataSyncService', () => ({
  notifyWorkoutCompleted: vi.fn(),
}));

vi.mock('../../src/engines/ReadinessEngine', () => ({
  invalidateReadinessCache: vi.fn(),
}));

vi.mock('../../src/services/smartDefaults', () => ({
  recordWorkoutPattern: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/telemetry', () => ({
  logEvent: vi.fn(),
}));

vi.mock('../../src/hooks/workout/persistence', () => ({
  persistWorkoutProgress: vi.fn(),
  persistExerciseCompletion: vi.fn(),
  clearActiveWorkout: vi.fn(),
  readActiveWorkout: vi.fn().mockReturnValue(null),
}));

vi.mock('../../src/hooks/workout/helpers', () => ({
  mapRecoveryReasonToFriendly: vi.fn().mockReturnValue(''),
  buildDisplaysFromSessionRows: vi.fn().mockReturnValue([]),
  overlayLocalization: vi.fn(),
  buildPhaseDisplays: vi.fn().mockReturnValue([]),
  collectMusclesWorked: vi.fn().mockReturnValue(['chest_mid', 'quads']),
  computePhaseBreakdown: vi.fn().mockReturnValue({
    warmup: { total: 0, completed: 0 },
    main: { total: 2, completed: 2 },
    cooldown: { total: 0, completed: 0 },
  }),
}));

// ============================================
// IMPORTS (after all mocks)
// ============================================

import { useFitQuestWorkout } from '../../src/hooks/useFitQuestWorkout';
import { createWorkout } from '../../src/engines';

// ============================================
// SETUP
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default mocks
  vi.mocked(createWorkout).mockResolvedValue(null);
});

// ============================================
// ZONE 1: INITIALIZATION & RETURN SHAPE
// ============================================

describe('Initialization & Return Shape', () => {
  it('starts in idle status with null workout', () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    expect(result.current.status).toBe('idle');
    expect(result.current.workout).toBeNull();
    expect(result.current.currentExercise).toBeNull();
    expect(result.current.currentExerciseIndex).toBe(0);
    expect(result.current.progressPercentage).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('exposes all required action functions', () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    expect(typeof result.current.generateNewWorkout).toBe('function');
    expect(typeof result.current.loadCustomWorkout).toBe('function');
    expect(typeof result.current.startWorkout).toBe('function');
    expect(typeof result.current.completeExercise).toBe('function');
    expect(typeof result.current.skipExercise).toBe('function');
    expect(typeof result.current.finishWorkout).toBe('function');
    expect(typeof result.current.cancelWorkout).toBe('function');
    expect(typeof result.current.recoverActiveSession).toBe('function');
  });

  it('exposes fatigue and deload state', () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    expect(result.current.fatigueSnapshot).toBeDefined();
    expect(result.current.deloadStatus).toBeDefined();
  });
});

// ============================================
// ZONE 2: GENERATION FLOW
// ============================================

describe('Generation Flow', () => {
  it('transitions from idle → ready on successful generation', async () => {
    vi.mocked(createWorkout).mockResolvedValue(mockCreatedWorkout as any);
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.workout).not.toBeNull();
    expect(result.current.workout!.id).toBe('session_001');
  });

  it('transitions to error when generation fails', async () => {
    vi.mocked(createWorkout).mockResolvedValue(null);
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('transitions to error when engine throws', async () => {
    vi.mocked(createWorkout).mockRejectedValue(new Error('DB error'));
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('DB error');
  });

  it('blocks generation when database not ready', async () => {
    const { useDatabase } = await import('../../src/context/DatabaseContext');
    vi.mocked(useDatabase).mockReturnValue({
      isReady: false,
      userProfile: null,
      getDatabase: vi.fn(),
    } as any);

    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('initializing');

    // Restore default
    vi.mocked(useDatabase).mockReturnValue({
      isReady: true,
      userProfile: mockUserProfile,
      getDatabase: vi.fn(),
    } as any);
  });

  it('workout exercises have correct display structure', async () => {
    vi.mocked(createWorkout).mockResolvedValue(mockCreatedWorkout as any);
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    const exercises = result.current.workout!.exercises;
    expect(exercises.length).toBeGreaterThan(0);
    for (const ex of exercises) {
      expect(ex.id).toBeTruthy();
      expect(ex.name).toBeTruthy();
      expect(ex.sets).toBeGreaterThanOrEqual(1);
      expect(ex.reps).toBeTruthy();
      expect(ex.completed).toBe(false);
    }
  });
});

// ============================================
// ZONE 3: WORKOUT LIFECYCLE
// ============================================

describe('Workout Lifecycle', () => {
  async function generateAndStart() {
    vi.mocked(createWorkout).mockResolvedValue(mockCreatedWorkout as any);
    const hook = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await hook.result.current.generateNewWorkout();
    });

    act(() => {
      hook.result.current.startWorkout();
    });

    return hook;
  }

  it('startWorkout transitions from ready → in_progress', async () => {
    const { result } = await generateAndStart();
    expect(result.current.status).toBe('in_progress');
    expect(result.current.currentExerciseIndex).toBe(0);
  });

  it('completeExercise advances to next exercise', async () => {
    const { result } = await generateAndStart();

    act(() => {
      result.current.completeExercise(7);
    });

    expect(result.current.currentExerciseIndex).toBe(1);
    expect(result.current.workout!.exercises[0]!.completed).toBe(true);
  });

  it('completing all exercises sets status to completed', async () => {
    const { result } = await generateAndStart();

    // Complete first exercise
    act(() => { result.current.completeExercise(5); });
    // queueMicrotask guard needs to release — await a tick
    await act(async () => { await Promise.resolve(); });
    // Complete second exercise
    act(() => { result.current.completeExercise(6); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.status).toBe('completed');
  });

  it('skipExercise advances without marking completed', async () => {
    const { result } = await generateAndStart();

    act(() => {
      result.current.skipExercise();
    });

    expect(result.current.currentExerciseIndex).toBe(1);
    expect(result.current.workout!.exercises[0]!.completed).toBe(false);
  });

  it('progressPercentage tracks main exercise completion', async () => {
    const { result } = await generateAndStart();
    expect(result.current.progressPercentage).toBe(0);

    act(() => { result.current.completeExercise(5); });
    await act(async () => { await Promise.resolve(); });
    // 1 of 2 main exercises completed = 50%
    expect(result.current.progressPercentage).toBe(50);

    act(() => { result.current.completeExercise(5); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.progressPercentage).toBe(100);
  });

  it('currentExercise reflects the current index', async () => {
    const { result } = await generateAndStart();

    // First exercise
    expect(result.current.currentExercise).not.toBeNull();
    expect(result.current.currentExercise!.name).toBe('Push-ups');

    act(() => { result.current.completeExercise(5); });

    // Second exercise
    expect(result.current.currentExercise!.name).toBe('Squats');
  });
});

// ============================================
// ZONE 4: DOUBLE-TAP PROTECTION
// ============================================

describe('Double-Tap Protection', () => {
  it('prevents concurrent generation calls', async () => {
    vi.mocked(createWorkout).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockCreatedWorkout as any), 100))
    );

    const { result } = renderHook(() => useFitQuestWorkout());

    // Fire two generation calls simultaneously
    await act(async () => {
      const p1 = result.current.generateNewWorkout();
      const p2 = result.current.generateNewWorkout(); // should be ignored
      await Promise.all([p1, p2]);
    });

    // createWorkout should only be called once
    expect(vi.mocked(createWorkout)).toHaveBeenCalledTimes(1);
  });

  it('startWorkout does nothing without a workout', () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    act(() => { result.current.startWorkout(); });
    expect(result.current.status).toBe('idle');
  });
});

// ============================================
// ZONE 5: CANCEL & RESET
// ============================================

describe('Cancel & Reset', () => {
  it('cancelWorkout resets to idle state', async () => {
    vi.mocked(createWorkout).mockResolvedValue(mockCreatedWorkout as any);
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    expect(result.current.status).toBe('ready');

    act(() => {
      result.current.cancelWorkout();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.workout).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('cancelWorkout works during in_progress', async () => {
    vi.mocked(createWorkout).mockResolvedValue(mockCreatedWorkout as any);
    const { result } = renderHook(() => useFitQuestWorkout());

    await act(async () => {
      await result.current.generateNewWorkout();
    });

    act(() => { result.current.startWorkout(); });
    expect(result.current.status).toBe('in_progress');

    act(() => { result.current.cancelWorkout(); });
    expect(result.current.status).toBe('idle');
  });
});

// ============================================
// ZONE 6: FINISH WORKOUT
// ============================================

describe('Finish Workout', () => {
  it('finishWorkout returns null when no workout', async () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    let returnVal: any;
    await act(async () => {
      returnVal = await result.current.finishWorkout();
    });
    expect(returnVal).toBeNull();
  });

  it('finishWorkout returns null when status is idle', async () => {
    const { result } = renderHook(() => useFitQuestWorkout());
    expect(result.current.status).toBe('idle');
    let returnVal: any;
    await act(async () => {
      returnVal = await result.current.finishWorkout();
    });
    expect(returnVal).toBeNull();
  });
});
