/**
 * SERVICE — Analytics Opt-Out (Phase 19 — Legal Compliance)
 *
 * Controls whether non-essential analytics are emitted.
 * Persisted in app_state. Reads are synchronous (cached flag).
 *
 * When opted out:
 *   - logEvent() skips PostHog + SQLite telemetry writes for non-critical events
 *   - UserStateEngine behavioral profiling continues (needed for workout logic)
 *     but profiling results are NOT sent to PostHog
 *   - Critical events (crashes, errors) are ALWAYS logged regardless
 *
 * Usage:
 *   import { isAnalyticsEnabled, setAnalyticsEnabled } from './analyticsOptOut';
 *   if (!isAnalyticsEnabled()) return; // gate non-essential
 */

import { getAppState, setAppState } from '../database/service';

// ============================================
// STATE
// ============================================

const OPT_OUT_KEY = 'analytics_opt_out';
let _optedOut = false;
let _initialized = false;

// ============================================
// PUBLIC API
// ============================================

/** Returns true if analytics are enabled (user has NOT opted out). */
export function isAnalyticsEnabled(): boolean {
  return !_optedOut;
}

/** Set analytics enabled/disabled. Persists to SQLite. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  _optedOut = !enabled;
  await setAppState(OPT_OUT_KEY, _optedOut ? '1' : '0');
}

/** Load persisted opt-out state from SQLite. Call once on app start. */
export async function initAnalyticsOptOut(): Promise<void> {
  if (_initialized) return;
  try {
    const val = await getAppState(OPT_OUT_KEY);
    _optedOut = val === '1';
  } catch {
    _optedOut = false;
  }
  _initialized = true;
}

// ============================================
// EVENT CLASSIFICATION
// ============================================

/** Critical events that are ALWAYS logged regardless of opt-out. */
const CRITICAL_PREFIXES = [
  'app_crash',
  'app_error',
  'FATAL:',
  'perf_app_launch',
  'app_launch',
] as const;

/** Returns true if this event should be logged even when opted out. */
export function isCriticalEvent(eventName: string): boolean {
  return CRITICAL_PREFIXES.some((p) => eventName.startsWith(p));
}
