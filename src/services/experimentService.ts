/**
 * SERVICE — Experiment System (Block AB)
 *
 * Controlled A/B testing using existing featureFlags infrastructure.
 * No new storage. Variant assignment persisted in app_state.
 * All experiments tracked through logEvent().
 *
 * Usage:
 *   const variant = await getExperimentVariant('onboarding_length');
 *   // variant === 'short' | 'full' | 'control'
 *
 *   logExperimentExposure('onboarding_length', variant);
 *   logExperimentConversion('onboarding_length', variant, 'completed_onboarding');
 */

import { logEvent } from './telemetry';
import { getAppState, setAppState } from '../database/service';

// ============================================
// TYPES
// ============================================

export interface Experiment {
  id: string;
  variants: string[];
  /** Weight distribution (must sum to 1). Default: equal distribution. */
  weights?: number[];
  /** Whether the experiment is active */
  active: boolean;
}

// ============================================
// EXPERIMENT REGISTRY
// ============================================

/**
 * All experiments defined here. Add new experiments as needed.
 * Variants are assigned deterministically on first access.
 */
const EXPERIMENTS: Record<string, Experiment> = {
  onboarding_length: {
    id: 'onboarding_length',
    variants: ['control', 'short'],
    weights: [0.5, 0.5],
    active: true,
  },
  paywall_timing: {
    id: 'paywall_timing',
    variants: ['control', 'delayed', 'early_light'],
    weights: [0.34, 0.33, 0.33],
    active: true,
  },
  dashboard_cta: {
    id: 'dashboard_cta',
    variants: ['control', 'aggressive', 'minimal'],
    weights: [0.34, 0.33, 0.33],
    active: true,
  },
};

// ============================================
// CORE
// ============================================

const VARIANT_PREFIX = 'experiment.variant.';

/**
 * Get the assigned variant for an experiment.
 * Assigns on first call (sticky). Returns 'control' if experiment doesn't exist.
 */
export async function getExperimentVariant(experimentId: string): Promise<string> {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment || !experiment.active) return 'control';

  // Check for existing assignment
  const existing = await getAppState(`${VARIANT_PREFIX}${experimentId}`).catch(() => null);
  if (existing && experiment.variants.includes(existing)) return existing;

  // Assign variant using weighted random (crypto not needed for A/B)
  const variant = weightedSelect(experiment.variants, experiment.weights);
  await setAppState(`${VARIANT_PREFIX}${experimentId}`, variant);

  void logEvent('experiment_assigned', {
    experiment_id: experimentId,
    variant,
    timestamp: Date.now(),
  });

  return variant;
}

/**
 * Log that a user was exposed to an experiment variant (saw the UI).
 * Call when the variant-specific UI is rendered.
 */
export function logExperimentExposure(experimentId: string, variant: string): void {
  void logEvent('experiment_exposure', {
    experiment_id: experimentId,
    variant,
    timestamp: Date.now(),
  });
}

/**
 * Log a conversion event for an experiment.
 * Call when the user completes the target action.
 */
export function logExperimentConversion(experimentId: string, variant: string, conversionEvent: string): void {
  void logEvent('experiment_conversion', {
    experiment_id: experimentId,
    variant,
    conversion_event: conversionEvent,
    timestamp: Date.now(),
  });
}

/**
 * Get all current experiment assignments for this user.
 */
export async function getAllAssignments(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const id of Object.keys(EXPERIMENTS)) {
    result[id] = await getExperimentVariant(id);
  }
  return result;
}

// ============================================
// HELPERS
// ============================================

function weightedSelect(variants: string[], weights?: number[]): string {
  if (!weights || weights.length !== variants.length) {
    // Equal distribution
    return variants[Math.floor(Math.random() * variants.length)]!;
  }

  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!;
    if (r < cumulative) return variants[i]!;
  }
  return variants[variants.length - 1]!;
}
