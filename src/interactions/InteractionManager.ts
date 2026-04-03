/**
 * InteractionManager — Global Interaction Governor
 *
 * Central authority for ALL user interactions. Merges:
 * - Tap throttling (replaces useActionGuard for non-hook contexts)
 * - Haptic feedback
 * - Loading/running lock (blocks re-entry while async executes)
 *
 * Usage:
 *   import { Interaction } from '../interactions/InteractionManager';
 *
 *   onPress={() => Interaction.execute('save_workout', handleSave, {
 *     haptic: 'light',
 *     blockWhileRunning: true,
 *   })}
 *
 * Hook variant for React components:
 *   const exec = useInteraction();
 *   onPress={() => exec('save_workout', handleSave, { haptic: 'medium' })}
 */

import { useCallback, useRef } from 'react';
import { haptic, type HapticEvent } from '../utils/haptics';
import { debugLogInteraction } from '../services/debugBuffer';

// ── Types ──────────────────────────────────────────────

export type HapticLevel = 'light' | 'medium' | 'heavy';

export interface ExecuteOptions {
  /** Minimum ms between executions of this action (default: 400) */
  throttle?: number;
  /** Haptic feedback intensity */
  haptic?: HapticLevel;
  /** Block re-entry while async fn is still running (default: false) */
  blockWhileRunning?: boolean;
}

interface ActionState {
  lockedUntil: number;
  running: boolean;
}

// ── Haptic mapping ─────────────────────────────────────

const HAPTIC_MAP: Record<HapticLevel, HapticEvent> = {
  light: 'buttonPress',
  medium: 'setComplete',
  heavy: 'exerciseComplete',
};

// ── Core engine (module-level singleton) ───────────────

const actions = new Map<string, ActionState>();

function getState(actionId: string): ActionState {
  let state = actions.get(actionId);
  if (!state) {
    state = { lockedUntil: 0, running: false };
    actions.set(actionId, state);
  }
  return state;
}

/**
 * Execute a guarded interaction.
 * Returns true if action was executed, false if blocked.
 */
function execute(
  actionId: string,
  fn: () => void | Promise<void>,
  options: ExecuteOptions = {},
): boolean {
  const { throttle = 400, haptic: hapticLevel, blockWhileRunning = false } = options;
  const now = Date.now();
  const state = getState(actionId);

  // Throttle gate
  if (now < state.lockedUntil) return false;

  // Running gate
  if (blockWhileRunning && state.running) return false;

  // Lock
  state.lockedUntil = now + throttle;
  debugLogInteraction(actionId, true);

  // Haptic
  if (hapticLevel) {
    haptic(HAPTIC_MAP[hapticLevel]);
  }

  // Execute
  if (blockWhileRunning) {
    state.running = true;
  }

  try {
    const result = fn();
    if (result instanceof Promise) {
      if (blockWhileRunning) {
        result.finally(() => {
          state.running = false;
        });
      }
    } else {
      // Sync — clear running immediately
      state.running = false;
    }
  } catch {
    state.running = false;
  }

  return true;
}

/**
 * Check if an action is currently locked (throttled or running).
 */
function isLocked(actionId: string): boolean {
  const state = actions.get(actionId);
  if (!state) return false;
  return Date.now() < state.lockedUntil || state.running;
}

/**
 * Reset a specific action's lock state.
 */
function reset(actionId: string): void {
  actions.delete(actionId);
}

/**
 * Reset all action locks. Use sparingly (e.g., on navigation reset).
 */
function resetAll(): void {
  actions.clear();
}

// ── Public API (singleton) ─────────────────────────────

export const Interaction = {
  execute,
  isLocked,
  reset,
  resetAll,
} as const;

// ── React Hook variant ─────────────────────────────────

/**
 * Hook that provides stable interaction executor.
 * Scope: per-component. Action IDs should be unique per screen.
 *
 * Usage:
 *   const exec = useInteraction();
 *   <GradientButton onPress={() => exec('start_workout', startWorkout, { haptic: 'medium' })} />
 */
export function useInteraction() {
  // Stable reference — Interaction.execute is module-level, no deps change
  const exec = useCallback(
    (
      actionId: string,
      fn: () => void | Promise<void>,
      options?: ExecuteOptions,
    ) => Interaction.execute(actionId, fn, options),
    [],
  );

  return exec;
}
