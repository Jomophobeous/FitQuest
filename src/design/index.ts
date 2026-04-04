/**
 * Design System — Unified Token Export
 *
 * Single entry point for ALL design tokens.
 * Import from here — not from individual files.
 *
 * Usage:
 *   import { colors, spacing, radius, typography, MOTION, HIERARCHY } from '../design';
 *   import { createTheme, darkTheme, lightTheme } from '../design';
 */

// ── Theme system (colors, spacing, radius, shadows, typography) ──
export {
  colorSystem,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  createTheme,
  darkTheme,
  lightTheme,
  blackGoldTheme,
  categoryTheme,
  defaultCategoryTheme,
  type ThemeMode,
  type Theme,
} from './theme-system';

// ── Motion tokens (animation constants, spring configs, presets) ──
export { MOTION, HIERARCHY, PRESS_SPRING, stepEnter, stepExit, stepExitBack, staggerChild } from './motion';
