/**
 * useAnimationConfig
 *
 * Resolves an animation spec by name, applies the device profile's
 * durationMultiplier, and returns a concrete easing function.
 *
 * Designed to be used with react-native-reanimated's withTiming/withSpring;
 * the returned easingFn is compatible with Reanimated's Easing API.
 *
 * In test environments (where Reanimated is unavailable), the hook still
 * returns a plain object — the easingFn is a simple pass-through.
 */
import { useMemo } from 'react';
import {
  animationSpecs,
  type AnimationSpecKey,
  type EasingName,
  type BaseAnimationSpec,
  type TransformAnimationSpec,
} from '../design/animations/animationSpecs';
import { getActiveAnimationProfile } from '../design/deviceConfig';

// ============================================================================
// EASING RESOLVER
// ============================================================================

/**
 * Maps EasingName to a numeric easing function (t: 0→1 → 0→1).
 * These are pure math functions that work without Reanimated.
 * When using Reanimated in production, pass the returned fn to
 * `Easing.bezier(...)` or use it directly via `withTiming({ easing })`.
 */
export function resolveEasingFn(name: EasingName): (t: number) => number {
  switch (name) {
    case 'linear':
      return (t) => t;
    case 'easeIn':
      return (t) => t * t;
    case 'easeOut':
      return (t) => t * (2 - t);
    case 'easeInOut':
      return (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    case 'cubic':
      return (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
    case 'sine':
      return (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      };
    }
    case 'bounce':
      return (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      };
    default:
      return (t) => t;
  }
}

// ============================================================================
// RESOLVED SPEC TYPE
// ============================================================================

export interface ResolvedAnimationSpec extends BaseAnimationSpec {
  /** Duration after device-profile scaling */
  resolvedDuration: number;
  /** Concrete easing function */
  easingFn: (t: number) => number;
  /** All other transform fields from the spec */
  fromOpacity?: number;
  toOpacity?: number;
  fromTranslateY?: number;
  toTranslateY?: number;
  fromScale?: number;
  toScale?: number;
  staggerMs?: number;
  delay?: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Resolves a named animation spec with device-profile scaling and easing function.
 *
 * @example
 * const spec = useAnimationConfig('cardEnter');
 * // spec.resolvedDuration → 238 on mid-range, 280 on high-end
 * // spec.easingFn(0.5)   → 0.75 (easeOut at t=0.5)
 */
export function useAnimationConfig(specName: AnimationSpecKey): ResolvedAnimationSpec {
  return useMemo(() => {
    const spec = animationSpecs[specName] as TransformAnimationSpec;
    const profile = getActiveAnimationProfile();
    const resolvedDuration = Math.round(spec.duration * profile.durationMultiplier);
    const easingFn = resolveEasingFn(spec.easing);

    return {
      ...spec,
      resolvedDuration,
      easingFn,
    };
  }, [specName]);
}
