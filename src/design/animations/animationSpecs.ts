/**
 * Animation Specs
 *
 * Canonical animation definitions for all FitQuest UI interactions.
 * These specs are resolved at runtime by useAnimationConfig, which
 * applies device profile multipliers and injects the easing function.
 */

// ============================================================================
// TYPES
// ============================================================================

export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubic' | 'sine' | 'elastic' | 'bounce';

export interface BaseAnimationSpec {
  /** Duration in ms (before device-profile scaling) */
  duration: number;
  /** Easing curve name */
  easing: EasingName;
  /** Optional delay in ms */
  delay?: number;
}

export interface TransformAnimationSpec extends BaseAnimationSpec {
  /** Starting opacity (0–1) */
  fromOpacity?: number;
  /** Ending opacity (0–1) */
  toOpacity?: number;
  /** Starting Y translation in dp */
  fromTranslateY?: number;
  /** Ending Y translation in dp */
  toTranslateY?: number;
  /** Starting scale */
  fromScale?: number;
  /** Ending scale */
  toScale?: number;
  /** Stagger delay per child in ms (for list animations) */
  staggerMs?: number;
}

export interface HapticSpec {
  /** Haptic feedback intensity type */
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
}

export interface AnimationSpecs {
  /** Screen enter transition — fade up from slightly below */
  screenEnter: TransformAnimationSpec;
  /** Screen exit transition — fade out upward */
  screenExit: TransformAnimationSpec;
  /** Card enter — zoom in from 94% with fade, supports stagger */
  cardEnter: TransformAnimationSpec;
  /** Button press feedback — scale down on press */
  buttonPress: TransformAnimationSpec;
  /** Breathing pulse — subtle scale oscillation (e.g. rest timer) */
  breathingPulse: TransformAnimationSpec;
  /** Shimmer skeleton loading — gradient sweep */
  shimmer: BaseAnimationSpec;
  /** Progress / count-up number animation */
  progressCountUp: BaseAnimationSpec;
  /** Success checkmark stamp */
  successCheckmark: TransformAnimationSpec;
  /** Haptic feedback presets */
  haptics: {
    light: HapticSpec;
    medium: HapticSpec;
    heavy: HapticSpec;
    success: HapticSpec;
  };
}

// ============================================================================
// SPEC DEFINITIONS
// ============================================================================

export const animationSpecs: AnimationSpecs = {
  screenEnter: {
    duration: 300,
    easing: 'easeOut',
    fromOpacity: 0,
    toOpacity: 1,
    fromTranslateY: 16,
    toTranslateY: 0,
  },

  screenExit: {
    duration: 220,
    easing: 'easeIn',
    fromOpacity: 1,
    toOpacity: 0,
    fromTranslateY: 0,
    toTranslateY: -12,
  },

  cardEnter: {
    duration: 280,
    easing: 'easeOut',
    fromOpacity: 0,
    toOpacity: 1,
    fromScale: 0.94,
    toScale: 1,
    staggerMs: 50,
  },

  buttonPress: {
    duration: 100,
    easing: 'easeIn',
    fromScale: 1,
    toScale: 0.95,
  },

  breathingPulse: {
    duration: 2600,
    easing: 'sine',
    fromScale: 1,
    toScale: 1.035,
  },

  shimmer: {
    duration: 1400,
    easing: 'linear',
  },

  progressCountUp: {
    duration: 1200,
    easing: 'cubic',
  },

  successCheckmark: {
    duration: 600,
    easing: 'elastic',
    fromScale: 0,
    toScale: 1,
    fromOpacity: 0,
    toOpacity: 1,
  },

  haptics: {
    light: { type: 'light' },
    medium: { type: 'medium' },
    heavy: { type: 'heavy' },
    success: { type: 'success' },
  },
};

/** All spec keys (excluding haptics) */
export type AnimationSpecKey = Exclude<keyof AnimationSpecs, 'haptics'>;

/** All haptic keys */
export type HapticKey = keyof AnimationSpecs['haptics'];
