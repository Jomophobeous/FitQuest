/**
 * FitQuest Theme Effects
 *
 * Glass-morphism presets, gradient specs, shadow elevations, and animation easing
 * for use across all 8 themes. Effects are resolved per-theme via themeConfigs.effects.
 *
 * This module provides:
 * 1. Reanimated-compatible easing curves
 * 2. Helper to resolve accent-relative border colors
 * 3. getThemeEffect() lookup for component consumption
 */

import { Easing } from 'react-native-reanimated';
import { themeConfigs, type ThemeEffects, type GlassSpec, type ElevationSpec, type GradientPair } from './themeConfigs';

// ============================================================================
// ANIMATION EASING (Reanimated worklet-safe)
// ============================================================================

export const animationEasing = {
  /** Fast interactions: toggles, micro-feedback (180ms) */
  fast: Easing.inOut(Easing.cubic),
  /** Standard Material Design easing (250ms) */
  base: Easing.bezier(0.4, 0, 0.2, 1),
  /** Smooth decelerate for modals, sheets (320ms) */
  slow: Easing.out(Easing.cubic),
  /** Spring-like overshoot for playful elements */
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve a theme's accent color with alpha for glass border styling.
 * @param accentHex - Hex color e.g. '#10B981'
 * @param opacity - 0-1 fraction
 * @returns rgba string
 */
export function accentWithAlpha(accentHex: string, opacity: number): string {
  const r = parseInt(accentHex.slice(1, 3), 16);
  const g = parseInt(accentHex.slice(3, 5), 16);
  const b = parseInt(accentHex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Get the resolved border color for a glass spec given a theme's accent.
 */
export function resolveGlassBorder(accentHex: string, glass: GlassSpec): string {
  return accentWithAlpha(accentHex, glass.borderOpacity);
}

// ============================================================================
// THEME EFFECT LOOKUP
// ============================================================================

export type EffectType = 'glass' | 'gradients' | 'elevations';

/**
 * Get a specific effect category for a theme.
 *
 * @example
 * const glass = getThemeEffect('dark', 'glass');
 * // glass.card.blur === 12
 */
export function getThemeEffect<T extends EffectType>(themeId: string, effectType: T): ThemeEffects[T] {
  const config = themeConfigs[themeId];
  if (!config) {
    throw new Error(`Unknown theme: ${themeId}`);
  }
  return config.effects[effectType];
}

/**
 * Get the full effects object for a theme.
 */
export function getThemeEffects(themeId: string): ThemeEffects {
  const config = themeConfigs[themeId];
  if (!config) {
    throw new Error(`Unknown theme: ${themeId}`);
  }
  return config.effects;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { ThemeEffects, GlassSpec, ElevationSpec, GradientPair };
