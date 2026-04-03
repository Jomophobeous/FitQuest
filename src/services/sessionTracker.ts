/**
 * SERVICE — Session Tracker (Block Y)
 *
 * Tracks app session duration and actions per session.
 * Session = foreground period between app open → background/close.
 *
 * All events logged through existing logEvent().
 * No timers. Uses AppState transitions detected by caller.
 */

import { logEvent } from './telemetry';
import { getAppState, setAppState } from '../database/service';

// ============================================
// STATE
// ============================================

let _sessionStart: number | null = null;
let _actionCount = 0;
let _screenViews = 0;

// ============================================
// SESSION LIFECYCLE
// ============================================

/**
 * Mark session start. Call on app foreground.
 */
export function startSession(): void {
  _sessionStart = Date.now();
  _actionCount = 0;
  _screenViews = 0;
}

/**
 * Record a user action within the current session.
 * Call from InteractionManager.execute().
 */
export function recordAction(): void {
  _actionCount += 1;
}

/**
 * Record a screen view within the current session.
 */
export function recordScreenView(): void {
  _screenViews += 1;
}

/**
 * End session and log metrics. Call on app background.
 * Returns session duration in ms, or null if no active session.
 */
export async function endSession(): Promise<number | null> {
  if (!_sessionStart) return null;

  const durationMs = Date.now() - _sessionStart;
  const durationMinutes = Math.round(durationMs / 60000);

  void logEvent('session_ended', {
    duration_ms: durationMs,
    duration_minutes: durationMinutes,
    action_count: _actionCount,
    screen_views: _screenViews,
    timestamp: Date.now(),
  });

  // Persist for metrics aggregation
  try {
    const todayKey = `session.${new Date().toISOString().split('T')[0]}`;
    const existing = await getAppState(todayKey).catch(() => null);
    const parsed = existing ? JSON.parse(existing) : { count: 0, totalMs: 0, totalActions: 0 };
    parsed.count += 1;
    parsed.totalMs += durationMs;
    parsed.totalActions += _actionCount;
    await setAppState(todayKey, JSON.stringify(parsed));
  } catch {}

  _sessionStart = null;
  _actionCount = 0;
  _screenViews = 0;

  return durationMs;
}

/**
 * Get current session duration in ms (for in-session decisions).
 * Returns 0 if no active session.
 */
export function getSessionDurationMs(): number {
  if (!_sessionStart) return 0;
  return Date.now() - _sessionStart;
}

/**
 * Get current action count for session length optimization.
 */
export function getSessionActionCount(): number {
  return _actionCount;
}

/**
 * Check if current session is "short" (< 2 min, < 3 actions).
 * Use to decide whether to push quick wins vs deeper flows.
 */
export function isShortSession(): boolean {
  if (!_sessionStart) return true;
  return getSessionDurationMs() < 120_000 && _actionCount < 3;
}
