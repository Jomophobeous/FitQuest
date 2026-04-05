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

// ── Theme configs (extended palette + metadata for all 8 themes) ──
export {
  themeConfigs,
  allThemes,
  DEFAULT_THEME_ID,
  darkThemeConfig,
  lightThemeConfig,
  blackGoldThemeConfig,
  neonThemeConfig,
  energyThemeConfig,
  wellnessThemeConfig,
  eliteThemeConfig,
  sunsetThemeConfig,
  type ThemeConfig,
  type ThemeColorPalette,
  type ThemeAnimationSettings,
  type ThemeAccessibility,
  type ThemeCategory,
} from './themes/themeConfigs';

// ── Animation specs ──
export {
  animationSpecs,
  type AnimationSpecs,
  type AnimationSpecKey,
  type BaseAnimationSpec,
  type TransformAnimationSpec,
  type EasingName,
  type HapticSpec,
  type HapticKey,
} from './animations/animationSpecs';

// ── Device config ──
export {
  getDeviceAnimationProfile,
  getActiveAnimationProfile,
  setDeviceProfileOverride,
  animationProfiles,
  type AnimationProfile,
  type DeviceTier,
} from './deviceConfig';

// ── WCAG contrast utilities ──
export {
  hexToRelativeLuminance,
  getContrastRatio,
  checkColorContrast,
  validateThemeColors,
  type ContrastCheckResult,
} from './theme-system';
