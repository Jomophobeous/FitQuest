/**
 * Motion Presets — Shared animation constants for brand-consistent transitions.
 *
 * Usage:
 *   import { MOTION, HIERARCHY, stepEnter, stepExit, staggerChild } from '../design/motion';
 *
 *   <Animated.View entering={stepEnter()} exiting={stepExit()}>
 *   <Animated.View entering={staggerChild(index)}>
 */
import {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  FadeOutUp,
  Easing,
  withSpring,
} from 'react-native-reanimated';

// ── Duration constants (ms) — aligned with theme.motion ──
export const MOTION = {
  /** Quick micro-interactions: press, dismiss, toggle */
  fast: 150,
  /** Standard enter/exit transitions */
  base: 250,
  /** Deliberate reveals, splash-grade timing */
  slow: 350,
  /** Press-in duration (tight, responsive) */
  pressIn: 80,
  /** Stagger gap between children (ms) */
  stagger: 50,
  /** Max stagger cap (prevents slow cascade on long lists) */
  staggerCap: 250,
} as const;

// ── Visual hierarchy — opacity tiers for depth layering ──
export const HIERARCHY = {
  /** Primary focus element (1 per screen) */
  primary: 1.0,
  /** Supporting context (recovery, stats) */
  secondary: 0.88,
  /** Tertiary / explore / historical */
  tertiary: 0.78,
} as const;

// ── Press release spring config ──
export const PRESS_SPRING = {
  damping: 15,
  stiffness: 300,
  mass: 0.8,
} as const;

// ── Easing presets ──
const EASE_ENTER = Easing.out(Easing.cubic);
const EASE_EXIT = Easing.in(Easing.quad);

// ── Step-level transitions (onboarding, wizard flows) ──

/** Step container enter — slide down + fade */
export const stepEnter = (duration = MOTION.base) =>
  FadeInDown.duration(duration).easing(EASE_ENTER);

/** Step container exit — slide left + fade (forward navigation feel) */
export const stepExit = (duration = MOTION.fast) =>
  FadeOutLeft.duration(duration).easing(EASE_EXIT);

/** Step container exit upward — for "back" navigation */
export const stepExitBack = (duration = MOTION.fast) =>
  FadeOutUp.duration(duration).easing(EASE_EXIT);

// ── Child-level stagger (list items, cards, options) ──

/** Staggered child enter — slide right + fade with index-based delay */
export const staggerChild = (index: number, duration = MOTION.fast) =>
  FadeInRight
    .delay(Math.min(index * MOTION.stagger, MOTION.staggerCap))
    .duration(duration)
    .easing(EASE_ENTER);
