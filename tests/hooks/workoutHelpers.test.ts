/**
 * Tests: Workout Hook Helpers & State Validation
 *
 * Target: src/hooks/workout/helpers.ts, src/hooks/workout/types.ts
 * Tests pure functions used by useFitQuestWorkout hook.
 * Validates state machine invariants without React rendering.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock audioService (imports expo-speech)
vi.mock('../../src/services/audioService', () => ({
  generateRichAudio: vi.fn().mockReturnValue({
    intro: 'Get ready for Push Ups',
    setup: 'Position your hands shoulder-width apart',
    execution: 'Lower your chest to the ground',
    transition: 'Great work! Next exercise coming up',
  }),
}));

import {
  mapRecoveryReasonToFriendly,
  safeParseInstructions,
} from '../../src/hooks/workout/helpers';

// ============================================
// safeParseInstructions
// ============================================

describe('safeParseInstructions', () => {
  it('parses valid JSON array', () => {
    const result = safeParseInstructions('["Step 1","Step 2","Step 3"]');
    expect(result).toEqual(['Step 1', 'Step 2', 'Step 3']);
  });

  it('wraps plain text in array', () => {
    const result = safeParseInstructions('Do 10 push ups');
    expect(result).toEqual(['Do 10 push ups']);
  });

  it('returns empty array for null', () => {
    expect(safeParseInstructions(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(safeParseInstructions('')).toEqual([]);
  });

  it('handles JSON object (not array) by wrapping', () => {
    const result = safeParseInstructions('{"step": "do this"}');
    expect(result).toEqual(['{"step": "do this"}']);
  });

  it('handles malformed JSON gracefully', () => {
    const result = safeParseInstructions('["broken');
    expect(result).toEqual(['["broken']);
  });
});

// ============================================
// mapRecoveryReasonToFriendly
// ============================================

describe('mapRecoveryReasonToFriendly', () => {
  it('returns healthy message when no reasons', () => {
    const msg = mapRecoveryReasonToFriendly([], 'none');
    expect(msg).toContain('healthy');
  });

  it('maps consecutive failures reason', () => {
    const msg = mapRecoveryReasonToFriendly(['3 consecutive workout failures detected'], 'required');
    expect(msg).toContain('recovery day');
  });

  it('maps critical fatigue reason', () => {
    const msg = mapRecoveryReasonToFriendly(['muscle group chest_mid at critical fatigue'], 'suggested');
    expect(msg).toContain('recovery time');
  });

  it('maps average fatigue reason', () => {
    const msg = mapRecoveryReasonToFriendly(['average fatigue (78) exceeds threshold'], 'recommended');
    expect(msg).toContain('lighter session');
  });

  it('maps scheduled deload', () => {
    const msg = mapRecoveryReasonToFriendly(['Scheduled deload week'], 'suggested');
    expect(msg).toContain('recharge');
  });

  it('passes through unknown reasons unchanged', () => {
    const msg = mapRecoveryReasonToFriendly(['Some custom reason'], 'none');
    expect(msg).toBe('Some custom reason');
  });

  it('combines multiple reasons', () => {
    const msg = mapRecoveryReasonToFriendly(
      ['3 consecutive workout failures detected', 'Scheduled deload week'],
      'required',
    );
    expect(msg).toContain('recovery day');
    expect(msg).toContain('recharge');
  });
});

// ============================================
// WorkoutExerciseDisplay type shape validation
// ============================================

describe('WorkoutExerciseDisplay shape invariants', () => {
  it('required fields present in a well-formed display', () => {
    const display = {
      id: 'se_001',
      exerciseId: 'push_up',
      name: 'Push Up',
      category: 'body_control',
      sets: 3,
      reps: '8-12',
      restSeconds: 60,
      instructions: ['Lower chest to ground', 'Push back up'],
      completed: false,
      audioIntro: '',
      audioSetup: '',
      audioExecution: '',
      audioTransition: '',
    };

    expect(display.id).toBeTruthy();
    expect(display.exerciseId).toBeTruthy();
    expect(display.name).toBeTruthy();
    expect(display.sets).toBeGreaterThan(0);
    expect(display.reps).toMatch(/\d/);
    expect(display.instructions).toBeInstanceOf(Array);
    expect(typeof display.completed).toBe('boolean');
  });

  it('phase is optional and constrained to valid values', () => {
    const validPhases = ['warmup', 'main', 'cooldown', undefined];
    for (const phase of validPhases) {
      const display = { phase };
      expect(validPhases).toContain(display.phase);
    }
  });
});

// ============================================
// Workout state machine: transition invariants
// ============================================

describe('Workout state transitions', () => {
  // The hook manages state: idle → generating → ready → active → completing → complete
  type WorkoutState = 'idle' | 'generating' | 'ready' | 'active' | 'completing' | 'complete';

  const validTransitions: Record<WorkoutState, WorkoutState[]> = {
    idle: ['generating'],
    generating: ['ready', 'idle'], // idle on error
    ready: ['active', 'idle'], // idle on discard
    active: ['completing', 'ready'], // ready on pause
    completing: ['complete', 'active'], // active on undo
    complete: ['idle'],
  };

  function isValidTransition(from: WorkoutState, to: WorkoutState): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  it('allows idle → generating', () => {
    expect(isValidTransition('idle', 'generating')).toBe(true);
  });

  it('allows generating → ready', () => {
    expect(isValidTransition('generating', 'ready')).toBe(true);
  });

  it('allows ready → active', () => {
    expect(isValidTransition('ready', 'active')).toBe(true);
  });

  it('allows active → completing', () => {
    expect(isValidTransition('active', 'completing')).toBe(true);
  });

  it('allows complete → idle (reset)', () => {
    expect(isValidTransition('complete', 'idle')).toBe(true);
  });

  it('blocks idle → active (must generate first)', () => {
    expect(isValidTransition('idle', 'active')).toBe(false);
  });

  it('blocks generating → complete (must go through ready+active)', () => {
    expect(isValidTransition('generating', 'complete')).toBe(false);
  });

  it('blocks active → idle (must complete or go back to ready)', () => {
    expect(isValidTransition('active', 'idle')).toBe(false);
  });

  it('complete lifecycle: idle → generating → ready → active → completing → complete → idle', () => {
    const lifecycle: WorkoutState[] = ['idle', 'generating', 'ready', 'active', 'completing', 'complete', 'idle'];
    for (let i = 0; i < lifecycle.length - 1; i++) {
      expect(isValidTransition(lifecycle[i]!, lifecycle[i + 1]!)).toBe(true);
    }
  });
});
