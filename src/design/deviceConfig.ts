/**
 * Device Animation Profile
 *
 * Detects device capability tier and returns an animation profile
 * that scales durations, disables blur/parallax on low-end hardware.
 *
 * Note: expo-battery / Platform is mocked in vitest — all device detection
 * is synchronous and pure for testability.
 */
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type DeviceTier = 'low-end' | 'mid-range' | 'high-end';

export interface AnimationProfile {
  /** Tier label */
  tier: DeviceTier;
  /** Multiply all animation durations by this factor */
  durationMultiplier: number;
  /** Whether to enable blur effects (glassmorphism etc.) */
  useBlur: boolean;
  /** Max gradient stops to render */
  maxGradientStops: number;
  /** Whether to enable parallax scroll effects */
  enableParallax: boolean;
}

// ============================================================================
// PROFILES
// ============================================================================

export const animationProfiles: Record<DeviceTier, AnimationProfile> = {
  'low-end': {
    tier: 'low-end',
    durationMultiplier: 0.6,
    useBlur: false,
    maxGradientStops: 2,
    enableParallax: false,
  },
  'mid-range': {
    tier: 'mid-range',
    durationMultiplier: 0.85,
    useBlur: false,
    maxGradientStops: 3,
    enableParallax: false,
  },
  'high-end': {
    tier: 'high-end',
    durationMultiplier: 1.0,
    useBlur: true,
    maxGradientStops: 5,
    enableParallax: true,
  },
};

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Heuristic device tier detection.
 *
 * Web/test environments → high-end (no penalty).
 * iOS → high-end (modern iPhones handle everything).
 * Android → mid-range default; we don't have runtime RAM access
 *   without native modules, so we default conservatively.
 *
 * In production you could replace the Android branch with an
 * expo-device check (DeviceType, totalMemory) once expo-device
 * is added to the project.
 */
export function getDeviceAnimationProfile(): AnimationProfile {
  if (Platform.OS === 'web' || Platform.OS === undefined) {
    return animationProfiles['high-end'];
  }

  if (Platform.OS === 'ios') {
    return animationProfiles['high-end'];
  }

  // Android — default to mid-range as a safe conservative choice
  return animationProfiles['mid-range'];
}

/**
 * Override the device profile for testing or user preference.
 * Pass null to revert to auto-detection.
 */
let _profileOverride: AnimationProfile | null = null;

export function setDeviceProfileOverride(profile: AnimationProfile | null): void {
  _profileOverride = profile;
}

/**
 * Returns the active animation profile, respecting any override.
 */
export function getActiveAnimationProfile(): AnimationProfile {
  return _profileOverride ?? getDeviceAnimationProfile();
}
