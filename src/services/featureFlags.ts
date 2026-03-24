/**
 * Feature Flags Service
 *
 * Simple feature flag system for controlled rollout of new capabilities.
 * Stores flag state in SQLite app_state for persistence across sessions.
 *
 * Usage:
 *   import { featureFlags, isFeatureEnabled } from '../services/featureFlags';
 *   const enabled = await isFeatureEnabled('SKIA_HEALTH_CARD');
 */

import { getAppState, setAppState } from '../database/service';

// ============================================
// FEATURE FLAG DEFINITIONS
// ============================================

export const FEATURE_FLAGS = {
  // Phase 4: Visualization experiments
  SKIA_HEALTH_CARD: 'ff_skia_health_card', // Skia-based health card pilot
  VICTORY_CHARTS: 'ff_victory_charts', // Victory-native chart library
  ENHANCED_ANIMATIONS: 'ff_enhanced_animations', // Advanced Reanimated animations

  // Phase 5: Platform consistency
  STRICT_THEME_ENFORCEMENT: 'ff_strict_theme', // Runtime theme violation warnings

  // Phase 6: Quality gates
  VERBOSE_TELEMETRY: 'ff_verbose_telemetry', // Extra debug telemetry
  SMOKE_TEST_MODE: 'ff_smoke_test_mode', // Enables automated smoke test hooks

  // Deferred features (disabled until next version)
  HEALTH_SYNC: 'ff_health_sync', // Health Connect / HealthKit data sync
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlagId = (typeof FEATURE_FLAGS)[FeatureFlagKey];

// Default values for flags (false = disabled by default for safety)
const DEFAULT_FLAGS: Record<FeatureFlagId, boolean> = {
  [FEATURE_FLAGS.SKIA_HEALTH_CARD]: false,
  [FEATURE_FLAGS.VICTORY_CHARTS]: false,
  [FEATURE_FLAGS.ENHANCED_ANIMATIONS]: true, // Safe: just uses existing Reanimated
  [FEATURE_FLAGS.STRICT_THEME_ENFORCEMENT]: false,
  [FEATURE_FLAGS.VERBOSE_TELEMETRY]: false,
  [FEATURE_FLAGS.SMOKE_TEST_MODE]: false,
  [FEATURE_FLAGS.HEALTH_SYNC]: false, // Deferred: HC crashes app, re-enable in v3
};

const FLAGS_STORAGE_KEY = 'feature_flags_v1';

// ============================================
// SERVICE
// ============================================

class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private flags: Map<FeatureFlagId, boolean> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await getAppState(FLAGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        for (const [key, value] of Object.entries(parsed)) {
          this.flags.set(key as FeatureFlagId, value);
        }
      }
    } catch {
      // Silent fail - use defaults
    }

    // Apply defaults for any missing flags
    for (const [key, defaultValue] of Object.entries(DEFAULT_FLAGS)) {
      if (!this.flags.has(key as FeatureFlagId)) {
        this.flags.set(key as FeatureFlagId, defaultValue);
      }
    }

    this.initialized = true;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flag: FeatureFlagKey | FeatureFlagId): boolean {
    const flagId =
      typeof flag === 'string' && flag in FEATURE_FLAGS
        ? FEATURE_FLAGS[flag as FeatureFlagKey]
        : (flag as FeatureFlagId);

    return this.flags.get(flagId) ?? DEFAULT_FLAGS[flagId] ?? false;
  }

  /**
   * Enable a feature flag
   */
  async enable(flag: FeatureFlagKey | FeatureFlagId): Promise<void> {
    const flagId =
      typeof flag === 'string' && flag in FEATURE_FLAGS
        ? FEATURE_FLAGS[flag as FeatureFlagKey]
        : (flag as FeatureFlagId);

    this.flags.set(flagId, true);
    await this.persist();
  }

  /**
   * Disable a feature flag
   */
  async disable(flag: FeatureFlagKey | FeatureFlagId): Promise<void> {
    const flagId =
      typeof flag === 'string' && flag in FEATURE_FLAGS
        ? FEATURE_FLAGS[flag as FeatureFlagKey]
        : (flag as FeatureFlagId);

    this.flags.set(flagId, false);
    await this.persist();
  }

  /**
   * Toggle a feature flag
   */
  async toggle(flag: FeatureFlagKey | FeatureFlagId): Promise<boolean> {
    const current = this.isEnabled(flag);
    if (current) {
      await this.disable(flag);
    } else {
      await this.enable(flag);
    }
    return !current;
  }

  /**
   * Get all flags and their current values
   */
  getAllFlags(): Record<FeatureFlagId, boolean> {
    const result: Record<string, boolean> = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_FLAGS)) {
      result[key] = this.flags.get(key as FeatureFlagId) ?? defaultValue;
    }
    return result as Record<FeatureFlagId, boolean>;
  }

  /**
   * Reset all flags to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.flags.clear();
    for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
      this.flags.set(key as FeatureFlagId, value);
    }
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      const data: Record<string, boolean> = {};
      for (const [key, value] of this.flags.entries()) {
        data[key] = value;
      }
      await setAppState(FLAGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silent fail
    }
  }
}

// Singleton export
export const featureFlags = FeatureFlagsService.getInstance();

// Convenience function
export async function isFeatureEnabled(flag: FeatureFlagKey | FeatureFlagId): Promise<boolean> {
  await featureFlags.initialize();
  return featureFlags.isEnabled(flag);
}

// Sync check (after initialization)
export function isFeatureEnabledSync(flag: FeatureFlagKey | FeatureFlagId): boolean {
  return featureFlags.isEnabled(flag);
}
