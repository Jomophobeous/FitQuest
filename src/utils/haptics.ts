/**
 * P7 — Haptic Feedback Choreography
 *
 * Centralized haptic patterns for workout milestones.
 * Uses react-native Vibration API (works in Expo Go).
 */

import { Vibration, Platform } from 'react-native';

/** Vibration patterns (ms: [pause, vibrate, pause, vibrate, ...]) */
const PATTERNS = {
  // ── Gesture-specific patterns (Phase 9) ──
  /** Swipe confirm — soft single tap */
  swipeConfirm: Platform.OS === 'android' ? [0, 20] : [0, 20],
  /** Swipe open actions — lighter tap */
  swipeOpen: Platform.OS === 'android' ? [0, 15] : [0, 15],
  /** Delete action — medium/heavy impact */
  deleteAction: Platform.OS === 'android' ? [0, 80, 40, 60] : [0, 80],
  /** Long press activation — subtle tap */
  longPress: Platform.OS === 'android' ? [0, 25] : [0, 25],
  /** Pull to refresh release — snap feedback */
  pullRefresh: Platform.OS === 'android' ? [0, 30, 30, 20] : [0, 30],
  /** Workout starts — double tap */
  workoutStart: Platform.OS === 'android' ? [0, 60, 80, 60] : [0, 60],
  /** Exercise starts — single firm tap */
  exerciseStart: Platform.OS === 'android' ? [0, 50] : [0, 50],
  /** Set/rep complete — light tap */
  setComplete: Platform.OS === 'android' ? [0, 30] : [0, 30],
  /** Exercise completed — triple tap */
  exerciseComplete: Platform.OS === 'android' ? [0, 40, 60, 40, 60, 40] : [0, 40, 60, 40],
  /** Rest starts — soft pulse */
  restStart: Platform.OS === 'android' ? [0, 20] : [0, 20],
  /** Rest ending countdown (3-2-1) — 3 quick taps */
  restEnding: Platform.OS === 'android' ? [0, 30, 50, 30, 50, 30] : [0, 30, 50, 30],
  /** Rest over — firm tap */
  restOver: Platform.OS === 'android' ? [0, 60] : [0, 60],
  /** Workout complete — celebration pattern */
  workoutComplete: Platform.OS === 'android' ? [0, 50, 60, 50, 100, 80, 60, 80] : [0, 50, 60, 50, 100, 80],
  /** Button press — micro tap */
  buttonPress: Platform.OS === 'android' ? [0, 15] : [0, 15],
  /** Error/warning */
  error: Platform.OS === 'android' ? [0, 100, 50, 100] : [0, 100],

  // ── Phase-aware patterns ──
  /** Warmup exercise complete — light double tap */
  warmupComplete: Platform.OS === 'android' ? [0, 25, 50, 25] : [0, 25, 50, 25],
  /** Cooldown exercise complete — gentle lingering pulse */
  cooldownComplete: Platform.OS === 'android' ? [0, 30, 70, 30, 70, 30] : [0, 30, 70, 30],
  /** Phase transition (warmup→main, main→cooldown) — distinct marker */
  phaseTransition: Platform.OS === 'android' ? [0, 40, 100, 60, 100, 80] : [0, 40, 100, 60],
};

export type HapticEvent = keyof typeof PATTERNS;

let enabled = true;

/**
 * Trigger a haptic pattern for the given workout event.
 */
export function haptic(event: HapticEvent): void {
  if (!enabled) return;
  try {
    const pattern = PATTERNS[event];
    if (pattern) {
      Vibration.vibrate(pattern);
    }
  } catch {
    // Silently ignore — some emulators don't support vibration
  }
}

/**
 * Enable or disable haptic feedback globally.
 */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Check if haptics are currently enabled.
 */
export function isHapticsEnabled(): boolean {
  return enabled;
}
